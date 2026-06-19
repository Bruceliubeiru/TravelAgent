const {
  getPlanSnapshotState,
  getTripTicketService,
  trackEvent,
} = require("../../utils/travel-service");
const { openPurchaseFlow } = require("../../utils/purchase");

Page({
  data: {
    detail: null,
    loading: true,
    planId: "",
    stale: false,
    statusLabelMap: {
      available: "可购买",
      limited: "库存紧张",
      unavailable: "暂不可购",
    },
    purchaseModeLabelMap: {
      miniProgram: "Trip 小程序承接",
      webView: "Trip 承接页",
      disabled: "暂不可购",
    },
  },

  onLoad(options) {
    const planId = decodeURIComponent(options.planId || "");
    const snapshot = getPlanSnapshotState(planId);
    const resolvedPlanId = (snapshot.plan && snapshot.plan.planId) || snapshot.planId || "";
    const stale = snapshot.stale;
    this.setData({
      planId: resolvedPlanId,
      stale,
    });
    trackEvent("ticket_detail_view", {
      sku: options.sku || "",
      planId: resolvedPlanId,
      stale,
      source: (snapshot.plan && snapshot.plan.source) || "fallback",
      city: (snapshot.plan && snapshot.plan.city) || "",
    });
    this.refreshDetail(options.sku, resolvedPlanId);
  },

  async refreshDetail(sku, planId = this.data.planId) {
    if (!sku) {
      this.setData({ detail: null, loading: false });
      return;
    }
    const snapshot = getPlanSnapshotState(planId);
    const detail = await getTripTicketService({ sku, planId });
    this.setData({
      detail: detail || null,
      loading: false,
      planId: (snapshot.plan && snapshot.plan.planId) || planId || "",
      stale: snapshot.stale,
    });
  },

  navigateBack() {
    wx.navigateBack();
  },

  async buyTicket() {
    const detail = this.data.detail;
    if (!detail || (detail.purchaseTarget && detail.purchaseTarget.purchaseMode === "disabled")) return;
    await openPurchaseFlow(
      {
        planId: this.data.planId || "",
        sku: detail.sku,
        poi_id: detail.poi_id,
      },
      detail.title,
    );
  },
});
