# -*- coding: utf-8 -*-
"""天玄修仙录·打磨补丁（修订版，三引号版）：
1) 修复主修功法字段错位 bug：createNewGame 把 mainTechnique 写在 state 顶层，
   但全部读取点（含研读执行分支）都读 state.player.mainTechnique，UI「设为主修」
   也写 player.mainTechnique；导致新游戏开局主修功法未被逻辑识别。修正：
   createNewGame 同时设置 state.player.mainTechnique，ensureLifeState 对旧档归一。
2) 研读（study）行动确定性收益预览 studyGainPreview + 罗盘预览分支 + 测试断言。
"""
import io

ROOT = "Z:/1/xiuxian"
SYS = ROOT + "/public/js/systems.js"
LIFE = ROOT + "/public/js/life.js"
TST = ROOT + "/tests/test-newfeatures.mjs"

# ===== A. systems.js：createNewGame 末尾设置 state.player.mainTechnique =====
anchor_a = """  ensureLifeState(state);
  refreshDerived(state);
  return state;
}"""
new_a = """  // 修复：主修功法同时写入 player.mainTechnique（与全部读取点/UI「设为主修」一致），
  // 否则新游戏开局主修功法不会被功法加成与研读逻辑识别。
  state.player.mainTechnique = startTechName;
  ensureLifeState(state);
  refreshDerived(state);
  return state;
}"""
with io.open(SYS, "r", encoding="utf-8") as f:
    s = f.read()
c = s.count(anchor_a)
print("A createNewGame 尾部锚点命中:", c)
if c == 1:
    s = s.replace(anchor_a, new_a, 1)
else:
    print("WARN: A 锚点异常")

# ===== B. systems.js：studyGainPreview 兜底读取（已插入的函数） =====
anchor_b = "  const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);\n  if (!tech) return '尚未主修功法，研读仅得悟性';"
new_b = "  const tech = state.techniques.find((t) => t.名称 === (state.player.mainTechnique || state.mainTechnique));\n  if (!tech) return '尚未主修功法，研读仅得悟性';"
c2 = s.count(anchor_b)
print("B studyGainPreview 兜底锚点命中:", c2)
if c2 == 1:
    s = s.replace(anchor_b, new_b, 1)
else:
    print("WARN: B 锚点异常（studyGainPreview 可能尚未插入或文本不符）")
with io.open(SYS, "w", encoding="utf-8") as f:
    f.write(s)

# ===== C. life.js：ensureLifeState 旧档兼容归一 =====
anchor_c = """  state.player = state.player || {};
  state.player.daoBase = state.player.daoBase || {};"""
new_c = """  state.player = state.player || {};
  // 主修功法兼容归一：旧档可能仅存顶层 state.mainTechnique，读取点统一用 player.mainTechnique
  if (!state.player.mainTechnique && state.mainTechnique) state.player.mainTechnique = state.mainTechnique;
  state.player.daoBase = state.player.daoBase || {};"""
with io.open(LIFE, "r", encoding="utf-8") as f:
    l = f.read()
c3 = l.count(anchor_c)
print("C ensureLifeState 归一锚点命中:", c3)
if c3 == 1:
    l = l.replace(anchor_c, new_c, 1)
else:
    print("WARN: C 锚点异常")
with io.open(LIFE, "w", encoding="utf-8") as f:
    f.write(l)

# ===== D. tests：在 studyPreviewGroup 中增加「开局主修字段已设置」断言 =====
anchor_d = """  ensureLifeState(sg);
  const prev = S.studyGainPreview(sg);"""
new_d = """  ensureLifeState(sg);
  ok(!!sg.player.mainTechnique, '新游戏默认主修功法已设置（修复 state.player.mainTechnique 初始 undefined 的错位 bug）');
  const prev = S.studyGainPreview(sg);"""
with io.open(TST, "r", encoding="utf-8") as f:
    t = f.read()
c4 = t.count(anchor_d)
print("D 测试断言锚点命中:", c4)
if c4 == 1:
    t = t.replace(anchor_d, new_d, 1)
else:
    print("WARN: D 锚点异常")
with io.open(TST, "w", encoding="utf-8") as f:
    f.write(t)

print("DONE")
