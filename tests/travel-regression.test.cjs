const assert = require("assert");
const path = require("path");

const miniprogramTravel = require(path.join(__dirname, "..", "miniprogram", "utils", "travel-data.js"));
const travelService = require(path.join(__dirname, "..", "miniprogram", "utils", "travel-service.js"));
const runtimeConfig = require(path.join(__dirname, "..", "miniprogram", "utils", "runtime-config.js"));
const agentPlanAdapter = require(path.join(__dirname, "..", "miniprogram", "utils", "agent-plan-adapter.js"));
const cloudTravel = require(path.join(
  __dirname,
  "..",
  "cloudfunctions",
  "travelGateway",
  "lib",
  "travel-engine.js",
));
const travelHandlers = require(path.join(
  __dirname,
  "..",
  "cloudfunctions",
  "travelGateway",
  "lib",
  "handlers.js",
));

function getFirstValue(obj) {
  return obj[Object.keys(obj)[0]];
}

function assertSameKeys(left, right, label) {
  assert.deepStrictEqual(
    Object.keys(left).sort(),
    Object.keys(right).sort(),
    `${label} keys should match`,
  );
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

async function main() {
  await runCase("normalize city aliases", async () => {
    assert.strictEqual(miniprogramTravel.normalizeCity("tokyo"), "东京");
    assert.strictEqual(miniprogramTravel.normalizeCity("新加坡市"), "新加坡");
    assert.strictEqual(cloudTravel.normalizeCity("上海市"), "上海");
  });

  await runCase("cloud and fallback catalog schemas stay aligned", async () => {
    const cloudCatalog = cloudTravel.getCatalogSnapshot();
    const fallbackCatalog = miniprogramTravel.getCatalogSnapshot();
    assertSameKeys(cloudCatalog, fallbackCatalog, "catalog root");
    assertSameKeys(cloudCatalog.cityMeta["上海"], fallbackCatalog.cityMeta["上海"], "cityMeta");
    assertSameKeys(getFirstValue(cloudCatalog.poiCatalog), getFirstValue(fallbackCatalog.poiCatalog), "poiCatalog");
    assertSameKeys(getFirstValue(cloudCatalog.ticketCatalog), getFirstValue(fallbackCatalog.ticketCatalog), "ticketCatalog");
    assertSameKeys(cloudCatalog.purchaseRules, fallbackCatalog.purchaseRules, "purchaseRules");
  });

  await runCase("fallback plan for Shanghai family 2d", async () => {
    const plan = miniprogramTravel.generateTripPlan("上海", 2, "family");
    assert.strictEqual(plan.city, "上海");
    assert.strictEqual(plan.days, 2);
    assert.strictEqual(plan.tickets.length > 0, true);
    assert.strictEqual(plan.source, "fallback");
  });

  await runCase("fallback plan for Tokyo couple 3d", async () => {
    const plan = miniprogramTravel.generateTripPlan("东京", 3, "couple");
    assert.strictEqual(plan.city, "东京");
    assert.strictEqual(plan.days, 3);
    assert.strictEqual(plan.itinerary.length, 3);
  });

  await runCase("fallback plan for Singapore culture 2d", async () => {
    const plan = miniprogramTravel.generateTripPlan("新加坡", 2, "culture");
    assert.strictEqual(plan.city, "新加坡");
    assert.strictEqual(plan.tickets.length >= 2, true);
  });

  await runCase("recommend poi when user only asks for attractions", async () => {
    const pois = miniprogramTravel.recommendPoi("东京", "夜景");
    assert.strictEqual(Array.isArray(pois), true);
    assert.strictEqual(pois.length > 0, true);
    assert.strictEqual(pois[0].city, "东京");
  });

  await runCase("get ticket when user only asks for tickets", async () => {
    const ticket = miniprogramTravel.getTripTicket("sentosa");
    assert.strictEqual(ticket.poi_id, "sentosa");
    assert.strictEqual(ticket.priceType, "reference");
    assert.strictEqual(ticket.purchaseTarget.purchaseMode, "webView");
    assert.strictEqual(ticket.purchaseTarget.url.includes("trip.com"), true);
  });

  await runCase("planTrip handler falls back when agent is disabled", async () => {
    delete process.env.TRAVEL_AGENT_MODE;
    delete process.env.TRAVEL_AGENT_BOT_ID;
    const result = await travelHandlers.handlePlanTrip({ city: "上海", days: 2, type: "family" });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.plan.source, "fallback");
  });

  await runCase("planTrip handler ignores legacy server agent env flags", async () => {
    process.env.TRAVEL_AGENT_MODE = "enabled";
    process.env.TRAVEL_AGENT_BOT_ID = "agent-server-side";
    const result = await travelHandlers.handlePlanTrip({ city: "东京", days: 2, type: "couple" });
    delete process.env.TRAVEL_AGENT_MODE;
    delete process.env.TRAVEL_AGENT_BOT_ID;
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.plan.source, "fallback");
  });

  await runCase("three supported cities all return ticket results", async () => {
    ["上海", "东京", "新加坡"].forEach((city) => {
      const plan = cloudTravel.generateTripPlan(city, 2, "default");
      assert.strictEqual(plan.tickets.length > 0, true);
    });
  });

  await runCase("unsupported city returns warning plan", async () => {
    const plan = miniprogramTravel.generateTripPlan("巴黎", 2, "culture");
    assert.strictEqual(plan.tickets.length, 0);
    assert.strictEqual(plan.warnings.length > 0, true);
  });

  await runCase("resolve purchase target covers priority modes", async () => {
    const poi = { city: "东京", keyword: "東京スカイツリー" };

    const miniProgram = cloudTravel.buildPurchaseTarget(
      {
        ticketStatus: "available",
        title: "test",
        cta: "去 Trip 小程序查看",
        miniProgram: { appId: "wx123", path: "pages/detail/index" },
        detailUrl: "https://jp.trip.com/detail",
      },
      poi,
    );
    assert.strictEqual(miniProgram.purchaseMode, "miniProgram");

    const detail = cloudTravel.buildPurchaseTarget(
      {
        ticketStatus: "available",
        title: "test",
        cta: "查看 Trip 商品详情",
        detailUrl: "https://jp.trip.com/detail",
      },
      poi,
    );
    assert.strictEqual(detail.purchaseMode, "webView");
    assert.strictEqual(detail.url, "https://jp.trip.com/detail");

    const keyword = cloudTravel.buildPurchaseTarget(
      {
        ticketStatus: "available",
        title: "东京晴空塔门票",
      },
      poi,
    );
    assert.strictEqual(keyword.purchaseMode, "webView");
    assert.strictEqual(keyword.url.includes("keyword="), true);

    const disabled = cloudTravel.buildPurchaseTarget(
      {
        ticketStatus: "unavailable",
        title: "东京晴空塔门票",
      },
      poi,
    );
    assert.strictEqual(disabled.purchaseMode, "disabled");
  });

  await runCase("primary tickets default to direct trip detail pages", async () => {
    const disney = cloudTravel.getTicketBySku("TDS-1D");
    const disneyseaUrl = disney.purchaseTarget.url || "";
    assert.strictEqual(disney.purchaseTarget.purchaseMode, "webView");
    assert.strictEqual(disney.priceType, "reference");
    assert.strictEqual(
      disneyseaUrl.includes("/things-to-do/experiences/") || disneyseaUrl.includes("/travel-guide/attraction/"),
      true,
    );

    const sentosa = cloudTravel.getTicketBySku("USS-1D");
    assert.strictEqual(sentosa.purchaseTarget.purchaseMode, "webView");
    assert.strictEqual(sentosa.purchaseTarget.url.includes("/travel-guide/attraction/"), true);
  });

  await runCase("unknown ticket ids return controlled errors", async () => {
    const result = await travelHandlers.handleGetTripTicket({ poi_id: "unknown-poi" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.ticket, null);
  });

  await runCase("trackEvent db failure does not block success response", async () => {
    const logger = {
      info() {},
      warn() {},
      error() {},
    };
    const result = await travelHandlers.handleTrackEvent(
      {
        eventName: "ticket_open",
        payload: { sku: "TDS-1D" },
        clientSource: "test-suite",
      },
      {
        OPENID: "openid",
        APPID: "appid",
      },
      {
        cloudSdk: {
          database() {
            throw new Error("db unavailable");
          },
        },
        logger,
      },
    );

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.tracked, true);
    assert.strictEqual(result.persisted, false);
  });

  await runCase("prompt parsing extracts city days type", async () => {
    const parsed = miniprogramTravel.parseUserPrompt("东京情侣 3 天，想看夜景");
    assert.strictEqual(parsed.city, "东京");
    assert.strictEqual(parsed.days, 3);
    assert.strictEqual(parsed.type, "couple");
  });

  await runCase("plan identity helpers add planId query and ttl", async () => {
    const basePlan = miniprogramTravel.generateTripPlan("上海", 2, "family");
    const snapshot = travelService.attachPlanIdentity(basePlan, { text: "上海亲子 2 天" }, {
      planId: "plan_test",
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    assert.strictEqual(snapshot.planId, "plan_test");
    assert.strictEqual(snapshot.query, "上海亲子 2 天");
    assert.strictEqual(snapshot.expiresAt, "2026-06-20T00:00:00.000Z");
    assert.strictEqual(travelService.isPlanExpired(snapshot, Date.parse(snapshot.expiresAt) - 1), false);
    assert.strictEqual(travelService.isPlanExpired(snapshot, Date.parse(snapshot.expiresAt) + 1), true);
    assert.strictEqual(
      travelService.buildResultPageUrl(snapshot.planId),
      "/pages/result/result?planId=plan_test",
    );
  });

  await runCase("ticket lookup can resolve from plan snapshot by sku", async () => {
    const plan = travelService.attachPlanIdentity(miniprogramTravel.generateTripPlan("上海", 2, "family"), {
      city: "上海",
      days: 2,
      type: "family",
    }, {
      planId: "plan_lookup",
    });
    const ticket = travelService.findTicketInPlan(plan, "SHDR-1D");
    assert.strictEqual(ticket.sku, "SHDR-1D");
    assert.strictEqual(ticket.poi.name, "上海迪士尼度假区");
  });

  await runCase("runtime status distinguishes chat and plan agent readiness", async () => {
    const baseRuntime = {
      envName: "prod",
      cloud: {
        envId: "env-prod",
        functionName: "travelGateway",
      },
      trip: {
        domain: "https://jp.trip.com",
        homeUrl: "https://jp.trip.com/things-to-do/?locale=ja_jp&curr=JPY",
        locale: "ja-JP",
        currency: "JPY",
      },
      product: {
        supportedCities: ["上海", "东京", "新加坡"],
      },
    };

    const legacyBotStatus = runtimeConfig.getIntegrationStatus(
      {
        ...baseRuntime,
        agent: {
          enabled: true,
          botId: "ibot-legacy",
        },
      },
      {
        sdkVersion: "3.8.0",
        aiRuntimeReady: true,
      },
    );
    assert.strictEqual(legacyBotStatus.chatAgentReady, true);
    assert.strictEqual(legacyBotStatus.planAgentReady, false);

    const planAgentStatus = runtimeConfig.getIntegrationStatus(
      {
        ...baseRuntime,
        agent: {
          enabled: true,
          botId: "agent-v2-demo",
        },
      },
      {
        sdkVersion: "3.8.0",
        aiRuntimeReady: true,
      },
    );
    assert.strictEqual(planAgentStatus.chatAgentReady, true);
    assert.strictEqual(planAgentStatus.planAgentReady, true);
  });

  await runCase("agent adapter merges strict json patch into base plan", async () => {
    const basePlan = miniprogramTravel.generateTripPlan("东京", 2, "couple");
    const patch = {
      title: "东京 2 天游览优化版",
      itinerary: basePlan.itinerary.map((day) => ({
        day: day.day,
        theme: `${day.theme}·优化`,
        summary: `${day.summary} 并补充了更清晰的情侣动线。`,
      })),
      warnings: ["已按情侣场景优化每日摘要"],
    };
    const merged = agentPlanAdapter.finalizeAgentPlan(basePlan, {
      executedTools: ["compose_base_plan"],
      finalText: JSON.stringify(patch),
    });
    assert.strictEqual(merged.source, "agent");
    assert.strictEqual(merged.title, patch.title);
    assert.strictEqual(merged.tickets.length, basePlan.tickets.length);
    assert.strictEqual(merged.itinerary[0].theme, patch.itinerary[0].theme);
  });

  await runCase("agent adapter rejects invalid json and timeout", async () => {
    const basePlan = miniprogramTravel.generateTripPlan("上海", 2, "family");
    assert.throws(() => {
      agentPlanAdapter.finalizeAgentPlan(basePlan, {
        executedTools: ["compose_base_plan"],
        finalText: "not-json",
      });
    }, /严格 JSON/);
    assert.throws(() => {
      agentPlanAdapter.finalizeAgentPlan(basePlan, {
        executedTools: [],
        finalText: "{}",
      });
    }, /compose_base_plan/);
    assert.throws(() => {
      agentPlanAdapter.ensureBeforeDeadline(Date.now() - 1, Date.now());
    }, /超时/);
  });

  console.log("All TravelAgent regression checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
