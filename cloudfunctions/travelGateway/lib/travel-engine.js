const {
  RESULT_PAGE,
  cityMeta,
  cityAliases,
  typeConfig,
  poiCatalog,
  ticketCatalog,
  getCatalogSnapshot,
} = require("./catalog");
const {
  buildPurchaseTarget: buildPurchaseTargetFromRules,
  buildTripCityUrl: buildTripCityUrlFromRules,
  buildTripHomeUrl,
} = require("./purchase-rules");

function normalizeText(input) {
  return String(input || "").trim();
}

function normalizeCity(city = "") {
  const raw = normalizeText(city);
  if (!raw) return "";
  return cityMeta[raw] ? raw : cityAliases[raw.toLowerCase()] || cityAliases[raw] || raw;
}

function normalizeDays(days = 2) {
  const parsed = Number(days);
  if (!parsed || parsed < 1) return 2;
  return Math.min(Math.max(Math.round(parsed), 1), 3);
}

function normalizeType(type = "") {
  const raw = normalizeText(type).toLowerCase();
  if (typeConfig[raw]) return raw;
  const matched = Object.keys(typeConfig).find((key) =>
    typeConfig[key].keywords.some((keyword) => raw && raw.includes(String(keyword).toLowerCase())),
  );
  return matched || "default";
}

function extractDaysFromText(text = "") {
  const raw = normalizeText(text);
  const matched = raw.match(/([1-3])\s*(天|日|day|days)/i);
  return matched ? normalizeDays(Number(matched[1])) : 2;
}

function extractCityFromText(text = "") {
  const raw = normalizeText(text);
  const aliases = Object.keys(cityAliases).sort((a, b) => b.length - a.length);
  const hit = aliases.find((alias) => raw.toLowerCase().includes(alias.toLowerCase()));
  if (hit) return normalizeCity(hit);
  return Object.keys(cityMeta).find((city) => raw.includes(city)) || "";
}

function inferTypeFromText(text = "") {
  const raw = normalizeText(text).toLowerCase();
  const matched = ["family", "couple", "culture"].find((key) =>
    typeConfig[key].keywords.some((keyword) => raw.includes(String(keyword).toLowerCase())),
  );
  return matched || "default";
}

function parseUserPrompt(text = "") {
  const normalized = normalizeText(text);
  return {
    text: normalized,
    city: extractCityFromText(normalized),
    days: extractDaysFromText(normalized),
    type: inferTypeFromText(normalized),
  };
}

function getCityMeta(city = "") {
  return cityMeta[normalizeCity(city)] || null;
}

function isSupportedCity(city = "") {
  return Boolean(getCityMeta(city));
}

function buildTripCityUrl(city = "", keyword = "") {
  return buildTripCityUrlRaw(getCityMeta(city), keyword);
}

function getPoisByCity(city = "", tag = "") {
  const normalizedCity = normalizeCity(city);
  const normalizedTag = normalizeText(tag).toLowerCase();
  const allItems = Object.values(poiCatalog)
    .filter((poi) => poi.city === normalizedCity)
    .sort((a, b) => b.priority - a.priority);
  if (!normalizedTag) {
    return allItems;
  }

  const filtered = allItems.filter((poi) => poi.tags.some((item) => String(item).toLowerCase().includes(normalizedTag)));
  return filtered.length ? filtered : allItems;
}

function buildPoiSummary(poi) {
  return {
    poi_id: poi.poi_id,
    name: poi.name,
    city: poi.city,
    tags: poi.tags,
    reason: poi.reason,
    image: poi.image,
    audience: poi.audience,
    stay: poi.stay,
    keyword: poi.keyword,
  };
}

function buildPurchaseTarget(ticket, poi) {
  return buildPurchaseTargetRaw(ticket, poi, getCityMeta(poi && poi.city));
}

function buildTicketSummary(ticket, poi) {
  const cityConfig = getCityMeta(poi && poi.city);
  return {
    poi_id: ticket.poi_id,
    sku: ticket.sku,
    title: ticket.title,
    price: ticket.price,
    originalPrice: ticket.originalPrice,
    currency: ticket.currency,
    benefits: ticket.benefits,
    cta: ticket.cta,
    conversionScore: ticket.conversionScore,
    ticketStatus: ticket.ticketStatus,
    bookingNote: ticket.bookingNote,
    lastUpdated: ticket.priceUpdatedAt,
    priceUpdatedAt: ticket.priceUpdatedAt,
    audience: ticket.suitableFor || (poi ? poi.audience : ""),
    suitableFor: ticket.suitableFor || (poi ? poi.audience : ""),
    purchaseTarget: buildPurchaseTargetRaw(ticket, poi, cityConfig),
    catalogVersion: ticket.catalogVersion,
  };
}

function getTripTicket(params = {}) {
  const poiId = typeof params === "string" ? params : params.poi_id || "";
  const ticket = Object.values(ticketCatalog)
    .filter((item) => item.poi_id === poiId)
    .sort((a, b) => b.conversionScore - a.conversionScore)[0];
  if (!ticket) return null;
  const poi = poiCatalog[ticket.poi_id] || null;
  return {
    ...buildTicketSummary(ticket, poi),
    poi: poi ? buildPoiSummary(poi) : null,
    cityMeta: poi ? getCityMeta(poi.city) : null,
  };
}

