# -*- coding: utf-8 -*-
"""补丁：灵草园一键收获 + 闭关连续风险可感知提示。
所有改动写入真实仓库 Z:/1/xiuxian，每次替换均校验是否发生。
"""
import io, sys, pathlib

ROOT = pathlib.Path(r"Z:/1/xiuxian")
SYS = ROOT / "public/js/systems.js"
LIFE = ROOT / "public/js/life.js"
UI = ROOT / "public/js/ui.js"
TEST = ROOT / "tests/test-newfeatures.mjs"

def patch(path: pathlib.Path, old: str, new: str, label: str):
    t = path.read_text(encoding="utf-8")
    if old not in t:
        raise SystemExit(f"[FAIL] 未找到替换锚点（{label}）：\n{old[:80]}")
    if old == new:
        raise SystemExit(f"[FAIL] 替换内容相同（{label}）")
    t = t.replace(old, new, 1)
    path.write_text(t, encoding="utf-8")
    print(f"[OK] {label}")

# ---------- systems.js：cultivateGainPreview 闭关风险提示（准确 + 可感知） ----------
old_note = """  const gain = Math.round(base * rootMul * caveMul * gradeMul * boneMul * toxicMul * boostMul * omen);
  return {
    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,
    note: mode === 'seclusion' ? '闭关·有走火入魔风险' : '稳定·无风险',
  };"""
new_note = """  const gain = Math.round(base * rootMul * caveMul * gradeMul * boneMul * toxicMul * boostMul * omen);
  // 闭关走火入魔提示：真实机制为「连续闭关>=3月触发 qihuo 事件」（需 Lv.30+）；
  // 让累积风险对玩家可感知，且低等级不再虚报风险。
  let note;
  if (mode !== 'seclusion') note = '稳定·无风险';
  else if (p.level < 30) note = '闭关·稳定（Lv.30 后久闭有走火入魔风险）';
  else {
    const streak = state.flags?.seclusionStreak || 0;
    note = streak >= 2
      ? `闭关·连关${streak}月，再闭关将走火入魔（满3月必触发）`
      : '闭关·走火入魔风险（连续闭关积累）';
  }
  return {
    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,
    note,
  };"""
patch(SYS, old_note, new_note, "systems.js cultivateGainPreview 风险提示")

# ---------- life.js：新增 harvestAllHerbs（一键收获成熟灵草） ----------
old_harvest_end = """  return { ok: true, logs: [`「${h.name}」已收获，但灵种异变，未见产出。`] };
}"""
new_harvest_end = """  return { ok: true, logs: [`「${h.name}」已收获，但灵种异变，未见产出。`] };
}

/**
 * 灵草园「一键收获」：批量收获所有已成熟灵草（progress>=grow）。
 * 按成熟株索引降序处理（splice 不影响更低索引），结果确定性无 RNG。
 * 返回 { ok, count, logs }。
 */
export function harvestAllHerbs(state) {
  ensureLifeState(state);
  const garden = state.cave.garden || [];
  const matureIdx = [];
  for (let i = 0; i < garden.length; i++) {
    const h = garden[i];
    if (h && h.progress >= h.grow) matureIdx.push(i);
  }
  if (!matureIdx.length) return { ok: false, count: 0, logs: ['灵草园中没有已成熟的灵草。'] };
  const logs = [];
  let count = 0;
  for (const idx of matureIdx.sort((a, b) => b - a)) {
    const r = harvestHerb(state, idx);
    if (r.ok) count++;
    logs.push(...(r.logs || []));
  }
  return { ok: count > 0, count, logs };
}"""
patch(LIFE, old_harvest_end, new_harvest_end, "life.js harvestAllHerbs")

# ---------- ui.js：导入 harvestAllHerbs ----------
old_imp = "plantHerb, harvestHerb, irrigateHerb, crossbreedHerbs,"
new_imp = "plantHerb, harvestHerb, harvestAllHerbs, irrigateHerb, crossbreedHerbs,"
patch(UI, old_imp, new_imp, "ui.js 导入 harvestAllHerbs")

# ---------- ui.js：灵草园插入「一键收获」按钮 ----------
old_garden = """        }).join('') : '<div class="opt-desc">灵田空置，挑选一株灵草播下灵种吧。</div>'}
        <div class="side-subtitle">播种灵草</div>"""
