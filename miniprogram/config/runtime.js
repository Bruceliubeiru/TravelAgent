const DEFAULT_AGENT_FLAGS = {
  enabled: false,
  botId: "",
  allowWebSearch: true,
  allowUploadFile: false,
  allowPullRefresh: true,
  allowUploadImage: false,
  allowMultiConversation: true,
  allowVoice: true,
  showBotName: true,
  showToolCallDetail: false,
};

const TRIP_PUBLIC_CONFIG = {
  domain: "https://jp.trip.com",
  locale: "ja-JP",
  currency: "JPY",
  homeUrl: "https://jp.trip.com/things-to-do/?locale=ja_jp&curr=JPY",
};

const PRODUCT_PUBLIC_CONFIG = {
  supportedCities: ["上海", "东京", "新加坡"],
  resultPage: "/pages/result/result",
};

const RUNTIME_CONFIGS = {
  dev: {
    envName: "dev",
    cloud: {
      envId: "",
      functionName: "travelGateway",
    },
    agent: {
      ...DEFAULT_AGENT_FLAGS,
    },
    trip: {
      ...TRIP_PUBLIC_CONFIG,
    },
    product: {
      ...PRODUCT_PUBLIC_CONFIG,
    },
  },
  staging: {
    envName: "staging",
    cloud: {
      envId: "",
      functionName: "travelGateway",
    },
    agent: {
      ...DEFAULT_AGENT_FLAGS,
    },
    trip: {
      ...TRIP_PUBLIC_CONFIG,
    },
    product: {
      ...PRODUCT_PUBLIC_CONFIG,
    },
  },
  prod: {
    envName: "prod",
    cloud: {
      envId: "",
      functionName: "travelGateway",
    },
    agent: {
      ...DEFAULT_AGENT_FLAGS,
    },
    trip: {
      ...TRIP_PUBLIC_CONFIG,
    },
    product: {
      ...PRODUCT_PUBLIC_CONFIG,
    },
  },
};

const ACTIVE_RUNTIME_ENV = "dev";

function resolveRuntimeConfig(envName = ACTIVE_RUNTIME_ENV) {
  const target = RUNTIME_CONFIGS[envName] || RUNTIME_CONFIGS[ACTIVE_RUNTIME_ENV] || RUNTIME_CONFIGS.dev;
  return {
    ...target,
    cloud: { ...(target.cloud || {}) },
    agent: { ...(target.agent || {}) },
    trip: { ...(target.trip || {}) },
    product: { ...(target.product || {}) },
  };
}

const PUBLIC_RUNTIME_CONFIG = resolveRuntimeConfig(ACTIVE_RUNTIME_ENV);

module.exports = {
  ACTIVE_RUNTIME_ENV,
  RUNTIME_CONFIGS,
  PUBLIC_RUNTIME_CONFIG,
  resolveRuntimeConfig,
};
