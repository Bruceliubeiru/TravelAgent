# travel-skill TravelAgent 旅行规划与 Trip 门票分销

## 业务流程

```
用户旅行需求
  │
  ├─ 明确城市/天数/偏好 → generateTripPlan → 行程结构化结果
  │                                │
  │                                ├─ recommendPoi → 高转化 POI 列表
  │                                └─ getTripTicket → Trip 门票 SKU/价格/购买目标
  │
  └─ 只问景点/门票 → recommendPoi → getTripTicket
```

## 原子接口

| 接口 | 作用 | 前置条件 |
|------|------|----------|
| generateTripPlan | 生成 1-3 天结构化行程 | 用户提供或可推断目的地城市 |
| recommendPoi | 根据城市和偏好标签推荐 POI | 必须有城市 |
| getTripTicket | 根据 poi_id 获取 Trip 门票与购买目标 | poi_id 必须来自上游接口 |

## 业务约束

- `poi_id` 必须来自 `generateTripPlan` 或 `recommendPoi` 返回值，禁止编造。
- `getTripTicket` 返回前，不得向用户承诺具体价格或可购买状态。
- 行程输出必须保持结构化：`title`、`itinerary`、`pois`、`tickets`。
- POI 排序遵循 PRD：转化率优先，其次热度与线路匹配度。
- MVP 仅覆盖上海、东京、新加坡；其他城市需要先说明当前为占位能力。
- Trip 链路当前默认承接到 `jp.trip.com` 真实活动页；若未来接入正式分销参数或 Trip 小程序路径，可直接替换 `purchaseTarget`。
