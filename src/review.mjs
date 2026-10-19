// 麦门述职报告 · 主流程
// 用真实麦当劳订单，生成一份「年度绩效述职」：履历 + KPI + 评级点评 + 改进建议。
import {
  McpClient,
  resultText,
  extractEmbeddedJson,
  loadDotEnv,
} from './mcp.mjs';

loadDotEnv();

const token = process.env.MCD_MCP_TOKEN;
if (!token) {
  console.error('请先设置 MCD_MCP_TOKEN（或复制 .env.example 为 .env 并填入）');
  process.exit(1);
}

const client = new McpClient({ url: 'https://mcp.mcd.cn', token });
await client.initialize();
const tools = await client.listTools();
const have = new Set(tools.map((t) => t.name));

async function callTool(name, args = {}) {
  const r = await client.callTool(name, args);
  return resultText(r);
}

const yuan = (fen) => (Number(fen) / 100).toFixed(2);

// ---------- 取数 ----------
const ordersJson = extractEmbeddedJson(await callTool('order-list'));
const orders = (ordersJson && ordersJson.data && ordersJson.data.list) || [];

let points = null;
if (have.has('query-my-account')) {
  const pj = extractEmbeddedJson(await callTool('query-my-account'));
  points = pj && pj.data ? pj.data : null;
}

// ---------- 画像计算 ----------
const fmtTime = (s) => new Date(String(s).replace(' ', 'T'));
const orderCount = orders.length;
let totalSpend = 0;
for (const o of orders) totalSpend += Number(o.realTotalAmount || 0);
const avgValue = orderCount ? totalSpend / orderCount : 0;

const times = orders.map((o) => fmtTime(o.createTime)).filter((d) => !isNaN(d));
const first = times.length ? times.reduce((a, b) => (a < b ? a : b)) : null;
const last = times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
const spanDays = first && last ? Math.round((last - first) / 86400000) : 0;
const perMonth = spanDays ? (orderCount / spanDays) * 30 : null;
const freqDays = orderCount > 1 && spanDays ? spanDays / (orderCount - 1) : null;

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

// 门店统计（含城市）
const storeAgg = new Map();
for (const o of orders) {
  const k = o.storeName || '未知门店';
  const cur = storeAgg.get(k) || { count: 0, spend: 0 };
  cur.count += 1;
  cur.spend += Number(o.realTotalAmount || 0);
  storeAgg.set(k, cur);
}
const storeTop = [...storeAgg.entries()].sort((a, b) => b[1].count - a[1].count);

// 常见城市名（用于从门店名中提取城市）
const CITY_LIST = '北京 上海 广州 深圳 天津 重庆 杭州 南京 苏州 成都 武汉 西安 长沙 郑州 青岛 济南 合肥 福州 厦门 南昌 昆明 贵阳 南宁 海口 三亚 哈尔滨 长春 沈阳 大连 石家庄 太原 呼和浩特 乌鲁木齐 兰州 西宁 银川 珠海 佛山 东莞 中山 惠州 江门 汕头 湛江 温州 宁波 嘉兴 绍兴 金华 台州 泉州 漳州 无锡 常州 南通 徐州 扬州 镇江 盐城 烟台 潍坊 临沂 洛阳 唐山 保定 廊坊 邯郸'.split(' ');
const cities = new Set();
for (const o of orders) {
  const name = String(o.storeName || '');
  for (const c of CITY_LIST) {
    if (name.includes(c)) {
      cities.add(c);
      break;
    }
  }
}

// 餐品统计
const prodAgg = new Map();
for (const o of orders) {
  for (const p of o.orderProductList || []) {
    const k = p.productName || p.productCode;
    const cur = prodAgg.get(k) || { qty: 0 };
    cur.qty += Number(p.quantity || 1);
    prodAgg.set(k, cur);
  }
}
const prodTop = [...prodAgg.entries()].sort((a, b) => b[1].qty - a[1].qty);

