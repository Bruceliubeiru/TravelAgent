const cloud = require("wx-server-sdk");
const { dispatchTravelAction } = require("./lib/handlers");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

exports.main = async (event, context) => {
  const action = event.action;
  const payload = event.payload || {};
  const wxContext = cloud.getWXContext();

  try {
    return await dispatchTravelAction(action, payload, {
      cloudSdk: cloud,
      logger: console,
      wxContext,
    });
  } catch (err) {
    console.error("[travelGateway.error]", action, err);
    return {
      ok: false,
      error: err.message || "travelGateway 执行失败",
    };
  }
};