function getTicketBySku(sku = "") {
  const ticket = ticketCatalog[sku];
  if (!ticket) return null;
  const poi = poiCatalog[ticket.poi_id] || null;
  return {
    ...buildTicketSummary(ticket, poi),
    poi: poi ? buildPoiSummary(poi) : null,
    cityMeta: poi ? getCityMeta(poi.city) : null,
  };
}

function recommendPoi(city = "", tag = "") {
  return getPoisByCity(city, tag).map((poi) => {
    const ticket = getTripTicket(poi.poi_id);
    return { ...buildPoiSummary(poi), ticket };
  });
}

function buildUnsupportedPlan(city = "", days = 2, type = "default") {
  const normalizedCity = normalizeText(city) || "该目的地";
  return {
    title: `${normalizedCity} 暂未开放自动规划`,
    city: normalizedCity,
    days: normalizeDays(days),
    type: normalizeType(type),
    itinerary: [],
    pois: [],
    tickets: [],
    source: "fallback",
    warnings: ["当前仅支持上海、东京、新加坡三座城市，可先从这三座城市开始验证闭环。"],
    generatedAt: new Date().toISOString(),
    resultPage: RESULT_PAGE,
    conversionNote: "暂未生成真实景点和门票，请切换到支持城市继续体验。",
  };
}

function generateTripPlan(city = "上海", days = 2, type = "default", options = {}) {
  const normalizedCity = normalizeCity(city) || "上海";
  const normalizedDays = normalizeDays(days);
  const normalizedType = normalizeType(type);
  const warnings = Array.isArray(options.warnings) ? options.warnings.slice() : [];
  const source = options.source === "agent" ? "agent" : "fallback";

  if (!isSupportedCity(normalizedCity)) {
    return buildUnsupportedPlan(city, normalizedDays, normalizedType);
  }

  const pois = recommendPoi(normalizedCity, options.tag || "");
  const dayThemes = (typeConfig[normalizedType] || typeConfig.default).dayThemes;
  const itinerary = Array.from({ length: normalizedDays }).map((_, index) => {
    const primary = pois[index % pois.length];
    const secondary = pois[(index + 1) % pois.length];
    return {
      day: index + 1,
      theme: dayThemes[index] || dayThemes[dayThemes.length - 1],
      summary: `第 ${index + 1} 天优先围绕 ${primary ? primary.name : normalizedCity} 展开，兼顾 ${secondary ? secondary.name : "城市地标"}，减少跨区折返。`,
      pois: [primary, secondary].filter(Boolean).map((poi) => ({
        poi_id: poi.poi_id,
        name: poi.name,
        reason: poi.reason,
        tags: poi.tags,
        stay: poi.stay,
      })),
    };
  });

  return {
    title: `${normalizedCity}${normalizedDays}天旅行计划`,
    city: normalizedCity,
    days: normalizedDays,
    type: normalizedType,
    itinerary,
    pois: pois.map((poi) => {
      const { ticket, ...rest } = poi;
      return rest;
    }),
    tickets: pois.map((poi) => poi.ticket).filter(Boolean),
    source,
    warnings,
    generatedAt: new Date().toISOString(),
    resultPage: RESULT_PAGE,
    conversionNote: "景点排序优先考虑转化率、线路顺滑度和大众决策成本；实时价格与库存请以 Trip 页面为准。",
  };
}

function buildPlanFromPrompt(text = "", overrides = {}) {
  const parsed = parseUserPrompt(text);
  const city = overrides.city || parsed.city;
  const days = overrides.days || parsed.days;
  const type = overrides.type || parsed.type;
  const warnings = [];
  if (!city) {
    warnings.push("未从文本中识别到目的地，已使用默认支持城市示例。");
  }
  return generateTripPlan(city || "上海", days || 2, type || "default", { source: "fallback", warnings });
}

function tryAgentPlan(payload = {}) {
  const botId = normalizeText(process.env.TRAVEL_AGENT_BOT_ID || "");
  const mode = String(process.env.TRAVEL_AGENT_MODE || "").toLowerCase();
  if (!botId || (mode !== "mock" && mode !== "enabled")) {
    return null;
  }

  const plan = payload.text
    ? buildPlanFromPrompt(payload.text, payload)
    : generateTripPlan(payload.city || "上海", payload.days || 2, payload.type || "default", { source: "agent" });

  return {
    ...plan,
    source: "agent",
    warnings:
      mode === "mock"
        ? (plan.warnings || []).concat("当前为 Agent 模拟输出，请在正式环境接入真实微信 Agent。")
        : plan.warnings || [],
  };
}

function buildTripCityUrlRaw(cityConfig, keyword = "") {
  return buildTripCityUrlFromRules(cityConfig, keyword);
}

function buildPurchaseTargetRaw(ticket, poi, cityConfig) {
  return buildPurchaseTargetFromRules(ticket, poi, cityConfig);
}

module.exports = {
  RESULT_PAGE,
  cityMeta,
  poiCatalog,
  ticketCatalog,
  normalizeCity,
  normalizeDays,
  normalizeType,
  isSupportedCity,
  parseUserPrompt,
  buildTripCityUrl,
  buildTripHomeUrl,
  buildPurchaseTarget,
  buildPlanFromPrompt,
  generateTripPlan,
  recommendPoi,
  getTripTicket,
  getTicketBySku,
  tryAgentPlan,
  getCatalogSnapshot,
};
