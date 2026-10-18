// 麦金卡 ROI：v0.1 探路版。
// 先拉取历史订单与账户信息，打印原始返回；字段校准后在此补全 ROI 计算。
// 用法：先设置 MCD_MCP_TOKEN，再 npm run roi

import { McpClient, resultText, resultIsError } from './mcp.mjs';

const token = process.env.MCD_MCP_TOKEN;
if (!token) {
  console.error('请先设置 MCD_MCP_TOKEN 环境变量（PowerShell: $env:MCD_MCP_TOKEN="..."）');
  process.exit(1);
}

const client = new McpClient({ url: 'https://mcp.mcd.cn', token });

await client.initialize();
const tools = await client.listTools();
const have = new Set(tools.map((t) => t.name));

console.log(`# 可用工具 ${tools.length} 个\n`);

// 1) 历史订单（消费画像的核心数据源）
if (have.has('order-list')) {
  console.log('=== order-list ===');
  const r = await client.callTool('order-list', {});
  console.log(resultIsError(r) ? `[isError]\n${resultText(r)}` : resultText(r));
  console.log('');
} else {
  console.log('order-list 不可用\n');
}

// 2) 我的积分（临期积分可用于顺手下单）
if (have.has('query-my-account')) {
  console.log('=== query-my-account ===');
  const r = await client.callTool('query-my-account', {});
  console.log(resultIsError(r) ? `[isError]\n${resultText(r)}` : resultText(r));
  console.log('');
}

// 3) 可领优惠券
if (have.has('available-coupons')) {
  console.log('=== available-coupons ===');
  const r = await client.callTool('available-coupons', {});
  console.log(resultIsError(r) ? `[isError]\n${resultText(r)}` : resultText(r));
  console.log('');
}

console.log('> v0.1 仅打印原始返回；拿到真实字段后，将在这里补全「总花费/客单价/复购频率/回本周期」的计算。');
