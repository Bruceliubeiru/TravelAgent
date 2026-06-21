const DeviceGateway = require("./DeviceGateway");

function createDeviceGateway(options = {}) {
  return new DeviceGateway({
    provider: options.provider || "mock",
    adapter: options.adapter || null,
  });
}

module.exports = {
  createDeviceGateway,
};
