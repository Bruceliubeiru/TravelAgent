const DeviceAdapter = require("./DeviceAdapter");

class CloudPhoneAdapter extends DeviceAdapter {
  constructor(options = {}) {
    super({ ...options, provider: "cloud-phone" });
  }
}

module.exports = CloudPhoneAdapter;
