// 存读档回路测试：证明并防止序列化/反序列化不对称
// 运行：node test-save.mjs
import * as S from '../public/js/systems.js';
import { serialize, deserialize } from '../public/js/save.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } };

// 1. 创建角色并制造真实状态
const st = S.createNewGame({
  name: '回路测试', gender: '男', raceId: 'human', ageId: 'young',
  regionId: 'zhongzhou', packId: 1, yunId: 'panshi',
  spiritRoot: { grade: '上品', gradeId: 'shang', elements: ['金'], speed: 1.2, desc: '测试' },
});
S.cultivate(st, 'seclusion');
// 普通装备 + 法宝 各一件（六部位结构：放入备用后装备）
st.equipment.stash.push({ 名称: '青锋剑', 类型: '装备', 等级: 3, 部位: 'weapon', 战力: 5, 描述: '测试剑' });
st.equipment.stash.push({ 名称: '玄火鉴', 类型: '法宝', 等级: 6, 部位: 'artifact', 战力: 12, 描述: '测试法宝' });
S.equipItem(st, 0); // 装备青锋剑到武器
S.equipItem(st, 0); // 装备玄火鉴到法宝（备用已移位）
// 伤势 + 同行道友（这些在旧版存档中会丢失）
st.flags.wounded = 2;
st.flags.companion = '云霜仙子';
st.flags.companionMonths = 3;
// 运行期计数 / 一次性 flag（旧版存档会丢失）
st.flags.refinedPills = 17;
st.flags.curedWounds = true;
st.flags.tribulationSuccess = true;
st.flags.cultivateBoostMonths = 4;
st.flags.nextBattleWin = 5;
// 天机运势：驱动修炼/悟性/交易倍率，必须随档持久化（否则存读档后有效运势静默消失）
st.flags.omen = { kind: 'cultivate', icon: '🌟', label: '紫气东来', desc: '近期修炼倍率提升', mul: 1.15, add: 0, expireYear: st.world.year + 1, expireMonth: st.world.month };

// 2. 序列化 -> 反序列化
const files = serialize(st);
const rt = deserialize(files);

// 3. 断言：装备/法宝不复用、不串格
ok('普通装备栏数量正确', rt.equipment.weapon?.名称 === '青锋剑');
ok('法宝栏数量正确', rt.equipment.artifact?.名称 === '玄火鉴');
ok('普通装备内容正确', rt.equipment.weapon?.名称 === '青锋剑');
ok('法宝内容正确', rt.equipment.artifact?.名称 === '玄火鉴');
ok('法宝未串入普通装备栏', rt.equipment.weapon?.名称 !== '玄火鉴');

// 4. 断言：伤势与同行状态保留
ok('伤势保留', rt.flags.wounded === 2);
ok('同行道友保留', rt.flags.companion === '云霜仙子');
ok('同行月数保留', rt.flags.companionMonths === 3);
// 运行期计数 / 一次性 flag 跨存档保留
ok('炼丹计数保留', rt.flags.refinedPills === 17);
ok('曾疗伤flag保留', rt.flags.curedWounds === true);
ok('曾渡劫flag保留', rt.flags.tribulationSuccess === true);
ok('聚灵加成余月保留', rt.flags.cultivateBoostMonths === 4);
ok('战前增益保留', rt.flags.nextBattleWin === 5);
ok('天机运势对象保留', !!rt.flags.omen);
ok('天机运势类型保留', rt.flags.omen && rt.flags.omen.kind === 'cultivate');
ok('天机运势倍率保留', rt.flags.omen && Math.abs(rt.flags.omen.mul - 1.15) < 1e-9);

// 5. 断言：基础字段回路一致
ok('姓名回路', rt.player.name === '回路测试');
ok('等级回路', rt.player.level === st.player.level);
ok('境界名回路', rt.player.realmName === st.player.realmName);
ok('灵石回路', rt.currencies['下品灵石'] === st.currencies['下品灵石']);
ok('天命主线回路', rt.destiny.lineName === st.destiny.lineName);
ok('法宝存在于法宝栏回路', rt.equipment.artifact?.名称 === '玄火鉴');

// 6. 仅持有法宝、无普通装备的极端场景（旧版会把法宝重复载入普通栏）
const st2 = S.createNewGame({
  name: '仅法宝', gender: '女', raceId: 'ling', ageId: 'prime',
  regionId: 'beiming', packId: 2, yunId: 'qihuo',
  spiritRoot: { grade: '极品', gradeId: 'ji', elements: ['水'], speed: 1.5, desc: '测试' },
});
st2.equipment.stash.push({ 名称: '寒玉佩', 类型: '法宝', 等级: 7, 部位: 'artifact', 战力: 14, 描述: '测试法宝' });
S.equipItem(st2, 0);
const rt2 = deserialize(serialize(st2));
ok('仅法宝时普通装备栏为空', rt2.equipment.weapon === null);
ok('仅法宝时法宝栏数量为1', rt2.equipment.artifact?.名称 === '寒玉佩');
ok('仅法宝时不串格', rt2.equipment.weapon?.名称 !== '寒玉佩');

// 7. 旧档（不含新增字段）兼容：缺字段不报错且给默认 0/false
const st3 = S.createNewGame({
  name: '旧档兼容', gender: '男', raceId: 'human', ageId: 'young',
  regionId: 'zhongzhou', packId: 1, yunId: 'panshi',
  spiritRoot: { grade: '上品', gradeId: 'shang', elements: ['金'], speed: 1.2, desc: '测试' },
});
const rt3 = deserialize(serialize(st3));
ok('旧档炼丹计数默认0', rt3.flags.refinedPills === 0);
ok('旧档曾疗伤默认false', rt3.flags.curedWounds === false);
ok('旧档曾渡劫默认false', rt3.flags.tribulationSuccess === false);
ok('旧档聚灵余月默认0', rt3.flags.cultivateBoostMonths === 0);
ok('旧档战前增益默认0', rt3.flags.nextBattleWin === 0);
ok('旧档天机运势默认null', rt3.flags.omen === null);

// 8. 聚灵阵 / 引泉 持久化回路（防存读档丢失洞府进度）
st.cave.springLevel = 2;
st.cave.arrayLevel = 4;
const rt4 = deserialize(serialize(st));
ok('聚灵阵重数随档持久化', rt4.cave.arrayLevel === 4);
ok('引泉重数随档持久化', rt4.cave.springLevel === 2);
// 旧档（序列化不含新字段）兼容：默认 0
const rt5 = deserialize(serialize(st3));
ok('旧档聚灵阵重数默认0', rt5.cave.arrayLevel === 0);
ok('旧档引泉重数默认0', rt5.cave.springLevel === 0);

console.log(`
存读档回路测试：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
