/**
 * test-codex.mjs - 图鉴与新增玩法专项测试
 */
import { createNewGame, cultivate, performAction, resolveBattle, makeEnemy, useItem, buyItem, equipGear, tameBeast, exploreMysticRealm, joinSect, doSectTask, openAuction, placeBid, calcPower, powerBreakdown } from '../public/js/systems.js';
import { ensureCodexState, discoverItem, codexEntries, codexStats, activeSetBonuses, setBonusFlags, realmGuide, rollPillQuality, applyPillToxicity, pillSideEffect, beastPowerBonus, ensureBeastState, achievementView, checkAchievements, claimAchievement, claimAllAchievements, ACHIEVEMENTS } from '../public/js/codex.js';
import { ensureLifeState, storeItem, ART_RECIPES } from '../public/js/life.js';
import { serialize, deserialize } from '../public/js/save.js';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log(`FAIL: ${name}`); } }

// 1. 创建角色并初始化图鉴
let st = createNewGame({ raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 1, yunId: 'panshi', name: '测试修士', gender: '男', spiritRoot: { grade: '凡品', gradeId: 'fan', elements: ['金'], speed: 1, desc: '测试' } });
ensureLifeState(st);
ensureCodexState(st);
ok('图鉴初始化', st.codex && Array.isArray(st.codex.discovered));
ok('图鉴发现开局物品', st.codex.discovered.length > 0);

// 2. 手动发现物品
discoverItem(st, { 名称: '聚气丹', 类型: '丹药' });
ok('图鉴发现聚气丹', st.codex.discovered.some((k) => k.includes('聚气丹')));

// 3. 图鉴统计
const stats = codexStats(st);
ok('图鉴统计返回正确结构', stats.totalFound > 0 && stats.totalAll > 0 && stats.byType);
ok('图鉴统计包含丹药分类', stats.byType['丹药'] !== undefined);

// 4. 图鉴条目分类查询
const pillEntries = codexEntries(st, '丹药');
ok('图鉴丹药分类查询', pillEntries.length > 0 && pillEntries.every((e) => e.category === '丹药'));
ok('图鉴条目含discovered字段', pillEntries.every((e) => typeof e.discovered === 'boolean'));

// 5. 境界说明
const guide = realmGuide(1);
ok('境界说明返回凡人境', guide.name === '凡人境');
const guide2 = realmGuide(50);
ok('境界说明返回金丹期', guide2.name === '金丹期');
ok('境界说明含解锁内容', guide.unlock && guide.bottleneck && guide.detail);

// 6. 套装效果（使用六部位装备结构：星辉战甲作为「衣服」部位）
st.equipment.armor = { 名称: '星辉战甲', 类型: '装备', 等级: 3, 部位: 'armor', 战力: 5, 描述: '测试' };
storeItem(st, { 名称: '星砂', 类型: '材料', 数量: 1, 描述: '测试' });
const sets = activeSetBonuses(st);
ok('星辉套装激活', sets.some((s) => s.name === '星辉'));
const flags = setBonusFlags(st);
ok('套装标志含artifactPower', flags.artifactPower >= 2);

