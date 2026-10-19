// 麦当劳 MCP 浏览器代理（Cloudflare Worker）
// 用途：绕开 CORS，让静态网页（GitHub Pages）能调用 mcp.mcd.cn 拉取真实数据。
// 安全：Token 仅转发给麦当劳官方 MCP，本代理不记录、不存储、不写日志。

const UPSTREAM = 'https://mcp.mcd.cn';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    try {
      const { token, sessionId, payload } = await request.json();

      if (!token || !payload) {
        return json(
          { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'missing token or payload' } },
          400,
        );
      }

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      };
      if (sessionId) headers['Mcp-Session-Id'] = sessionId;

      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const text = await upstream.text();
      const sid = upstream.headers.get('mcp-session-id');

      const respHeaders = { ...CORS };
      respHeaders['Content-Type'] = upstream.headers.get('content-type') || 'application/json';
      if (sid) respHeaders['Mcp-Session-Id'] = sid;

      return new Response(text, { status: upstream.status, headers: respHeaders });
    } catch (e) {
      return json(
        { jsonrpc: '2.0', id: null, error: { code: -32603, message: String((e && e.message) || e) } },
        500,
      );
    }
  },
};
