# TravelAgent

TravelAgent 是一个面向微信小程序的旅行规划 MVP。当前版本聚焦三座城市 `上海 / 东京 / 新加坡`，支持中文自然语言输入，输出 1-3 天结构化行程、POI 推荐、Trip 门票卡片，以及真实 Trip 承接跳转。

## 当前架构

- 小程序前端：`miniprogram/`
  - 首页、聊天页、结果页、门票详情页、Trip `web-view` 承接页
  - `travel-service.js` 统一调用 `travelGateway`
  - `travel-data.js` 仅保留最小本地 fallback 样本
- 云函数：`cloudfunctions/travelGateway`
  - action：`planTrip` / `recommendPoi` / `getTripTicket` / `resolvePurchaseTarget` / `trackEvent`
  - 真源目录拆为 `cityMeta / poiCatalog / ticketCatalog / purchaseRules`
- 回归测试：`tests/travel-regression.test.cjs`

## 本地联调

1. 用微信开发者工具打开仓库根目录 `/Users/bruce/Documents/New project/TripAgent`
2. 在 [miniprogram/config/runtime.js](/Users/bruce/Documents/New%20project/TripAgent/miniprogram/config/runtime.js) 填写当前环境公开配置
3. 至少补齐以下字段
   - `cloud.envId`
   - `cloud.functionName`，默认 `travelGateway`
   - `agent.botId`，若暂未接入可留空
4. 微信后台需要把 `https://jp.trip.com` 配到小程序 `web-view` 业务域名
5. 云开发环境中建议预建集合 `travel_events`

## 云函数部署

部署脚本已经切换为 `travelGateway`：

```bash
./uploadCloudFunction.sh <envId> <projectPath> <wechat-cli-path>
```

示例：

```bash
./uploadCloudFunction.sh env-prod /Users/bruce/Documents/New\ project/TripAgent /Applications/wechatwebdevtools.app/Contents/MacOS/cli
```

脚本也支持通过环境变量 `WECHAT_CLOUD_CLI` 传入 CLI 路径。

## Trip 承接策略

- 优先级：`miniProgram > detailUrl > 城市+关键词 webView > 城市活动页 webView > disabled`
- 当前默认真实承接为 JP Trip 城市页或城市 + 关键词页
- 已内置城市页参数
  - 上海：`id=2`
  - 东京：`id=294`
  - 新加坡：`id=53`
- 公共参数：`locale=ja-JP`、`currency=JPY`、`pagetype=city`、`pshowcode=1daytrip`

## Agent 配置说明

- Agent 配置位仍保留在公开运行时配置中
- 若 `agent.enabled + agent.botId + cloud.envId` 未完整配置，首页和聊天页会明确展示“稳定兜底”状态
- 技能层 `generateTripPlan / recommendPoi / getTripTicket` 已统一走 `travel-service.js`，不再维护第二套入口

## 回归测试

运行核心回归：

```bash
node tests/travel-regression.test.cjs
```

常用补充检查：

```bash
node -c miniprogram/utils/travel-data.js
node -c cloudfunctions/travelGateway/lib/travel-engine.js
```

## 交付注意

- 价格、库存、权益展示只作为当前拉取结果，最终以下单页为准
- `travel_events` 写库失败不会阻塞主链路
- 当前不包含酒店、机票、支付、社区或独立后台
