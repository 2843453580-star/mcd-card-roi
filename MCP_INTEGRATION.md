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
| `initialize` | 建立 MCP 会话 | 启动时 |
| `tools/list` | 发现可用工具与参数 schema | 启动时 |
| `order-list` | 拉取历史订单（商品明细 / 金额 / 门店 / 时间） | 情绪层 · 履历 + KPI |
| `query-my-account` | 查询积分（可用 / 累计 / 已过期 / 临期） | 实用层 · 积分止损 |
| `query-meals` | 查询门店菜单（含麦金卡优惠价） | 实用层 · 省钱参谋 |
| `calculate-price` | 有卡 / 无卡金额试算 | 实用层 · 省钱参谋（核价） |

## 调用流程

1. `initialize` → 建立会话，随后发送 `notifications/initialized`
2. `tools/list` → 获取工具清单与输入 schema
3. `order-list` → 拉取用户历史订单
4. 本地聚合：总花费、客单价、复购频率、时段分布、门店、城市轨迹
5. 规则引擎 → 生成人设标签、绩效评级、毒舌点评（**情绪层**）
6. `query-my-account` → 积分档案 + 止损提醒
7. `query-meals` + `calculate-price` → 麦金卡价差 → 省钱建议（**实用层**）
8. 输出完整的「麦门述职报告」卡片

## 业务价值

把「算账」和「情绪」绑在一起，用职场「述职报告」这个全民梗做容器：

- **情绪层（可转发）**：绩效评级 + 人设标签 + 毒舌点评，戳中打工人共鸣，天然适合截图分享；
- **实用层（可执行）**：省钱 / 效率 / 积分止损三条建议，带具体数字，真的能省；
- **个性化**：全部基于用户个人真实订单数据，而非行业平均。

> 注：评级与点评为娱乐化内容；餐品价格、卡权益、积分规则以麦当劳官方渠道为准。
