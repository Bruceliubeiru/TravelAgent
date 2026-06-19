const { ACTIVE_RUNTIME_ENV, PUBLIC_RUNTIME_CONFIG } = require("../config/runtime");

function getRuntimeConfig() {
  try {
    const app = getApp();
    return (app && app.globalData && app.globalData.runtimeConfig) || PUBLIC_RUNTIME_CONFIG;
  } catch (err) {
    return PUBLIC_RUNTIME_CONFIG;
  }
}

function buildStatusCard(level, title, detail) {
  return {
    level,
    title,
    detail,
  };
}

function getIntegrationStatus(config = getRuntimeConfig()) {
  const runtimeConfig = config || PUBLIC_RUNTIME_CONFIG;
  const cloud = runtimeConfig.cloud || {};
  const agent = runtimeConfig.agent || {};
  const trip = runtimeConfig.trip || {};
  const product = runtimeConfig.product || {};
  const supportedCities = Array.isArray(product.supportedCities) ? product.supportedCities : [];
  const cloudConfigured = Boolean(cloud.envId && cloud.functionName);
  const cloudCallable = cloudConfigured;
  const botIdConfigured = Boolean(agent.botId);
  const agentConfigured = Boolean(agent.enabled && botIdConfigured && cloudConfigured);
  const tripWebviewReady = Boolean(trip.domain && trip.homeUrl && trip.locale && trip.currency);

  const integrationStatus = cloudConfigured
    ? buildStatusCard(
        "ready",
        "云端主链路已配置",
        `当前环境 ${runtimeConfig.envName || ACTIVE_RUNTIME_ENV} 已指向 ${cloud.functionName}，可联调 travelGateway。`,
      )
    : buildStatusCard(
        "degraded",
        "云端配置待补齐",
        "尚未填写 cloud.envId，页面会直接切到本地稳定兜底，不会静默失败。",
      );

  const planStatus = agentConfigured
    ? buildStatusCard(
        "ready",
        "AI 规划优先走 Agent",
        "首页、聊天页和技能层会优先调用云端 + Agent，再按统一契约自动兜底。",
      )
    : buildStatusCard(
        "fallback",
        "当前默认稳定兜底规划",
        botIdConfigured
          ? "botId 已填写，但 Agent 或云环境未完整打通，当前仍以 fallback 规划器为主。"
          : "未检测到完整 Agent 配置，当前会稳定回退到本地模板规划器。",
      );

  const purchaseStatus = tripWebviewReady
    ? buildStatusCard(
        "ready",
        "Trip 承接页已就绪",
        `默认承接到 ${supportedCities.join(" / ")} 的 Trip 城市页或城市 + 关键词搜索页。`,
      )
    : buildStatusCard(
        "degraded",
        "Trip WebView 配置待补",
        "未补齐 Trip 域名时会显示明确反馈，不会把用户带到空白页。",
      );

  return {
    envName: runtimeConfig.envName || ACTIVE_RUNTIME_ENV,
    cloudConfigured,
    cloudCallable,
    botIdConfigured,
    agentConfigured,
    tripWebviewReady,
    supportedCities,
    integrationStatus,
    planStatus,
    purchaseStatus,
  };
}

function hasAgentAccess() {
  return Boolean(getIntegrationStatus().agentConfigured);
}

function isCloudCallable() {
  return Boolean(getIntegrationStatus().cloudCallable);
}

module.exports = {
  PUBLIC_RUNTIME_CONFIG,
  getRuntimeConfig,
  getIntegrationStatus,
  hasAgentAccess,
  isCloudCallable,
};
