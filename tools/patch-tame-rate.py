# -*- coding: utf-8 -*-
"""补丁：灵兽收服成功率确定性预览（tameBeastRate 纯函数 + UI 徽标 + 样式 + 测试）。"""
import io, os, sys

ROOT = 'Z:/1/xiuxian'

def read(p):
    with io.open(os.path.join(ROOT, p), 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)

# ---------- 1) systems.js：重构 tameBeast 并新增 tameBeastRate ----------
sys_js = read('public/js/systems.js')
lines = sys_js.split('\n')
# 定位 tameBeast 函数起点
start = None
for i, ln in enumerate(lines):
    if ln.startswith('export function tameBeast(state, beastTemplate, useIncense = false) {'):
        start = i
        break
assert start is not None, '未找到 tameBeast 起点'
# 括号匹配定位终点
depth = 0
end = None
for j in range(start, len(lines)):
    for ch in lines[j]:
        if ch == '{': depth += 1
        elif ch == '}': depth -= 1
    if depth == 0:
        end = j
        break
assert end is not None, '未找到 tameBeast 终点'

new_fn = '''export function tameBeast(state, beastTemplate, useIncense = false) {
  ensureLifeState(state);
  ensureBeastState(state);
  if (!canTameBeast(state)) return { ok: false, logs: ['灵兽栏已满，无法再收服新灵兽。'] };
  const beast = { ...beastTemplate, power: beastTemplate.power + Rng.int(-2, 4), tamed: true };
  // 先按当前状态算成功率（含自动投喂驯兽口粮），再消耗道具，保证数值与预览一致
  const rate = tameBeastRate(state, beastTemplate, useIncense);
  let usedFood = false;
  if (useIncense) {
    const idx = state.items.findIndex((i) => i.名称 === '驭兽香');
    if (idx >= 0) {
      state.items[idx].数量 -= 1;
      if (state.items[idx].数量 <= 0) state.items.splice(idx, 1);
    }
  }
  // 驯兽口粮（百艺御兽产出）：持有则自动投喂，提高收服成功率（落实图鉴/UI「可大幅提升收服概率」的承诺，消除死道具）
  const foodIdx = state.items.findIndex((i) => i.名称 === '驯兽口粮');
  if (foodIdx >= 0) {
    const food = state.items[foodIdx];
    food.数量 -= 1;
    if (food.数量 <= 0) state.items.splice(foodIdx, 1);
    usedFood = true;
  }
  const foodNote = usedFood ? '（已投喂驯兽口粮，收服概率提升）' : '';
  if (Rng.chance(rate / 100)) {
    state.beasts.slots.push(beast);
    state.beasts.tamedCount += 1;
    if (state.beasts.activeIdx < 0) state.beasts.activeIdx = state.beasts.slots.length - 1;
    // 收服成功赠予「灵兽契约」作为驯兽凭证（见证羁绊）；仅在缺失时补发，避免重复累积。
    if (!state.items.some((i) => i.名称 === '灵兽契约')) {
      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。', 价值: 0, effect: { beastSlot: 1 } };
      storeItem(state, contract);
      discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });
    }
    discoverItem(state, { 名称: beast.name, 类型: '灵兽' });
    addLog(state, '事件', `成功收服灵兽「${beast.name}」，战力加成 +${beast.power}。`);
    makeChronicle(state, { type: '灵兽', title: `收服${beast.name}`, text: `你收服了${beast.name}，它将协助你战斗与采集。` });
    refreshDerived(state);
    return { ok: true, logs: [`你成功收服「${beast.name}」！${beast.desc} 战力 +${beast.power}。${foodNote}`] };
  }
  return { ok: false, logs: [`收服失败，「${beast.name}」挣脱了你的束缚，扬长而去。${foodNote}`] };
}

/** 灵兽收服成功率预览：纯函数，不消耗状态，与 tameBeast 同口径（确定性、无 RNG） */
export function tameBeastRate(state, beastTemplate, useIncense = false) {
  ensureLifeState(state);
  ensureBeastState(state);
  let rate = 30 + (state.arts['御兽']?.level || 0) * 2;
  if (useIncense && state.items.some((i) => i.名称 === '驭兽香')) rate += 20;
  const food = state.items.find((i) => i.名称 === '驯兽口粮');
  if (food) rate += (food.effect && typeof food.effect.tame === 'number') ? food.effect.tame : 15;
  if (state.player.level < beastTemplate.minLevel) rate -= 20;
  rate = Math.min(90, Math.max(10, rate));
  return rate;
}'''

