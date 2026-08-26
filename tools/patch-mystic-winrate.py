# -*- coding: utf-8 -*-
# 秘境探索·护宝妖兽预估胜率 确定性预览补丁
# 与 regionEncounterRate 同构：取护宝妖兽 stronger 等级区间中点，深度>=3 按 1.2/1.3 缩放。
import io, sys, os

ROOT = r'Z:\1\xiuxian'
sys.path.insert(0, ROOT)

def patch(path, old, new, label):
    with io.open(os.path.join(ROOT, path), 'r', encoding='utf-8') as f:
        s = f.read()
    if old not in s:
        print(f'[SKIP] {label}: 锚点未找到（可能已应用）')
        return False
    if new in s:
        print(f'[SKIP] {label}: 新内容已存在')
        return False
    s = s.replace(old, new, 1)
    with io.open(os.path.join(ROOT, path), 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] {label}')
    return True

# ---------- 1) systems.js: 新增 mysticBeastRate ----------
systems_old = """  return pv.finalRate;
}

export function resolveBattle(state, enemy, type, fled = false, tactic = 'normal', blessed = false) {"""

systems_new = """  return pv.finalRate;
}

/**
 * 秘境探索·护宝妖兽预估胜率（纯函数，不修改状态，供深度选择面板展示）。
 * 与 exploreMysticRealm 实际遭遇口径一致：护宝妖兽取 stronger 等级区间中点，
 * 深度 >=3 时按 1.2 倍等级 / 1.3 倍战力上浮；复用 previewBattle 同口径加成，确定性无 RNG。
 */
export function mysticBeastRate(state, depth = 1) {
  const regionId = state.world.regionId || 'zhongzhou';
  const reg = REGION_TRAVEL[regionId] || REGION_TRAVEL.zhongzhou;
  const { min, max } = beastLevelRange(regionId, true); // 护宝妖兽 stronger
  let lv = Math.max(1, Math.round((min + max) / 2));
  const danger = Math.min(5, Math.max(2, reg.danger || 2));
  let power = Math.round(beastPowerOfLevel(lv, danger) * 1.15); // 与 makeEnemy 的 stronger 上浮一致
  if (depth >= 3) { power = Math.round(power * 1.3); lv = Math.round(lv * 1.2); }
  const enemy = { name: '护宝妖兽', level: lv, power, beast: true, realm: realmLevelName(lv), danger, regionId };
  const pv = previewBattle(state, enemy, 'yaoshou', 'normal', false);
  return pv.finalRate;
}

export function resolveBattle(state, enemy, type, fled = false, tactic = 'normal', blessed = false) {"""

# ---------- 2) ui.js: 秘境深度面板加胜率预览 ----------
ui_old = """            <div class="depth-detail">灵石×${d.stoneMul} ｜ 材料×${d.matMul} ｜ 法宝×${d.artMul} ｜ 妖兽风险 +${Math.round(d.beastAdd * 100)}%${d.hiddenChance > 0 ? ` ｜ 隐藏奇遇 ${Math.round(d.hiddenChance * 100)}%` : ''}</div>"""

ui_new = """            <div class="depth-detail">灵石×${d.stoneMul} ｜ 材料×${d.matMul} ｜ 法宝×${d.artMul} ｜ 妖兽风险 +${Math.round(d.beastAdd * 100)}%${d.hiddenChance > 0 ? ` ｜ 隐藏奇遇 ${Math.round(d.hiddenChance * 100)}%` : ''}</div>
            ${(() => { const wr = S.mysticBeastRate(st, depths.indexOf(d) + 1); return `<div class="region-winrate ${wr >= 70 ? 'wr-high' : wr >= 40 ? 'wr-mid' : 'wr-low'}" title="基于该深度护宝妖兽典型等级（等级区间中点，深度≥3 更强）估算的胜率，实际遭遇等级会在区间内浮动">预估护宝妖兽胜率 ${wr}%</div>`; })()}"""

# ---------- 3) test-newfeatures.mjs: 新增断言（插在汇总前） ----------
test_anchor = """console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""

test_block = """/* ---------- 秘境探索·护宝妖兽预估胜率（确定性预览） ---------- */
{
  // 护宝妖兽取 stronger 等级区间中点（与 makeEnemy 一致，+15% 上浮）；深度1/2 不缩放，胜率应一致
  const st = S.createNewGame({ name: '秘境胜率', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(st);
  const r1 = S.mysticBeastRate(st, 1);
  const r2 = S.mysticBeastRate(st, 2);
  ok(r1 === r2, `秘境护宝妖兽·深度1与2胜率一致(${r1}/${r2})`);
  // 深度3 妖兽更强（1.2倍等级/1.3倍战力），胜率应不高于深度1
  const r3 = S.mysticBeastRate(st, 3);
  ok(r3 <= r1, `秘境护宝妖兽·深度3胜率不高于深度1(${r3}<=${r1})`);
  // 与 previewBattle 对同代表妖兽复算一致（深度1，无缩放）
  const reg = REGION_TRAVEL[st.world.regionId] || REGION_TRAVEL.zhongzhou;
  const { min, max } = beastLevelRange(st.world.regionId, true);
  const mlv = Math.max(1, Math.round((min + max) / 2));
  const mpower = Math.round(beastPowerOfLevel(mlv, reg.danger || 2) * 1.15);
  const repEnemy = { name: '护宝妖兽', level: mlv, power: mpower, beast: true, realm: S.realmLevelName(mlv), danger: reg.danger || 2, regionId: st.world.regionId };
  ok(r1 === S.previewBattle(st, repEnemy, 'yaoshou', 'normal', false).finalRate, 'mysticBeastRate 与 previewBattle 复算一致(深度1)');
  // 护宝妖兽 +15% 上浮应使胜率不高于「未上浮」的同中点妖兽
  const repEnemyNoStrong = { name: '护宝妖兽', level: mlv, power: beastPowerOfLevel(mlv, reg.danger || 2), beast: true, realm: S.realmLevelName(mlv), danger: reg.danger || 2, regionId: st.world.regionId };
  const rateNoStrong = S.previewBattle(st, repEnemyNoStrong, 'yaoshou', 'normal', false).finalRate;
  ok(r1 <= rateNoStrong, `护宝妖兽+15%上浮使胜率不高于未上浮(${r1}<=${rateNoStrong})`);
  // 高阶修士碾压护宝妖兽（封顶95）
  const strong = S.createNewGame({ name: '秘境胜率2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(strong);
  strong.player.level = 80; strong.player.power = 6000;
  ok(S.mysticBeastRate(strong, 3) >= 90, `高阶修士·深度3护宝妖兽胜率仍高(${S.mysticBeastRate(strong, 3)}%)`);
}

console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""

if __name__ == '__main__':
    patch('public/js/systems.js', systems_old, systems_new, 'systems.mysticBeastRate')
    patch('public/js/ui.js', ui_old, ui_new, 'ui.mysticWinrate')
    patch('tests/test-newfeatures.mjs', test_anchor, test_block, 'test.mysticWinrate')
