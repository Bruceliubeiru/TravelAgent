const OpsCenter = require("../OpsCenter");

function normalizeBody(input = {}) {
  return input && typeof input === "object" ? input : {};
}

function createOpsApi(options = {}) {
  const opsCenter = options.opsCenter || new OpsCenter(options);

  return {
    async createTask(request = {}) {
      const body = normalizeBody(request.body || request);
      const task = opsCenter.createTask({
        accountId: body.accountId,
        type: body.type || "generic_callback",
        title: body.title || "Ops Task",
        payload: body.payload || {},
        callbackUrl: body.callbackUrl || "",
      });
      return { ok: true, task };
    },

    async getTask(request = {}) {
      const taskId = request.taskId || request.id || (request.params && request.params.taskId);
      const task = opsCenter.getTask(taskId);
      return task ? { ok: true, task } : { ok: false, error: "Ops task not found" };
    },

    async runTask(request = {}) {
      const taskId = request.taskId || request.id || (request.params && request.params.taskId);
      const task = await opsCenter.runPendingTask(taskId);
      return { ok: true, task };
    },

    async callback(request = {}) {
      const taskId = request.taskId || request.id || (request.params && request.params.taskId);
      const body = normalizeBody(request.body || request.payload || {});
      const task = await opsCenter.handleCallback(taskId, body);
      return { ok: true, task };
    },

    async dashboard() {
      return { ok: true, dashboard: opsCenter.getDashboard() };
    },
  };
}

module.exports = {
  createOpsApi,
};
