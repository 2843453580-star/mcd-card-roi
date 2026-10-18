// 麦金卡算师 · 主流程
// 拉取历史订单 + 积分 + 门店菜单，输出消费画像与麦金卡 ROI 报告。
import {
  McpClient,
  resultText,
  resultIsError,
  extractEmbeddedJson,
} from './mcp.mjs';

const token = process.env.MCD_MCP_TOKEN;
if (!token) {
  console.error('请先设置 MCD_MCP_TOKEN 环境变量（PowerShell: $env:MCD_MCP_TOKEN="..."）');
  process.exit(1);
}

const client = new McpClient({ url: 'https://mcp.mcd.cn', token });
await client.initialize();
const tools = await client.listTools();
const have = new Set(tools.map((t) => t.name));

const yuan = (fen) => (Number(fen) / 100).toFixed(2);

// ---------- 工具调用辅助 ----------
async function callTool(name, args = {}) {
  const r = await client.callTool(name, args);
  return resultText(r);
}

const orderText = have.has('order-list') ? await callTool('order-list') : '';
const ordersJson = extractEmbeddedJson(orderText);
const orders = (ordersJson && ordersJson.data && ordersJson.data.list) || [];

// ---------- 2) 积分 ----------
let points = null;
if (have.has('query-my-account')) {
  const pt = extractEmbeddedJson(await callTool('query-my-account'));
  points = pt && pt.data ? pt.data : null;
}

