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

function buildDiagnostic(level, title, detail, action = "") {
  return {
    level,
    title,
    detail,
    action,
  };
}

function compareVersions(version1 = "", version2 = "") {
  const v1Parts = String(version1)
    .split(".")
    .map((item) => Number(item || 0));
  const v2Parts = String(version2)
    .split(".")
    .map((item) => Number(item || 0));
  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = v1Parts[index] || 0;
    const right = v2Parts[index] || 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function getClientCapabilities() {
  try {
    const appBaseInfo = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};
    const sdkVersion = appBaseInfo.SDKVersion || "";
    const aiRuntimeReady = Boolean(
      sdkVersion &&
        compareVersions(sdkVersion, "3.7.7") >= 0 &&
        wx.cloud &&
        wx.cloud.extend &&
        wx.cloud.extend.AI,
    );
    return {
      sdkVersion,
      aiRuntimeReady,
    };
  } catch (err) {
    return {
      sdkVersion: "",
      aiRuntimeReady: false,
    };
  }
}

function isAgentV2BotId(botId = "") {
  return String(botId || "")
    .trim()
    .toLowerCase()
    .startsWith("agent");
}

function getAgentDiagnostics(runtimeConfig = getRuntimeConfig(), capabilities = getClientCapabilities()) {
  const cloud = (runtimeConfig && runtimeConfig.cloud) || {};
  const agent = (runtimeConfig && runtimeConfig.agent) || {};
  const client = capabilities || getClientCapabilities();
  const diagnostics = [];
  const cloudConfigured = Boolean(cloud.envId && cloud.functionName);
  const agentEnabled = Boolean(agent.enabled);
  const botId = String(agent.botId || "").trim();
  const botIdConfigured = Boolean(botId);
  const sdkVersion = client.sdkVersion || "";
  const sdkSupported = Boolean(sdkVersion && compareVersions(sdkVersion, "3.7.7") >= 0);
  const aiRuntimeReady = Boolean(client.aiRuntimeReady);
  const agentV2 = isAgentV2BotId(botId);

  if (!cloudConfigured) {
    diagnostics.push(
      buildDiagnostic(
        "degraded",
        "云函数环境未就绪",
        "尚未同时填写 cloud.envId 和 cloud.functionName，结构化规划会直接回退到本地 fallback。",
        "在 miniprogram/config/runtime.js 的当前环境里补齐 cloud.envId，并确认 functionName=travelGateway。",
      ),
    );
  }

  if (!agentEnabled) {
    diagnostics.push(
      buildDiagnostic(
        "fallback",
        "Agent 开关仍关闭",
        "当前 agent.enabled=false，聊天与结构化规划都不会进入真实 Agent 链路。",
        "在 miniprogram/config/runtime.js 对应环境把 agent.enabled 改为 true，再重新预览。",
      ),
    );
  }

  if (!botIdConfigured) {
    diagnostics.push(
      buildDiagnostic(
        "degraded",
        "缺少 Agent botId",
        "没有可用 botId 时，首页和聊天页都会稳定回退到 fallback。",
        "将新的微信 Agent botId 填入 runtime 配置；如果暂时没有，保留 fallback 也能继续联调 Trip 闭环。",
      ),
    );
  } else if (!agentV2) {
    diagnostics.push(
      buildDiagnostic(
        "fallback",
        "当前 botId 仍是旧版会话 Bot",
        "旧版 Bot 仍可用于聊天面板，但结构化 planTrip 不会走客户端 Agent 增强。",
        "切换成以 agent 开头的 Agent V2 botId，才能让 planTrip 进入真实 Agent 优先链路。",
      ),
    );
  }

  if (!sdkSupported) {
    diagnostics.push(
      buildDiagnostic(
        "degraded",
        "基础库版本不足",
        sdkVersion
          ? `当前 SDKVersion=${sdkVersion}，低于微信 AI 能力所需的 3.7.7。`
          : "当前未读到有效 SDKVersion，无法确认微信 AI 能力是否可用。",
        "请在微信开发者工具和真机微信中升级到较新的基础库后，再验证 Agent 真链路。",
      ),
    );
  } else if (!aiRuntimeReady) {
    diagnostics.push(
      buildDiagnostic(
        "degraded",
        "客户端 AI 运行时不可用",
        "虽然基础库版本看起来满足条件，但 wx.cloud.extend.AI 当前不可用，结构化规划会继续 fallback。",
        "请确认在微信环境中打开、已初始化云能力，并在真机或开发者工具中检查 AI 扩展是否可访问。",
      ),
    );
  }

  if (agentEnabled && botIdConfigured && cloudConfigured && aiRuntimeReady && agentV2) {
    diagnostics.push(
      buildDiagnostic(
        "ready",
        "客户端 Agent V2 已满足联调前置条件",
        "当前配置已允许 planTrip 优先走客户端 Agent 增强，若仍回退，请重点检查 Agent 输出 JSON 是否合规。",
        "继续验证首页生成、聊天页生成、结果页打开是否都保持同一份 planId。",
      ),
    );
  } else if (agentEnabled && botIdConfigured && cloudConfigured && aiRuntimeReady && !agentV2) {
    diagnostics.push(
      buildDiagnostic(
        "fallback",
        "聊天 Agent 可用，结构化规划仍兜底",
        "当前配置允许聊天页继续使用旧版 Bot，但首页/结果页不会走真实 Agent。",
        "若希望结构化规划也使用 Agent，请切到 Agent V2 botId。",
      ),
    );
  }

  return diagnostics;
}

