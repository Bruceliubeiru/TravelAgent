const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

assert.strictEqual(exists("apps/h5/README.md"), true);
assert.strictEqual(exists("src/modules/ops/OpsCenter.js"), true);
assert.strictEqual(exists("src/modules/device/DeviceGateway.js"), true);
assert.strictEqual(exists("src/modules/device/adapters/DeviceAdapter.js"), true);
assert.strictEqual(exists("src/modules/device/adapters/MockMoyuntengAdapter.js"), true);

const DeviceAdapter = require(path.join(root, "src/modules/device/adapters/DeviceAdapter.js"));
const MockMoyuntengAdapter = require(path.join(root, "src/modules/device/adapters/MockMoyuntengAdapter.js"));

assert.strictEqual(Array.isArray(DeviceAdapter.DEVICE_METHODS), true);
assert.strictEqual(DeviceAdapter.DEVICE_METHODS.length >= 8, true);

const adapter = new MockMoyuntengAdapter();
DeviceAdapter.DEVICE_METHODS.forEach((methodName) => {
  assert.strictEqual(typeof adapter[methodName], "function");
});

console.log("PASS module boundary checks");
