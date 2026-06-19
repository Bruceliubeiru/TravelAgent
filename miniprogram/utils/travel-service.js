const {
  RESULT_PAGE,
  buildPlanFromPrompt,
  buildPurchaseTarget,
  generateTripPlan,
  getTicketBySku,
  getTripTicket,
  getTypeLabel,
  normalizeCity,
  normalizeDays,
  normalizeType,
  parseUserPrompt,
  recommendPoi,
} = require("./travel-data");
const { runClientAgentPlan } = require("./agent-plan-adapter");
const { getRuntimeConfig, getIntegrationStatus, isCloudCallable } = require("./runtime-config");

const PLAN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PLAN_SNAPSHOTS = 20;

const STORAGE_KEYS = {
  latestPlanId: "travelagent.latestPlanId",
  plansById: "travelagent.plansById",
  selectedTicket: "travelagent.selectedTicket",
  latestEvents: "travelagent.latestEvents",
};

function normalizeText(input = "") {
  return String(input || "").trim();
}

function mergeWarnings(list = []) {
  return Array.from(
    new Set(
      list
        .map((item) => normalizeText(item))
        .filter(Boolean),
    ),
  );
}

function safeGetStorageSync(key, fallback = null) {
  try {
    if (typeof wx === "undefined" || !wx.getStorageSync) {
      return fallback;
    }
    const value = wx.getStorageSync(key);
    return value === undefined || value === null || value === "" ? fallback : value;
  } catch (err) {
    return fallback;
  }
}

