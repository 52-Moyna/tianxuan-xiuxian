import { CURRENCIES } from '../public/js/data.js';
import * as S from '../public/js/systems.js';
import { ensureLifeState, storeItem, inventoryUsed, ART_RECIPES, startTravel } from '../public/js/life.js';
import { serialize, deserialize } from '../public/js/save.js';

let pass = 0, fail = 0;

/* 分层货币辅助：货币分 5 档、1:100 递进，收入/支出都会重新分档，
 * 故「下品灵石」单档账面恒 < 100。测试一律以总资产（下品单位）存取，
 * 避免用单档账面断言——那正是历史 bug 的潜伏方式。 */
const stones = (st) => S.totalStones(st);
function setStones(st, n) {
  st.currencies = st.currencies || {};
  for (const c of CURRENCIES) st.currencies[c] = 0;
  S.addStones(st, n);
}

const ok = (condition, name) => condition ? pass++ : (fail++, console.error('FAIL:', name));

const state = S.createNewGame({
  name: '生活测试', gender: '女', raceId: 'human', ageId: 'young',
  regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot(),
});
ensureLifeState(state);
state.inventory.capacity = 6;
state.inventory.bagName = '小型储物袋';
state.items = state.items.filter((item) => item.类型 === '容器');
ok(state.inventory.bagName === '小型储物袋' && state.inventory.capacity === 6, '储物袋基础容量');
ok(storeItem(state, { 名称: '灵草', 类型: '材料', 数量: 3 }), '材料可以入袋');
ok(inventoryUsed(state) === 3 && state.inventory.used === 3, '堆叠材料按数量占格');
ok(!storeItem(state, { 名称: '铁剑', 类型: '装备', 数量: 2, 等级: 1 }), '空间不足阻止装备入袋');

state.equipment.stash.push({ 名称: '备用剑', 类型: '装备', 等级: 2, 部位: 'weapon', 战力: 3, 描述: '测试' });
state.equipment.stash.push({ 名称: '秘境法宝', 类型: '法宝', 等级: 6, 部位: 'artifact', 战力: 12, 描述: '测试' });
ok(S.equipItem(state, 0) && state.equipment.weapon?.名称 === '备用剑', '普通装备替换');
ok(S.equipItem(state, 0) && state.equipment.artifact?.名称 === '秘境法宝', '法宝独立替换');
ok(state.player.power === S.calcPower(state), '装备法宝计入战力');

setStones(state, 1000);
const travel = startTravel(state, 'nanming');
ok(travel.ok && state.world.travel.destination === 'nanming', '地图开始旅行');
S.nextMonth(state);
ok(state.world.regionId === 'nanming' && state.world.region === '南明离火域', '地图抵达地域');

state.items = [
  { 名称: '百越灵草', 类型: '材料', 数量: 2, 描述: '炼丹材料' },
  { 名称: '海灵珠', 类型: '材料', 数量: 1, 描述: '炼丹材料' },
];
ensureLifeState(state);
const art = S.practiceArt(state, '炼丹', '聚气丹');
ok(art.some((line) => line.includes('聚气丹')), '百艺产出实际丹药');
ok(state.items.some((item) => item.名称 === '聚气丹'), '产物进入储物袋');
ok(state.chronicle.some((entry) => entry.type === '百艺'), '百艺写入仙途纪事');

const files = serialize(state);
const restored = deserialize(files);
ok(restored.world.regionId === 'nanming', '地域存档往返');
ok(restored.equipment.artifact.名称 === '秘境法宝', '法宝存档往返');
ok(restored.inventory.used === inventoryUsed(restored), '容量存档往返');
ok(restored.chronicle.length === state.chronicle.length, '仙途纪事存档往返');

console.log(`\n===== 生活系统专项测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