function getIntegrationStatus(config = getRuntimeConfig(), capabilities = getClientCapabilities()) {
  const runtimeConfig = config || PUBLIC_RUNTIME_CONFIG;
  const cloud = runtimeConfig.cloud || {};
  const agent = runtimeConfig.agent || {};
  const trip = runtimeConfig.trip || {};
  const product = runtimeConfig.product || {};
  const client = capabilities || getClientCapabilities();
  const supportedCities = Array.isArray(product.supportedCities) ? product.supportedCities : [];
  const cloudConfigured = Boolean(cloud.envId && cloud.functionName);
  const cloudCallable = cloudConfigured;
  const botIdConfigured = Boolean(agent.botId);
  const chatAgentReady = Boolean(agent.enabled && botIdConfigured && cloudConfigured && client.aiRuntimeReady);
  const planAgentReady = Boolean(chatAgentReady && isAgentV2BotId(agent.botId));
  const agentConfigured = chatAgentReady;
  const tripWebviewReady = Boolean(trip.domain && trip.homeUrl && trip.locale && trip.currency);
  const agentDiagnostics = getAgentDiagnostics(runtimeConfig, client);

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

  const planStatus = planAgentReady
    ? buildStatusCard(
        "ready",
        "AI 规划优先走客户端 Agent",
        "planTrip 会先调用客户端 Agent V2 生成结构化文案，再沿用云端目录与票券真源自动兜底。",
      )
    : chatAgentReady
      ? buildStatusCard(
          "fallback",
          "聊天 Agent 已就绪，规划仍走稳定兜底",
          "当前 botId 仍是旧版会话 Bot，可继续用于聊天面板；结构化 planTrip 继续走稳定 fallback。",
        )
      : botIdConfigured
        ? buildStatusCard(
            "fallback",
            "当前默认稳定兜底规划",
            client.aiRuntimeReady
              ? "botId 已填写，但 Agent 或云环境未完整打通，当前仍以 fallback 规划器为主。"
              : "当前客户端 AI 运行环境未就绪，结构化规划会稳定回退到本地模板规划器。",
          )
    : buildStatusCard(
        "fallback",
        "当前默认稳定兜底规划",
        "未检测到完整 Agent 配置，当前会稳定回退到本地模板规划器。",
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
    chatAgentReady,
    planAgentReady,
    agentConfigured,
    tripWebviewReady,
    sdkVersion: client.sdkVersion || "",
    aiRuntimeReady: Boolean(client.aiRuntimeReady),
    supportedCities,
    agentDiagnostics,
    integrationStatus,
    planStatus,
    purchaseStatus,
  };
}

function hasAgentAccess() {
  return Boolean(getIntegrationStatus().chatAgentReady);
}

function isCloudCallable() {
  return Boolean(getIntegrationStatus().cloudCallable);
}

module.exports = {
  PUBLIC_RUNTIME_CONFIG,
  compareVersions,
  getAgentDiagnostics,
  getClientCapabilities,
  getRuntimeConfig,
  getIntegrationStatus,
  hasAgentAccess,
  isAgentV2BotId,
  isCloudCallable,
};
