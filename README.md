# Trip GEO Growth OS

TravelAgent is now defined as the Mini Program App inside Trip GEO Growth OS. It is not the name of the whole system.

## Current scope

TravelAgent is a WeChat Mini Program travel planning MVP. It focuses on Shanghai, Tokyo, and Singapore, supports Chinese natural-language input, returns 1-3 day structured itineraries, POI recommendations, Trip ticket cards, and real Trip booking handoff.

## Current architecture

- Mini Program App: `miniprogram/`
  - Current physical path is preserved to avoid breaking WeChat Developer Tools.
  - Conceptually this app belongs to `apps/miniprogram`.
  - It owns the index page, chat page, result page, ticket detail page, and Trip `web-view` handoff page.
- H5 Landing App boundary: `apps/h5/`
  - Independent future indexable landing app.
  - It will support SEO, AI Search / GEO, POI landing pages, FAQ pages, compare pages, Trip booking links, and attribution.
- Cloud function: `cloudfunctions/travelGateway`
  - Existing actions remain unchanged: `planTrip`, `recommendPoi`, `getTripTicket`, `resolvePurchaseTarget`, `trackEvent`.
- Optional Ops Center: `src/modules/ops`
  - Optional plugin, off by default.
  - P0 supports task creation, pending status, callback result, and dashboard summary through isolated handlers.
- Optional Device Gateway: `src/modules/device`
  - Optional device abstraction, mock by default.
  - Moyunteng is only a Device Adapter and not a core dependency.
- Core regression test: `tests/travel-regression.test.cjs`
- Module boundary test: `tests/module-boundary.test.cjs`
- Ops P0 test: `tests/ops-center-p0.test.cjs`

## Core flow

```text
Question -> Knowledge -> Landing -> Mini Program -> Trip Booking -> Feedback
```

## Local setup

1. Open the repository root with WeChat Developer Tools.
2. Fill runtime config in `miniprogram/config/runtime.js`.
3. Keep `cloud.functionName` as `travelGateway` unless intentionally changed.
4. Configure `https://jp.trip.com` as a Mini Program `web-view` business domain.
5. Create the `travel_events` collection in the cloud environment when event persistence is needed.

## Cloud function deploy

```bash
./uploadCloudFunction.sh <envId> <projectPath> <wechat-cli-path>
```

## Trip handoff strategy

Priority:

```text
miniProgram > detailUrl > city keyword webView > city activity webView > disabled
```

The current default handoff is to JP Trip city pages, keyword pages, or real detail pages.

## Agent notes

- Agent runtime config remains in `miniprogram/config/runtime.js`.
- Runtime distinguishes `chatAgentReady` and `planAgentReady`.
- Legacy `ibot...` can still support chat, but structured `planTrip` requires an Agent V2 bot id.
- Existing fallback planning must remain stable when Agent is disabled or unavailable.

## Plan snapshot and price notes

- Every generated plan gets a local `planId` snapshot.
- Result page, ticket detail page, and purchase flow use the same `planId`.
- Snapshot TTL is 24 hours.
- Ticket prices are reference prices. The real latest price and inventory are determined by the Trip booking page.

## Regression tests

```bash
node tests/travel-regression.test.cjs
node tests/module-boundary.test.cjs
node tests/ops-center-p0.test.cjs
```

Additional syntax checks:

```bash
node -c miniprogram/utils/travel-data.js
node -c cloudfunctions/travelGateway/lib/travel-engine.js
```

## Delivery notes

- H5, Ops Center, and Device Gateway are currently architecture boundaries.
- Removing `src/modules/ops` or `src/modules/device` must not break the existing Mini Program and Trip Booking flow.
- This project does not currently include hotels, flights, payment, community, or a standalone admin backend.
