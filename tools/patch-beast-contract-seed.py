# -*- coding: utf-8 -*-
"""修复灵兽栖息地死锁 + 修正三处装饰性假承诺文案。

死锁根因：灵兽栖息地罗盘入口以「持有灵兽契约」为唯一门槛，但契约仅在收服成功后才发放，
新玩家无任何契约来源 → 入口永不可见 → 无法收服 → 永远拿不到契约（收服链死锁）。
修复：ensureBeastState 为新玩家/旧档补发初始契约（保证入口可达）；tameBeast 改为缺失时补发避免无限累积。
"""
import io, sys

ROOT = 'public/js'
FILES = {
    'systems': f'{ROOT}/systems.js',
    'codex': f'{ROOT}/codex.js',
    'ui': f'{ROOT}/ui.js',
    'test': 'tests/test-newfeatures.mjs',
}

def replace_once(path, old, new):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    cnt = s.count(old)
    if cnt != 1:
        raise SystemExit(f'[FAIL] {path}: 期望匹配 1 次，实际 {cnt} 次\n---OLD---\n{old}')
    s = s.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] {path}: 已替换 1 处')

# ---------- codex.js: ensureBeastState 补发契约种子 ----------
codex_seed_old = """  state.beasts.maxSlots = Math.max(1, state.beasts.maxSlots || 1);
  if (typeof state.beasts.activeIdx !== 'number') state.beasts.activeIdx = -1;
  return state.beasts;"""
codex_seed_new = """  state.beasts.maxSlots = Math.max(1, state.beasts.maxSlots || 1);
  // 种子「灵兽契约」：栖息地罗盘入口以持有契约为门槛；若玩家无任何契约来源，入口永不可见、
  // 「前往灵兽栖息地」收服链死锁。确保至少持有 1 张，使新玩家/旧档均可达。
  if (state.items && !state.items.some((i) => i.名称 === '灵兽契约')) {
    state.items.push({ 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '收服灵兽后获赠的驯兽凭证，见证你与灵兽的羁绊。', 价值: 0 });
    discoverItem(state, { 名称: '灵兽契约', 类型: '道具' }, true);
  }
  if (typeof state.beasts.activeIdx !== 'number') state.beasts.activeIdx = -1;
  return state.beasts;"""
replace_once(FILES['codex'], codex_seed_old, codex_seed_new)

# ---------- codex.js: 契约图鉴描述（ trophy，非门槛） ----------
codex_entry_old = "  { id: 'item_beast_contract', category: '道具', name: '灵兽契约', rarity: '特殊道具', source: '御兽、东荒机缘、秘境', effect: '解锁灵兽栏，灵兽可在战斗和采集中提供协助。' },"
codex_entry_new = "  { id: 'item_beast_contract', category: '道具', name: '灵兽契约', rarity: '特殊道具', source: '收服灵兽后获赠；东荒机缘、秘境亦有传闻', effect: '收服灵兽后获赠的驯兽凭证，见证你与灵兽的羁绊；灵兽会在战斗与采集中助你一臂之力。' },"
replace_once(FILES['codex'], codex_entry_old, codex_entry_new)

# ---------- systems.js: extraCompassOptions 先确保契约已补发 ----------
sys_extra_old = """export function extraCompassOptions(state) {
  ensureLifeState(state);
  const opts = [];"""
sys_extra_new = """export function extraCompassOptions(state) {
  ensureLifeState(state);
  ensureBeastState(state); // 确保灵兽契约已补发，使栖息地入口可达（修复死锁）
  const opts = [];"""
replace_once(FILES['systems'], sys_extra_old, sys_extra_new)

# ---------- systems.js: tameBeast 契约改为缺失时补发 ----------
sys_tame_old = """    // 首次收服即赠予「灵兽契约」入背包（此前仅解锁图鉴、从不入袋，导致收服罗盘入口永不出现）。
    // 之后每次收服都会稳定补充一张契约，使「前往灵兽栖息地」收服链可持续运转。
    const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '解锁灵兽栏的契约，持有方可前往灵兽栖息地收服灵兽。', 价值: 0 };
    storeItem(state, contract);
    discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });"""
