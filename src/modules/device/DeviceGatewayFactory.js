const DeviceGateway = require("./DeviceGateway");
const MockMoyuntengAdapter = require("./adapters/MockMoyuntengAdapter");

function createDeviceGateway(options = {}) {
  const provider = options.provider || "mock";
  const adapter = options.adapter || new MockMoyuntengAdapter({ provider });
  return new DeviceGateway({ provider, adapter });
}

module.exports = {
  createDeviceGateway,
};
