Page({
  data: {
    url: "",
    title: "Trip 详情页",
  },

  onLoad(options) {
    const title = decodeURIComponent(options.title || "Trip 详情页");
    const url = decodeURIComponent(options.url || "");
    wx.setNavigationBarTitle({ title });
    this.setData({
      title,
      url,
    });
  },
});
