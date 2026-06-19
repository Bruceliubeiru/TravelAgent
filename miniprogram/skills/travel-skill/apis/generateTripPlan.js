const { buildResultPageUrl, planTrip } = require("../../../utils/travel-service.js");

async function generateTripPlanApi({ city = "上海", days = 2, type = "family" } = {}) {
  try {
    const plan = await planTrip({ city, days, type }, { preferAgent: false });
    const resultPageUrl = buildResultPageUrl(plan.planId);
    return {
      isError: false,
      content: [
        {
          type: "text",
          text: `已生成${plan.title}，并绑定 ${plan.tickets.length} 个 Trip 承接目标。请展示结构化结果，引导用户查看门票卡片或进入结果页。`,
        },
      ],
      structuredContent: plan,
      _meta: {
        resultPage: "/pages/result/result",
        resultPageUrl,
        primaryTickets: plan.tickets.slice(0, 3),
        planId: plan.planId,
        source: plan.source,
      },
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `生成行程失败：${err.message || "未知错误"}` }],
    };
  }
}

module.exports = generateTripPlanApi;