sys_js = '\n'.join(lines[:start] + new_fn.split('\n') + lines[end + 1:])
write('public/js/systems.js', sys_js)
print('systems.js 已更新')

# ---------- 2) ui.js：灵兽栖息地卡片显示预估收服率 ----------
ui_js = read('public/js/ui.js')
old_a = '''  const beasts = CX.BEAST_TEMPLATES.filter((b) => st.player.level >= b.minLevel - 10);
  const m = openModal(`
    <div class="choice-intro">你前往灵兽栖息地。御兽等级越高，收服成功率越高。当前灵兽栏：${st.beasts?.slots?.length || 0}/${st.beasts?.maxSlots || 1}。</div>'''
new_a = '''  const beasts = CX.BEAST_TEMPLATES.filter((b) => st.player.level >= b.minLevel - 10);
  const hasIncense = st.items.some((i) => i.名称 === '驭兽香');
  const m = openModal(`
    <div class="choice-intro">你前往灵兽栖息地。御兽等级越高，收服成功率越高；下方为各灵兽预估收服率。当前灵兽栏：${st.beasts?.slots?.length || 0}/${st.beasts?.maxSlots || 1}。</div>'''
assert old_a in ui_js, 'ui.js 锚点A未命中'
ui_js = ui_js.replace(old_a, new_a, 1)

old_b = '''    ${beasts.map((b, i) => `<div class="beast-slot">
      <div class="beast-name">🐺 ${b.name} <span class="codex-rarity">Lv.${b.minLevel}+</span></div>
      <div class="beast-skill">技能：${b.skill}</div>
      <div class="beast-desc">${b.desc} 战力加成 +${b.power}</div>
      <div class="modal-actions"><button class="btn btn-sm btn-gold" data-beast="${i}">尝试收服</button></div>
    </div>`).join('')}'''
new_b = '''    ${beasts.map((b, i) => { const rt = S.tameBeastRate(st, b, false); const rtCls = rt >= 70 ? 'wr-high' : rt >= 40 ? 'wr-mid' : 'wr-low'; const rtInc = hasIncense ? '（用驭兽香 +20%）' : ''; return `<div class="beast-slot">
      <div class="beast-name">🐺 ${b.name} <span class="codex-rarity">Lv.${b.minLevel}+</span></div>
      <div class="beast-skill">技能：${b.skill}</div>
      <div class="beast-desc">${b.desc} 战力加成 +${b.power}</div>
      <div class="beast-rate"><span class="region-winrate ${rtCls}">预估收服率 ${rt}%</span>${rtInc}</div>
      <div class="modal-actions"><button class="btn btn-sm btn-gold" data-beast="${i}">尝试收服</button></div>
    </div>`; }).join('')}'''
assert old_b in ui_js, 'ui.js 锚点B未命中'
ui_js = ui_js.replace(old_b, new_b, 1)
write('public/js/ui.js', ui_js)
print('ui.js 已更新')

# ---------- 3) main.css：补充 beast-rate 样式 ----------
css = read('public/css/main.css')
old_c = '.region-winrate.wr-low { color: var(--danger); border: 1px solid rgba(225,110,110,.5); }'
new_c = old_c + '\n.beast-rate { margin: 4px 0 2px; font-size: 13px; color: var(--muted); }\n.beast-rate .region-winrate { font-size: 12px; }'
assert old_c in css, 'css 锚点未命中'
css = css.replace(old_c, new_c, 1)
write('public/css/main.css', css)
print('main.css 已更新')

