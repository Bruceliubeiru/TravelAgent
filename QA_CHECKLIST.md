# TravelAgent 真机回归清单

适用版本：当前 `main` 分支，已接入 `planId` 本地快照、Trip 真实承接页、客户端 Agent V2 优先增强。

## 联调前准备

1. 在 [miniprogram/config/runtime.js](/Users/bruce/Documents/New%20project/TripAgent/miniprogram/config/runtime.js) 补齐当前环境配置。
   - `cloud.envId`
   - `cloud.functionName`
   - `agent.enabled`
   - `agent.botId`
2. 微信后台配置 `https://jp.trip.com` 为 `web-view` 业务域名。
3. 云开发环境已存在 `travel_events` 集合。
4. 微信开发者工具基础库建议不低于 `3.7.7`，真机微信建议更新到较新版本。
5. 若验证结构化 Agent 规划，请使用以 `agent` 开头的 Agent V2 `botId`；旧版 `ibot...` 只验证聊天面板，不验证 `planTrip` Agent 增强。

## 核心闭环

1. 首页自由输入 `东京情侣 3 天，想看夜景和沉浸式展览`。
   - 预期：成功进入结果页，URL 携带同一个 `planId`；结果页展示结构化行程、POI、Trip 门票。
2. 从结果页打开任一门票详情，再打开 Trip 承接页。
   - 预期：详情页和购买流都沿用同一个 `planId`；Trip 页面可打开；文案为“查看最新价格并预订”。
3. 从 Trip 页返回详情页，再返回结果页。
   - 预期：页面不丢失、不重算，仍显示同一份计划快照。

## 快照与刷新

1. 首页生成一次计划后，退出小程序再重新进入。
   - 预期：聊天页和结果页仍能恢复最近一次 `planId` 对应计划。
2. 结果页下拉刷新。
   - 预期：生成新的计划快照，`planId` 更新；页面不白屏。
3. 人工把本地计划快照时间改为 24 小时前后，再打开结果页。
   - 预期：页面继续展示旧结果，并出现“结果已超过 24 小时，可手动刷新”的提示；不会静默重算。

## Agent 联调

1. `agent.enabled=false` 或 `agent.botId` 为空。
   - 预期：首页和聊天页显示明确诊断，结构化规划稳定 fallback。
2. 使用旧版 `ibot...`。
   - 预期：聊天面板可继续使用，但首页和聊天页诊断会提示“聊天 Agent 可用，结构化规划仍兜底”。
3. 使用 Agent V2 `agent...`。
   - 预期：诊断提示变为“客户端 Agent V2 已满足联调前置条件”；结构化规划可进入 Agent 增强路径。
4. 模拟 Agent 异常或超时。
   - 预期：结果页仍然可用，并带明确 warning；Trip 购买链路不受影响。

## Trip 承接

1. 结果页门票卡片点击主 CTA。
   - 预期：直达 Trip 真实详情页或承接页，不出现复制链接。
2. 关闭 `web-view` 域名配置后重试。
   - 预期：页面给出明确失败反馈，不出现空白页。
3. 逐个验证上海、东京、新加坡的主门票。
   - 预期：三城都能打开真实 Trip 页面。

## 埋点与验收

1. 生成计划后检查 `travel_events`。
   - 预期：存在 `plan_trip_success` 或 `plan_trip_fallback`，带 `planId / city / source / stale`。
2. 打开详情页和购买页后检查 `travel_events`。
   - 预期：存在 `ticket_detail_view`、`purchase_target_resolved`、`purchase_target_opened`，且带 `planId / sku / purchaseMode`。
3. 所有异常场景都验证一次。
   - 预期：不白屏、不静默失败、都有明确提示和继续操作路径。
