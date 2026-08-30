# -*- coding: utf-8 -*-
"""补丁：为 itemUsePreview 与兽皮护符修复补确定性断言。
注意历史坑：断言必须插在汇总 console.log 整句之前，不可落入模板串内部。"""
import io
T = 'tests/test-newfeatures.mjs'
s = io.open(T, encoding='utf-8').read()
anchor = "console.log(`\n===== 本轮新功能专项测试："
assert s.count(anchor) == 1, '汇总行锚点异常'

BLOCK = r"""/* ---------- 物品使用预览 itemUsePreview（修复「炼出来却不能服用」）---------- */
{
  const st0 = { player: { lifespanPillsTaken: 0 }, beasts: { maxSlots: 1 } };
  // 洗髓丹：daoBase 区间 + 丹毒代价
  const xisui = S.itemUsePreview(st0, { 名称: '洗髓丹', 类型: '丹药', effect: { daoBase: { keys: ['根骨', '道心'], min: 5, max: 10 } }, toxicity: 20 });
  ok(xisui.mode === 'use' && xisui.label === '服用', '洗髓丹可主动服用（旧版无按钮）');
  ok(xisui.text.includes('根骨/道心') && xisui.text.includes('+5~10 级') && xisui.text.includes('丹毒 +20'), '洗髓丹预览含道基区间与丹毒');
  // 凝神丹：悟性经验
  const ningshen = S.itemUsePreview(st0, { 名称: '凝神丹', 类型: '丹药', effect: { wuxing: 120 }, toxicity: 10 });
  ok(ningshen.mode === 'use' && ningshen.text.includes('悟性经验 +120') && ningshen.text.includes('丹毒 +10'), '凝神丹可服用且预览含悟性经验');
  // 狂战丹：临时战力 + 持续月数
  const kuangzhan = S.itemUsePreview(st0, { 名称: '狂战丹', 类型: '丹药', effect: { power: 150, powerMonths: 3 }, toxicity: 14 });
  ok(kuangzhan.mode === 'use' && kuangzhan.text.includes('战力临时 +150（持续 3 月）'), '狂战丹可服用且预览含临时战力与月数');
  // 延寿丹：一生 3 颗额度实时反映
  const ys0 = S.itemUsePreview(st0, { 名称: '延寿丹', 类型: '丹药', effect: { lifespan: 20 } });
  ok(ys0.mode === 'use' && ys0.text.includes('寿元上限 +20 年') && ys0.text.includes('已服 0/3'), '延寿丹预览含剩余额度 0/3');
  const ys3 = S.itemUsePreview({ player: { lifespanPillsTaken: 3 } }, { 名称: '延寿丹', 类型: '丹药', effect: { lifespan: 20 } });
  ok(ys3.text.includes('已服满 3/3') && ys3.text.includes('暂难生效'), '延寿丹服满 3 颗时预览提示无效');
  // 灵兽契约：非丹药 → 按钮文案「使用」；上限已满时提示
  const qiyue = S.itemUsePreview(st0, { 名称: '灵兽契约', 类型: '道具', effect: { beastSlot: 1 } });
  ok(qiyue.mode === 'use' && qiyue.label === '使用' && qiyue.text.includes('现 1/6 栏'), '灵兽契约可使用且预览含当前栏位');
  const qiyueFull = S.itemUsePreview({ beasts: { maxSlots: 6 } }, { 名称: '灵兽契约', 类型: '道具', effect: { beastSlot: 1 } });
  ok(qiyueFull.text.includes('已达上限 6/6'), '灵兽栏满时契约预览提示无效');
  // 聚灵阵旗：修炼效率增益
  const zhenqi = S.itemUsePreview(st0, { 名称: '聚灵阵旗', 类型: '消耗品', effect: { cultivateBoostMonths: 1 } });
  ok(zhenqi.mode === 'use' && zhenqi.text.includes('未来 1 月修炼效率 +15%'), '聚灵阵旗可使用且预览含增益月数');
  // 丹药品质乘区计入预览
  const jq = S.itemUsePreview(st0, { 名称: '聚气丹', 类型: '丹药', effect: { exp: 90 }, quality: { grade: '上品', mult: 1.2 }, toxicity: 8 });
  ok(jq.text.includes('修为 +108') && jq.text.includes('上品'), '预览按丹药品质乘区计算修为');
  // 自动消耗类：不给按钮，改说明时机
  ok(S.itemUsePreview(st0, { 名称: '筑基丹', 类型: '丹药', effect: { exp: 150 }, breakthrough: true }).mode === 'auto', '瓶颈专属丹为自动消耗类');
  const dj = S.itemUsePreview(st0, { 名称: '渡劫丹', 类型: '丹药', effect: { tribulation: 15, exp: 60 } });
  ok(dj.mode === 'auto' && dj.text.includes('+15%'), '渡劫丹为自动消耗类且说明加成');
  ok(S.itemUsePreview(st0, { 名称: '护身符', 类型: '消耗品', effect: { ward: true } }).mode === 'auto', '护身道具为自动消耗类');
  ok(S.itemUsePreview(st0, { 名称: '驯兽口粮', 类型: '消耗品', effect: { tame: 15 } }).mode === 'auto', '驯兽口粮为自动消耗类');
  ok(S.itemUsePreview(st0, { 名称: '地火引', 类型: '材料', effect: { exp: 1 } }).mode === 'auto', '地火引为自动消耗类');
  // 装备/无效果
  ok(S.itemUsePreview(st0, { 名称: '青锋剑', 类型: '法宝', 战力: 30 }).mode === 'equip', '法宝判定为可穿戴');
  ok(S.itemUsePreview(st0, { 名称: '星砂', 类型: '材料' }).mode === 'none', '无 effect 材料无可用操作');
  // 核心回归：所有丹方产出（除瓶颈丹/渡劫丹）必须可主动服用，防止再现「炼出来却不能吃」
  let unusable = [];
  for (const [id, r] of Object.entries(PILL_RECIPES)) {
    const out = { 名称: r.name, 类型: '丹药', 数量: 1, effect: r.effect, toxicity: r.toxicity, breakthrough: r.breakthrough || false };
    const pv = S.itemUsePreview(st0, out);
    const autoKind = r.breakthrough || typeof (r.effect || {}).tribulation === 'number';
    if (!autoKind && pv.mode !== 'use') unusable.push(id);
  }
  ok(unusable.length === 0, `所有丹方产出均可服用（异常：${unusable.join('、')}）`);
}
/* ---------- 兽皮护符纳入护身道具（消除死道具）---------- */
ok(S.WARD_ITEM_NAMES.includes('兽皮护符'), '兽皮护符已纳入护身道具名单');
{
  const stW = { items: [{ 名称: '兽皮护符', 类型: '消耗品', 数量: 2, effect: { ward: true } }] };
  ok(S.wardItems(stW).length === 1, '兽皮护符可被 wardItems 统计（英雄卡护身数）');
}

"""
s = s.replace(anchor, BLOCK + anchor, 1)
io.open(T, 'w', encoding='utf-8', newline='\n').write(s)
print('测试已打补丁')
