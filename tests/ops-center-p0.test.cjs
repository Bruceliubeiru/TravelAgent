const assert = require("assert");
const path = require("path");

const root = path.join(__dirname, "..");
const OpsCenter = require(path.join(root, "src/modules/ops/OpsCenter.js"));
const { createOpsApi } = require(path.join(root, "src/modules/ops/api/OpsApi.js"));

async function main() {
  const center = new OpsCenter({ enabled: true });
  const api = createOpsApi({ opsCenter: center });

  const created = await api.createTask({
    title: "P0 mock task",
    type: "generic_callback",
    payload: { target: "mock" },
  });
  assert.strictEqual(created.ok, true);
  assert.strictEqual(created.task.status, "pending");

  const executed = await api.runTask({ taskId: created.task.id });
  assert.strictEqual(executed.ok, true);
  assert.strictEqual(executed.task.status, "succeeded");

  const returned = await api.callback({
    taskId: created.task.id,
    body: { status: "succeeded", externalRunId: "mock-return" },
  });
  assert.strictEqual(returned.ok, true);
  assert.strictEqual(returned.task.result.callback.externalRunId, "mock-return");

  const board = await api.dashboard();
  assert.strictEqual(board.ok, true);
  assert.strictEqual(board.dashboard.counts.total, 1);
  assert.strictEqual(board.dashboard.counts.succeeded, 1);

  console.log("PASS ops center p0 flow");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
