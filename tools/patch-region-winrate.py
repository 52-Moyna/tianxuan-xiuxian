# -*- coding: utf-8 -*-
"""为疆域图地域卡增加「预估遭遇胜率」确定性预览（自由优化·打磨轮）。

改动：
  systems.js  : 新增纯函数 regionEncounterRate（取地域妖兽等级区间中点作典型遭遇，复用 previewBattle 同口径加成）
  ui.js       : 地域卡 region-meta 新增预估胜率徽标（按胜率高低着色）
  main.css    : 新增 .region-winrate 及 wr-high/wr-mid/wr-low 着色样式
  tests/test-newfeatures.mjs : 新增 5 条确定性断言
"""
import io, sys, os

ROOT = "Z:/1/xiuxian"
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

def patch(path, replacements):
    full = os.path.join(ROOT, path)
    with open(full, "r", encoding="utf-8") as f:
        s = f.read()
    for old, new, label in replacements:
        cnt = s.count(old)
        if cnt != 1:
            raise SystemExit(f"[FAIL] {path} 锚点「{label}」匹配 {cnt} 次（应为1），中止以避免误改")
        s = s.replace(old, new, 1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] {path} 已应用 {len(replacements)} 处改动")

# ---------- systems.js ----------
NEW_FN = '''

/**
 * 地域「典型遭遇胜率」预估（纯函数，不改动 state，供疆域图地域卡在玩家决定前往前展示）。
 * 取该地域妖兽等级区间的中点作为"典型遭遇"，复用 previewBattle 同口径加成，给出确定性预估
 * （不含命运骰子与胜负副作用）。实际遭遇等级在 [min,max] 内浮动，故仅作参考。
 */
export function regionEncounterRate(state, regionId) {
  const reg = REGION_TRAVEL[regionId] || REGION_TRAVEL.zhongzhou;
  const { min, max } = beastLevelRange(regionId, false);
  const lv = Math.max(1, Math.round((min + max) / 2)); // 典型遭遇等级（区间中点）
  const danger = Math.min(5, Math.max(2, reg.danger || 2));
  const power = beastPowerOfLevel(lv, danger);
  const enemy = { name: '妖兽', level: lv, power, beast: true, realm: realmLevelName(lv), danger, regionId };
  const pv = previewBattle(state, enemy, 'yaoshou', 'normal', false);
  return pv.finalRate;
}'''

anchor_sys = "export function resolveBattle(state, enemy, type, fled = false, tactic = 'normal', blessed = false) {"
patch("public/js/systems.js", [
    (anchor_sys, NEW_FN + "\n\n" + anchor_sys, "resolveBattle前插入regionEncounterRate（空行无关）"),
])

# ---------- ui.js ----------
anchor_a = (
    "      const marketCount = (REGION_MARKET[r.id] || []).length;\n"
    "      const canGo = isNeighbor && !isCur && !traveling;\n"
    "      return `"
)
new_a = (
    "      const marketCount = (REGION_MARKET[r.id] || []).length;\n"
    "      const canGo = isNeighbor && !isCur && !traveling;\n"
    "      const winRate = S.regionEncounterRate(st, r.id);\n"
    "      return `"
)

anchor_b = (
    "          <div class=\"region-meta\">\n"
    "            <span class=\"region-danger\" title=\"危险度\">危险 ${dangerStars(t.danger || 2)}</span>\n"
    "            <span class=\"region-req\">建议 ${S.realmLevelName(t.realmReq || 1)}</span>\n"
    "          </div>"
)
new_b = (
    "          <div class=\"region-meta\">\n"
    "            <span class=\"region-danger\" title=\"危险度\">危险 ${dangerStars(t.danger || 2)}</span>\n"
    "            <span class=\"region-req\">建议 ${S.realmLevelName(t.realmReq || 1)}</span>\n"
    "            <span class=\"region-winrate ${winRate >= 70 ? 'wr-high' : winRate >= 40 ? 'wr-mid' : 'wr-low'}\" title=\"基于该地域典型妖兽等级（等级区间中点）估算的遭遇胜率，实际遭遇等级会在区间内浮动\">预估遭遇 ${winRate}%</span>\n"
    "          </div>"
)
patch("public/js/ui.js", [
    (anchor_a, new_a, "地域卡map中计算winRate"),
    (anchor_b, new_b, "地域卡region-meta插入胜率徽标"),
])