// ---------- 人设标签 ----------
const tags = [];
const has = (re) => orders.some((o) => (o.orderProductList || []).some((p) => re.test(p.productName || '')));
const suixin = orders.filter((o) => (o.orderProductList || []).some((p) => /随心配|1\+1|6\+3/.test(p.productName || ''))).length;
if (orderCount && suixin / orderCount >= 0.4) tags.push('随心配信徒');
const setMeal = orders.filter((o) => (o.orderProductList || []).some((p) => /四件套|双人|多人|全家|分享/.test(p.productName || ''))).length;
if (orderCount && setMeal / orderCount >= 0.3) tags.push('四件套贵族');
if ((hourCount['夜宵(21-05)'] || 0) >= 2) tags.push('深夜麦门人');
if ((hourCount['早餐(05-10)'] || 0) >= Math.max(2, orderCount * 0.3)) tags.push('早餐打卡党');
if (cities.size >= 3) tags.push('漂泊麦门客');
if (!tags.length) tags.push('麦门普通路人');

// ---------- 绩效评级 ----------
function computeGrade(avg, perM, count) {
  let s = 0;
  if (avg >= 40) s += 2;
  else if (avg >= 30) s += 1.5;
  else if (avg >= 20) s += 1;
  else s += 0.5;
  if (perM >= 4) s += 2;
  else if (perM >= 2) s += 1;
  else s += 0.5;
  if (count >= 30) s += 1;
  else if (count >= 15) s += 0.5;
  if (s >= 4.5) return 'S';
  if (s >= 3.5) return 'A';
  if (s >= 2.5) return 'B';
  if (s >= 2) return 'C+';
  if (s >= 1.5) return 'C-';
  return 'D';
}
const grade = computeGrade(avgValue, perMonth || 0, orderCount);

// ---------- 毒舌点评 ----------
function roast(tagsArr, avg, count, cityCount) {
  const lines = [];
  if (tagsArr.includes('随心配信徒')) {
    lines.push(`一年只来 ${count} 次，还专挑 ¥13.9 的随心配点——麦门不差你这点钱，但谢谢你坚持。`);
  }
  if (tagsArr.includes('深夜麦门人')) {
    lines.push('你的订单总在深夜出没，麦门怀疑你在躲老板，可惜躲不过麦门的监控。');
  }
  if (tagsArr.includes('漂泊麦门客')) {
    lines.push(`你在 ${cityCount} 座城市点过单，麦门以为你在全国巡回吃汉堡。`);
  }
  if (tagsArr.includes('早餐打卡党')) {
    lines.push('早起上班还坚持麦门早餐，麦门决定给你颁一个「最卷早餐奖」。');
  }
  if (tagsArr.includes('四件套贵族')) {
    lines.push('顿顿四件套，麦门认证你为尊贵的 VIP 客户。');
  }
  if (!lines.length) {
    lines.push(`客单价 ¥${avg.toFixed(1)}，麦门评语：来都来了，别只点甜筒。`);
  }
  return lines;
}
const roasts = roast(tags, avgValue, orderCount, cities.size);

// ---------- 麦门年度颁奖（独家记忆点：根据数据颁一个专属奖） ----------
function award(tagsArr, gradeVal) {
  if (gradeVal === 'S') return '麦门终身成就奖';
  if (gradeVal === 'A') return '麦门模范员工奖';
  if (tagsArr.includes('四件套贵族')) return '麦门 VIP 金卡奖';
  if (tagsArr.includes('早餐打卡党')) return '最卷打工人奖';
  if (tagsArr.includes('深夜麦门人')) return '深夜加班陪伴奖';
  if (tagsArr.includes('漂泊麦门客')) return '全国巡回吃堡奖';
  if (tagsArr.includes('随心配信徒')) return '年度最抠门奖';
  return '麦门潜力新人奖';
}
const awardTitle = award(tags, grade);

// ---------- 省钱参谋（改进建议） ----------
let cardItems = [];
let topStoreName = storeTop.length ? storeTop[0][0] : null;
if (topStoreName && have.has('query-meals')) {
  const so = orders.find((o) => o.storeName === topStoreName);
  if (so && so.storeCode) {
    const mealJson = extractEmbeddedJson(
      await callTool('query-meals', { storeCode: so.storeCode, orderType: 1, beType: 1 }),
    );
    const meals = (mealJson && mealJson.data && mealJson.data.meals) || {};
    cardItems = Object.values(meals).filter(
      (m) => m.discountType && String(m.discountType).includes('麦金卡'),
    );
  }
}
const sorted = cardItems
  .map((m) => ({ name: m.name, orig: Number(m.originalPrice), cur: Number(m.currentPrice) }))
  .filter((m) => m.orig > m.cur)
  .sort((a, b) => b.orig - b.cur - (a.orig - a.cur));
