const {
  RESULT_PAGE,
  cityMeta,
  cityAliases,
  typeConfig,
  poiCatalog,
  ticketCatalog,
  purchaseRules,
  getCatalogSnapshot,
} = require("./travel-fallback-catalog");

function normalizeText(input) {
  return String(input || "").trim();
}

function resolveButtonText(ticket, fallback = purchaseRules.defaultButtonText) {
  const cta = normalizeText(ticket && ticket.cta);
  if (!cta || cta.includes("查看 Trip")) {
    return fallback;
  }
  return cta;
}

function normalizeCity(city = "") {
  const raw = normalizeText(city);
  if (!raw) return "";
  return cityMeta[raw] ? raw : cityAliases[raw.toLowerCase()] || cityAliases[raw] || raw;
}

function isSupportedCity(city = "") {
  return Boolean(cityMeta[normalizeCity(city)]);
}

function normalizeDays(days = 2) {
  const parsed = Number(days);
  if (!parsed || parsed < 1) return 2;
  return Math.min(Math.max(Math.round(parsed), 1), 3);
}

function normalizeType(type = "") {
  const raw = normalizeText(type).toLowerCase();
  if (typeConfig[raw]) return raw;
  const keys = Object.keys(typeConfig);
  const matched = keys.find((key) =>
    typeConfig[key].keywords.some((keyword) => raw && raw.includes(String(keyword).toLowerCase())),
  );
  return matched || "default";
}

