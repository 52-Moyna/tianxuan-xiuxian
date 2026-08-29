# -*- coding: utf-8 -*-
"""天玄修仙录·打磨补丁：研读功法（study）行动确定性收益预览。
给罗盘「研读功法典籍」选项补上真实收益展示（主修功法经验+40、临界突破、悟性区间），
补齐「投资型决策确定性预览」主线在研读行动的缺口。纯增量、无 RNG、不破坏已有功能。
"""
import io

ROOT = "Z:/1/xiuxian"
SYS = ROOT + "/public/js/systems.js"
TST = ROOT + "/tests/test-newfeatures.mjs"

# ===== 1. systems.js：在 cultivateGainPreview 之后插入 studyGainPreview 纯函数 =====
study_fn = """/**
 * 研读功法（study）行动确定性收益预览（不改动 state）。
 * 主修功法经验固定 +40、临界则可能突破；悟性按真实区间 8~15 展示（不造假、无 RNG）。
 */
export function studyGainPreview(state) {
  const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);
  if (!tech) return '尚未主修功法，研读仅得悟性';
  const g = TECHNIQUE_GRADES.find((x) => x.name === (tech.品级 || '凡品'));
  const maxLv = g ? g.maxLv : 99;
  if (tech.等级 >= maxLv) return `《${tech.名称}》已至${tech.品级}瓶颈，研读难有寸进（仅得悟性）`;
  const need = tech.等级 * 20;
  const after = tech.经验 + 40;
  const breakHint = after >= need ? `研读后将突破至第${tech.等级 + 1}层` : `距突破还差${need - after}经验`;
  return `研读《${tech.名称}》·功法经验+40（需${need}）｜${breakHint}｜悟性+（8~15）`;
}

"""

anchor_fn = "/** 寿元危机预警（纯函数，不修改状态；供状态卡展示）。"
with io.open(SYS, "r", encoding="utf-8") as f:
    s = f.read()
c = s.count(anchor_fn)
print("systems.js 函数锚点命中:", c)
if c == 1:
    s = s.replace(anchor_fn, study_fn + anchor_fn, 1)
else:
    print("WARN: 函数锚点异常，跳过函数插入")

# ===== 2. systems.js：预览映射增加 study 分支 =====
anchor_study = """    if (o.action.type === 'art') return { ...o, preview: '收益：技艺经验与灵石；可返回重新选择' };
    return { ...o, preview: '收益：推进本月状态与世界变化' };"""
study_branch = """    if (o.action.type === 'art') return { ...o, preview: '收益：技艺经验与灵石；可返回重新选择' };
    if (o.action.type === 'study') return { ...o, preview: studyGainPreview(state) };
    return { ...o, preview: '收益：推进本月状态与世界变化' };"""
c2 = s.count(anchor_study)
print("systems.js study分支锚点命中:", c2)
if c2 == 1:
    s = s.replace(anchor_study, study_branch, 1)
else:
    print("WARN: study分支锚点异常，跳过")
with io.open(SYS, "w", encoding="utf-8") as f:
    f.write(s)

# ===== 3. tests：在汇总 console.log 之前插入研读预览专项断言 =====
study_test = """/* ---------- 研读功法确定性预览（补齐投资型决策预览缺口） ---------- */
function studyPreviewGroup() {
  // 正常：有主修功法且未达瓶颈，等级1经验0 → need=20，+40 触发突破
  const sg = S.createNewGame({ name: '研读预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg);
  const prev = S.studyGainPreview(sg);
  ok(typeof prev === 'string' && prev.length > 0, 'studyGainPreview 返回非空字符串');
  const tech = sg.techniques.find((t) => t.名称 === sg.player.mainTechnique);
  ok(prev.includes(tech.名称), '预览包含主修功法名');
  ok(prev.includes('+40'), '预览标明功法经验+40');
  ok(prev.includes('突破至第2层'), '等级1经验0：研读+40(=40≥need20)预览将突破至第2层');
  // 临近瓶颈但不足：等级5经验5 → need=100，after=45 < 100 → 不突破，距突破还差55
  const sg2 = S.createNewGame({ name: '研读预览2', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg2);
  const t2 = sg2.techniques.find((x) => x.名称 === sg2.player.mainTechnique);
  t2.等级 = 5; t2.经验 = 5;
  const prev2 = S.studyGainPreview(sg2);
  ok(prev2.includes('距突破还差55'), '临界不突破：等级5经验5预览标明距突破差55（' + prev2 + '）');
  // 已达瓶颈：凡品 maxLv=30，设等级30 → 提示瓶颈
  const sg3 = S.createNewGame({ name: '研读预览3', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg3);
  const t3 = sg3.techniques.find((x) => x.名称 === sg3.player.mainTechnique);
  t3.等级 = 30;
  const prev3 = S.studyGainPreview(sg3);
  ok(prev3.includes('瓶颈'), '凡品满级(30)：预览提示已至瓶颈（' + prev3 + '）');
  // 无主修功法
  const sg4 = S.createNewGame({ name: '研读预览4', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(sg4);
  sg4.player.mainTechnique = null;
  const prev4 = S.studyGainPreview(sg4);
  ok(prev4.includes('尚未主修'), '未主修功法：预览提示尚未主修（' + prev4 + '）');
}
studyPreviewGroup();

"""

anchor_console = r"console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
with io.open(TST, "r", encoding="utf-8") as f:
    t = f.read()
c3 = t.count(anchor_console)
print("tests 汇总锚点命中:", c3)
if c3 == 1:
    t = t.replace(anchor_console, study_test + anchor_console, 1)
else:
    print("WARN: 汇总锚点异常，跳过测试插入")
with io.open(TST, "w", encoding="utf-8") as f:
    f.write(t)

print("DONE")
