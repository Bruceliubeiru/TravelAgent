const {
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
} = require("./travel-engine");
const { persistTravelEvent } = require("./event-store");

function ok(data) {
  return {
    ok: true,
    ...data,
  };
}

function fail(message, extra = {}) {
  return {
    ok: false,
    error: message,
    ...extra,
  };
}

function normalizePayload(payload = {}) {
  const text = String(payload.text || "").trim();
  const parsed = parseUserPrompt(text);
  return {
    text,
    city: normalizeCity(payload.city || parsed.city || ""),
    days: normalizeDays(payload.days || parsed.days || 2),
    type: normalizeType(payload.type || parsed.type || "default"),
    tag: payload.tag || "",
    poi_id: payload.poi_id || "",
    sku: payload.sku || "",
  };
}

async function handlePlanTrip(payload) {
  const normalized = normalizePayload(payload);
  const plan = normalized.text
    ? buildPlanFromPrompt(normalized.text, normalized)
    : generateTripPlan(normalized.city || "上海", normalized.days || 2, normalized.type || "default", {
        source: "fallback",
      });
  return ok({ plan });
}

async function handleRecommendPoi(payload) {
  const normalized = normalizePayload(payload);
  const items = recommendPoi(normalized.city, normalized.tag);
  return ok({
    items,
    total: items.length,
  });
}

async function handleGetTripTicket(payload) {
  const normalized = normalizePayload(payload);
  if (!normalized.poi_id && !normalized.sku) {
    return fail("缺少 poi_id 或 sku", {
      ticket: null,
    });
  }

  const ticket = normalized.sku ? getTicketBySku(normalized.sku) : getTripTicket(normalized.poi_id);
  if (!ticket) {
    return fail("未找到对应门票", {
      ticket: null,
    });
  }
  return ok({ ticket });
}

async function handleResolvePurchaseTarget(payload) {
  const normalized = normalizePayload(payload);
  const ticket = normalized.sku ? getTicketBySku(normalized.sku) : getTripTicket(normalized.poi_id);
  if (!ticket) {
    return fail("缺少可用票券配置", {
      purchaseTarget: {
        purchaseMode: "disabled",
        buttonText: "暂不可购",
        reason: "未找到对应票券配置",
      },
    });
  }
  const purchaseTarget = ticket.purchaseTarget || buildPurchaseTarget(ticket, ticket.poi, ticket.cityMeta);
  return ok({ purchaseTarget });
}

async function handleTrackEvent(payload, wxContext, options = {}) {
  const result = await persistTravelEvent({
    cloudSdk: options.cloudSdk,
    payload,
    wxContext,
    logger: options.logger || console,
  });
  return ok(result);
}

async function dispatchTravelAction(action, payload, options = {}) {
  if (action === "planTrip") {
    return handlePlanTrip(payload);
  }
  if (action === "recommendPoi") {
    return handleRecommendPoi(payload);
  }
  if (action === "getTripTicket") {
    return handleGetTripTicket(payload);
  }
  if (action === "resolvePurchaseTarget") {
    return handleResolvePurchaseTarget(payload);
  }
  if (action === "trackEvent") {
    return handleTrackEvent(payload, options.wxContext || {}, options);
  }
  return fail(`Unsupported action: ${action || "unknown"}`);
}

module.exports = {
  ok,
  fail,
  normalizePayload,
  handlePlanTrip,
  handleRecommendPoi,
  handleGetTripTicket,
  handleResolvePurchaseTarget,
  handleTrackEvent,
  dispatchTravelAction,
};
