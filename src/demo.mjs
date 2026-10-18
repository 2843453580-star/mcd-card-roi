// 演示模式：无需 Token，打印一份示例报告（数据为虚构，展示输出格式）。
// 用法：npm run demo

const bar = '═'.repeat(52);
console.log(bar);
console.log('  麦门消费画像 · mcd-card-roi');
console.log('  基于麦当劳 MCP 实时数据（演示数据）');
console.log(bar);

console.log('\n【消费概览】');
console.log('  订单数    ：42 单');
console.log('  累计花费  ：¥ 1086.40');
console.log('  客单价    ：¥ 25.87');
console.log('  覆盖时间  ：2025-10-12 ~ 2026-10-12（365 天）');
console.log('  下单频率  ：约 3.5 单/月（每 8.7 天一次）');

console.log('\n【时段分布】');
console.log('  晚餐(17-21)      18 单');
console.log('  午餐(10-14)      12 单');
console.log('  早餐(05-10)       6 单');
console.log('  夜宵(21-05)       4 单');
console.log('  下午(14-17)       2 单');

console.log('\n【最爱门店 TOP3】');
console.log('  麦当劳广州天河城餐厅               14 单  ¥372.40');
console.log('  麦当劳深圳科兴科学园餐厅            9 单  ¥286.90');
console.log('  麦当劳广州珠江新城餐厅              6 单  ¥158.10');

console.log('\n【最常点餐品 TOP5】');
console.log('  精选超值随心配                      ×18');
console.log('  板烧鸡腿堡四件套                     ×6');
console.log('  10块麦乐鸡                        ×5');
console.log('  原味板烧鸡腿麦满分套餐               ×4');
console.log('  巨无霸四件套                        ×3');

console.log('\n【积分档案】');
console.log('  可用积分   ：580.0');
console.log('  累计积分   ：2040.5');
console.log('  已过期积分 ：320.0  ⚠️ 已浪费');
console.log('  本月将过期 ：0');
console.log('  下月将过期 ：120.0');
console.log('  → 下月有 120 积分将过期，建议尽快在麦麦商城兑换');

console.log('\n【麦金卡测算】');
console.log('  卡成本：麦金卡体验卡（15天） ¥9.90（实测）');
console.log('  数据门店：麦当劳广州天河城餐厅');
console.log('  可解锁价差 TOP5：');
console.log('    全明星双人分享餐八件套              ¥117.0 → ¥49.9  省 ¥67.1');
console.log('    BFF四宫格小食盘双人餐             ¥124.5 → ¥62.9  省 ¥61.6');
console.log('    人气超值四件套随心选               ¥58.5 → ¥28.0  省 ¥30.5');
console.log('    巨无霸四件套                     ¥60.0 → ¥32.0  省 ¥28.0');
console.log('    板烧鸡腿堡四件套                 ¥58.5 → ¥28.0  省 ¥30.5');
console.log('  测算（17 个麦金卡品项，平均省 ¥32.1）：');
console.log('    15 天内点 1 次四件套 → 省 ¥32.1，扣卡费净省 ¥22.2');
console.log('    15 天内点 2 次四件套 → 省 ¥64.2，扣卡费净省 ¥54.3');
console.log('    15 天内点 3 次四件套 → 省 ¥96.2，扣卡费净省 ¥86.3');

console.log('\n【结论】');
console.log('  你历史 42 单里有 9 单四件套/多人餐 —— 若集中到 15 天内点 2 次，');
console.log('  麦金卡扣卡费后仍净省 ¥54+，值得购买体验卡先试 15 天。');

console.log('\n  ⚠️ 卡价、权益、餐品信息以麦当劳官方为准；本报告仅供参考。');
console.log(bar);
