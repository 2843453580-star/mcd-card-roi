# 国内云函数中转（让网页能用真实数据）

## 为什么需要它

静态网页（GitHub Pages）直接调 `mcp.mcd.cn` 会被浏览器 **CORS** 拦截；
国外的免费中转（Cloudflare Workers / Vercel / Netlify）在国内基本访问不了。
所以要用**国内能直连的云函数**做中转。

## 它做什么

一个极简的 HTTP 中转：

```
网页（github.io）
   │  POST { token, sessionId, payload }
   ▼
云函数（阿里云 FC，国内可访问）
   │  转发（带 Authorization）+ 加 CORS 头
   ▼
mcp.mcd.cn（麦当劳官方 MCP）
```

Token 只转发给麦当劳官方 MCP，**不记录、不存储、不写日志**。

## 部署（阿里云函数计算 FC）

1. 打开 https://fc.console.aliyun.com ，创建一个函数
2. 运行环境选 **Node.js 18+**
3. 函数类型选 **Web 函数**
4. 代码：把 `fc-proxy.js` 全部内容粘贴进去
5. 触发器：创建 **HTTP 触发器**，鉴权方式选「无需鉴权」
6. 部署，拿到公网访问地址（形如 `https://xxx.cn-hangzhou.fcapp.run`）

## 接进网页

部署后，把网页里的代理地址改成你的云函数地址：

`docs/index.html` 里：

```js
const WORKER_URL = 'https://你的云函数地址.fcapp.run';
```

改完提交推送，网页的「一键拉取真实报告」就通了（国内直连，不需要翻墙）。

## 其他云平台

- **腾讯云 SCF（API 网关 + 云函数）**：把 `exports.handler = async (req, res)` 换成 SCF 的 `exports.main = async (event, context)`，从 `event.body` 取请求体、`event.headers` 取头，返回 `{ statusCode, headers, body }` 即可。
- **微信云开发 / CloudBase**：同样支持 HTTP 云函数，逻辑一致。

## 注意

- 云函数默认有超时（阿里云 FC 默认 60s），本项目单次请求远小于此，无需调整。
- 免费额度足够个人使用。
- **不要把 Token 写进云函数代码**——Token 由网页端在请求体里传入，云函数只做透传。
