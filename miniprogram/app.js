const { ACTIVE_RUNTIME_ENV, resolveRuntimeConfig } = require("./config/runtime");

function getMiniProgramEnvName() {
  try {
    const envVersion = __wxConfig && __wxConfig.envVersion;
    if (envVersion === "release") return "prod";
    if (envVersion === "trial") return "staging";
  } catch (err) {
    // noop
  }
  return ACTIVE_RUNTIME_ENV;
}

App({
  globalData: {
    runtimeConfig: resolveRuntimeConfig(getMiniProgramEnvName()),
  },

  onLaunch() {
    const runtimeConfig = resolveRuntimeConfig(getMiniProgramEnvName());
    this.globalData.runtimeConfig = runtimeConfig;

    if (!wx.cloud) {
      console.error("当前基础库不支持云能力，TravelAgent 将使用本地兜底数据。");
      return;
    }

    const envId = runtimeConfig.cloud && runtimeConfig.cloud.envId;
    const cloudConfig = {
      traceUser: true,
    };
    if (envId) {
      cloudConfig.env = envId;
    }
    wx.cloud.init(cloudConfig);
  },
});
