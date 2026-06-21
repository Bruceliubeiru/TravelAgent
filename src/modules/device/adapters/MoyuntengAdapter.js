const DeviceAdapter = require("./DeviceAdapter");

class MoyuntengAdapter extends DeviceAdapter {
  constructor(options = {}) {
    super({ ...options, provider: "moyunteng" });
  }
}

module.exports = MoyuntengAdapter;
