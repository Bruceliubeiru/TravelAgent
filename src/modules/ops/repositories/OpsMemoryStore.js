function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

class OpsMemoryStore {
  constructor(seed = {}) {
    this.accounts = new Map();
    this.tasks = new Map();
    this.logs = new Map();

    (seed.accounts || []).forEach((account) => this.accounts.set(account.id, account));
    (seed.tasks || []).forEach((task) => this.tasks.set(task.id, task));
    (seed.logs || []).forEach((log) => this.logs.set(log.id, log));
  }

  createAccount(input = {}) {
    const account = {
      id: input.id || createId("ops_account"),
      name: input.name || "Mock Ops Account",
      provider: input.provider || "mock",
      status: input.status || "active",
      metadata: input.metadata || {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.accounts.set(account.id, account);
    return account;
  }

  createTask(input = {}) {
    const task = {
      id: input.id || createId("ops_task"),
      accountId: input.accountId || null,
      type: input.type || "generic_callback",
      status: "pending",
      title: input.title || "Untitled Ops Task",
      payload: input.payload || {},
      result: null,
      callbackUrl: input.callbackUrl || "",
      error: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: null,
      finishedAt: null,
    };
    this.tasks.set(task.id, task);
    this.addLog(task.id, "info", "task_created", { status: task.status });
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  listTasks(filter = {}) {
    return Array.from(this.tasks.values())
      .filter((task) => (filter.status ? task.status === filter.status : true))
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  updateTask(taskId, patch = {}) {
    const current = this.getTask(taskId);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.tasks.set(taskId, next);
    return next;
  }

  addLog(taskId, level, message, data = {}) {
    const log = {
      id: createId("ops_log"),
      taskId,
      level: level || "info",
      message,
      data,
      createdAt: nowIso(),
    };
    this.logs.set(log.id, log);
    return log;
  }

  listLogs(taskId) {
    return Array.from(this.logs.values())
      .filter((log) => log.taskId === taskId)
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }
}

module.exports = OpsMemoryStore;