function safeSetStorageSync(key, value) {
  try {
    if (typeof wx === "undefined" || !wx.setStorageSync) {
      return false;
    }
    wx.setStorageSync(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

function getCloudFunctionName() {
  const config = getRuntimeConfig();
  return (config.cloud && config.cloud.functionName) || "travelGateway";
}

function buildFallbackWarning(err, prefix) {
  const reason = err && err.message ? err.message : "云端能力暂不可用";
  return `${prefix}，已切换为本地稳定兜底：${reason}`;
}

function createPlanId(now = Date.now(), randomSource = Math.random) {
  const randomSuffix = Math.floor(Number(randomSource()) * 1e8)
    .toString(36)
    .padStart(5, "0");
  return `plan_${now}_${randomSuffix}`;
}

function buildPlanQuery(payload = {}) {
  const text = normalizeText(payload.text);
  if (text) {
    return text;
  }
  const city = normalizeCity(payload.city || "上海") || "上海";
  const days = normalizeDays(payload.days || 2);
  const type = normalizeType(payload.type || "default");
  return `${city}${days}天${getTypeLabel(type)}`;
}

function attachPlanIdentity(plan, payload = {}, options = {}) {
  const generatedAt = normalizeText(options.generatedAt) || normalizeText(plan && plan.generatedAt) || new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAt) || Date.now();
  return {
    ...(plan || {}),
    planId: normalizeText(options.planId) || normalizeText(plan && plan.planId) || createPlanId(generatedAtMs, options.randomSource || Math.random),
    query: normalizeText(plan && plan.query) || buildPlanQuery(payload),
    expiresAt:
      normalizeText(options.expiresAt) ||
      normalizeText(plan && plan.expiresAt) ||
      new Date(generatedAtMs + PLAN_TTL_MS).toISOString(),
    generatedAt,
    resultPage: (plan && plan.resultPage) || RESULT_PAGE,
  };
}

function isPlanExpired(plan, now = Date.now()) {
  if (!plan) {
    return false;
  }
  const expiresAtMs = Date.parse(plan.expiresAt || "");
  if (expiresAtMs) {
    return now > expiresAtMs;
  }
  const generatedAtMs = Date.parse(plan.generatedAt || "");
  return generatedAtMs ? now > generatedAtMs + PLAN_TTL_MS : false;
}

function trimPlanSnapshots(plansById = {}, maxEntries = MAX_PLAN_SNAPSHOTS) {
  const sortedPlans = Object.values(plansById)
    .filter((item) => item && item.planId)
    .sort((left, right) => {
      const rightTime = Date.parse((right && right.generatedAt) || "") || 0;
      const leftTime = Date.parse((left && left.generatedAt) || "") || 0;
      return rightTime - leftTime;
    })
    .slice(0, maxEntries);

  return sortedPlans.reduce((result, item) => {
    result[item.planId] = item;
    return result;
  }, {});
}

function savePlanSnapshot(plan, payload = {}) {
  const snapshot = attachPlanIdentity(plan, payload);
  const plansById = safeGetStorageSync(STORAGE_KEYS.plansById, {});
  const nextPlansById = trimPlanSnapshots({
    ...(plansById || {}),
    [snapshot.planId]: snapshot,
  });
  safeSetStorageSync(STORAGE_KEYS.plansById, nextPlansById);
  safeSetStorageSync(STORAGE_KEYS.latestPlanId, snapshot.planId);
  return snapshot;
}

function saveLatestPlan(plan, payload = {}) {
  return savePlanSnapshot(plan, payload);
}

function getPlansById() {
  return safeGetStorageSync(STORAGE_KEYS.plansById, {}) || {};
}

function getLatestPlanId() {
  return normalizeText(safeGetStorageSync(STORAGE_KEYS.latestPlanId, ""));
}

function getPlanById(planId = "") {
  const safePlanId = normalizeText(planId);
  if (!safePlanId) {
    return null;
  }
  const plansById = getPlansById();
  return plansById[safePlanId] || null;
}

function getLatestPlan() {
  const latestPlanId = getLatestPlanId();
  return latestPlanId ? getPlanById(latestPlanId) : null;
}

function getPlanSnapshotState(planId = "", now = Date.now()) {
  const requestedPlanId = normalizeText(planId);
  const resolvedPlanId = requestedPlanId || getLatestPlanId();
  if (!resolvedPlanId) {
    return {
      plan: null,
      planId: "",
      stale: false,
    };
  }

  const plan = getPlanById(resolvedPlanId);
  return {
    plan,
    planId: resolvedPlanId,
    stale: plan ? isPlanExpired(plan, now) : false,
  };
}

function buildResultPageUrl(planId = "") {
  const safePlanId = normalizeText(planId) || getLatestPlanId();
  return safePlanId ? `${RESULT_PAGE}?planId=${encodeURIComponent(safePlanId)}` : RESULT_PAGE;
}

function saveSelectedTicket(ticket) {
  safeSetStorageSync(STORAGE_KEYS.selectedTicket, ticket);
}

function getSelectedTicket() {
  return safeGetStorageSync(STORAGE_KEYS.selectedTicket, null);
}

function saveEventLocally(event) {
  const list = safeGetStorageSync(STORAGE_KEYS.latestEvents, []) || [];
  const next = [event].concat(Array.isArray(list) ? list : []).slice(0, 30);
  safeSetStorageSync(STORAGE_KEYS.latestEvents, next);
}

function sanitizePlan(plan, fallbackPlan) {
  if (!plan || !plan.title) {
    return fallbackPlan;
  }
  return {
    ...fallbackPlan,
    ...plan,
    source: plan.source === "agent" ? "agent" : "fallback",
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
    priceType: ticket.priceType || (fallbackTicket && fallbackTicket.priceType) || "reference",
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

function buildLocalFallbackPlan(payload) {
  return payload.text
    ? buildPlanFromPrompt(payload.text, payload)
    : generateTripPlan(payload.city || "上海", payload.days || 2, payload.type || "default", {
        source: "fallback",
      });
}

function normalizeCanonicalPlan(plan, fallbackPlan) {
  const canonicalPlan = sanitizePlan(plan, fallbackPlan);
  return {
    ...canonicalPlan,
    source: "fallback",
    warnings: Array.isArray(canonicalPlan.warnings) ? canonicalPlan.warnings : [],
  };
}

async function fetchCanonicalPlan(payload) {
  const localFallbackPlan = buildLocalFallbackPlan(payload);
  try {
    const result = await callTravelGateway("planTrip", payload);
    return {
      plan: normalizeCanonicalPlan(result.plan || result.data || result, localFallbackPlan),
      fallbackUsed: false,
    };
  } catch (err) {
    return {
      plan: {
        ...localFallbackPlan,
        source: "fallback",
        warnings: mergeWarnings([].concat(localFallbackPlan.warnings || [], buildFallbackWarning(err, "云端规划不可用"))),
      },
      fallbackUsed: true,
      error: err,
    };
  }
}

function findTicketInPlan(plan, sku = "") {
  const safeSku = normalizeText(sku);
  if (!safeSku || !plan || !Array.isArray(plan.tickets)) {
    return null;
  }
  return plan.tickets.find((item) => item && item.sku === safeSku) || null;
}

function getTicketSnapshot(params = {}) {
  const snapshot = getPlanSnapshotState(params.planId || "");
  const fallbackTicket = params.sku ? getTicketBySku(params.sku) : getTripTicket(params.poi_id);
  const ticket = snapshot.plan ? sanitizeTicket(findTicketInPlan(snapshot.plan, params.sku), fallbackTicket) : null;
  return {
    ...snapshot,
    ticket,
  };
}

function getTicketEventContext(params = {}) {
  const snapshot = getTicketSnapshot(params);
  return {
    planId: snapshot.planId || normalizeText(params.planId),
    city:
      (snapshot.ticket && snapshot.ticket.poi && snapshot.ticket.poi.city) ||
      (snapshot.plan && snapshot.plan.city) ||
      "",
    source: (snapshot.plan && snapshot.plan.source) || "fallback",
    stale: snapshot.stale,
    sku: normalizeText(params.sku || (snapshot.ticket && snapshot.ticket.sku)),
    poi_id: normalizeText(params.poi_id || (snapshot.ticket && snapshot.ticket.poi_id)),
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

async function planTrip(input, options = {}) {
  const payload = normalizePlannerInput(input);
  const runtime = options.runtimeConfig || getRuntimeConfig();
  const status = options.integrationStatus || getIntegrationStatus(runtime);
  const canonical = await fetchCanonicalPlan(payload);
  let plan = canonical.plan;

  if (options.preferAgent !== false && status.planAgentReady && Array.isArray(plan.itinerary) && plan.itinerary.length > 0) {
    try {
      plan = await runClientAgentPlan(payload, plan, {
        botId: runtime.agent && runtime.agent.botId,
        timeoutMs: options.timeoutMs,
      });
    } catch (err) {
      plan = {
        ...canonical.plan,
        source: "fallback",
        warnings: mergeWarnings([].concat(canonical.plan.warnings || [], buildFallbackWarning(err, "客户端 Agent 规划失败"))),
      };
    }
  } else {
    plan = {
      ...plan,
      source: "fallback",
    };
  }

  const snapshot = savePlanSnapshot(plan, payload);
  const eventPayload = {
    planId: snapshot.planId,
    city: snapshot.city,
    days: snapshot.days,
    type: snapshot.type,
    source: snapshot.source,
    stale: false,
  };
  trackEvent(snapshot.source === "agent" ? "plan_trip_success" : "plan_trip_fallback", eventPayload);
  return snapshot;
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
  const snapshot = getTicketSnapshot(params);
  if (snapshot.ticket) {
    return snapshot.ticket;
  }

  const fallback = params.sku ? getTicketBySku(params.sku) : getTripTicket(params.poi_id);
  try {
    const result = await callTravelGateway("getTripTicket", params);
    return sanitizeTicket(result.ticket || result.data || result, fallback);
  } catch (err) {
    return fallback;
  }
}

async function resolvePurchaseTarget(params = {}) {
  const snapshot = getTicketSnapshot(params);
  const fallbackTicket =
    snapshot.ticket || (params.sku ? getTicketBySku(params.sku) : getTripTicket(params.poi_id));
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
  PLAN_TTL_MS,
  STORAGE_KEYS,
  attachPlanIdentity,
  buildPlanQuery,
  buildResultPageUrl,
  createPlanId,
  findTicketInPlan,
  getLatestPlan,
  getLatestPlanId,
  getPlanById,
  getPlanSnapshotState,
  getSelectedTicket,
  getTicketEventContext,
  getTicketSnapshot,
  getTripTicketService,
  isPlanExpired,
  planTrip,
  recommendPoiService,
  resolvePurchaseTarget,
  saveLatestPlan,
  savePlanSnapshot,
  saveSelectedTicket,
  trackEvent,
  trimPlanSnapshots,
};
