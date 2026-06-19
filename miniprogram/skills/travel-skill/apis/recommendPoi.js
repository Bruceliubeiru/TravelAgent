const { recommendPoiService } = require("../../../utils/travel-service.js");

async function recommendPoiApi({ city = "上海", tag = "" } = {}) {
  try {
    const items = await recommendPoiService(city, tag);
    return {
      isError: false,
      content: [
        {
          type: "text",
          text: `已为${city}推荐 ${items.length} 个 POI。poi_id 必须从 structuredContent.items 中读取，禁止编造。`,
        },
      ],
      structuredContent: {
        items,
        total: items.length,
      },
      _meta: {
        city,
        tag,
        supported: items.length > 0,
      },
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `推荐 POI 失败：${err.message || "未知错误"}` }],
    };
  }
}

module.exports = recommendPoiApi;
