# -*- coding: utf-8 -*-
import io, sys

PATH = "Z:/1/xiuxian/tests/test-newfeatures.mjs"

group = (
    "/* ---------- 英雄卡护身道具常驻展示（wardItems 计数助手） ---------- */\n"
    "{\n"
    "  const st = S.createNewGame({ name: '护身计数', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });\n"
    "  ensureLifeState(st);\n"
    "  // 新游戏初始不应自带护身类道具\n"
    "  ok(S.wardItems(st).length === 0, '护身计数：新游戏初始无护身道具');\n"
    "  // 注入两件不同护身道具，合并按数量计数\n"
    "  st.items.push({ 名称: '低阶护身符', 类型: '消耗品', 数量: 2, 描述: '测试' });\n"
    "  st.items.push({ 名称: '简易阵旗', 类型: '消耗品', 数量: 1, 描述: '测试', effect: { ward: true } });\n"
    "  const held = S.wardItems(st);\n"
    "  const total = held.reduce((s, x) => s + (Number(x.数量) || 1), 0);\n"
    "  ok(held.length === 2 && total === 3, '护身计数：持有 2 种共 3 件（低阶护身符×2 + 简易阵旗×1）');\n"
    "  // 高阶护身符识别（败北时挡重伤并护住灵石）\n"
    "  st.items.push({ 名称: '护身符', 类型: '消耗品', 数量: 1, 描述: '测试' });\n"
    "  ok(S.wardItems(st).some((x) => x.名称 === '护身符'), '护身计数：高阶护身符被正确纳入统计');\n"
    "  // 非护身类物品不应计入\n"
    "  st.items.push({ 名称: '凝火丹', 类型: '丹药', 数量: 5, 描述: '测试' });\n"
    "  ok(S.wardItems(st).length === 3, '护身计数：非护身类物品（丹药）不计入统计');\n"
    "}\n\n"
)

old = "console.log(`\n===== 本轮新功能专项测试："
with io.open(PATH, "r", encoding="utf-8") as f:
    s = f.read()
cnt = s.count(old)
if cnt != 1:
    print("锚点匹配异常 count=%d" % cnt)
    sys.exit(2)
s = s.replace(old, group + old, 1)
with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(s)
print("测试补丁 OK")