// ---------- 3) 门店菜单（取最常去的店，用于麦金卡价差） ----------
function topStore(orders) {
  const m = new Map();
  for (const o of orders) {
    const key = o.storeName || '未知门店';
    m.set(key, (m.get(key) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
}

let cardItems = [];
let storeNameForMenu = null;
const top = topStore(orders);
if (top && have.has('query-meals')) {
  // 用最常去门店的 storeCode 查菜单（历史订单里同店 storeCode 应一致）
  const so = orders.find((o) => o.storeName === top[0]);
  if (so && so.storeCode) {
    storeNameForMenu = top[0];
    const mealText = await callTool('query-meals', {
      storeCode: so.storeCode,
      orderType: 1,
      beType: 1,
    });
    const mealJson = extractEmbeddedJson(mealText);
    const meals = (mealJson && mealJson.data && mealJson.data.meals) || {};
    cardItems = Object.values(meals).filter(
      (m) => m.discountType && String(m.discountType).includes('麦金卡'),
    );
  }
}

// ---------- 计算消费画像 ----------
function fmtTime(createTime) {
  // "2026-08-18 21:21:48"
  return new Date(createTime.replace(' ', 'T'));
}

const orderCount = orders.length;
let totalSpend = 0;
for (const o of orders) totalSpend += Number(o.realTotalAmount || 0);

const avgValue = orderCount ? totalSpend / orderCount : 0;
const times = orders.map((o) => fmtTime(o.createTime)).filter((d) => !isNaN(d));
const first = times.length ? times.reduce((a, b) => (a < b ? a : b)) : null;
const last = times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
const spanDays = first && last ? Math.round((last - first) / 86400000) : 0;
const freqDays = orderCount > 1 && spanDays ? spanDays / (orderCount - 1) : null;
const perMonth = spanDays ? (orderCount / spanDays) * 30 : null;

// 时段分布
const buckets = [
  ['早餐(05-10)', 5, 10],
  ['午餐(10-14)', 10, 14],
  ['下午(14-17)', 14, 17],
  ['晚餐(17-21)', 17, 21],
  ['夜宵(21-05)', 21, 29],
];
const hourCount = {};
for (const t of times) {
  let h = t.getHours();
  if (h < 5) h += 24;
  for (const [label, lo, hi] of buckets) {
    if (h >= lo && h < hi) {
      hourCount[label] = (hourCount[label] || 0) + 1;
      break;
    }
  }
}

// 门店统计
const storeAgg = new Map();
for (const o of orders) {
  const k = o.storeName || '未知门店';
  const cur = storeAgg.get(k) || { count: 0, spend: 0 };
  cur.count += 1;
  cur.spend += Number(o.realTotalAmount || 0);
  storeAgg.set(k, cur);
}
const storeTop = [...storeAgg.entries()].sort((a, b) => b[1].count - a[1].count);

// 餐品统计（按顶层商品名 + 数量）
const prodAgg = new Map();
for (const o of orders) {
  for (const p of o.orderProductList || []) {
    const k = p.productName || p.productCode;
    const cur = prodAgg.get(k) || { qty: 0, orders: 0 };
    cur.qty += Number(p.quantity || 1);
    cur.orders += 1;
    prodAgg.set(k, cur);
  }
}
const prodTop = [...prodAgg.entries()].sort((a, b) => b[1].qty - a[1].qty);

// ---------- 渲染 ----------
const bar = '═'.repeat(52);
console.log(bar);
console.log('  麦门消费画像 · mcd-card-roi');
console.log('  基于麦当劳 MCP 实时数据');
console.log(bar);

console.log('\n【消费概览】');
console.log(`  订单数    ：${orderCount} 单`);
console.log(`  累计花费  ：¥ ${yuan(totalSpend * 100)}`);
console.log(`  客单价    ：¥ ${avgValue.toFixed(2)}`);
if (first && last) {
  console.log(
    `  覆盖时间  ：${first.toISOString().slice(0, 10)} ~ ${last.toISOString().slice(0, 10)}（${spanDays} 天）`,
  );
}
if (perMonth) console.log(`  下单频率  ：约 ${perMonth.toFixed(1)} 单/月${freqDays ? `（每 ${freqDays.toFixed(1)} 天一次）` : ''}`);

console.log('\n【时段分布】');
const hourEntries = Object.entries(hourCount).sort((a, b) => b[1] - a[1]);
if (hourEntries.length) {
  for (const [k, v] of hourEntries) console.log(`  ${k.padEnd(14)} ${v} 单`);
} else {
  console.log('  （无数据）');
}

console.log('\n【最爱门店 TOP3】');
for (const [name, s] of storeTop.slice(0, 3)) {
  console.log(`  ${name.padEnd(30)} ${s.count} 单  ¥${yuan(s.spend * 100)}`);
}

console.log('\n【最常点餐品 TOP5】');
for (const [name, p] of prodTop.slice(0, 5)) {
  console.log(`  ${name.padEnd(28)} ×${p.qty}`);
}

console.log('\n【积分档案】');
if (points) {
  console.log(`  可用积分   ：${points.availablePoint ?? '-'}`);
  console.log(`  累计积分   ：${points.accumulativePoint ?? '-'}`);
  console.log(`  已过期积分 ：${points.expiredPoint ?? '-'}${Number(points.expiredPoint) > 0 ? '  ⚠️ 已浪费' : ''}`);
  console.log(`  本月将过期 ：${points.currentMouthExpirePoint ?? '-'}`);
  console.log(`  下月将过期 ：${points.nextMouthExpirePoint ?? '-'}`);
  const avail = Number(points.availablePoint || 0);
  const curExp = Number(points.currentMouthExpirePoint || 0);
  const nextExp = Number(points.nextMouthExpirePoint || 0);
  if (curExp > 0) console.log(`  → 本月有 ${curExp} 积分将过期，建议尽快在麦麦商城兑换`);
  else if (nextExp > 0) console.log(`  → 下月有 ${nextExp} 积分将过期，留意使用`);
  else if (avail > 0) console.log(`  → 暂无临期积分；${avail} 积分可去麦麦商城兑换`);
} else {
  console.log('  （无积分数据）');
}

console.log('\n【麦金卡测算】');
const CARD_PRICE = 9.9; // 实测：麦金卡体验卡（15天）随单购价格
console.log(`  卡成本：麦金卡体验卡（15天） ¥${CARD_PRICE.toFixed(2)}（实测）`);
if (cardItems.length) {
  console.log(`  数据门店：${storeNameForMenu}`);
  const sorted = cardItems
    .map((m) => ({
      name: m.name,
      orig: Number(m.originalPrice),
      cur: Number(m.currentPrice),
    }))
    .filter((m) => m.orig > m.cur)
    .sort((a, b) => b.orig - b.cur - (a.orig - a.cur));
  console.log('  可解锁价差 TOP5：');
  for (const it of sorted.slice(0, 5)) {
    console.log(
      `    ${it.name.padEnd(24)} ¥${it.orig.toFixed(1)} → ¥${it.cur.toFixed(1)}  省 ¥${(it.orig - it.cur).toFixed(1)}`,
    );
  }
  const avgSave = sorted.length
    ? sorted.reduce((s, it) => s + (it.orig - it.cur), 0) / sorted.length
    : 0;
  console.log(`  测算（${sorted.length} 个麦金卡品项，平均省 ¥${avgSave.toFixed(1)}）：`);
  for (const n of [1, 2, 3]) {
    const save = avgSave * n - CARD_PRICE;
    console.log(`    15 天内点 ${n} 次四件套 → 省 ¥${(avgSave * n).toFixed(1)}，扣卡费净省 ¥${save.toFixed(1)}`);
  }
} else {
  console.log('  （未能获取麦金卡价目）');
}

// 结论
const setMealCount = orders.filter((o) =>
  (o.orderProductList || []).some((p) =>
    /四件套|双人|多人|全家|分享/.test(p.productName || ''),
  ),
).length;
console.log('\n【结论】');
if (setMealCount >= 2) {
  console.log('  你常点四件套/多人餐，麦金卡大概率划算，建议购买体验卡先试 15 天。');
} else {
  console.log(
    `  你历史 ${orderCount} 单里，四件套/多人餐仅 ${setMealCount} 单，以「随心配/小食」为主 —— 麦金卡的四件套价对你目前价值有限。`,
  );
  console.log('  若你愿意把单人点法升级为四件套/双人餐，麦金卡才能省得动。');
}
console.log('\n  ⚠️ 卡价、权益、餐品信息以麦当劳官方为准；本报告仅供参考。');
console.log(bar);
