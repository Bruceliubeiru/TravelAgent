const DeviceAdapter = require("./DeviceAdapter");

class RealAndroidAdapter extends DeviceAdapter {
  constructor(options = {}) {
    super({ ...options, provider: "real-android" });
  }
}

module.exports = RealAndroidAdapter;
