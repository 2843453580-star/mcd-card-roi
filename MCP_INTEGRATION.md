# MCP 集成说明

## 使用的 MCP Server

| 项 | 值 |
|---|---|
| 名称 | 麦当劳 MCP Server |
| 地址 | `https://mcp.mcd.cn` |
| 传输协议 | Streamable HTTP |
| 鉴权方式 | `Authorization: Bearer <MCD_MCP_TOKEN>` |
| 限流 | 每 Token 每分钟最多 600 次请求 |

Token 通过环境变量 `MCD_MCP_TOKEN` 注入，配置示例见 `mcp-config.example.json`（仅使用环境变量占位符，不含真实凭证）。

## 实际使用的 Tool 与调用流程

| Tool | 用途 | 在项目中的调用点 |
|---|---|---|
| `tools/list` | 发现可用工具与参数 schema | 启动时 |
| `initialize` | 建立 MCP 会话 | 启动时 |
| `order-list` | 拉取历史订单，统计消费画像（总花费 / 客单价 / 复购频率） | 第 1 步 |
| `query-meals` | 查询门店在售餐品与价格 | 第 3 步 |
| `query-meal-detail` | 查询套餐组成与可替换项 | 第 3 步 |
| `calculate-price` | 有卡 / 无卡两种方案的金额试算 | 第 4 步 |
| `query-my-account` | 查询积分与临期积分 | 第 5 步 |
| `available-coupons` | 查询可领取的优惠券 | 第 5 步 |

## 调用流程

1. `initialize` → 建立会话，随后发送 `notifications/initialized`
2. `tools/list` → 获取工具清单与输入 schema
3. `order-list` → 拉取用户历史订单
4. 本地聚合统计：总花费、客单价、复购频率、时段分布
5. `query-meals` + `query-meal-detail` + `calculate-price` → 试算麦金卡权益带来的价差
6. 输出：回本周期、是否建议购买、临期积分处置建议

## 业务价值

把「该不该买麦金卡」从主观感觉，变成基于用户个人真实订单数据的量化决策：

- **个性化**：依据用户自己的消费频次与客单价计算，而非行业平均；
- **可分享**：结果天然适合截图转发，降低决策成本；
- **可落地**：结合临期积分与可领优惠券，给出「下一步能省多少」的可执行建议。

> 注：麦金卡价格、权益、有效期以麦当劳官方渠道为准；本项目仅基于 MCP 返回数据做测算。
