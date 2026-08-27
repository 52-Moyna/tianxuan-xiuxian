# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = "Z:/1/xiuxian"
p = ROOT + "/tests/test-newfeatures.mjs"
s = open(p, encoding="utf-8").read()

# 1) 注入 DESTINY_LINES 导入
imp = "import { DIVINATION, PILL_RECIPES, HERB_HYBRIDS, HERB_HYBRID_COST } from '../public/js/data.js';"
assert imp in s, "data import anchor not found"
s = s.replace(imp,
    "import { DIVINATION, PILL_RECIPES, HERB_HYBRIDS, HERB_HYBRID_COST, DESTINY_LINES } from '../public/js/data.js';", 1)

# 2) 在汇总前插入天命预览测试
anchor = "console.log(`\n===== 本轮新功能专项测试："
assert anchor in s, "summary anchor not found"
block = (
"\n"
"/* ---------- 天命奖励确定性预览 ---------- */\n"
"const dp0 = S.destinyRewardPreview(state);\n"
"ok(typeof dp0 === 'string' && dp0.startsWith('奖励：'), '天命奖励预览返回确定性文案');\n"
"ok(S.destinyRewardPreview(state) === dp0, '天命奖励预览确定性（无 RNG 波动）');\n"
"const savedStage = state.destiny.stage;\n"
"const lineStages = DESTINY_LINES[state.destiny.lineId].stages;\n"
"state.destiny.stage = lineStages.length - 1;\n"
"ok(S.destinyRewardPreview(state).includes('封号'), '末阶段封号奖励预览正确');\n"
"const daoIdx = lineStages.findIndex((x) => x.reward.type === '道基');\n"
"if (daoIdx >= 0) { state.destiny.stage = daoIdx; ok(S.destinyRewardPreview(state).includes('道基'), '道基奖励预览包含「道基」'); }\n"
"state.destiny.stage = savedStage;\n"
"\n"
)
s = s.replace(anchor, block + anchor, 1)
open(p, "w", encoding="utf-8").write(s)
print("test-newfeatures patched")
