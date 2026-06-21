const DeviceAdapter = require("./adapters/DeviceAdapter");

class DeviceGateway {
  constructor(options = {}) {
    this.provider = options.provider || "mock";
    this.adapter = options.adapter || null;
  }

  getAdapter() {
    if (!this.adapter) {
      throw new Error("DeviceGateway adapter is not configured");
    }
    return this.adapter;
  }
}

DeviceAdapter.DEVICE_METHODS.forEach((methodName) => {
  DeviceGateway.prototype[methodName] = async function proxy(input = {}) {
    const adapter = this.getAdapter();
    if (typeof adapter[methodName] !== "function") {
      throw new Error(`Device adapter does not implement ${methodName}`);
    }
    return adapter[methodName](input);
  };
});

module.exports = DeviceGateway;
