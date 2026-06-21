const OpsMemoryStore = require("./repositories/OpsMemoryStore");
const { createDeviceGateway } = require("../device/DeviceGatewayFactory");

function nowIso() {
  return new Date().toISOString();
}

class OpsCenter {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.store = options.store || new OpsMemoryStore();
    this.deviceGateway = options.deviceGateway || createDeviceGateway({ provider: "mock" });
  }

  isEnabled() {
    return this.enabled;
  }

  createAccount(input = {}) {
    return this.store.createAccount(input);
  }

  createTask(input = {}) {
    if (!this.isEnabled()) {
      throw new Error("Ops Center is disabled");
    }
    return this.store.createTask(input);
  }

  getTask(taskId) {
    const task = this.store.getTask(taskId);
    if (!task) return null;
    return {
      ...task,
      logs: this.store.listLogs(taskId),
    };
  }

  listTasks(filter = {}) {
    return this.store.listTasks(filter);
  }

  async runPendingTask(taskId) {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Ops task not found: ${taskId}`);
    }
    if (task.status !== "pending") {
      return task;
    }

    this.store.updateTask(taskId, {
      status: "running",
      startedAt: nowIso(),
    });
    this.store.addLog(taskId, "info", "task_running", { provider: this.deviceGateway.provider });

    try {
      const result = await this.deviceGateway.runSmokeTest({
        taskId,
        type: task.type,
        payload: task.payload,
      });
      const nextTask = this.store.updateTask(taskId, {
        status: "succeeded",
        result,
        finishedAt: nowIso(),
      });
      this.store.addLog(taskId, "info", "task_succeeded", result);
      return nextTask;
    } catch (err) {
      const nextTask = this.store.updateTask(taskId, {
        status: "failed",
        error: err && err.message ? err.message : "Ops task failed",
        finishedAt: nowIso(),
      });
      this.store.addLog(taskId, "error", "task_failed", { error: nextTask.error });
      return nextTask;
    }
  }

  async handleCallback(taskId, callbackPayload = {}) {
    const task = this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Ops task not found: ${taskId}`);
    }

    const nextTask = this.store.updateTask(taskId, {
      status: callbackPayload.status || task.status || "succeeded",
      result: {
        ...(task.result || {}),
        callback: callbackPayload,
      },
      finishedAt: callbackPayload.finishedAt || nowIso(),
    });
    this.store.addLog(taskId, "info", "task_callback", callbackPayload);
    return nextTask;
  }

  getDashboard() {
    const tasks = this.store.listTasks();
    const counts = tasks.reduce(
      (result, task) => {
        result.total += 1;
        result[task.status] = (result[task.status] || 0) + 1;
        return result;
      },
      { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 },
    );

    return {
      enabled: this.isEnabled(),
      counts,
      tasks: tasks.slice(0, 50),
    };
  }
}

module.exports = OpsCenter;
