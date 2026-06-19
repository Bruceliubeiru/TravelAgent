const {
  RESULT_PAGE,
  buildPlanFromPrompt,
  buildPurchaseTarget,
  generateTripPlan,
  getTicketBySku,
  getTripTicket,
  normalizeCity,
  normalizeDays,
  normalizeType,
  parseUserPrompt,
  recommendPoi,
} = require("./travel-data");
const { getRuntimeConfig, isCloudCallable } = require("./runtime-config");

const STORAGE_KEYS = {
  latestPlan: "travelagent.latestPlan",
  selectedTicket: "travelagent.selectedTicket",
  latestEvents: "travelagent.latestEvents",
};

function getCloudFunctionName() {
  const config = getRuntimeConfig();
  return (config.cloud && config.cloud.functionName) || "travelGateway";
}

function buildFallbackWarning(err, prefix) {
  const reason = err && err.message ? err.message : "云端能力暂不可用";
  return `${prefix}，已切换为本地稳定兜底：${reason}`;
}

function saveLatestPlan(plan) {
  wx.setStorageSync(STORAGE_KEYS.latestPlan, plan);
}

function getLatestPlan() {
  return wx.getStorageSync(STORAGE_KEYS.latestPlan) || null;
}

function saveSelectedTicket(ticket) {
  wx.setStorageSync(STORAGE_KEYS.selectedTicket, ticket);
}

function getSelectedTicket() {
  return wx.getStorageSync(STORAGE_KEYS.selectedTicket) || null;
}

function saveEventLocally(event) {
  const list = wx.getStorageSync(STORAGE_KEYS.latestEvents) || [];
  const next = [event].concat(list).slice(0, 30);
  wx.setStorageSync(STORAGE_KEYS.latestEvents, next);
}

function sanitizePlan(plan, fallbackPlan) {
  if (!plan || !plan.title) {
    return fallbackPlan;
  }
  return {
    ...fallbackPlan,
    ...plan,
    source: plan.source === "agent" ? "agent" : fallbackPlan.source,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : fallbackPlan.warnings,
    tickets: Array.isArray(plan.tickets) ? plan.tickets : fallbackPlan.tickets,
    pois: Array.isArray(plan.pois) ? plan.pois : fallbackPlan.pois,
    itinerary: Array.isArray(plan.itinerary) ? plan.itinerary : fallbackPlan.itinerary,
    resultPage: plan.resultPage || RESULT_PAGE,
  };
}

function sanitizeTicket(ticket, fallbackTicket) {
  if (!ticket || !ticket.sku) {
    return fallbackTicket;
  }
  return {
    ...(fallbackTicket || {}),
    ...ticket,
    poi: ticket.poi || (fallbackTicket && fallbackTicket.poi) || null,
    purchaseTarget: ticket.purchaseTarget || (fallbackTicket && fallbackTicket.purchaseTarget) || null,
  };
}

function callTravelGateway(action, payload) {
  return new Promise((resolve, reject) => {
    if (!isCloudCallable()) {
      reject(new Error("云函数配置未完成"));
      return;
    }
    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error("当前环境未启用云开发"));
      return;
    }
    wx.cloud.callFunction({
      name: getCloudFunctionName(),
      data: { action, payload },
      success: (res) => {
        resolve((res && res.result) || {});
      },
      fail: reject,
    });
  });
}

function normalizePlannerInput(input) {
  if (typeof input === "string") {
    const parsed = parseUserPrompt(input);
    return {
      text: input,
      city: parsed.city,
      days: parsed.days,
      type: parsed.type,
    };
  }
  const text = input && input.text ? input.text : "";
  const parsed = parseUserPrompt(text);
  return {
    text,
    city: normalizeCity((input && input.city) || parsed.city || ""),
    days: normalizeDays((input && input.days) || parsed.days || 2),
    type: normalizeType((input && input.type) || parsed.type || "default"),
  };
}

async function trackEvent(eventName, payload = {}) {
  const event = {
    eventName,
    payload,
    clientSource: payload.clientSource || "miniprogram",
    timestamp: new Date().toISOString(),
  };
  saveEventLocally(event);
  try {
    await callTravelGateway("trackEvent", event);
  } catch (err) {
    console.info("[travelGateway.trackEvent]", eventName, err && err.message);
  }
}

async function planTrip(input) {
  const payload = normalizePlannerInput(input);
  const fallbackPlan = payload.text
    ? buildPlanFromPrompt(payload.text, payload)
    : generateTripPlan(payload.city || "上海", payload.days || 2, payload.type || "default", {
        source: "fallback",
      });
  try {
    const result = await callTravelGateway("planTrip", payload);
    const plan = sanitizePlan(result.plan || result.data || result, fallbackPlan);
    saveLatestPlan(plan);
    trackEvent("plan_trip_success", {
      city: plan.city,
      days: plan.days,
      type: plan.type,
      source: plan.source,
    });
    return plan;
  } catch (err) {
    const warnings = (fallbackPlan.warnings || []).concat(buildFallbackWarning(err, "云端规划不可用"));
    const plan = {
      ...fallbackPlan,
      source: "fallback",
      warnings,
    };
    saveLatestPlan(plan);
    trackEvent("plan_trip_fallback", {
      city: plan.city,
      days: plan.days,
      type: plan.type,
    });
    return plan;
  }
}

async function recommendPoiService(city, tag = "") {
  const fallback = recommendPoi(city, tag);
  try {
    const result = await callTravelGateway("recommendPoi", { city, tag });
    return Array.isArray(result.items) ? result.items : fallback;
  } catch (err) {
    return fallback;
  }
}

async function getTripTicketService(params = {}) {
  const fallback = params.sku ? getTicketBySku(params.sku) : getTripTicket(params.poi_id);
  try {
    const result = await callTravelGateway("getTripTicket", params);
    return sanitizeTicket(result.ticket || result.data || result, fallback);
  } catch (err) {
    return fallback;
  }
}

async function resolvePurchaseTarget(params = {}) {
  const fallbackTicket = params.sku ? getTicketBySku(params.sku) : getTripTicket(params.poi_id);
  const fallbackTarget = fallbackTicket
    ? fallbackTicket.purchaseTarget || buildPurchaseTarget(fallbackTicket, fallbackTicket.poi)
    : {
        purchaseMode: "disabled",
        buttonText: "暂不可购",
        reason: "未找到可用购买目标",
      };
  try {
    const result = await callTravelGateway("resolvePurchaseTarget", params);
    return result.purchaseTarget || result.data || fallbackTarget;
  } catch (err) {
    return fallbackTarget;
  }
}

module.exports = {
  RESULT_PAGE,
  STORAGE_KEYS,
  getLatestPlan,
  getSelectedTicket,
  planTrip,
  recommendPoiService,
  getTripTicketService,
  resolvePurchaseTarget,
  saveLatestPlan,
  saveSelectedTicket,
  trackEvent,
};
