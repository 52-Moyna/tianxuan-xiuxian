#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给 tests/test-newfeatures.mjs 补「宗门灵脉晶接入炼器」确定性断言。
安全写回：先 replace 再 write，严禁直接覆盖。
"""
import io, sys, os

TEST = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'

# 1) 在 life.js 导入中追加 ART_RECIPES
imp_old = "travelOptions } from '../public/js/life.js';"
imp_new = "travelOptions, ART_RECIPES } from '../public/js/life.js';"

# 2) 在末尾汇总 console.log 之前插入测试块
anchor = "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"
block = r'''
/* ---------- 宗门灵脉晶接入炼器（修复死道具） ---------- */
// 新增「灵脉石饰」配方应将宗门灵脉晶作为真实锻造材料，使其不再是死道具
const lmRecipe = ART_RECIPES.炼器.find((r) => r.id === 'lingmai_shi');
ok(!!lmRecipe, '炼器新增灵脉石饰配方');
ok(lmRecipe && lmRecipe.need['宗门灵脉晶'] === 1, '灵脉石饰配方消耗宗门灵脉晶×1');
ok(lmRecipe && lmRecipe.need['矿石'] === 2, '灵脉石饰配方消耗矿石×2');
// 材料不足：无法锻造、不产出
const lmState = S.createNewGame({ name: '灵脉测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
ensureLifeState(lmState);
const lmNoMat = S.practiceArt(lmState, '炼器', 'lingmai_shi');
ok(!lmNoMat.some((l) => l.includes('百艺制成')), '无材料时灵脉石饰锻造不产出');
// 给予材料：确定性产出灵脉石饰并消耗材料
storeItem(lmState, { 名称: '宗门灵脉晶', 类型: '材料', 数量: 1, 描述: 'x' });
storeItem(lmState, { 名称: '矿石', 类型: '材料', 数量: 2, 描述: 'x' });
const lmBefore = lmState.items.find((i) => i.名称 === '宗门灵脉晶')?.数量 || 0;
const lmLogs = S.practiceArt(lmState, '炼器', 'lingmai_shi');
ok(lmLogs.some((l) => l.includes('灵脉石饰')), '持材料锻造灵脉石饰成功产出');
ok((lmState.items.find((i) => i.名称 === '宗门灵脉晶')?.数量 || 0) === lmBefore - 1, '锻造消耗宗门灵脉晶×1');
ok(!!lmState.items.find((i) => i.名称 === '灵脉石饰'), '背包出现灵脉石饰装备');

''' + "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"

def patch(path, old, new, label):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    cnt = s.count(old)
    if cnt != 1:
        print(f'FAIL [{label}] 期望命中 1 次，实际 {cnt} 次')
        sys.exit(1)
    s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'OK [{label}] 已替换 1 处')

patch(TEST, imp_old, imp_new, 'test import ART_RECIPES')
patch(TEST, anchor, block, 'test block 灵脉石饰')
print('测试补丁应用成功。')