sys_tame_new = """    // 收服成功赠予「灵兽契约」作为驯兽凭证（见证羁绊）。
    // 注：栖息地入口已改为「ensureBeastState 保证至少持有 1 张契约」即可达，故此处仅在缺失时补发，避免无限累积。
    if (!state.items.some((i) => i.名称 === '灵兽契约')) {
      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '收服灵兽后获赠的驯兽凭证，见证你与灵兽的羁绊。', 价值: 0 };
      storeItem(state, contract);
      discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });
    }"""
replace_once(FILES['systems'], sys_tame_old, sys_tame_new)

# ---------- ui.js: 三处装饰性假承诺文案 ----------
ui1_old = '        <div class="opt-desc" style="margin-top:6px"><b>如何收服灵兽：</b>在决策罗盘选择「游历」行动，有概率前往<strong>灵兽栖息地</strong>（需 Lv.5+ 解锁），遭遇野生灵兽后可尝试收服。</div>'
ui1_new = '        <div class="opt-desc" style="margin-top:6px"><b>如何收服灵兽：</b>当灵兽栏有空位时，决策罗盘会出现「前往灵兽栖息地」选项，遭遇野生灵兽后即可尝试收服（御兽等级越高成功率越高）。</div>'
replace_once(FILES['ui'], ui1_old, ui1_new)

ui2_old = '        <div class="opt-desc" style="margin-top:4px"><b>提高成功率：</b>使用「驭兽香」（坊市·消耗品）或「驯兽口粮」可大幅提升收服概率；道缘中「驯兽师」NPC 可传授驭兽技巧。</div>'
ui2_new = '        <div class="opt-desc" style="margin-top:4px"><b>提高成功率：</b>使用「驭兽香」（坊市·消耗品）或「驯兽口粮」（百艺·御兽产出）可提升收服概率；提升百艺「御兽」等级也能增加成功率。</div>'
replace_once(FILES['ui'], ui2_old, ui2_new)

ui3_old = '        <div class="opt-desc" style="margin-top:4px"><b>灵兽加成：</b>已收服的灵兽会在战斗中助阵（提高胜率）并提供固定战力加成。使用「灵兽契约」（图鉴解锁后可获得）可解锁更多栏位。</div>'
ui3_new = '        <div class="opt-desc" style="margin-top:4px"><b>灵兽加成：</b>已收服的灵兽会在战斗中助阵（提高胜率）并提供固定战力加成。成功收服灵兽可获得「灵兽契约」作为驯兽凭证；灵兽栏默认 1 格。</div>'
replace_once(FILES['ui'], ui3_old, ui3_new)

# ---------- test-newfeatures.mjs: 新增确定性断言 ----------
test_old = """contractGroup();
bugPowderGroup();
codexGhostGroup();

console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""
test_new = """contractGroup();
bugPowderGroup();
codexGhostGroup();

/* ---------- 灵兽契约种子：栖息地入口不再死锁 ---------- */
function beastHabitatReachableGroup() {
  // 新玩家（无契约来源）也应能见到「前往灵兽栖息地」入口
  const sb = S.createNewGame({ name: '栖息地可达', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sb);
  ensureBeastState(sb); // 初始化 beasts 并补发契约
  sb.beasts.slots = []; sb.beasts.activeIdx = -1;
  // ensureBeastState 应为新玩家补一张契约（消除「无契约→不可见→无法收服→拿不到契约」死锁）
  ok(sb.items.some((i) => i.名称 === '灵兽契约'), 'ensureBeastState 为新玩家补发灵兽契约（修复死锁）');
  ok(S.extraCompassOptions(sb).some((o) => o.action && o.action.type === 'tameBeast'), '持有契约时「前往灵兽栖息地」入口可见');
  // 收服成功仍只保留 1 张（不无限累积）
  let rr = null;
  for (let k = 0; k < 300 && !(rr && rr.ok); k++) rr = S.tameBeast(sb, { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' }, false);
  ok(rr && rr.ok, '可成功收服灵兽');
  const c2 = sb.items.find((i) => i.名称 === '灵兽契约');
  ok(c2 && c2.数量 === 1, '收服后契约数量仍为 1（不累积）');
}
beastHabitatReachableGroup();

console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""
replace_once(FILES['test'], test_old, test_new)

print('\n全部替换完成。')