// 6b. 套装叠加封顶（多套装同时激活时，战力加成被封顶，避免无上限膨胀）
{
  const build = (maxAll) => {
    const s = createNewGame({ raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 1, yunId: 'panshi', name: '封顶测试', gender: '男', spiritRoot: { grade: '凡品', gradeId: 'fan', elements: ['金'], speed: 1, desc: '测试' } });
    ensureLifeState(s);
    s.equipment.armor = { 名称: '星辉战甲', 类型: '装备', 等级: 3, 部位: 'armor', 战力: 5, 描述: '测试' };
    const items = [
      { 名称: '星纹剑', 类型: '装备', 等级: 3, 部位: 'weapon', 战力: 5, 描述: '测试' },
      { 名称: '火纹刃', 类型: '装备', 等级: 3, 部位: 'weapon', 战力: 5, 描述: '测试' },
      { 名称: '赤铜盾', 类型: '装备', 等级: 3, 部位: 'armor', 战力: 5, 描述: '测试' },
      { 名称: '海兽佩', 类型: '装备', 等级: 3, 部位: 'accessory', 战力: 5, 描述: '测试' },
      { 名称: '远航旗', 类型: '装备', 等级: 3, 部位: 'accessory', 战力: 5, 描述: '测试' },
      { 名称: '妖纹护腕', 类型: '装备', 等级: 3, 部位: 'armor', 战力: 5, 描述: '测试' },
      { 名称: '青风剑', 类型: '装备', 等级: 3, 部位: 'weapon', 战力: 5, 描述: '测试' },
    ];
    if (maxAll) {
      items.push({ 名称: '星砂', 类型: '材料', 数量: 1, 描述: '测试' });   // 星辉→3件
      items.push({ 名称: '地火炉', 类型: '装备', 等级: 3, 部位: 'weapon', 战力: 5, 描述: '测试' }); // 地火→3件
      items.push({ 名称: '海灵佩', 类型: '装备', 等级: 3, 部位: 'accessory', 战力: 5, 描述: '测试' }); // 海行→3件
    }
    for (const it of items) s.items.push(it);
    return s;
  };
  const getSet = (s) => powerBreakdown(s).items.find((i) => i.label === '套装共鸣').value;
  ok('多套装未超限时如实计入(25)', getSet(build(false)) === 25);
  ok('多套装叠加封顶为30(原始37)', getSet(build(true)) === 30);
}

// 7. 丹药品质（固定随机种子，避免概率性抖动）
const _rand = Math.random;
Math.random = () => 0.5;
const q1 = rollPillQuality(0, {});
const q2 = rollPillQuality(100, {});
Math.random = _rand;
ok('0级百艺可能产出废品或凡品', ['废品', '凡品'].includes(q1.grade) || q1.mult >= 0.5);
ok('100级百艺品质更好', q2.mult >= q1.mult);

// 8. 丹毒系统（B② 放宽阈值阶梯：≥35→90% / ≥60→75% / ≥85→55%）
st.flags = { pillToxicity: 0 };
applyPillToxicity(st, 80);
ok('丹毒累加到80', st.flags.pillToxicity === 80);
const side = pillSideEffect(st);
ok('丹毒80现为warn(阈值上移到85)', side && side.level === 'warn');
applyPillToxicity(st, -50);
ok('解毒丹降低丹毒', st.flags.pillToxicity === 30);
// 新阶梯边界断言
ok('丹毒34无提示', pillSideEffect({ flags: { pillToxicity: 34 } }) === null);
ok('丹毒35降至90%', (pillSideEffect({ flags: { pillToxicity: 35 } })?.text || '').includes('90%'));
ok('丹毒60降至75%', (pillSideEffect({ flags: { pillToxicity: 60 } })?.text || '').includes('75%'));
ok('丹毒85降至55%', (pillSideEffect({ flags: { pillToxicity: 85 } })?.text || '').includes('55%'));

// 9. 灵兽系统
ensureBeastState(st);
ok('灵兽栏初始化', st.beasts.slots.length === 0);
const tameR = tameBeast(st, { id: 'wolf', name: '青风狼', element: '风', minLevel: 5, power: 8, skill: '风刃突袭', desc: '测试' }, false);
ok('灵兽收服返回结果', typeof tameR.ok === 'boolean');
if (tameR.ok) {
  ok('灵兽进入栏位', st.beasts.slots.length === 1);
  ok('灵兽战力加成', beastPowerBonus(st) > 0);
}

// 10. 宗门系统
const sectMsg = joinSect(st, '测试宗');
ok('加入宗门', st.sect.name === '测试宗' && st.sect.rank === 1);
const taskR = doSectTask(st, 'patrol');
ok('宗门任务执行', taskR.logs && taskR.logs.length > 0);
ok('宗门贡献增加', st.sect.contribution > 0);

// 11. 拍卖会
const auctionItems = openAuction(st);
ok('拍卖会开启', auctionItems.length > 0 && st.auction.active);
const bidR = placeBid(st, 0, 99999);
ok('拍卖竞价返回结果', typeof bidR.ok === 'boolean');

