const { openPurchaseFlow } = require("../../utils/purchase");
const { getLatestPlan, getPlanSnapshotState, planTrip, trackEvent } = require("../../utils/travel-service");
const { getTypeLabel } = require("../../utils/travel-data");

function buildPlannerRequest(plan, options = {}) {
  if (plan && plan.title) {
    return {
      text: plan.query || "",
      city: plan.city,
      days: plan.days,
      type: plan.type,
    };
  }

  return {
    text: decodeURIComponent(options.query || ""),
    city: options.city || "上海",
    days: Number(options.days || 2),
    type: options.type || "default",
  };
}

Page({
  data: {
    plan: null,
    loading: false,
    emptyText: "",
    planStale: false,
    staleText: "",
    typeLabel: "",
    statusLabelMap: {
      available: "可购买",
      limited: "库存紧张",
      unavailable: "暂不可购",
    },
  },

  onLoad(options) {
    this.initializePlan(options || {});
  },

  applyPlan(plan, stale) {
    this.setData({
      plan,
      planStale: Boolean(stale),
      staleText: stale ? "当前结果已超过 24 小时，页面仍展示最近一次计划快照；如需更新，请下拉刷新。" : "",
      emptyText: !plan.tickets.length ? "当前暂无可展示的门票，请切换支持城市继续体验。" : "",
      typeLabel: getTypeLabel(plan.type),
      loading: false,
    });
  },

  trackPlanView(plan, stale) {
    if (!plan) return;
    trackEvent("result_page_view", {
      planId: plan.planId || "",
      source: plan.source || "fallback",
      city: plan.city || "",
      stale: Boolean(stale),
    });
  },

  async initializePlan(options = {}) {
    const planId = decodeURIComponent(options.planId || "");
    const shouldRefresh = options.refresh === "1" || options.refresh === "true";
    const snapshot = getPlanSnapshotState(planId);

    if (snapshot.plan && !shouldRefresh) {
      this.applyPlan(snapshot.plan, snapshot.stale);
      this.trackPlanView(snapshot.plan, snapshot.stale);
      return;
    }

    await this.refreshPlan(snapshot.plan || getLatestPlan(), options);
  },

  async refreshPlan(planSeed = null, options = {}) {
    this.setData({ loading: true });
    const request = buildPlannerRequest(planSeed || this.data.plan, options);
    const plan = await planTrip(request);
    this.applyPlan(plan, false);
    this.trackPlanView(plan, false);
  },

  onPullDownRefresh() {
    this.refreshPlan(this.data.plan || getLatestPlan())
      .finally(() => {
        wx.stopPullDownRefresh();
      });
  },

  goChat() {
    wx.navigateTo({ url: "/pages/chatBot/chatBot" });
  },

  viewTicket(e) {
    const sku = encodeURIComponent(e.currentTarget.dataset.sku || "");
    const planId = this.data.plan && this.data.plan.planId ? encodeURIComponent(this.data.plan.planId) : "";
    const planQuery = planId ? `&planId=${planId}` : "";
    wx.navigateTo({ url: `/pages/ticketDetail/ticketDetail?sku=${sku}${planQuery}` });
  },

  async purchaseTicket(e) {
    const sku = e.currentTarget.dataset.sku;
    const ticket = ((this.data.plan && this.data.plan.tickets) || []).find((item) => item.sku === sku);
    if (!ticket) return;
    await openPurchaseFlow(
      {
        planId: (this.data.plan && this.data.plan.planId) || "",
        sku: ticket.sku,
        poi_id: ticket.poi_id,
      },
      ticket.title,
    );
  },
});
