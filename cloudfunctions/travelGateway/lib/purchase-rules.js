const { purchaseRules } = require("./catalog");

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

function buildTripHomeUrl() {
  return purchaseRules.tripHomeUrl;
}

function buildTripCityUrl(cityConfig, keyword = "") {
  if (!cityConfig) {
    return buildTripHomeUrl();
  }

  const query = [
    `citytype=${encodeURIComponent(purchaseRules.cityQuery.citytype)}`,
    `currency=${encodeURIComponent(cityConfig.currency || purchaseRules.defaultCurrency)}`,
    `id=${encodeURIComponent(cityConfig.tripCityId)}`,
    `locale=${encodeURIComponent(cityConfig.locale || purchaseRules.defaultLocale)}`,
    `pagetype=${encodeURIComponent(purchaseRules.cityQuery.pagetype)}`,
    `pshowcode=${encodeURIComponent(purchaseRules.cityQuery.pshowcode)}`,
  ];

  if (normalizeText(keyword)) {
    query.push(`keyword=${encodeURIComponent(normalizeText(keyword))}`);
  }

  return `${purchaseRules.tripDomain}/things-to-do/list/?${query.join("&")}`;
}

function buildPurchaseTarget(ticket, poi, cityConfig) {
  if (!ticket || !poi || !cityConfig) {
    return {
      purchaseMode: "disabled",
      buttonText: "暂不可购",
      reason: "缺少可用购买配置",
    };
  }

  const cityUrl = buildTripCityUrl(cityConfig);
  const keyword = normalizeText(ticket.keyword || poi.keyword || ticket.title);
  const keywordUrl = keyword ? buildTripCityUrl(cityConfig, keyword) : cityUrl;

  if (ticket.ticketStatus === "unavailable") {
    return {
      purchaseMode: "disabled",
      url: keywordUrl,
      fallbackUrl: cityUrl,
      buttonText: "暂不可购",
      reason: "当前门票暂不可购，请稍后再试",
    };
  }

  if (ticket.miniProgram && ticket.miniProgram.appId && ticket.miniProgram.path) {
    return {
      purchaseMode: "miniProgram",
      url: ticket.detailUrl || keywordUrl,
      fallbackUrl: keywordUrl || cityUrl,
      buttonText: resolveButtonText(ticket, purchaseRules.defaultButtonText),
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

  if (keyword) {
    return {
      purchaseMode: "webView",
      url: keywordUrl,
      fallbackUrl: cityUrl,
      buttonText: resolveButtonText(ticket),
      reason: "已打开 Trip 关键词承接页，可继续查看实时可售产品并完成预订。",
    };
  }

  if (cityUrl) {
    return {
      purchaseMode: "webView",
      url: cityUrl,
      fallbackUrl: buildTripHomeUrl(),
      buttonText: resolveButtonText(ticket),
      reason: "已打开 Trip 城市活动页，可继续查看该城市的实时可售产品并完成预订。",
    };
  }

  return {
    purchaseMode: "disabled",
    buttonText: "暂不可购",
    reason: "当前缺少可用的 Trip 承接配置",
  };
}

module.exports = {
  buildTripHomeUrl,
  buildTripCityUrl,
  buildPurchaseTarget,
};
