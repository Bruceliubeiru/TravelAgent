const { buildResultPageUrl, planTrip, trackEvent } = require("../../utils/travel-service");
const { getIntegrationStatus } = require("../../utils/runtime-config");

Page({
  data: {
    prompt: "",
    city: "上海",
    days: 2,
    type: "family",
    loading: false,
    statusText: "",
    cities: ["上海", "东京", "新加坡"],
    dayOptions: [1, 2, 3],
    typeOptions: [
      { key: "family", label: "亲子" },
      { key: "couple", label: "情侣" },
      { key: "culture", label: "文化" },
    ],
    quickPrompts: ["上海亲子 2 天", "东京情侣 3 天", "新加坡文化 2 天"],
    highlights: [
      { title: "同一条闭环", desc: "首页、聊天页、结果页都走同一套 planTrip 服务。" },
      { title: "Trip 真实跳转", desc: "默认跳到 jp.trip.com 对应城市活动页，不再只复制占位链接。" },
      { title: "双轨兜底", desc: "云端或 Agent 不可用时，前端仍能稳定产出结构化行程。" },
    ],
    integrationStatus: null,
    planStatus: null,
    purchaseStatus: null,
    agentDiagnostics: [],
    runtimeEnv: "dev",
  },

  onLoad() {
    const status = getIntegrationStatus();
    this.setData({
      integrationStatus: status.integrationStatus,
      planStatus: status.planStatus,
      purchaseStatus: status.purchaseStatus,
      agentDiagnostics: status.agentDiagnostics || [],
      runtimeEnv: status.envName,
    });
    trackEvent("home_page_view", {
      envName: status.envName,
      cloudConfigured: status.cloudConfigured,
      chatAgentReady: status.chatAgentReady,
      planAgentReady: status.planAgentReady,
    });
  },

  handlePromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },

  selectCity(e) {
    this.setData({ city: e.currentTarget.dataset.city });
  },

  selectDays(e) {
    this.setData({ days: Number(e.currentTarget.dataset.days) });
  },

  selectType(e) {
    this.setData({ type: e.currentTarget.dataset.type });
  },

  useQuickPrompt(e) {
    const prompt = e.currentTarget.dataset.prompt;
    this.setData({ prompt });
  },

  async generatePlan() {
    if (this.data.loading) return;
    const { city, days, type, prompt } = this.data;
    this.setData({
      loading: true,
      statusText: "正在生成行程与门票卡片...",
    });
    const plan = await planTrip({
      text: prompt,
      city,
      days,
      type,
    });
    const statusText =
      plan.source === "agent"
        ? "已完成智能规划，正在带你进入结果页。"
        : (plan.warnings && plan.warnings[0]) || "云端不可用时已切换到稳定兜底规划，结果页已可继续浏览和下单。";
    this.setData({
      loading: false,
      statusText,
    });
    wx.navigateTo({
      url: buildResultPageUrl(plan.planId),
    });
  },

  goChatBot() {
    wx.navigateTo({ url: "/pages/chatBot/chatBot" });
  },
});
