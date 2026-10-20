// 麦当劳 MCP 的 CORS 中转（阿里云函数计算 FC · Web 函数 · Node.js 18+）
// 让国内网页（GitHub Pages 等静态站）能调用 mcp.mcd.cn 拉取真实数据。
// 安全：Token 只转发给麦当劳官方 MCP，不记录、不存储、不写日志。

const UPSTREAM = 'https://mcp.mcd.cn';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

exports.handler = async function (req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    send(res, 204, CORS, '');
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { ...CORS, 'Content-Type': 'application/json' }, JSON.stringify({ error: 'POST only' }));
    return;
  }

  try {
    let raw = '';
    for await (const chunk of req) raw += chunk;

    const { token, sessionId, payload } = JSON.parse(raw || '{}');
    if (!token || !payload) {
      send(
        res,
        400,
        { ...CORS, 'Content-Type': 'application/json' },
        JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'missing token or payload' } }),
      );
      return;
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

    send(res, upstream.status, respHeaders, text);
  } catch (e) {
    send(
      res,
      500,
      { ...CORS, 'Content-Type': 'application/json' },
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String((e && e.message) || e) } }),
    );
  }
};
