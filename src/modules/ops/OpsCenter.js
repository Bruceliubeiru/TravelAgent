class OpsCenter {
  constructor(options = {}) {
    this.enabled = Boolean(options.enabled);
    this.deviceGateway = options.deviceGateway || null;
  }

  isEnabled() {
    return this.enabled;
  }
}

module.exports = OpsCenter;
