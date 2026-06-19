const { getTicketEventContext, resolvePurchaseTarget, trackEvent } = require("./travel-service");

function toWebviewUrl(target, title) {
  const url = encodeURIComponent(target.url || target.fallbackUrl || "");
  const safeTitle = encodeURIComponent(title || "Trip 预订页");
  return `/pages/webview/webview?url=${url}&title=${safeTitle}`;
}

function showDisabled(target) {
  wx.showToast({
    title: (target && target.reason) || "当前暂不可购",
    icon: "none",
    duration: 2200,
  });
}

function navigateWebview(target, title) {
  const nextUrl = target.url || target.fallbackUrl;
  if (!nextUrl) {
    showDisabled(target);
    return;
  }
  wx.navigateTo({
    url: toWebviewUrl(target, title),
  });
}

function navigateMiniProgram(target, title) {
  if (!target.appId || !target.path) {
    navigateWebview(target, title);
    return;
  }
  wx.navigateToMiniProgram({
    appId: target.appId,
    path: target.path,
    extraData: target.extraData || {},
    fail: () => {
      navigateWebview(target, title);
    },
  });
}

async function openPurchaseFlow(params = {}, title = "") {
  const target = await resolvePurchaseTarget(params);
  const eventContext = getTicketEventContext(params);
  trackEvent("purchase_target_resolved", {
    ...eventContext,
    purchaseMode: target.purchaseMode,
  });

  if (!target || target.purchaseMode === "disabled") {
    showDisabled(target);
    return target;
  }

  if (target.purchaseMode === "miniProgram") {
    navigateMiniProgram(target, title);
  } else if (target.purchaseMode !== "disabled") {
    navigateWebview(target, title);
  } else {
    showDisabled(target);
  }

  trackEvent("purchase_target_opened", {
    ...eventContext,
    purchaseMode: target.purchaseMode,
  });
  return target;
}

module.exports = {
  openPurchaseFlow,
};