new_garden = """        }).join('') : '<div class="opt-desc">灵田空置，挑选一株灵草播下灵种吧。</div>'}
        ${garden.some((h) => h.progress >= h.grow) ? `<button class="btn btn-gold btn-block" id="btn-harvest-all" style="margin:6px 0 4px">🌿 一键收获成熟灵草（${garden.filter((h) => h.progress >= h.grow).length} 株）</button>` : ''}
        <div class="side-subtitle">播种灵草</div>"""
patch(UI, old_garden, new_garden, "ui.js 一键收获按钮")

# ---------- ui.js：接线一键收获处理 ----------
old_handler = """    box.querySelectorAll('[data-harvest]').forEach((b) => b.addEventListener('click', () => {
      const r = harvestHerb(st, Number(b.dataset.harvest));
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法收获'), r.ok ? 'gold' : 'warn');
      renderAll();
    }));"""
new_handler = """    box.querySelectorAll('[data-harvest]').forEach((b) => b.addEventListener('click', () => {
      const r = harvestHerb(st, Number(b.dataset.harvest));
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法收获'), r.ok ? 'gold' : 'warn');
      renderAll();
    }));
    const haBtn = box.querySelector('#btn-harvest-all');
    if (haBtn) haBtn.addEventListener('click', () => {
      const r = harvestAllHerbs(st);
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? `已收获 ${r.count} 株灵草` : (r.logs[0] || '无可收获灵草'), r.ok ? 'gold' : 'warn');
      renderAll();
    });"""
patch(UI, old_handler, new_handler, "ui.js 一键收获处理")

# ---------- tests：导入 harvestAllHerbs ----------
old_timp = "plantHerb, harvestHerb, irrigateHerb, crossbreedHerbs,"
new_timp = "plantHerb, harvestHerb, harvestAllHerbs, irrigateHerb, crossbreedHerbs,"
patch(TEST, old_timp, new_timp, "test 导入 harvestAllHerbs")

# ---------- tests：新增断言块（插在汇总 console.log 之前） ----------
old_summary = "console.log(`"
new_block = """/* ---------- 灵草园「一键收获」+ 闭关连续风险可感知 ---------- */
// 一键收获：播种若干株并强制成熟，批量收获应全部入库
const hg = S.createNewGame({ name: '收获测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(hg);
hg.cave.level = 4; hg.currencies['下品灵石'] = 99999;
const seedPool = ['lingcao', 'huojing', 'yushu', 'yulu'];
let plantedN = 0;
for (let i = 0; i < 4; i++) { if (plantHerb(hg, seedPool[i]).ok) plantedN++; }
ok(plantedN >= 3, `一键收获测试：播种至少 3 株（实际 ${plantedN}）`);
hg.cave.garden.forEach((h) => { h.progress = h.grow; }); // 强制全部成熟
const beforeItems = hg.items.length;
const ha = harvestAllHerbs(hg);
ok(ha.ok && ha.count === plantedN, `一键收获成熟 ${plantedN} 株（实际 ${ha.count}）`);
ok(hg.cave.garden.length === 0, '一键收获后灵田清空');
ok(hg.items.length > beforeItems, '一键收获产物入储物袋');
const ha2 = harvestAllHerbs(hg);
ok(!ha2.ok && ha2.count === 0, '灵田无成熟株时一键收获返回失败且不误处理');

// 闭关连续风险可感知提示
const sp = S.createNewGame({ name: '闭关', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(sp);
sp.player.level = 10;
ok(S.cultivateGainPreview(sp, 'normal').note === '稳定·无风险', '普通修炼提示稳定无风险');
ok(S.cultivateGainPreview(sp, 'seclusion').note.includes('Lv.30'), '低等级闭关不再虚报走火入魔风险');
sp.player.level = 40; sp.flags.seclusionStreak = 0;
ok(S.cultivateGainPreview(sp, 'seclusion').note.includes('走火入魔风险'), '高等级闭关提示走火入魔风险');
sp.flags.seclusionStreak = 2;
ok(S.cultivateGainPreview(sp, 'seclusion').note.includes('再闭关将走火入魔'), '连关2月提示再闭关将触发走火入魔');

console.log(`"""
patch(TEST, old_summary, new_block, "test 新增断言块")

print("\n全部补丁应用成功。")
