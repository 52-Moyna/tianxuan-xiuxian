# -*- coding: utf-8 -*-
"""天玄修仙录·修炼收益确定性预览补丁。
在 systems.js 新增 cultivateGainPreview 纯函数并接入罗盘修炼选项预览，
ui.js 渲染支持 previewTitle（乘区拆解 tooltip）。
游戏源码改动走真实仓库 Z:/1/xiuxian，不破坏既有功能。
"""
import io, sys, os

ROOT = 'Z:/1/xiuxian'
sys_paths = [os.path.join(ROOT, 'public', 'js')]
for p in sys_paths:
    if p not in sys.path:
        sys.path.insert(0, p)

def patch(path, old, new, label):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    cnt = s.count(old)
    if cnt != 1:
        raise SystemExit(f'[FAIL] {label} 锚点命中 {cnt} 次（期望 1）')
    s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] {label} 已替换')

# ---------- 1. systems.js：cultivate 后新增 cultivateGainPreview ----------
sys_path = os.path.join(ROOT, 'public', 'js', 'systems.js')
old1 = r'''  return { gain, logs, levelUps: ups };
}

/** 道基加经验（含升级） */'''
new1 = r'''  return { gain, logs, levelUps: ups };
}

/** 修炼收益确定性预览（与 cultivate 同口径；基础取 Rng 区间中点，无 RNG 波动） */
export function cultivateGainPreview(state, mode = 'normal') {
  const p = state.player;
  const tech = state.techniques.find((t) => t.名称 === p.mainTechnique);
  const grade = TECHNIQUE_GRADES.find((g) => g.name === (tech?.品级 || '凡品'));
  const base = mode === 'seclusion' ? 42 : 22; // Rng.int(30,55)/Rng.int(15,30) 期望中点
  const sectBonus = sectCultivateBonus(state);
  const toxic = Number(state.flags?.pillToxicity || 0);
  const toxicMul = toxic >= 85 ? 0.55 : toxic >= 60 ? 0.75 : toxic >= 35 ? 0.9 : 1;
  const boostMul = (state.flags?.cultivateBoostMonths || 0) > 0 ? 1.15 : 1;
  const rootMul = p.spiritRoot.speed;
  const caveMul = 1 + (state.cave.bonus || 0) + sectBonus;
  const gradeMul = grade.expMul;
  const boneMul = 1 + p.daoBase['根骨'].level / 200;
  const omen = omenMul(state, 'cultivate');
  const gain = Math.round(base * rootMul * caveMul * gradeMul * boneMul * toxicMul * boostMul * omen);
  return {
    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,
    note: mode === 'seclusion' ? '闭关·有走火入魔风险' : '稳定·无风险',
  };
}

/** 道基加经验（含升级） */'''
patch(sys_path, old1, new1, 'systems.js 新增 cultivateGainPreview')

# ---------- 2. systems.js：选项预览映射替换修炼泛化文案 ----------
old2 = r'''    if (o.action.type === 'cultivate') return { ...o, preview: o.action.mode === 'seclusion' ? '收益：修为较多，道心也会成长' : '收益：稳定修为，风险低' };'''
new2 = r'''    if (o.action.type === 'cultivate') {
      const m = o.action.mode === 'seclusion' ? 'seclusion' : 'normal';
      const pv = cultivateGainPreview(state, m);
      const cavePct = Math.round((pv.caveMul - 1) * 100);
      const bonePct = Math.round((pv.boneMul - 1) * 100);
      const parts = [`基础${pv.base}`, `灵根×${pv.rootMul}`, `洞府/宗门+${cavePct}%`, `功法×${pv.gradeMul}`, `根骨+${bonePct}%`];
      if (pv.toxicMul !== 1) parts.push(`丹毒×${pv.toxicMul}`);
      if (pv.boostMul !== 1) parts.push(`聚灵×${pv.boostMul}`);
      parts.push(`运势×${pv.omen}`);
      return { ...o, preview: `预计修为 +${pv.gain}（${pv.note}）`, previewTitle: `修炼收益拆解：${parts.join(' ｜ ')} ≈ ${pv.gain}` };
    }'''
patch(sys_path, old2, new2, 'systems.js 接入修炼预览')

# ---------- 3. ui.js：ci-preview 支持 title（乘区拆解 tooltip） ----------
ui_path = os.path.join(ROOT, 'public', 'js', 'ui.js')
old3 = r'''        ${o.preview && !done ? `<span class="ci-preview">${o.preview}</span>` : ''}'''
new3 = r'''        ${o.preview && !done ? `<span class="ci-preview"${o.previewTitle ? ` title="${o.previewTitle}"` : ''}>${o.preview}</span>` : ''}'''
patch(ui_path, old3, new3, 'ui.js 渲染 previewTitle')

print('全部补丁应用完成。')