const singleSet = sorted.filter(
  (m) => /四件套/.test(m.name) && !/双人|多人|全家|分享|八件套/.test(m.name),
);
const avgSave = sorted.length
  ? sorted.reduce((s, it) => s + (it.orig - it.cur), 0) / sorted.length
  : 0;
const CARD_PRICE = 9.9; // 实测：麦金卡体验卡（15天）随单购价

// ---------- 渲染 ----------
const line = '─'.repeat(52);
const eq = '═'.repeat(52);
console.log(eq);
console.log('  麦门述职报告 · 年度绩效回顾');
console.log('  McDonald\'s Performance Review');
console.log(eq);

console.log('\n【一、你的麦门履历】');
if (first) console.log(`  入职麦门（首单）：${first.toISOString().slice(0, 10)}`);
if (spanDays >= 0) console.log(`  在岗时长：${spanDays} 天${spanDays < 365 ? '（还在实习期）' : ''}`);
console.log(`  服务门店：${storeAgg.size} 家（覆盖 ${cities.size} 座城市）`);
console.log(`  累计点单 ${orderCount} 次，贡献 ¥${totalSpend.toFixed(2)}`);

console.log('\n【二、核心 KPI 达成情况】');
console.log(`  ├─ 订单量　　：${orderCount} 单`);
console.log(`  ├─ 客单价　　：¥${avgValue.toFixed(2)}${avgValue < 30 ? '（偏低，低于四件套标准线）' : ''}`);
console.log(`  ├─ 复购频率　：${perMonth ? `每月 ${perMonth.toFixed(1)} 单` : '—'}${freqDays ? `（每 ${freqDays.toFixed(1)} 天一次）` : ''}`);
const peak = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
if (peak) console.log(`  ├─ 时段偏好　：${peak[0].replace(/\(.*\)/, '')}党（${peak[1]}/${orderCount} 单）`);
if (prodTop.length) console.log(`  └─ 常点产品　：${prodTop[0][0]} ×${prodTop[0][1].qty}`);

console.log('\n【三、绩效评级】');
console.log(`  人设标签：${tags.join(' · ')}`);
console.log(`  综合评级：${grade}${grade === 'S' ? '（麦门终身成就奖）' : grade === 'A' ? '（麦门模范员工）' : grade === 'B' ? '（稳定输出）' : grade === 'C+' ? '（凑合）' : grade === 'C-' ? '（抠搜但忠诚）' : '（试用期观察）'}`);
console.log('  老板点评：');
for (const r of roasts) console.log(`    「${r}」`);
console.log(`  年度奖项：${awardTitle}`);

console.log('\n【四、绩效改进建议（下一年怎么点更省）】');
const pick = singleSet[0] || sorted[0];
console.log('  ① 省钱：');
if (pick) {
  console.log(`     把你常点的「随心配」里的 2 单，升级成${pick.name}（¥${pick.orig.toFixed(1)}→¥${pick.cur.toFixed(1)}）`);
  console.log(`     加麦金卡体验卡（15 天 ¥${CARD_PRICE.toFixed(1)}），15 天内点 2 次净省 ¥${(avgSave * 2 - CARD_PRICE).toFixed(1)}`);
} else {
  console.log('     （当前门店未返回麦金卡价目，略）');
}
console.log('  ② 效率：');
if (topStoreName) {
  console.log(`     你最常去「${topStoreName}」，午休最快：${pick ? `${pick.name} ¥${pick.cur.toFixed(1)}` : '招牌套餐'}，到店自取`);
}
console.log('  ③ 积分止损：');
if (points) {
  const avail = Number(points.availablePoint || 0);
  const expired = Number(points.expiredPoint || 0);
  console.log(`     你已有 ${expired} 积分悄悄过期；现有 ${avail} 积分可用，去麦麦商城兑换，别再让它过期`);
} else {
  console.log('     （无积分数据）');
}

console.log('\n' + line);
console.log('  注：评级与点评为娱乐化打分；省钱建议基于实时菜单计算。');
console.log('  餐品价格、卡权益、供应状态以麦当劳官方为准。');
console.log(eq);
