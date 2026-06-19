const { buildPlanFromPrompt, generateTripPlan } = require("./travel-data");

const AGENT_TIMEOUT_MS = 8000;

function normalizeText(input = "") {
  return String(input || "").trim();
}

function buildBasePlan(payload = {}, basePlan = null) {
  if (basePlan && basePlan.title) {
    return basePlan;
  }
  return payload.text
    ? buildPlanFromPrompt(payload.text, payload)
    : generateTripPlan(payload.city || "上海", payload.days || 2, payload.type || "default", {
        source: "fallback",
      });
}

function dedupeWarnings(list = []) {
  return Array.from(
    new Set(
      list
        .map((item) => normalizeText(item))
        .filter(Boolean),
    ),
  );
}

function buildAgentPrompt(payload = {}, basePlan = null) {
  const canonicalPlan = buildBasePlan(payload, basePlan);
  const requestText =
    normalizeText(payload.text) ||
    `${canonicalPlan.city}${canonicalPlan.days}天${canonicalPlan.type === "default" ? "经典" : canonicalPlan.type}行程`;

  return [
    "你是 TravelAgent 的结构化行程文案增强器。",
    "你必须先调用 compose_base_plan 一次，再基于工具返回内容输出最终结果。",
    "你只能改写以下字段：title、itinerary[*].theme、itinerary[*].summary、warnings。",
    "禁止改写 city、days、type、pois、tickets、purchaseTarget、price、originalPrice、currency、ticketStatus。",
    "最终只能输出严格 JSON，不要输出 Markdown，不要输出代码块，不要输出 JSON 之外的任何文本。",
    "JSON 结构固定为：",
    '{"title":"string","itinerary":[{"day":1,"theme":"string","summary":"string"}],"warnings":["string"]}',
    `用户需求：${requestText}`,
    `当前基准城市：${canonicalPlan.city}；天数：${canonicalPlan.days}；类型：${canonicalPlan.type}。`,
  ].join("\n");
}

function createComposeBasePlanTool(basePlan) {
  const canonicalPlan = buildBasePlan({}, basePlan);
  return {
    name: "compose_base_plan",
    description: "返回当前 TravelAgent 的基准结构化计划。必须先读取后再改写标题与每日摘要。",
    parameters: {
      type: "object",
      properties: {},
    },
    handler: async () => canonicalPlan,
  };
}

function buildToolMessages(frontendToolsResult) {
  return frontendToolsResult.map((item) => ({
    id: item.toolCallId,
    role: "tool",
    toolCallId: item.toolCallId,
    content: item.result,
  }));
}

function ensureBeforeDeadline(deadlineAt, now = Date.now()) {
  if (deadlineAt && now > deadlineAt) {
    throw new Error("客户端 Agent 规划超时");
  }
}

function parseStrictJson(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error("客户端 Agent 未返回可解析内容");
  }
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw new Error("客户端 Agent 返回内容不是严格 JSON");
  }

  try {
    return JSON.parse(normalized);
  } catch (err) {
    throw new Error(`客户端 Agent JSON 解析失败：${err && err.message ? err.message : "未知错误"}`);
  }
}

function mergeAgentPlan(basePlan, patch = {}) {
  if (!basePlan || !basePlan.title) {
    throw new Error("缺少可用的基准计划");
  }

  const title = normalizeText(patch.title);
  const patchDays = Array.isArray(patch.itinerary) ? patch.itinerary : null;
  if (!title) {
    throw new Error("客户端 Agent 返回缺少 title");
  }
  if (!patchDays || patchDays.length !== (basePlan.itinerary || []).length) {
    throw new Error("客户端 Agent 返回的 itinerary 不完整");
  }

  const itinerary = (basePlan.itinerary || []).map((day, index) => {
    const nextDay = patchDays[index] || {};
    const theme = normalizeText(nextDay.theme);
    const summary = normalizeText(nextDay.summary);
    if (!theme || !summary) {
      throw new Error(`客户端 Agent 返回的第 ${index + 1} 天文案不完整`);
    }
    return {
      ...day,
      theme,
      summary,
    };
  });

  return {
    ...basePlan,
    title,
    itinerary,
    source: "agent",
    warnings: dedupeWarnings([].concat(basePlan.warnings || [], patch.warnings || [])),
  };
}