function inferTypeFromText(text = "") {
  const raw = normalizeText(text).toLowerCase();
  const keys = ["family", "couple", "culture"];
  const matched = keys.find((key) =>
    typeConfig[key].keywords.some((keyword) => raw.includes(String(keyword).toLowerCase())),
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
  const exact = Object.keys(cityMeta).find((city) => raw.includes(city));
  return exact || "";
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

function buildTripHomeUrl() {
  return purchaseRules.tripHomeUrl;
}

function buildTripCityUrl(city = "", keyword = "") {
  const meta = getCityMeta(city);
  if (!meta) return buildTripHomeUrl();
  const query = [
    `citytype=${encodeURIComponent(purchaseRules.cityQuery.citytype)}`,
    `currency=${encodeURIComponent(meta.currency || purchaseRules.defaultCurrency)}`,
    `id=${encodeURIComponent(meta.tripCityId)}`,
    `locale=${encodeURIComponent(meta.locale || purchaseRules.defaultLocale)}`,
    `pagetype=${encodeURIComponent(purchaseRules.cityQuery.pagetype)}`,
    `pshowcode=${encodeURIComponent(purchaseRules.cityQuery.pshowcode)}`,
  ];
  if (normalizeText(keyword)) {
    query.push(`keyword=${encodeURIComponent(normalizeText(keyword))}`);
  }
  return `${purchaseRules.tripDomain}/things-to-do/list/?${query.join("&")}`;
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

function buildPurchaseTarget(ticket, poi) {
  if (!ticket || !poi) {
    return {
      purchaseMode: "disabled",
      buttonText: "暂不可购",
      reason: "缺少可用门票配置",
    };
  }

  const cityUrl = buildTripCityUrl(poi.city);
  const keyword = normalizeText(ticket.keyword || poi.keyword || ticket.title);
  const keywordUrl = keyword ? buildTripCityUrl(poi.city, keyword) : cityUrl;
  if (ticket.ticketStatus === "unavailable") {
    return {
      purchaseMode: "disabled",
      buttonText: "暂不可购",
      reason: "当前门票状态不可售，请稍后再试",
      url: keywordUrl,
      fallbackUrl: cityUrl,
    };
  }

  if (ticket.miniProgram && ticket.miniProgram.appId && ticket.miniProgram.path) {
    return {
      purchaseMode: "miniProgram",
      url: ticket.detailUrl || keywordUrl,
      fallbackUrl: keywordUrl || cityUrl,
      buttonText: resolveButtonText(ticket),
      reason: "已命中 Trip 小程序承接配置，可优先在小程序继续确认价格与完成预订。",
      appId: ticket.miniProgram.appId,
      path: ticket.miniProgram.path,
      extraData: ticket.miniProgram.extraData || {},
    };
  }

  if (normalizeText(ticket.detailUrl)) {
    return {
      purchaseMode: "webView",
      url: ticket.detailUrl,
      fallbackUrl: keywordUrl || cityUrl,
      buttonText: resolveButtonText(ticket),
      reason: "已打开 Trip 详情承接页，可继续确认最新价格、库存并完成预订。",
    };
  }

  return {
    purchaseMode: "webView",
    url: keywordUrl,
    fallbackUrl: cityUrl,
    buttonText: resolveButtonText(ticket),
    provider: "Trip",
    locale: "ja_jp",
    currency: "JPY",
    reason: keyword
      ? "已跳转到 Trip 关键词承接页，可继续查看最新可售产品与价格并完成预订。"
      : "已跳转到 Trip 城市活动页，可继续查看最新可售产品与价格并完成预订。",
  };
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

function buildTicketSummary(ticket, poi) {
  return {
    poi_id: ticket.poi_id,
    sku: ticket.sku,
    title: ticket.title,
    price: ticket.price,
    originalPrice: ticket.originalPrice,
    currency: ticket.currency,
    priceType: ticket.priceType || "reference",
    benefits: ticket.benefits,
    cta: ticket.cta,
    conversionScore: ticket.conversionScore,
    ticketStatus: ticket.ticketStatus,
    bookingNote: ticket.bookingNote,
    lastUpdated: ticket.priceUpdatedAt,
    priceUpdatedAt: ticket.priceUpdatedAt,
    audience: ticket.suitableFor || (poi ? poi.audience : ""),
    suitableFor: ticket.suitableFor || (poi ? poi.audience : ""),
    purchaseTarget: buildPurchaseTarget(ticket, poi),
    catalogVersion: ticket.catalogVersion,
  };
}

function getTripTicket(params = "") {
  const poiId = typeof params === "string" ? params : params.poi_id || "";
  const ticket = Object.values(ticketCatalog)
    .filter((item) => item.poi_id === poiId)
    .sort((a, b) => b.conversionScore - a.conversionScore)[0];
  if (!ticket) return null;
  const poi = poiCatalog[ticket.poi_id] || null;
  return {
    ...buildTicketSummary(ticket, poi),
    poi: poi ? buildPoiSummary(poi) : null,
  };
}

function getTicketBySku(sku = "") {
  const ticket = ticketCatalog[sku];
  if (!ticket) return null;
  const poi = poiCatalog[ticket.poi_id] || null;
  return {
    ...buildTicketSummary(ticket, poi),
    poi: poi ? buildPoiSummary(poi) : null,
  };
}

function recommendPoi(city = "", tag = "") {
  return getPoisByCity(city, tag).map((poi) => {
    const ticket = getTripTicket(poi.poi_id);
    return {
      ...buildPoiSummary(poi),
      ticket,
    };
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

  const config = typeConfig[normalizedType] || typeConfig.default;
  const pois = recommendPoi(normalizedCity, options.tag || "");
  const itinerary = Array.from({ length: normalizedDays }).map((_, index) => {
    const primary = pois[index % pois.length];
    const secondary = pois[(index + 1) % pois.length];
    return {
      day: index + 1,
      theme: config.dayThemes[index] || config.dayThemes[config.dayThemes.length - 1],
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
    conversionNote: "景点排序优先考虑转化率、线路顺滑度和大众决策成本；卡片价格为目录参考价，最新价格与库存请以 Trip 下单页为准。",
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
  return generateTripPlan(city || "上海", days || 2, type || "default", {
    source: "fallback",
    warnings,
  });
}

function getTypeLabel(type = "default") {
  return (typeConfig[normalizeType(type)] || typeConfig.default).label;
}

module.exports = {
  CITY_META: cityMeta,
  CITY_ALIASES: cityAliases,
  TYPE_CONFIG: typeConfig,
  POIS: Object.values(poiCatalog),
  TICKETS: Object.values(ticketCatalog),
  cityMeta,
  cityAliases,
  typeConfig,
  poiCatalog,
  ticketCatalog,
  RESULT_PAGE,
  normalizeCity,
  normalizeDays,
  normalizeType,
  isSupportedCity,
  parseUserPrompt,
  buildTripHomeUrl,
  buildTripCityUrl,
  buildPurchaseTarget,
  buildPlanFromPrompt,
  generateTripPlan,
  recommendPoi,
  getTripTicket,
  getTicketBySku,
  getTypeLabel,
  getCatalogSnapshot,
};
