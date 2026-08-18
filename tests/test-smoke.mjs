// 冒烟测试：不依赖浏览器，直接驱动核心玩法模块
import * as S from '../public/js/systems.js';
import { serialize, deserialize } from '../public/js/save.js';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } };

// 1. 创建角色
const root = S.rollSpiritRoot();
const st = S.createNewGame({
  name: '测试道人', gender: '男', raceId: 'human', ageId: 'young',
  regionId: 'zhongzhou', packId: 1, yunId: 'panshi', spiritRoot: root,
});
ok(st.player.name === '测试道人', '创建角色');
ok(st.npcs.length >= 10 && st.npcs.length <= 15, 'NPC生成数量');
ok(st.destiny.lineName === '圣体之路', '天命绑定');
ok(st.currencies['下品灵石'] === 10, '开局灵石');

// 2. 修炼升级
let before = st.player.level;
for (let i = 0; i < 12; i++) S.cultivate(st, 'seclusion');
ok(st.player.level > before, `修炼升级 Lv.${before}->${st.player.level}`);

// 3. 货币
S.addStones(st, 250);
ok(st.currencies['中品灵石'] === 2 && st.currencies['下品灵石'] === 60, `货币进位 ${st.currencies['下品灵石']}下 ${st.currencies['中品灵石']}中`);
ok(S.spendStones(st, 100), '消费');
ok(S.totalStones(st) === 160, `余额 ${S.totalStones(st)}`);

// 4. 瓶颈与渡劫
st.player.level = 10; st.player.exp = 50;
ok(!!S.checkBottleneck(st), '瓶颈检测');
const bt = S.attemptBreakthrough(st);
ok(bt.waves.length >= 1 && bt.waves.length <= 5 && typeof bt.success === 'boolean', `渡劫(${bt.success ? '成' : '败'})`);

// 5. 战斗
const enemy = S.makeEnemy(st, { beast: true });
const rep = S.resolveBattle(st, enemy, 'yaoshou', false);
ok(typeof rep.win === 'boolean' && rep.logs.length > 0, '战斗结算');
const dice = S.rollFateDice(st);
ok(dice && dice.name, `命运骰子:${dice.name}`);

// 6. 天命推进
const d0 = st.destiny.stage;
const adv = S.advanceDestiny(st);
ok(st.destiny.stage === d0 + 1 && adv.logs.length > 0, '天命推进');

// 7. 商店买卖
const stock = S.shopStock(st);
S.addStones(st, 100000);
const msg = S.buyItem(st, stock[0]);
ok(msg.includes('购得'), '购买');
ok(st.items.length > 0, '物品入袋');
const sellIndex = st.items.findIndex((item) => item.类型 !== '容器');
const sold = S.sellItem(st, sellIndex);
ok(sold.includes('售出'), '出售');

// 8. NPC 互动
const npc = st.npcs[0];
const f0 = npc.favor;
S.interactNpc(st, npc, 'chat');
ok(npc.favor > f0, 'NPC好感');

// 9. 百艺
const artLogs = S.practiceArt(st, '炼丹');
ok(artLogs.length >= 2, '百艺研习');

// 10. 月度推进
const nm = S.nextMonth(st);
ok(st.world.month === 2 && !nm.dead, '月份推进');
for (let i = 0; i < 11; i++) S.nextMonth(st);
ok(st.world.year === 1001 && st.player.age > 16, '跨年+骨龄');

// 11. 罗盘生成
const opts = S.generateCompass(st);
ok(opts.length >= 5, `罗盘选项 ${opts.length} 个`);

// 12. 存档序列化往返
const files = serialize(st);
ok(files['个人信息.ini'] && files['货币.ini'] && files['天命.ini'], '序列化文件齐全');
const st2 = deserialize(files);
ok(st2.player.name === st.player.name, '反序列化-姓名');
ok(st2.player.level === st.player.level, '反序列化-等级');
ok(st2.player.daoBase['根骨'].level === st.player.daoBase['根骨'].level, '反序列化-道基');
ok(st2.techniques.length === st.techniques.length, '反序列化-功法');
ok(st2.npcs.length === st.npcs.length, '反序列化-NPC');
ok(st2.destiny.stage === st.destiny.stage, '反序列化-天命');
ok(st2.world.year === st.world.year, '反序列化-时间');
ok(S.totalStones(st2) === S.totalStones(st), '反序列化-灵石');

// 13. 轮回继承
const inh = S.reincarnate(st, false);
ok(inh.stones > 0 && inh.daoBase, '轮回继承');

console.log(`\n===== 冒烟测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
