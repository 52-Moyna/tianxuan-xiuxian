#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""修复：宗门兑换所满仓静默丢失贡献（P1）

问题：sectExchange 先扣贡献再 storeItem；储物袋满时丹药被静默丢弃，
      玩家白付 100~240 点宗门贡献却一无所获，日志仍写「兑换成功」。

修复：
  1. systems.js 新增 sectExchangeBlockReason 纯函数（结算与 UI 共用的唯一事实来源）。
  2. sectExchange 在扣贡献前校验容量，满仓直接拒绝且不扣贡献。
  3. 丹药入袋失败补 ⚠ 日志（双保险）。
  4. ui.js 宗门兑换所：满仓时按钮 disabled + 红字警示。
  5. main.css 新增通用 .bag-block-warn 样式。
"""
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


# ---------- 1. systems.js：新增容量校验 + 结算前拦截 ----------
p = os.path.join(ROOT, 'public', 'js', 'systems.js')
s = read(p)

OLD = """/** 宗门兑换所：以宗门贡献兑换资源（确定性，无 RNG）。 */
export function sectExchange(state, itemId) {
  ensureLifeState(state);
  ensureSectState(state);
  if (!state.sect.name) return { ok: false, logs: ['你尚未加入任何宗门，无处兑换。'] };
  const ex = SECT_EXCHANGE.find((e) => e.id === itemId);
  if (!ex) return { ok: false, logs: ['宗门兑换所无此物资。'] };
  if (state.sect.contribution < ex.cost) {
    return { ok: false, logs: [`宗门贡献不足，需 ${ex.cost}（当前 ${state.sect.contribution}）。`] };
  }
  state.sect.contribution -= ex.cost;
  const logs = [`🏯 你于宗门兑换所换取「${ex.name}」，消耗贡献 ${ex.cost}。`];
  if (ex.type === 'stones') {
    addStones(state, ex.amount);
    logs.push(`获得下品灵石 +${ex.amount}。`);
  } else if (ex.type === 'pill') {
    const it = { 名称: ex.item, 类型: '丹药', 数量: ex.qty || 1, 描述: ex.desc, effect: ex.effect, toxicity: ex.toxicity };
    if (storeItem(state, it)) logs.push(`获得丹药：${ex.item} ×${ex.qty || 1}。`);
  }
"""

NEW = """/** 宗门兑换容量校验：作为「结算与 UI」唯一事实来源，杜绝口径漂移。
 *  灵石直接入账、不占行囊格位，故只对丹药类兑换做容量校验。返回 null 表示可兑换。 */
export function sectExchangeBlockReason(state, itemId) {
  const ex = SECT_EXCHANGE.find((e) => e.id === itemId);
  if (!ex || ex.type !== 'pill') return null;
  const probe = { 名称: ex.item, 类型: '丹药', 数量: ex.qty || 1 };
  if (canStore(state, probe)) return null;
  return `储物袋空间不足，「${ex.item}」无处安放，请先出售杂物或扩容储物袋再行兑换。`;
}

/** 宗门兑换所：以宗门贡献兑换资源（确定性，无 RNG）。 */
export function sectExchange(state, itemId) {
  ensureLifeState(state);
  ensureSectState(state);
  if (!state.sect.name) return { ok: false, logs: ['你尚未加入任何宗门，无处兑换。'] };
  const ex = SECT_EXCHANGE.find((e) => e.id === itemId);
  if (!ex) return { ok: false, logs: ['宗门兑换所无此物资。'] };
  if (state.sect.contribution < ex.cost) {
    return { ok: false, logs: [`宗门贡献不足，需 ${ex.cost}（当前 ${state.sect.contribution}）。`] };
  }
  // 满仓保护：丹药要占行囊格位，必须先确认有处安放，再扣贡献。
  // 旧写法先扣贡献再 storeItem，储物袋满时玩家白付 100~240 点贡献却一无所获，
  // 返回却是 ok:true、日志仍写「兑换成功」——典型的付费后静默丢失。
  const block = sectExchangeBlockReason(state, itemId);
  if (block) return { ok: false, logs: [`⚠ ${block}（贡献未扣除）`] };
  state.sect.contribution -= ex.cost;
  const logs = [`🏯 你于宗门兑换所换取「${ex.name}」，消耗贡献 ${ex.cost}。`];
  if (ex.type === 'stones') {
    addStones(state, ex.amount);
    logs.push(`获得下品灵石 +${ex.amount}。`);
  } else if (ex.type === 'pill') {
    const it = { 名称: ex.item, 类型: '丹药', 数量: ex.qty || 1, 描述: ex.desc, effect: ex.effect, toxicity: ex.toxicity };
    if (storeItem(state, it)) logs.push(`获得丹药：${ex.item} ×${ex.qty || 1}。`);
    else logs.push(`⚠ 储物袋已满，「${ex.item}」未能带走。`);
  }
"""

s = sub_once(s, OLD, NEW, 'systems.js: sectExchange 满仓拦截')
write(p, s)

# ---------- 2. ui.js：兑换按钮满仓禁用 + 红字警示 ----------
p = os.path.join(ROOT, 'public', 'js', 'ui.js')
s = read(p)

OLD = """    ${CX.SECT_EXCHANGE.map((e) => {
      const get = e.type === 'stones' ? `下品灵石 +${e.amount}` : `丹药：${e.item} ×${e.qty || 1}`;
      return `<div class="sect-task">
        <div class="codex-body"><b>${e.name}</b><div class="codex-source">${e.desc} ｜ 需贡献 ${e.cost}</div><div class="codex-effect">可得：${get}</div></div>
        <button class="btn btn-sm ${st.sect.contribution >= e.cost ? 'btn-gold' : 'btn-dim'}" data-exchange="${e.id}" ${st.sect.contribution >= e.cost ? '' : 'disabled'}>兑换</button>
      </div>`;
    }).join('')}"""

NEW = """    ${CX.SECT_EXCHANGE.map((e) => {
      const get = e.type === 'stones' ? `下品灵石 +${e.amount}` : `丹药：${e.item} ×${e.qty || 1}`;
      // 满仓校验与 sectExchange 共用 sectExchangeBlockReason，UI 与结算口径一致：
      // 丹药占行囊格位，储物袋满时直接禁用按钮，避免玩家点了才发现贡献白扣。
      const block = S.sectExchangeBlockReason(st, e.id);
      const ok = st.sect.contribution >= e.cost && !block;
      const warn = block ? `<div class="bag-block-warn">⚠ ${block}</div>` : '';
      return `<div class="sect-task">
        <div class="codex-body"><b>${e.name}</b><div class="codex-source">${e.desc} ｜ 需贡献 ${e.cost}</div><div class="codex-effect">可得：${get}</div>${warn}</div>
        <button class="btn btn-sm ${ok ? 'btn-gold' : 'btn-dim'}" data-exchange="${e.id}" ${ok ? '' : 'disabled'}>兑换</button>
      </div>`;
    }).join('')}"""

s = sub_once(s, OLD, NEW, 'ui.js: 兑换所满仓禁用')
write(p, s)

# ---------- 3. main.css：通用满仓红条 ----------
p = os.path.join(ROOT, 'public', 'css', 'main.css')
s = read(p)

OLD = """.herb-bag-warn { margin: 6px 0 8px; padding: 7px 10px; border-radius: 9px; font-size: .78rem; line-height: 1.5; color: var(--danger-strong); background: var(--danger-bg); border: 1px solid var(--danger-strong); }"""

NEW = OLD + """
.bag-block-warn { margin: 6px 0 0; padding: 7px 10px; border-radius: 9px; font-size: .76rem; line-height: 1.5; color: var(--danger-strong); background: var(--danger-bg); border: 1px solid var(--danger-strong); }"""

s = sub_once(s, OLD, NEW, 'main.css: .bag-block-warn')
write(p, s)

print('DONE')
