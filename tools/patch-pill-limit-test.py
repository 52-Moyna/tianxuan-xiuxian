# -*- coding: utf-8 -*-
"""为「丹药一生次数上限持久化 + 洗髓丹 2 颗上限」新增确定性断言。"""
import io

P = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'
s = io.open(P, encoding='utf-8').read()

ANCHOR = "console.log(`\n===== 本轮新功能专项测试"
if ANCHOR not in s:
    raise SystemExit('汇总锚点未找到')

BLOCK = r'''
/* ---------- 珍贵丹药「一生服用次数」上限：洗髓丹 2 颗 + 计数随档持久化 ---------- */
{
  // 【背景】图鉴承诺「洗髓丹一生最多服用 2 颗」，此前代码完全无限制（假承诺）；
  // 且延寿丹已实现的 3 颗上限未写入存档，存读档即可清零计数绕过上限。本组断言两者。
  const mkPill = () => ({ 名称: '洗髓丹', 类型: '丹药', 数量: 1, 描述: '洗髓伐毛', effect: { daoBase: { keys: ['根骨', '道心'], min: 5, max: 10 } }, toxicity: 20 });
  const stM = S.createNewGame({ name: '洗髓上限', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stM);
  stM.inventory.capacity = 1000;
  ok(stM.player.marrowPillsTaken === 0, '洗髓上限：新档计数初始为 0');
  for (let i = 0; i < 4; i++) storeItem(stM, mkPill()); // storeItem 按名称合并为「数量 4」
  const idxM = stM.items.findIndex((i) => i.名称 === '洗髓丹');
  ok(idxM >= 0 && stM.items[idxM].数量 === 4, '洗髓上限：注入 4 颗（合并为数量 4）');
  const gen0 = stM.player.daoBase['根骨'].level + stM.player.daoBase['道心'].level;
  S.useItem(stM, idxM); S.useItem(stM, idxM); // 服满 2 颗
  ok(stM.player.marrowPillsTaken === 2, '洗髓上限：服用 2 颗后计数 = 2');
  const gen2 = stM.player.daoBase['根骨'].level + stM.player.daoBase['道心'].level;
  ok(gen2 >= gen0 + 10, '洗髓上限：2 颗共提升道基 ≥ 10 级（每颗 5~10）');
  ok(stM.items[idxM] && stM.items[idxM].数量 === 2, '洗髓上限：2 颗已消耗、剩 2 颗');
  const logs3 = S.useItem(stM, idxM) || [];
  ok(logs3.join('').includes('一生至多可服 2 颗'), '洗髓上限：第 3 颗返回拒绝文案');
  ok(stM.player.marrowPillsTaken === 2, '洗髓上限：第 3 颗不累加计数');
  ok(stM.player.daoBase['根骨'].level + stM.player.daoBase['道心'].level === gen2, '洗髓上限：第 3 颗不提升道基');
  ok(stM.items[idxM] && stM.items[idxM].数量 === 2, '洗髓上限：第 3 颗未被消耗（仍留储物袋）');

  // 炎玉丹/玉华丹同为 daoBase 效果但不受洗髓丹额度限制（各自无次数承诺）
  const stY = S.createNewGame({ name: '炎玉不受限', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stY);
  stY.inventory.capacity = 1000;
  stY.player.marrowPillsTaken = 2; // 洗髓额度已满，不应影响炎玉丹
  storeItem(stY, { 名称: '炎玉丹', 类型: '丹药', 数量: 1, 描述: '温补根基', effect: { daoBase: { keys: ['根骨', '道心'], min: 4, max: 8 } }, toxicity: 16 });
  const idxY = stY.items.findIndex((i) => i.名称 === '炎玉丹');
  const yBefore = stY.player.daoBase['根骨'].level + stY.player.daoBase['道心'].level;
  S.useItem(stY, idxY);
  ok(stY.player.daoBase['根骨'].level + stY.player.daoBase['道心'].level >= yBefore + 4, '洗髓额度满时炎玉丹仍可正常服用（不受洗髓丹上限牵连）');
  ok(stY.player.marrowPillsTaken === 2, '炎玉丹不消耗洗髓丹额度');

  // itemUsePreview 与实际结算同口径：额度实时反映在行囊预览
  const pv0 = S.itemUsePreview(stY, mkPill());
  ok(pv0.mode === 'use' && pv0.text.includes('已服满 2/2') && pv0.text.includes('暂难生效'), '洗髓丹预览：额度用尽时提示暂难生效');
  const pv1 = S.itemUsePreview({ player: { marrowPillsTaken: 1, daoBase: {} } }, mkPill());
  ok(pv1.text.includes('已服 1/2'), '洗髓丹预览：剩余额度实时显示 1/2');
  const pvYan = S.itemUsePreview(stY, { 名称: '炎玉丹', 类型: '丹药', effect: { daoBase: { keys: ['根骨', '道心'], min: 4, max: 8 } } });
  ok(!pvYan.text.includes('一生限'), '炎玉丹预览不显示一生额度（无此承诺）');

  // 【关键回归】计数必须随存档往返保持，否则存读档即可无限嗑药绕过上限
  const stSave = S.createNewGame({ name: '计数存档', gender: '女', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(stSave);
  stSave.player.lifespanPillsTaken = 3;
  stSave.player.marrowPillsTaken = 2;
  const round = deserialize(serialize(stSave));
  ensureLifeState(round);
  ok(round.player.lifespanPillsTaken === 3, '存档往返：延寿丹已服计数保持为 3（修复存读档绕过上限）');
  ok(round.player.marrowPillsTaken === 2, '存档往返：洗髓丹已服计数保持为 2');
  // 读档后额度确实仍然生效（不是只存了数字）
  round.inventory.capacity = 1000;
  storeItem(round, mkPill());
  const idxR = round.items.findIndex((i) => i.名称 === '洗髓丹');
  const rBefore = round.player.daoBase['根骨'].level + round.player.daoBase['道心'].level;
  const rLogs = S.useItem(round, idxR) || [];
  ok(rLogs.join('').includes('一生至多可服 2 颗'), '读档后洗髓丹额度仍生效（拒绝服用）');
  ok(round.player.daoBase['根骨'].level + round.player.daoBase['道心'].level === rBefore, '读档后第 3 颗洗髓丹不提升道基');

  // 旧档兜底：缺字段时 ensureLifeState 归零，避免 undefined 参与比较导致上限失效
  const legacy = JSON.parse(JSON.stringify(stSave));
  delete legacy.player.lifespanPillsTaken;
  delete legacy.player.marrowPillsTaken;
  ensureLifeState(legacy);
  ok(legacy.player.lifespanPillsTaken === 0 && legacy.player.marrowPillsTaken === 0, '旧档兜底：缺失计数字段被归零为 0');
}

'''

s = s.replace(ANCHOR, BLOCK + ANCHOR, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('测试断言已插入')
