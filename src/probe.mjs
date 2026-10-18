// 探路脚本：列出麦当劳 MCP 的全部工具 + 参数 schema，用于核对真实字段。
// 用法：先设置 MCD_MCP_TOKEN，再 npm run probe

import { McpClient, loadDotEnv } from './mcp.mjs';

loadDotEnv();

const token = process.env.MCD_MCP_TOKEN;
if (!token) {
  console.error('请先设置 MCD_MCP_TOKEN 环境变量（PowerShell: $env:MCD_MCP_TOKEN="..."）');
  process.exit(1);
}

const client = new McpClient({ url: 'https://mcp.mcd.cn', token });

const info = await client.initialize();
console.log('# serverInfo');
console.log(JSON.stringify(info, null, 2));

const tools = await client.listTools();
console.log(`\n# 共 ${tools.length} 个工具\n`);

for (const t of tools) {
  console.log(`## ${t.name}`);
  console.log((t.description || '(无描述)').trim());
  console.log('inputSchema:');
  console.log(JSON.stringify(t.inputSchema, null, 2));
  console.log('');
}
