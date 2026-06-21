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

console.log("PASS architecture boundary checks");