# ---------- 4) tests：新增确定性断言 ----------
test = read('tests/test-newfeatures.mjs')
anchor = '===== 本轮新功能专项测试：'
assert anchor in test, '测试汇总锚点未命中'
block = '''
/* ---------- 灵兽收服成功率预览（确定性，无 RNG） ---------- */
{
  const tb = S.createNewGame({ name: '收服率预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(tb);
  const tpl = { name: '试驯灵兽', power: 5, minLevel: 1, desc: '测试' };
  // 御兽 0 级、无道具 → 基础 30
  ok(S.tameBeastRate(tb, tpl, false) === 30, `收服率·御兽0级基础为30(${S.tameBeastRate(tb, tpl, false)})`);
  // 御兽每级 +2
  tb.arts['御兽'] = { name: '御兽', level: 10, 经验: 0 };
  ok(S.tameBeastRate(tb, tpl, false) === 50, `收服率·御兽10级=50(${S.tameBeastRate(tb, tpl, false)})`);
  // 驯兽口粮 +15
  storeItem(tb, { 名称: '驯兽口粮', 类型: '消耗品', 数量: 1, effect: { tame: 15 }, 描述: '测试' });
  ok(S.tameBeastRate(tb, tpl, false) === 65, `收服率·含驯兽口粮=65(${S.tameBeastRate(tb, tpl, false)})`);
  // 驭兽香 +20（选择使用且持有）
  storeItem(tb, { 名称: '驭兽香', 类型: '消耗品', 数量: 1, effect: { tame: 20 }, 描述: '测试' });
  ok(S.tameBeastRate(tb, tpl, true) === 85, `收服率·用驭兽香=85(${S.tameBeastRate(tb, tpl, true)})`);
  // 低于 minLevel -20
  const highTpl = { name: '高阶灵兽', power: 5, minLevel: 50, desc: '测试' };
  const lowPlayer = S.createNewGame({ name: '低阶', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(lowPlayer);
  lowPlayer.player.level = 1;
  ok(S.tameBeastRate(lowPlayer, highTpl, false) === 10, `收服率·低于minLevel封底10(${S.tameBeastRate(lowPlayer, highTpl, false)})`);
  // 极高御兽等级封顶 90
  const cap = S.createNewGame({ name: '封顶', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(cap);
  cap.arts['御兽'] = { name: '御兽', level: 80, 经验: 0 };
  ok(S.tameBeastRate(cap, tpl, false) === 90, `收服率·高御兽等级封顶90(${S.tameBeastRate(cap, tpl, false)})`);
  // 纯函数不消耗物品：连算两次，驯兽口粮/驭兽香数量不变
  const beforeFood = tb.items.find((i) => i.名称 === '驯兽口粮')?.数量;
  const beforeInc = tb.items.find((i) => i.名称 === '驭兽香')?.数量;
  S.tameBeastRate(tb, tpl, true); S.tameBeastRate(tb, tpl, true);
  ok(tb.items.find((i) => i.名称 === '驯兽口粮')?.数量 === beforeFood, 'tameBeastRate 不消耗驯兽口粮');
  ok(tb.items.find((i) => i.名称 === '驭兽香')?.数量 === beforeInc, 'tameBeastRate 不消耗驭兽香');
  // 重构后 tameBeast 仍返回结构化结果（不破坏既有行为）
  const rb = S.tameBeast(tb, tpl, false);
  ok(rb && typeof rb.ok === 'boolean' && Array.isArray(rb.logs), 'tameBeast 仍返回结构化结果');
}
'''
idx = test.index(anchor)
test = test[:idx] + block + test[idx:]
write('tests/test-newfeatures.mjs', test)
print('tests 已更新')

print('全部补丁应用完成。')
