const { getIntegrationStatus, getRuntimeConfig } = require("../../utils/runtime-config");
const {
  getTripTicketService,
  planTrip,
  recommendPoiService,
  trackEvent,
} = require("../../utils/travel-service");

function formatPlanForAssistant(plan) {
  const days = (plan.itinerary || [])
    .map((day) => {
      const pois = (day.pois || []).map((poi) => poi.name).join(" / ");
      return `D${day.day} ${day.theme}: ${pois}`;
    })
    .join("\n");
  const tickets = (plan.tickets || [])
    .slice(0, 3)
    .map((ticket) => {
      const target = ticket.purchaseTarget || {};
      return `- ${ticket.title} ¥${ticket.price}，${target.buttonText || ticket.cta}: ${target.url || target.fallbackUrl || "Trip 城市页"}`;
    })
    .join("\n");
  return `${plan.title}\n${days}\n\nTrip 门票推荐:\n${tickets}\n\n结构化结果页：/pages/result/result`;
}

Page({
  data: {
    prompt: "",
    loading: false,
    statusText: "",
    fallbackMode: true,
    latestPlan: null,
    integrationStatus: null,
    planStatus: null,
    purchaseStatus: null,
    quickPrompts: ["上海亲子 2 天", "东京情侣 3 天", "新加坡文化 2 天"],
    chatMode: "bot",
    showBotAvatar: true,
    showAgentPanel: false,
    agentConfig: {
      botId: "",
      allowWebSearch: true,
      allowUploadFile: false,
      allowPullRefresh: true,
      allowUploadImage: false,
      showToolCallDetail: false,
      allowMultiConversation: true,
      allowVoice: true,
      showBotName: true,
      tools: [
        {
          name: "generate_trip_plan",
          description: "根据城市、天数和旅行类型生成结构化旅行计划，并写入最新结果页缓存。",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "目的地城市，例如上海、东京、新加坡" },
              days: { type: "number", description: "旅行天数，MVP 支持 1 到 3 天" },
              type: { type: "string", description: "旅行类型：family、couple、culture 或 default" },
            },
            required: ["city", "days"],
          },
          handler: async (params) => {
            const plan = await planTrip({
              city: params.city,
              days: params.days,
              type: params.type || "family",
            });
            return {
              ...plan,
              assistant_summary: formatPlanForAssistant(plan),
            };
          },
        },
        {
          name: "recommend_poi",
          description: "按城市和标签推荐 POI，优先返回可转化、高优先级景点。",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "目的地城市，例如上海、东京、新加坡" },
              tag: { type: "string", description: "可选偏好标签，例如亲子、夜景、文化、乐园" },
            },
            required: ["city"],
          },
          handler: (params) => recommendPoiService(params.city, params.tag),
        },
        {
          name: "get_trip_ticket",
          description: "根据 poi_id 获取 Trip 门票 SKU、价格和购买目标。",
          parameters: {
            type: "object",
            properties: {
              poi_id: { type: "string", description: "POI ID，例如 shanghai-disney" },
            },
            required: ["poi_id"],
          },
          handler: (params) => getTripTicketService({ poi_id: params.poi_id }),
        },
        {
          name: "open_trip_result",
          description: "打开最近一次 AI 生成的结构化行程结果页。",
          parameters: {
            type: "object",
            properties: {},
          },
          handler: () => {
            wx.navigateTo({ url: "/pages/result/result" });
            return { opened: true, page: "/pages/result/result" };
          },
        },
      ],
    },
    modelConfig: {
      modelProvider: "fallback-planner",
      quickResponseModel: "travelagent-commercial-mvp",
      logo: "",
      welcomeMsg: "告诉我你想去哪、玩几天、偏亲子/情侣/文化，我会生成行程并推荐可继续购买的 Trip 页面。",
    },
  },

  onLoad() {
    const runtime = getRuntimeConfig();
    const status = getIntegrationStatus(runtime);
    const nextAgentConfig = {
      ...this.data.agentConfig,
      ...runtime.agent,
      botId: (runtime.agent && runtime.agent.botId) || "",
      showToolCallDetail: false,
    };
    this.setData({
      agentConfig: nextAgentConfig,
      showAgentPanel: status.agentConfigured,
      fallbackMode: !status.agentConfigured,
      integrationStatus: status.integrationStatus,
      planStatus: status.planStatus,
      purchaseStatus: status.purchaseStatus,
    });
    trackEvent("chat_page_view", {
      hasAgentAccess: status.agentConfigured,
      envName: status.envName,
    });
  },

  handlePromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },

  useQuickPrompt(e) {
    this.setData({ prompt: e.currentTarget.dataset.prompt });
  },

  async generateByPrompt() {
    if (this.data.loading) return;
    const prompt = (this.data.prompt || "").trim();
    if (!prompt) {
      wx.showToast({ title: "先输入一句旅行需求", icon: "none" });
      return;
    }
    this.setData({
      loading: true,
      statusText: "正在生成结构化行程...",
    });
    const plan = await planTrip({ text: prompt });
    const fallbackMode = plan.source !== "agent";
    this.setData({
      loading: false,
      latestPlan: plan,
      fallbackMode,
      statusText: fallbackMode
        ? (plan.warnings && plan.warnings[0]) || "已切换到稳定兜底结果。你仍可继续看结果页和 Trip 活动页。"
        : "智能规划已完成，可以继续查看结构化结果。",
    });
  },

  openResult() {
    wx.navigateTo({ url: "/pages/result/result" });
  },

  openLatestResult() {
    if (!this.data.latestPlan) {
      this.openResult();
      return;
    }
    wx.navigateTo({
      url: `/pages/result/result?city=${encodeURIComponent(this.data.latestPlan.city)}&days=${this.data.latestPlan.days}&type=${this.data.latestPlan.type}`,
    });
  },
});
