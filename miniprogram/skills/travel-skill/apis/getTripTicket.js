const { getTripTicketService } = require("../../../utils/travel-service.js");

async function getTripTicketApi({ poi_id } = {}) {
  try {
    if (!poi_id) {
      return {
        isError: true,
        content: [{ type: "text", text: "缺少 poi_id。必须先调用 generateTripPlan 或 recommendPoi 获取有效 poi_id。" }],
      };
    }

    const ticket = await getTripTicketService({ poi_id });
    if (!ticket) {
      return {
        isError: true,
        content: [{ type: "text", text: `未找到 poi_id=${poi_id} 的 Trip 门票。禁止编造 SKU 或价格。` }],
      };
    }

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: `已找到 ${ticket.title}，当前展示为${ticket.priceType === "reference" ? "参考价" : "实时价"}，可用 ${ticket.purchaseTarget.buttonText || ticket.cta} 承接 Trip 转化。`,
        },
      ],
      structuredContent: ticket,
      _meta: {
        purchaseTarget: ticket.purchaseTarget,
        benefits: ticket.benefits,
      },
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `获取 Trip 门票失败：${err.message || "未知错误"}` }],
    };
  }
}

module.exports = getTripTicketApi;
