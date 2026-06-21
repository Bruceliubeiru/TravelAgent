const DEVICE_METHODS = [
  "openUrl",
  "openMiniProgram",
  "screenshot",
  "click",
  "waitFor",
  "getStatus",
  "close",
  "runSmokeTest",
];

class DeviceAdapter {
  constructor(options = {}) {
    this.options = options;
    this.provider = options.provider || "base";
  }
}

DEVICE_METHODS.forEach((methodName) => {
  DeviceAdapter.prototype[methodName] = async function notImplemented() {
    throw new Error(`DeviceAdapter.${methodName} is not implemented`);
  };
});

DeviceAdapter.DEVICE_METHODS = DEVICE_METHODS;

module.exports = DeviceAdapter;
