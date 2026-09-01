#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""补测试：宗门兑换所满仓保护 + storeItemOrNote 满仓提示"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def sub_once(text, old, new, tag):
    if old not in text:
        print('[MISS] ' + tag)
        sys.exit(1)
    if text.count(old) != 1:
        print('[DUP] %s -> %d' % (tag, text.count(old)))
        sys.exit(1)
    print('[OK] ' + tag)
    return text.replace(old, new)


# ========== 1. test-newfeatures.mjs ==========
p = os.path.join(ROOT, 'tests', 'test-newfeatures.mjs')
s = read(p)

# 1a. import 补齐
OLD = "upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, ARRAY_GROWTH_EVERY, ARRAY_GROWTH_MAX, herbMonthlyGrowth, herbArrayGrowth } from '../public/js/life.js';"
NEW = "upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE, ARRAY_BONUS_PER_LEVEL, ARRAY_MAX_LEVEL, ARRAY_GROWTH_EVERY, ARRAY_GROWTH_MAX, herbMonthlyGrowth, herbArrayGrowth, storeItemOrNote } from '../public/js/life.js';"
s = sub_once(s, OLD, NEW, 'newfeatures: import storeItemOrNote')

# 1b. 追加测试段
OLD = """console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""

NEW = """/* ---------- 宗门兑换所：满仓保护（付费后静默丢失修复） ---------- */
{
  const s7 = S.createNewGame({ name: '兑换满仓', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s7);
  s7.sect = { name: '测试宗门', rank: 1, contribution: 5000, tasks: [] };
  // 灵石直接入账、不占行囊格位 → 恒放行
  ok(S.sectExchangeBlockReason(s7, 'ex_stones') === null, '兑换容量校验：灵石类不占格位，恒放行');
  ok(S.sectExchangeBlockReason(s7, 'ex_qi') === null, '兑换容量校验：空间充足时丹药放行');
  // 构造满载：容量 = 当前已用（不能用 capacity=0，会被 ensureLifeState 归一成 100）
  s7.inventory.capacity = Math.max(1, inventoryUsed(s7));
  s7.inventory.ringBonus = 0;
  const blk = S.sectExchangeBlockReason(s7, 'ex_qi');
  ok(typeof blk === 'string' && blk.includes('储物袋空间不足'), '兑换容量校验：满仓时丹药被拦截');
  const c0 = s7.sect.contribution;
  const rFull = S.sectExchange(s7, 'ex_qi');
  ok(!rFull.ok, '满仓兑换丹药：拒绝兑换（修复前返回 ok:true 却什么都没给）');
  ok(s7.sect.contribution === c0, `满仓兑换丹药：贡献分文未扣（${c0} → ${s7.sect.contribution}）`);
  ok(rFull.logs.some((l) => l.includes('贡献未扣除')), '满仓兑换丹药：明确告知贡献未扣除');
  ok(!s7.items.some((i) => i.名称 === '聚气丹'), '满仓兑换丹药：未产生「没拿到却扣了贡献」的幽灵结果');
  // 灵石类满仓仍可兑换
  const rStone = S.sectExchange(s7, 'ex_stones');
  ok(rStone.ok, '满仓兑换灵石：仍可正常兑换（灵石不占行囊格位）');
  ok(s7.sect.contribution === c0 - 100, `满仓兑换灵石：正常扣除贡献 100（余 ${s7.sect.contribution}）`);
  // 腾出空间后丹药恢复可兑换
  s7.inventory.capacity = 200;
  const rOk = S.sectExchange(s7, 'ex_qi');
  ok(rOk.ok && s7.items.some((i) => i.名称 === '聚气丹'), '腾出空间后丹药可正常兑换');
  ok(s7.sect.contribution === c0 - 250, `两次兑换共扣贡献 250（余 ${s7.sect.contribution}）`);
}

/* ---------- storeItemOrNote：满仓补提示（消除静默丢失） ---------- */
{
  const s8 = S.createNewGame({ name: '提示测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s8);
  const lg1 = [];
  ok(storeItemOrNote(s8, { 名称: '测试物', 类型: '材料', 数量: 1 }, lg1) === true, 'storeItemOrNote：空间充足时入袋成功');
  ok(lg1.length === 0, 'storeItemOrNote：成功时不写提示');
  s8.inventory.capacity = Math.max(1, inventoryUsed(s8));
  s8.inventory.ringBonus = 0;
  const lg2 = [];
  ok(storeItemOrNote(s8, { 名称: '满仓物', 类型: '材料', 数量: 1 }, lg2) === false, 'storeItemOrNote：满仓返回 false');
  ok(lg2.length === 1 && lg2[0].includes('储物袋已满') && lg2[0].includes('满仓物'), 'storeItemOrNote：满仓写入含物品名的提示');
  const lg3 = [];
  storeItemOrNote(s8, { 名称: '自定义', 类型: '材料', 数量: 1 }, lg3, '自定义提示文本');
  ok(lg3[0] === '自定义提示文本', 'storeItemOrNote：支持自定义提示文案');
  ok(storeItemOrNote(s8, { 名称: '无日志', 类型: '材料', 数量: 1 }, null) === false, 'storeItemOrNote：logs 非数组时不报错');
  ok(!s8.items.some((i) => i.名称 === '满仓物' || i.名称 === '自定义' || i.名称 === '无日志'), 'storeItemOrNote：满仓时物品确实未入袋');
}

console.log(`
===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);"""

s = sub_once(s, OLD, NEW, 'newfeatures: 追加兑换满仓与提示测试')
write(p, s)

# ========== 2. test-ui-smoke.mjs ==========
p = os.path.join(ROOT, 'tests', 'test-ui-smoke.mjs')
s = read(p)

OLD = """  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""

NEW = """  // 宗门兑换所：满仓时禁用丹药兑换（UI 与 sectExchange 同口径，防止贡献白扣）
  try {
    const L2 = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const s2 = GameState.data;
    L2.ensureLifeState(s2);
    s2.sect = s2.sect || {};
    s2.sect.name = '测试宗门'; s2.sect.rank = 1; s2.sect.contribution = 5000;
    UI.renderAll(); await sleep(150);
    const chip = $('#tb-sect');
    ok(!!chip && chip.style.display !== 'none', '入宗后顶栏宗门 chip 可见');
    chip.click(); await sleep(200);
    ok($$('[data-exchange]').length === 4, `宗门面板渲染兑换项（${$$('[data-exchange]').length} 个）`);
    ok($$('[data-exchange]').every((b) => !b.disabled), '空间充足时兑换按钮全部可用');
    // 构造满载：容量 = 当前已用
    s2.inventory.capacity = Math.max(1, L2.inventoryUsed(s2));
    s2.inventory.ringBonus = 0;
    UI.renderAll(); await sleep(120);
    $('#tb-sect').click(); await sleep(200);
    const qiBtn = $$('[data-exchange]').find((b) => b.dataset.exchange === 'ex_qi');
    const stBtn = $$('[data-exchange]').find((b) => b.dataset.exchange === 'ex_stones');
    ok(!!qiBtn && qiBtn.disabled, '满仓时丹药兑换按钮被禁用（防止贡献白扣）');
    ok(!!stBtn && !stBtn.disabled, '满仓时灵石兑换仍可用（灵石不占行囊格位）');
    const mHtml = $('.modal') ? $('.modal').innerHTML : '';
    ok(mHtml.includes('储物袋空间不足'), '满仓兑换项给出明确警示文案');
    ok(!!$('.bag-block-warn'), '满仓警示使用 .bag-block-warn 红条样式');
    $('#btn-back-sect').click(); await sleep(150);
    s2.inventory.capacity = 200; s2.sect.contribution = 0;
    UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `宗门兑换所满仓渲染: ${e.message}`); }

  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""

s = sub_once(s, OLD, NEW, 'ui-smoke: 宗门兑换满仓 UI 测试')
write(p, s)

print('DONE')