# ---------- main.css ----------
anchor_css = ".region-req { color: var(--jade); }"
new_css = (
    ".region-req { color: var(--jade); }\n"
    ".region-winrate { padding: 1px 7px; border-radius: 999px; font-weight: 600; background: rgba(255,255,255,.06); }\n"
    ".region-winrate.wr-high { color: var(--jade); border: 1px solid rgba(143,191,159,.5); }\n"
    ".region-winrate.wr-mid { color: var(--gold); border: 1px solid rgba(216,177,90,.5); }\n"
    ".region-winrate.wr-low { color: var(--danger); border: 1px solid rgba(225,110,110,.5); }"
)
patch("public/css/main.css", [
    (anchor_css, new_css, "地域卡胜率徽标样式"),
])

# ---------- tests/test-newfeatures.mjs ----------
anchor_imp = "beastLevelRange, startTravel, travelOptions, ART_RECIPES, upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE } from '../public/js/life.js';"
new_imp = "beastLevelRange, beastPowerOfLevel, startTravel, travelOptions, ART_RECIPES, upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE } from '../public/js/life.js';"

anchor_test = "}\n\nconsole.log(`"
new_test = (
    "}\n\n"
    "/* ---------- 疆域图·地域典型遭遇胜率预估（确定性预览） ---------- */\n"
    "{\n"
    "  // 新手（低境界低战力）踏入高危地域「海外仙岛」(danger5) 胜率应偏低\n"
    "  const weakState = S.createNewGame({ name: '胜率测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "  ensureLifeState(weakState);\n"
    "  const haiwaiWeak = S.regionEncounterRate(weakState, 'haiwai');\n"
    "  ok(haiwaiWeak < 50, `新手海外仙岛典型遭遇胜率偏低(${haiwaiWeak}%)`);\n"
    "  // 高境界高战力修士回到低危「中州」(danger2) 应碾压（封顶95）\n"
    "  const strongState = S.createNewGame({ name: '胜率测试2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "  ensureLifeState(strongState);\n"
    "  strongState.player.level = 80; strongState.player.power = 5000;\n"
    "  const zhongzhouStrong = S.regionEncounterRate(strongState, 'zhongzhou');\n"
    "  ok(zhongzhouStrong >= 90, `高阶修士中州遭遇胜率高(${zhongzhouStrong}%)`);\n"
    "  // 中等修士（25级/战力300）：低危地域胜率应明显高于高危地域\n"
    "  const midState = S.createNewGame({ name: '胜率测试3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "  ensureLifeState(midState);\n"
    "  midState.player.level = 25; midState.player.power = 300;\n"
    "  ok(S.regionEncounterRate(midState, 'zhongzhou') > S.regionEncounterRate(midState, 'haiwai'), '中等修士·低危地域胜率高于高危地域');\n"
    "  // 与 previewBattle 对同中点妖兽复算一致\n"
    "  const mid = Math.round((beastLevelRange('haiwai', false).min + beastLevelRange('haiwai', false).max) / 2);\n"
    "  const repEnemy = { name: '妖兽', level: mid, power: beastPowerOfLevel(mid, 5), beast: true, realm: S.realmLevelName(mid), danger: 5, regionId: 'haiwai' };\n"
    "  ok(S.regionEncounterRate(weakState, 'haiwai') === S.previewBattle(weakState, repEnemy, 'yaoshou', 'normal', false).finalRate, 'regionEncounterRate 与 previewBattle 中点复算一致');\n"
    "}\n\n"
    "console.log(`"
)
patch("tests/test-newfeatures.mjs", [
    (anchor_imp, new_imp, "测试导入新增beastPowerOfLevel"),
    (anchor_test, new_test, "新增地域遭遇胜率断言块"),
])

print("全部补丁应用完成。")
