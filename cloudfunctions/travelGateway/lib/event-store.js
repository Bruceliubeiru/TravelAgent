function createEventRecord(payload = {}, wxContext = {}) {
  return {
    eventName: payload.eventName || "unknown",
    payload: payload.payload || {},
    openid: wxContext.OPENID || "",
    appid: wxContext.APPID || "",
    timestamp: payload.timestamp || new Date().toISOString(),
    clientSource: payload.clientSource || "miniprogram",
  };
}

async function persistTravelEvent({ cloudSdk, payload, wxContext, logger = console } = {}) {
  const event = createEventRecord(payload, wxContext);
  let persisted = false;

  try {
    if (!cloudSdk || typeof cloudSdk.database !== "function") {
      throw new Error("云数据库未启用");
    }

    const db = cloudSdk.database();
    if (!db || typeof db.collection !== "function") {
      throw new Error("云数据库实例不可用");
    }

    await db.collection("travel_events").add({
      data: event,
    });
    persisted = true;
  } catch (err) {
    logger.info("[travelGateway.trackEvent.persistFailed]", err && err.message ? err.message : err);
  }

  return {
    tracked: true,
    persisted,
    event,
  };
}

module.exports = {
  createEventRecord,
  persistTravelEvent,
};
