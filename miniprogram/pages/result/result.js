const { openPurchaseFlow } = require("../../utils/purchase");
const { saveSelectedTicket, getLatestPlan, planTrip, trackEvent } = require("../../utils/travel-service");
const { getTypeLabel } = require("../../utils/travel-data");

Page({
  data: {
    plan: null,
    loading: false,
    emptyText: "",
    typeLabel: "",
    statusLabelMap: {
      available: "可购买",
      limited: "库存紧张",
      unavailable: "暂不可购",
    },
  },

  onLoad(options) {
    trackEvent("result_page_view");
    const stored = getLatestPlan();
    if (stored && !options.city && !options.refresh) {
      this.setData({
        plan: stored,
        typeLabel: getTypeLabel(stored.type),
      });
      return;
    }

    this.refreshPlan(options);
  },

  async refreshPlan(options = {}) {
    const city = options.city || "上海";
    const days = Number(options.days || 2);
    const type = options.type || "default";
    this.setData({ loading: true });
    const plan = await planTrip({
      city,
      days,
      type,
    });
    this.setData({
      loading: false,
      plan,
      emptyText: !plan.tickets.length ? "当前暂无可展示的门票，请切换支持城市继续体验。" : "",
      typeLabel: getTypeLabel(plan.type),
    });
  },

  goChat() {
    wx.navigateTo({ url: "/pages/chatBot/chatBot" });
  },

  viewTicket(e) {
    const sku = e.currentTarget.dataset.sku;
    const ticket = ((this.data.plan && this.data.plan.tickets) || []).find((item) => item.sku === sku);
    if (ticket) {
      saveSelectedTicket(ticket);
    }
    wx.navigateTo({ url: `/pages/ticketDetail/ticketDetail?sku=${sku}` });
  },

  async purchaseTicket(e) {
    const sku = e.currentTarget.dataset.sku;
    const ticket = ((this.data.plan && this.data.plan.tickets) || []).find((item) => item.sku === sku);
    if (!ticket) return;
    saveSelectedTicket(ticket);
    await openPurchaseFlow(
      {
        sku: ticket.sku,
        poi_id: ticket.poi_id,
      },
      ticket.title,
    );
  },
});
