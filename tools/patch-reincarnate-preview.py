# -*- coding: utf-8 -*-
"""天玄修仙录：新增 转世继承确定性预览（自由优化/审查轮）。精确字符串替换，不破坏既有功能。"""
import io, sys

ROOT = "Z:/1/xiuxian"
SYS = ROOT + "/public/js/systems.js"
UI  = ROOT + "/public/js/ui.js"
CSS = ROOT + "/public/css/main.css"
TEST= ROOT + "/tests/test-newfeatures.mjs"

def read(p):
    with io.open(p, encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8") as f:
        f.write(s)

def patch(path, old, new, label):
    s = read(path)
    if old not in s:
        print("!!! 未找到锚点 [%s]，脚本中止。" % label)
        sys.exit(1)
    cnt = s.count(old)
    s = s.replace(old, new, 1)
    write(path, s)
    print("OK  替换 [%s]（命中 %d 处，替换 1 处）" % (label, cnt))

old_re = """export function reincarnate(state, full) {
  if (full) return null; // 完全重开：由 UI 走新建流程
  // 轮回转世：继承部分遗产
  const inherit = {
    stones: Math.floor(totalStones(state) * 0.5),
    daoBase: Object.fromEntries(Object.entries(state.player.daoBase).map(([k, v]) => [k, Math.floor(v.level * 0.3)])),
    yunExp: Math.floor(state.player.daoYun.exp * 0.2),
    tech: state.techniques.find((t) => t.名称 === state.player.mainTechnique),
    heirs: state.npcs.filter((n) => n.favor >= 80).slice(0, 2).map((n) => n.name),
  };
  return inherit;
}"""
new_re = """/** 轮回转世：计算可继承的遗产（纯函数，只读 state，不修改）。 */
function computeInherit(state) {
  return {
    stones: Math.floor(totalStones(state) * 0.5),
    daoBase: Object.fromEntries(Object.entries(state.player.daoBase).map(([k, v]) => [k, Math.floor(v.level * 0.3)])),
    yunExp: Math.floor(state.player.daoYun.exp * 0.2),
    tech: state.techniques.find((t) => t.名称 === state.player.mainTechnique),
    heirs: state.npcs.filter((n) => n.favor >= 80).slice(0, 2).map((n) => n.name),
  };
}

export function reincarnate(state, full) {
  if (full) return null; // 完全重开：由 UI 走新建流程
  // 轮回转世：继承部分遗产
  return computeInherit(state);
}

/** 转世继承预览：纯函数，返回玩家转世后将继承的具体内容（确定性、无 RNG），供 UI 确认前展示。 */
export function reincarnatePreview(state) {
  const inh = computeInherit(state);
  const total = totalStones(state);
  const daoList = Object.entries(inh.daoBase).map(([k, add]) => {
    const cur = (state.player.daoBase[k] && state.player.daoBase[k].level) || 0;
    return { name: k, cur, add, next: cur + add };
  });
  return {
    stones: inh.stones,
    totalStones: total,
    daoList,
    yunExp: inh.yunExp,
    techName: inh.tech ? inh.tech.名称 : '（无主修功法）',
    heirs: inh.heirs,
  };
}"""
patch(SYS, old_re, new_re, "systems.js reincarnate->computeInherit+preview")

old_helper = """/* ---------------- 寿元已尽 / 转世 ---------------- */
async function flowDeath() {"""
new_helper = """/* ---------------- 转世继承预览 ---------------- */
/** 转世前展示将继承的具体内容，确认后再执行转世（确定性预览，对齐「投资型决策确定性预览」主题）。 */
function openReincarnatePreview(st, onConfirm) {
  const pv = S.reincarnatePreview(st);
  const daoRows = pv.daoList.map((d) => `<div class="ri-row"><span>${d.name}</span><b>${d.cur} → <span class="ri-up">${d.next}</span>（+${(d.add)}）</b></div>`).join('');
  const m = openModal(`
    <div class="modal-title">🔄 轮回转世 · 遗泽预览</div>
    <p class="modal-text">魂归轮回，以下<b>前世遗泽</b>将随你转世；其余（境界、装备、灵兽、灵草、宗门、寿元等）皆重置：</p>
    <div class="ri-box">
      <div class="ri-row"><span>🪙 继承灵石</span><b>${pv.stones}（半数，共 ${pv.totalStones}）</b></div>
      ${daoRows}
      <div class="ri-row"><span>✨ 道韵经验</span><b>+${pv.yunExp}</b></div>
      <div class="ri-row"><span>📜 主修功法</span><b>${pv.techName}</b></div>
    </div>
    <div class="opt-desc" style="margin-top:6px">提示：转世开启全新一生，挚友羁绊（${pv.heirs.length ? pv.heirs.join('、') : '暂未结交'}）需重新结缘。</div>
    <div class="modal-actions">
      <button class="btn btn-gold" data-v="1">确认转世</button>
      <button class="btn" data-v="0">再想想</button>
    </div>`, { lock: true });
  m.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
    closeModal();
    if (b.dataset.v === '1') onConfirm();
  }));
}

/* ---------------- 寿元已尽 / 转世 ---------------- */
async function flowDeath() {"""
patch(UI, old_helper, new_helper, "ui.js add openReincarnatePreview helper")

old_flow = """  if (re === 're') {
    const inherit = S.reincarnate(st, false);
    await resetSave();
    startCreation(inherit);
  } else {"""
new_flow = """  if (re === 're') {
    openReincarnatePreview(st, async () => {
      const inherit = S.reincarnate(st, false);
      await resetSave();
      startCreation(inherit);
    });
  } else {"""
patch(UI, old_flow, new_flow, "ui.js flowDeath re-branch")

old_set = """  box.querySelector('#btn-reincarnate').addEventListener('click', async () => {
    if (await confirmModal('确定转世重修？将继承半数灵石、三成道基与主修功法。', '转世', '再想想')) {
      const { resetSave } = await import('./save.js');
      const inherit = S.reincarnate(st, false);
      await resetSave();
      startCreation(inherit);
    }
  });"""
new_set = """  box.querySelector('#btn-reincarnate').addEventListener('click', async () => {
    openReincarnatePreview(st, async () => {
      const { resetSave } = await import('./save.js');
      const inherit = S.reincarnate(st, false);
      await resetSave();
      startCreation(inherit);
    });
  });"""
patch(UI, old_set, new_set, "ui.js settings reincarnate button")

old_yun = """    if (WIZARD.inherit.tech) state.techniques.push({ ...WIZARD.inherit.tech });
    S.refreshDerived(state);"""
new_yun = """    if (WIZARD.inherit.tech) state.techniques.push({ ...WIZARD.inherit.tech });
    if (WIZARD.inherit.yunExp) state.player.daoYun.exp += WIZARD.inherit.yunExp;
    S.refreshDerived(state);"""
patch(UI, old_yun, new_yun, "ui.js wizardNext apply yunExp")

old_css = """.modal .opt-desc, .modal-text { line-height: 1.75; }"""
new_css = """.modal .opt-desc, .modal-text { line-height: 1.75; }
/* 转世继承预览 */
.ri-box { margin: 10px 0 4px; padding: 10px 12px; border-radius: 12px; background: linear-gradient(180deg, rgba(212,175,55,.10), rgba(212,175,55,.03)); border: 1px solid var(--gold-soft); }
.ri-box .ri-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border-bottom: 1px dashed var(--line-soft); font-size: .9rem; }
.ri-box .ri-row:last-child { border-bottom: none; }
.ri-box .ri-row > span { color: var(--text-dim); }
.ri-box .ri-row > b { color: var(--text); text-align: right; }
.ri-box .ri-up { color: var(--gold); }
.ri-box .ri-row b .ri-up { font-weight: 700; }"""
patch(CSS, old_css, new_css, "css ri-box styles")

test_block = """
/* ---------- 转世继承确定性预览（自由优化：补齐投资型决策预览最后缺口） ---------- */
const rcS = S.createNewGame({ name: '转世', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(rcS);
rcS.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0, '极品灵石': 0, '灵晶': 0 };
rcS.player.daoBase['根骨'].level = 10;
rcS.player.daoBase['悟性'].level = 5;
rcS.player.daoYun.exp = 200;
rcS.player.mainTechnique = rcS.techniques[0].名称;
const pv = S.reincarnatePreview(rcS);
ok(pv.stones === 500, '转世预览：继承灵石为半数（1000→500）');
ok(pv.totalStones === 1000, '转世预览：记录总灵石数');
const gengu = pv.daoList.find((d) => d.name === '根骨');
ok(gengu && gengu.cur === 10 && gengu.add === 3 && gengu.next === 13, '转世预览：根骨 +floor(10×0.3)=+3（10→13）');
const wux = pv.daoList.find((d) => d.name === '悟性');
ok(wux && wux.cur === 5 && wux.add === 1 && wux.next === 6, '转世预览：悟性 +floor(5×0.3)=+1（5→6）');
ok(pv.yunExp === 40, '转世预览：道韵经验 +floor(200×0.2)=+40');
ok(pv.techName === rcS.techniques[0].名称, '转世预览：主修功法名为当前主修');
ok(rcS.player.daoBase['根骨'].level === 10 && rcS.player.daoYun.exp === 200 && rcS.currencies['下品灵石'] === 1000, '转世预览纯函数：完全不改动原状态');
const inhR = S.reincarnate(rcS, false);
ok(inhR && inhR.stones === 500 && inhR.daoBase['根骨'] === 3 && inhR.yunExp === 40 && inhR.tech && inhR.tech.名称 === rcS.techniques[0].名称, 'reincarnate 返回继承对象与预览一致（行为不变）');
ok(S.reincarnate(rcS, true) === null, 'reincarnate(full=true) 返回 null（完全重开走新建流程）');
"""
t = read(TEST)
SEP = "===== 本轮新功能专项测试："
if SEP not in t:
    print("!!! 未找到测试汇总锚点，脚本中止。")
    sys.exit(1)
parts = t.split(SEP, 1)
write(TEST, parts[0] + test_block + SEP + parts[1])
print("OK  追加测试 [转世继承确定性预览] 断言（插入到汇总之前）")

print("\n全部补丁应用完成。")
