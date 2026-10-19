// 极简 MCP Streamable HTTP 客户端（零依赖，Node >= 18 自带 fetch）。
// 用于连接麦当劳 MCP Server（https://mcp.mcd.cn）。

import { readFileSync } from 'node:fs';

// 读取本地 .env（若存在），把 KEY=VALUE 注入 process.env（不覆盖已存在的变量）。
export function loadDotEnv(path = '.env') {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* 没有 .env 时忽略 */
  }
}

const JSON_RPC = '2.0';

// 解析 SSE（text/event-stream）响应，取 data: 行的 JSON。
function parseSse(text) {
  let data = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      data += line.slice(5).trimStart();
    }
  }
  if (!data) return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export class McpClient {
  #url;
  #token;
  #id = 0;
  #sessionId = null;

  constructor({ url, token }) {
    if (!url) throw new Error('MCP url 不能为空');
    if (!token) throw new Error('MCD_MCP_TOKEN 不能为空');
    this.#url = url;
    this.#token = token;
  }

  async #post(payload, isNotification = false) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.#token}`,
    };
    if (this.#sessionId) headers['Mcp-Session-Id'] = this.#sessionId;

    const res = await fetch(this.#url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const sid = res.headers.get('mcp-session-id');
    if (sid) this.#sessionId = sid;

    if (isNotification) {
      if (!res.ok && res.status !== 202) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      return;
    }

    if (!res.ok) {
      const body = await res.text();
      const hint =
        res.status === 401
          ? 'Token 无效或未提供'
          : res.status === 429
            ? '触发限流（600 次/分钟）'
            : '';
      throw new Error(`HTTP ${res.status}${hint ? `（${hint}）` : ''}: ${body}`);
    }

    const ct = res.headers.get('content-type') ?? '';
    const raw = await res.text();
    const msg = ct.includes('text/event-stream') ? parseSse(raw) : JSON.parse(raw);

    if (msg && msg.error) {
      throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
    }
    return msg && msg.result;
  }

  async initialize() {
    const result = await this.#post({
      jsonrpc: JSON_RPC,
      id: ++this.#id,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcd-performance-review', version: '0.2.0' },
      },
    });
    await this.#post(
      { jsonrpc: JSON_RPC, method: 'notifications/initialized' },
      true,
    );
    return result;
  }

  async listTools() {
    const result = await this.#post({
      jsonrpc: JSON_RPC,
      id: ++this.#id,
      method: 'tools/list',
      params: {},
    });
    return (result && result.tools) || [];
  }

  async callTool(name, args = {}) {
    return this.#post({
      jsonrpc: JSON_RPC,
      id: ++this.#id,
      method: 'tools/call',
      params: { name, arguments: args },
    });
  }
}

// tools/call 返回 { content: [{ type:'text', text }], isError }，提取纯文本。
export function resultText(result) {
  if (!result) return '';
  if (Array.isArray(result.content)) {
    return result.content
      .filter((c) => c && c.type === 'text')
      .map((c) => c.text)
      .join('\n');
  }
  return String(result);
}

export function resultIsError(result) {
  return !!(result && result.isError);
}

// MCP 工具返回的 text 里通常内嵌了 {"success":true,...} 的原始 JSON，
// 这里把它提取并解析出来；失败返回 null。
export function extractEmbeddedJson(text) {
  if (!text) return null;
  const m = text.match(/\{"success":true[\s\S]*\}$/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