function finalizeAgentPlan(basePlan, runState = {}) {
  const executedTools = Array.isArray(runState.executedTools) ? runState.executedTools : [];
  if (!executedTools.includes("compose_base_plan")) {
    throw new Error("客户端 Agent 未先调用 compose_base_plan");
  }
  const parsed = parseStrictJson(runState.finalText || "");
  return mergeAgentPlan(basePlan, parsed);
}

function getCloudAI() {
  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI) {
    throw new Error("当前客户端 AI 运行环境不可用");
  }
  return wx.cloud.extend.AI;
}

async function runAgentConversation(ai, botId, threadId, messages, tools, deadlineAt, runState) {
  ensureBeforeDeadline(deadlineAt);
  const frontendTools = Array.isArray(tools) ? tools : [];
  const response = await ai.bot.sendMessage({
    data: {
      botId,
      threadId,
      runId: `plan_run_${Date.now()}`,
      messages,
      tools: frontendTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
      context: [],
      state: {},
    },
  });

  const toolCalls = [];
  const textParts = [];

  for await (const event of response.eventStream) {
    ensureBeforeDeadline(deadlineAt);
    const data = (event && event.json) || {};

    if (data.type === "TEXT_MESSAGE_START") {
      textParts.push("");
      continue;
    }

    if (data.type === "TEXT_MESSAGE_CONTENT") {
      if (!textParts.length) {
        textParts.push("");
      }
      textParts[textParts.length - 1] += data.delta || "";
      continue;
    }

    if (data.type === "TOOL_CALL_START") {
      toolCalls.push({
        id: data.toolCallId,
        toolCallName: data.toolCallName,
        arguments: "",
      });
      continue;
    }

    if (data.type === "TOOL_CALL_ARGS") {
      if (!toolCalls.length) {
        toolCalls.push({
          id: data.toolCallId || `tool_call_${Date.now()}`,
          toolCallName: data.toolCallName || "",
          arguments: "",
        });
      }
      toolCalls[toolCalls.length - 1].arguments += data.delta || "";
      continue;
    }

    if (data.type === "RUN_ERROR") {
      throw new Error("客户端 Agent 运行失败");
    }
  }

  if (textParts.length) {
    runState.finalText = textParts.join("").trim();
  }

  if (!toolCalls.length) {
    return runState;
  }

  const frontendToolResults = [];
  for (const toolCall of toolCalls) {
    const tool = frontendTools.find((item) => item.name === toolCall.toolCallName);
    if (!tool) {
      continue;
    }

    const args = normalizeText(toolCall.arguments) ? JSON.parse(toolCall.arguments) : {};
    const result = await tool.handler(args);
    runState.executedTools.push(tool.name);
    frontendToolResults.push({
      toolCallId: toolCall.id,
      result: JSON.stringify(result),
    });
  }

  if (!frontendToolResults.length) {
    return runState;
  }

  return runAgentConversation(
    ai,
    botId,
    threadId,
    buildToolMessages(frontendToolResults),
    frontendTools,
    deadlineAt,
    runState,
  );
}

async function runClientAgentPlan(payload = {}, basePlan, options = {}) {
  const botId = normalizeText(options.botId || "");
  if (!botId) {
    throw new Error("缺少可用的客户端 Agent botId");
  }

  const canonicalPlan = buildBasePlan(payload, basePlan);
  if (!canonicalPlan.city || !Array.isArray(canonicalPlan.itinerary) || !canonicalPlan.itinerary.length) {
    throw new Error("当前基准计划不可用于客户端 Agent 增强");
  }

  const ai = getCloudAI();
  const threadId = `travelagent_plan_${Date.now()}`;
  const tools = [createComposeBasePlanTool(canonicalPlan)];
  const runState = {
    executedTools: [],
    finalText: "",
  };
  const deadlineAt = Date.now() + (options.timeoutMs || AGENT_TIMEOUT_MS);

  await runAgentConversation(
    ai,
    botId,
    threadId,
    [
      {
        id: `user_message_${Date.now()}`,
        role: "user",
        content: buildAgentPrompt(payload, canonicalPlan),
      },
    ],
    tools,
    deadlineAt,
    runState,
  );

  return finalizeAgentPlan(canonicalPlan, runState);
}

module.exports = {
  AGENT_TIMEOUT_MS,
  buildAgentPrompt,
  buildBasePlan,
  createComposeBasePlanTool,
  ensureBeforeDeadline,
  finalizeAgentPlan,
  mergeAgentPlan,
  parseStrictJson,
  runClientAgentPlan,
};
