const DeviceAdapter = require("./DeviceAdapter");

class MockMoyuntengAdapter extends DeviceAdapter {
  constructor(options = {}) {
    super({ ...options, provider: "mock-moyunteng" });
  }

  async openUrl(input = {}) {
    return this.result("openUrl", input);
  }

  async openMiniProgram(input = {}) {
    return this.result("openMiniProgram", input);
  }

  async screenshot(input = {}) {
    return this.result("screenshot", input);
  }

  async click(input = {}) {
    return this.result("click", input);
  }

  async waitFor(input = {}) {
    return this.result("waitFor", input);
  }

  async getStatus(input = {}) {
    return this.result("getStatus", input);
  }

  async close(input = {}) {
    return this.result("close", input);
  }

  async runSmokeTest(input = {}) {
    return this.result("runSmokeTest", input);
  }

  result(action, input = {}) {
    return {
      ok: true,
      provider: this.provider,
      action,
      input,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = MockMoyuntengAdapter;