// 12. 秘境探索（低等级角色无法进入高级秘境，测试青虚秘境）
const mysticR = exploreMysticRealm(st, 'qingxu');
ok('秘境探索返回logs', Array.isArray(mysticR.logs) && mysticR.logs.length > 0);

// 13. 战力计算含灵兽和套装加成
const power = calcPower(st);
ok('战力计算成功', typeof power === 'number' && power > 0);

// 14. 存档往返（图鉴/灵兽/宗门）
const files = serialize(st);
ok('序列化含图鉴.ini', !!files['图鉴.ini']);
ok('序列化含灵兽.ini', !!files['灵兽.ini']);
ok('序列化含宗门.ini', !!files['宗门.ini']);
ok('图鉴.ini含已发现条目', Object.keys(files['图鉴.ini']['已发现']).length > 0);

const st2 = deserialize(files);
if (st2) {
  ok('反序列化还原图鉴', st2.codex && st2.codex.discovered.length > 0);
  ok('反序列化还原灵兽', st2.beasts && Array.isArray(st2.beasts.slots));
  ok('反序列化还原宗门', st2.sect && st2.sect.name === '测试宗');
  ok('反序列化还原丹毒', typeof st2.flags.pillToxicity === 'number');
}

// 15. 丹药使用带丹毒
st.items.push({ 名称: '聚气丹', 类型: '丹药', 数量: 1, 描述: '测试', effect: { exp: 80 }, toxicity: 8 });
const beforeToxic = st.flags.pillToxicity;
const useLogs = useItem(st, st.items.length - 1);
ok('丹药使用返回logs', Array.isArray(useLogs) && useLogs.length > 0);

// 16. 成就奖励领取闭环
{
  const s = createNewGame({ name: '成就测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 1, yunId: 'panshi', spiritRoot: { grade: '凡品', gradeId: 'fan', elements: ['金'], speed: 1, desc: '测试' } });
  ensureLifeState(s);
  ensureCodexState(s);
  s.currencies = s.currencies || {};
  s.currencies['下品灵石'] = 0;
  checkAchievements(s); // 'start' 必然解锁
  const startView = achievementView(s).find((a) => a.id === 'start');
  ok('start 成就解锁且带奖励', startView.unlocked && startView.reward && startView.reward.stones === 100);
  const before = s.currencies['下品灵石'];
  const r1 = claimAchievement(s, 'start');
  ok('领取成功且灵石+100', r1.ok && s.currencies['下品灵石'] === before + 100);
  ok('领取后标记 claimed', achievementView(s).find((a) => a.id === 'start').claimed === true);
  const r2 = claimAchievement(s, 'start');
  ok('重复领取被拒绝', !r2.ok && s.currencies['下品灵石'] === before + 100);
  const r3 = claimAchievement(s, 'phoenix'); // 未解锁
  ok('未解锁成就不可领取', !r3.ok);
  // 存档往返后 claimed 持久化
  const reS = deserialize(serialize(s));
  ok('领取状态存读档持久化', achievementView(reS).find((a) => a.id === 'start').claimed === true);
  // 一键领取：reS 中 start 已领取；mainTech（选定主修功法）与富甲一方为未领，合计发放
  reS.achievements.push({ id: 'rich', name: '富甲一方', icon: '💰', time: '测试' });
  const stonesBeforeAll = reS.currencies['下品灵石'];
  const unclaimedRewards = reS.achievements
    .filter((a) => !a.claimed)
    .reduce((sum, a) => sum + (ACHIEVEMENTS.find((x) => x.id === a.id)?.reward?.stones || 0), 0);
  const ra = claimAllAchievements(reS);
  ok('一键领取发放剩余未领奖励(含mainTech+富甲一方)', ra.ok && ra.total === unclaimedRewards && reS.currencies['下品灵石'] === stonesBeforeAll + unclaimedRewards);
  ok('一键领取后均标记claimed', achievementView(reS).find((a) => a.id === 'rich').claimed === true);
  const ra2 = claimAllAchievements(reS);
  ok('无未领奖励时一键领取返回ok=false', !ra2.ok);
}

console.log(`\n===== 图鉴与新增玩法专项测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
