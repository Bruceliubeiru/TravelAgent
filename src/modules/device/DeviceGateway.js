class DeviceGateway {
  constructor(options = {}) {
    this.provider = options.provider || "mock";
    this.adapter = options.adapter || null;
  }
}

module.exports = DeviceGateway;
