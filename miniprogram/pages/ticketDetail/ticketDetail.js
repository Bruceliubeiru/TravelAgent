const { getSelectedTicket, getTripTicketService, saveSelectedTicket, trackEvent } = require("../../utils/travel-service");
const { openPurchaseFlow } = require("../../utils/purchase");

Page({
  data: {
    detail: null,
    loading: true,
    statusLabelMap: {
      available: "可购买",
      limited: "库存紧张",
      unavailable: "暂不可购",
    },
    purchaseModeLabelMap: {
      miniProgram: "Trip 小程序承接",
      webView: "Trip 承接页",
      clipboard: "Trip 承接页",
      disabled: "暂不可购",
    },
  },

  onLoad(options) {
    trackEvent("ticket_detail_view", {
      sku: options.sku || "",
    });
    const selected = getSelectedTicket();
    if (selected && selected.sku === options.sku) {
      this.setData({ detail: selected, loading: false });
    }
    this.refreshDetail(options.sku);
  },

  async refreshDetail(sku) {
    if (!sku) {
      this.setData({ detail: null, loading: false });
      return;
    }
    const detail = await getTripTicketService({ sku });
    if (detail) {
      saveSelectedTicket(detail);
    }
    this.setData({
      detail: detail || null,
      loading: false,
    });
  },

  navigateBack() {
    wx.navigateBack();
  },

  async buyTicket() {
    const detail = this.data.detail;
    if (!detail || (detail.purchaseTarget && detail.purchaseTarget.purchaseMode === "disabled")) return;
    saveSelectedTicket(detail);
    await openPurchaseFlow(
      {
        sku: detail.sku,
        poi_id: detail.poi_id,
      },
      detail.title,
    );
  },
});
