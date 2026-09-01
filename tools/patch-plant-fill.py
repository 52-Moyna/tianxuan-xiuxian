# -*- coding: utf-8 -*-
"""灵草园一键补种：life.js 新增 plantHerbFill + ui.js 种子列表补满按钮"""
import io, sys

# ---------- life.js ----------
P = 'Z:/1/xiuxian/public/js/life.js'
s = io.open(P, encoding='utf-8').read()
orig = s
anchor = "/** 收获一株已成熟的灵草 → 产出材料入袋 */"
assert s.count(anchor) == 1, 'harvestHerb 注释锚点不唯一'
fn = '''/**
 * 一键补种：把灵田空位全部播上同一种灵草。
 * 收获后灵田常整片空置，逐株点击播种纯属重复劳动，故提供批量补种入口。
 * 灵石不足时种到负担不起为止（不透支、不半途报错）。
 * @returns {{ok:boolean, count:number, spent:number, logs:string[]}}
 */
export function plantHerbFill(state, herbId) {
  ensureLifeState(state);
  const def = HERB_TYPES.find((h) => h.id === herbId);
  if (!def) return { ok: false, count: 0, spent: 0, logs: ['未知灵草。'] };
  const room = gardenCapacity(state) - state.cave.garden.length;
  if (room <= 0) return { ok: false, count: 0, spent: 0, logs: [`灵草园已满（最多 ${gardenCapacity(state)} 株），请先收获。`] };
  let count = 0;
  for (let i = 0; i < room; i++) {
    const r = plantHerb(state, herbId);
    if (!r.ok) break;
    count += 1;
  }
  if (!count) return { ok: false, count: 0, spent: 0, logs: [`灵石不足（补种 1 株需 ${def.seedCost}）。`] };
  return { ok: true, count, spent: count * def.seedCost, logs: [`你在灵田补种「${def.name}」${count} 株（耗灵石 ${count * def.seedCost}），约 ${def.grow} 个月后成熟。`] };
}

'''
s = s.replace(anchor, fn + anchor, 1)
assert s != orig
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('life.js patched OK')

# ---------- ui.js ----------
P2 = 'Z:/1/xiuxian/public/js/ui.js'
u = io.open(P2, encoding='utf-8').read()
orig2 = u

old = "herbQuality, plantHerb, harvestHerb,"
assert u.count(old) == 1
u = u.replace(old, "herbQuality, plantHerb, plantHerbFill, harvestHerb,", 1)

old = """              <button class="btn btn-sm btn-gold" data-plant="${hb.id}" ${garden.length >= gardenCapacity(st) ? 'disabled' : ''}>播种（${hb.seedCost}灵石）</button>"""
new = """              <button class="btn btn-sm btn-gold" data-plant="${hb.id}" ${garden.length >= gardenCapacity(st) ? 'disabled' : ''}>播种（${hb.seedCost}灵石）</button>
              ${garden.length < gardenCapacity(st) ? `<button class="btn btn-sm" data-plantfill="${hb.id}" title="把剩余 ${gardenCapacity(st) - garden.length} 个空位全部播上「${hb.name}」">补满 ${gardenCapacity(st) - garden.length} 株（${(gardenCapacity(st) - garden.length) * hb.seedCost}灵石）</button>` : ''}"""
assert u.count(old) == 1, '播种按钮锚点不唯一'
u = u.replace(old, new, 1)

old = """    box.querySelectorAll('[data-harvest]').forEach((b) => b.addEventListener('click', () => {"""
new = """    box.querySelectorAll('[data-plantfill]').forEach((b) => b.addEventListener('click', () => {
      const r = plantHerbFill(st, b.dataset.plantfill);
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? `已补种 ${r.count} 株（耗灵石 ${r.spent}）` : (r.logs[0] || '无法补种'), r.ok ? 'jade' : 'warn');
      renderAll();
    }));
    box.querySelectorAll('[data-harvest]').forEach((b) => b.addEventListener('click', () => {"""
assert u.count(old) == 1, 'harvest 事件锚点不唯一'
u = u.replace(old, new, 1)

assert u != orig2
io.open(P2, 'w', encoding='utf-8', newline='').write(u)
print('ui.js patched OK')
