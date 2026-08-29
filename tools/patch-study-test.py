# -*- coding: utf-8 -*-
"""仅插入研读预览专项测试（systems.js 已改好，避免重复）。"""
import io

TST = "Z:/1/xiuxian/tests/test-newfeatures.mjs"

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

# 文件里 console.log(`) 后接真实换行再 ===== ，故用普通字符串的 \n（Python 转真实换行）匹配
anchor_console = "console.log(`\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
with io.open(TST, "r", encoding="utf-8") as f:
    t = f.read()
c = t.count(anchor_console)
print("tests 汇总锚点命中:", c)
if c == 1:
    t = t.replace(anchor_console, study_test + anchor_console, 1)
    with io.open(TST, "w", encoding="utf-8") as f:
        f.write(t)
    print("DONE: 测试已插入")
else:
    print("WARN: 汇总锚点异常，未插入")
