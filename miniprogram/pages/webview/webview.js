Page({
  data: {
    url: "",
    title: "Trip 预订页",
  },

  onLoad(options) {
    const title = decodeURIComponent(options.title || "Trip 预订页");
    const url = decodeURIComponent(options.url || "");
    wx.setNavigationBarTitle({ title });
    this.setData({
      title,
      url,
    });
  },
});
