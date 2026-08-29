# -*- coding: utf-8 -*-
import io, sys

BASE = 'Z:/1/xiuxian/'

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)

def edit(p, old, new, count=None, all=False):
    s = read(p)
    n = s.count(old)
    if count is not None and n != count:
        print(f'[MISS] {p} 期望 {count} 处匹配，实际 {n} 处 -> 跳过')
        return False
    if count is None and n == 0:
        print(f'[MISS] {p} 未找到匹配 -> 跳过')
        return False
    s = s.replace(old, new, -1) if all else s.replace(old, new, 1) if not all else s.replace(old, new)
    # 用 replace 默认只换第一处（count 未指定时单处）
    write(p, s)
    print(f'[OK] {p} 替换成功（匹配 {n} 处）')
    return True

# ============ systems.js ============
P = BASE + 'public/js/systems.js'

HELPER = '''/** 当前生效的临时战力增益（来自战力类丹药 buff）。
 *  state.buffs = { power, expireMonth }，expireMonth 为全局月序号 year*12+month；
 *  超过 expireMonth 即视为过期，返回 0（此前该字段恒为 0，是死字段）。 */
export function activeBuffPower(state) {
  const b = state.buffs;
  if (!b || !b.power) return 0;
  const cur = (state.world.year * 12) + state.world.month;
  return cur < b.expireMonth ? b.power : 0;
}
/** 临时战力增益剩余月数（过期返回 0），供战力拆解与英雄卡显示。 */
export function buffMonthsLeft(state) {
  const b = state.buffs;
  if (!b || !b.power) return 0;
  const cur = (state.world.year * 12) + state.world.month;
  return Math.max(0, b.expireMonth - cur);
}
export function calcPower(state) {'''

edit(P, 'export function calcPower(state) {', HELPER, count=1)

edit(P, "  const pillPower = (state.buffs?.power || 0);",
       "  const pillPower = activeBuffPower(state);", all=True)

edit(P,
     "    { label: '丹药增益', value: pillPower, hint: pillPower ? '临时' : '无' },",
     "    { label: '丹药增益', value: pillPower, hint: pillPower ? ('临时·余' + buffMonthsLeft(state) + '月') : '无' },",
     count=1)

POWER_BLOCK = '''  // 临时战力增益：服用后未来若干月战力临时提升（state.buffs.power），过期自动失效。
  // 此前该字段在 calcPower 中恒为 0（死字段），现接入真实丹药效果（如狂战丹），
  // 让「丹药增益」战力拆解项与英雄卡不再恒显「无」。
  if (it.effect.power) {
    const months = it.effect.powerMonths || 1;
    const cur = state.world.year * 12 + state.world.month;
    state.buffs = state.buffs || { power: 0, expireMonth: 0 };
    state.buffs.power = Math.max(state.buffs.power || 0, it.effect.power);
    state.buffs.expireMonth = Math.max(state.buffs.expireMonth || 0, cur + months);
    logs.push(`药力激荡，未来 ${months} 月战力临时 +${it.effect.power}。`);
  }
'''
edit(P,
     "  // 延寿：提升寿元上限（延寿丹）——叠加持久加成 lifeBonus，避免被 refreshDerived 重算覆盖。",
     POWER_BLOCK + "  // 延寿：提升寿元上限（延寿丹）——叠加持久加成 lifeBonus，避免被 refreshDerived 重算覆盖。",
     count=1)

edit(P,
     "    flags: { focusMonths: 0, lastFocus: '', noGuideMonths: 0, wounded: 0, companion: '', companionMonths: 0 },\n    chronicle: [],",
     "    flags: { focusMonths: 0, lastFocus: '', noGuideMonths: 0, wounded: 0, companion: '', companionMonths: 0 },\n    buffs: { power: 0, expireMonth: 0 },\n    chronicle: [],",
     count=1)

edit(P,
     "  checkTitles(state); // 幂等：达成即授予封号\n}",
     "  checkTitles(state); // 幂等：达成即授予封号\n  // 临时战力增益到期清理：到期后将 buff 清零，避免 state.buffs 长期残留过期数值\n  const _bf = state.buffs;\n  if (_bf && _bf.power) {\n    const _cur = (state.world.year * 12) + state.world.month;\n    if (_cur >= _bf.expireMonth) { _bf.power = 0; _bf.expireMonth = 0; }\n  }\n}",
     count=1)

# ============ life.js ============
L = BASE + 'public/js/life.js'
edit(L,
     "  state.flags = state.flags || {};",
     "  state.flags = state.flags || {};\n  state.buffs = (state.buffs && typeof state.buffs === 'object') ? state.buffs : {};\n  state.buffs.power = Number(state.buffs.power) || 0;\n  state.buffs.expireMonth = Number(state.buffs.expireMonth) || 0;",
     count=1)

edit(L,
     "    case '露华丹': return lvl >= 60 || sectRank >= 3;\n    default: return false;",
     "    case '露华丹': return lvl >= 60 || sectRank >= 3;\n    case '狂战丹': return lvl >= 21 || artLv >= 2;\n    default: return false;",
     count=1)

# ============ data.js ============
D = BASE + 'public/js/data.js'
edit(D,
     "  露华丹: { id: '露华丹', name: '露华丹', icon: '💧', tier: 8, need: { '露华玉液': 1, '天材地宝·月华露': 1 }, stoneCost: 160, months: 3, baseRate: 70, effect: { heal: true, wuxing: 200 }, toxicity: 8, output: { name: '露华丹', type: '丹药', value: 420, desc: '露华玉液所化玉丹，服用后伤势尽去、悟性经验 +200。' } },\n};",
     "  露华丹: { id: '露华丹', name: '露华丹', icon: '💧', tier: 8, need: { '露华玉液': 1, '天材地宝·月华露': 1 }, stoneCost: 160, months: 3, baseRate: 70, effect: { heal: true, wuxing: 200 }, toxicity: 8, output: { name: '露华丹', type: '丹药', value: 420, desc: '露华玉液所化玉丹，服用后伤势尽去、悟性经验 +200。' } },\n  狂战丹: { id: '狂战丹', name: '狂战丹', icon: '🔴', tier: 6, need: { '凝火奇实': 1, '火精枣': 2, '星砂': 1 }, stoneCost: 90, months: 2, baseRate: 76, effect: { power: 150, powerMonths: 3 }, toxicity: 14, output: { name: '狂战丹', type: '丹药', value: 280, desc: '燃血狂战之丹，服用后未来 3 月战力临时 +150；连续服用会累积丹毒。' } },\n};",
     count=1)

edit(D,
     "  露华丹: '元婴期（60级）或宗门核心（rank3）解锁，需露华玉液（灵草杂交）。',\n};",
     "  露华丹: '元婴期（60级）或宗门核心（rank3）解锁，需露华玉液（灵草杂交）。',\n  狂战丹: '筑基期（21级）或炼丹百艺小成（Lv.2）解锁，需凝火奇实/火精枣/星砂。',\n};",
     count=1)

# ============ save.js ============
S_ = BASE + 'public/js/save.js'
edit(S_,
     "        秘境最深: state.flags?.mysticDeepest || 0,\n      },",
     "        秘境最深: state.flags?.mysticDeepest || 0,\n        丹药增益: state.buffs?.power || 0,\n        增益到期月: state.buffs?.expireMonth || 0,\n      },",
     count=1)

edit(S_,
     "    flags: { focusMonths: 0, lastFocus: '', noGuideMonths: 0, wounded: 0, companion: '', companionMonths: 0 },\n    chronicle: [],",
     "    flags: { focusMonths: 0, lastFocus: '', noGuideMonths: 0, wounded: 0, companion: '', companionMonths: 0 },\n    buffs: { power: Number(get('设置.ini', '标记状态').丹药增益) || 0, expireMonth: Number(get('设置.ini', '标记状态').增益到期月) || 0 },\n    chronicle: [],",
     count=1)

# ============ ui.js ============
U = BASE + 'public/js/ui.js'
BUFF_RENDER = '''  // 临时战力增益常驻显示：服用战力类丹药（如狂战丹）后，未来数月战力临时提升（state.buffs.power），
  // 此前该状态完全不可见（且 calcPower 中恒为 0，是死字段）；现做英雄卡常驻行，
  // 延续「跨标签页不可见状态常驻化」主题，让玩家随时知晓临时战力增益还剩几月
  const buffPower = S.activeBuffPower(st);
  const buffRow = document.getElementById('st-buff-row');
  const buffB = document.getElementById('st-buff');
  if (buffRow && buffB) {
    if (buffPower > 0) {
      const cur = st.world.year * 12 + st.world.month;
      const buffLeft = Math.max(0, (st.buffs?.expireMonth || 0) - cur);
      buffRow.style.display = '';
      buffB.innerHTML = '战力+' + buffPower + ' · 余 ' + buffLeft + ' 月';
      buffB.title = '临时战力增益生效中：战力 +' + buffPower + '，剩余 ' + buffLeft + ' 月后消退（服用战力类丹药获得）';
    } else {
      buffRow.style.display = 'none';
    }
  }
'''
edit(U,
     "  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径；若行囊正好有对应解药，渲染可点击「服用」按钮（预警→行动闭环）",
     BUFF_RENDER + "  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径；若行囊正好有对应解药，渲染可点击「服用」按钮（预警→行动闭环）",
     count=1)

# ============ index.html ============
H = BASE + 'public/index.html'
edit(H,
     "            <span class=\"vital-label\">聚灵</span><b id=\"st-juling\">—</b>\n          </div>\n        </div>",
     "            <span class=\"vital-label\">聚灵</span><b id=\"st-juling\">—</b>\n          </div>\n          <div class=\"vital-row buff-row\" id=\"st-buff-row\" style=\"display:none\">\n            <svg class=\"vi\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M13 2L3 14h7l-1 8 10-12h-7z\"/></svg>\n            <span class=\"vital-label\">战力增益</span><b id=\"st-buff\">—</b>\n          </div>\n        </div>",
     count=1)

# ============ main.css ============
C = BASE + 'public/css/main.css'
edit(C,
     ".juling-row { background: linear-gradient(90deg, rgba(126,155,214,.16), rgba(126,155,214,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }\n.juling-row .vital-label { color: #7e9bd6; }\n.juling-row b { color: #7e9bd6; font-weight: 600; }",
     ".juling-row { background: linear-gradient(90deg, rgba(126,155,214,.16), rgba(126,155,214,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }\n.juling-row .vital-label { color: #7e9bd6; }\n.juling-row b { color: #7e9bd6; font-weight: 600; }\n.buff-row { background: linear-gradient(90deg, rgba(224,138,74,.16), rgba(224,138,74,.02)); border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }\n.buff-row .vital-label { color: #e08a4a; }\n.buff-row b { color: #e08a4a; font-weight: 600; }",
     count=1)

# ============ tests/test-newfeatures.mjs ============
T = BASE + 'tests/test-newfeatures.mjs'
TEST_BLOCK = '''/* ---------- 临时战力增益（丹药增益 buff） ---------- */
// 直接构造一颗狂战丹并服用，验证 buff 生效、战力提升、跨月过期、存档往返、解锁判定
const beforePower = S.calcPower(state);
state.items.push({ 名称: '狂战丹', 类型: '丹药', 数量: 1, 描述: '测试', effect: { power: 150, powerMonths: 3 }, toxicity: 0 });
const buffIdx = state.items.length - 1;
const buffLogs = S.useItem(state, buffIdx);
ok(buffLogs && buffLogs.some((l) => l.includes('战力临时')), '服用战力丹写入临时增益日志');
ok(state.buffs && state.buffs.power === 150, 'buffs.power 已置为 150');
ok(state.buffs && state.buffs.expireMonth === state.world.year * 12 + state.world.month + 3, 'buffs 过期月份=当前+3');
ok(S.calcPower(state) === beforePower + 150, '临时战力增益已计入 calcPower（+150）');
const buffBd = S.powerBreakdown(state);
ok(buffBd.items.find((x) => x.label === '丹药增益').value === 150, '战力拆解丹药增益项=150');
ok(S.activeBuffPower(state) === 150, 'activeBuffPower 返回当前增益 150');
// 跨月推进 3 个月后过期
for (let i = 0; i < 3; i++) { state.world.month++; if (state.world.month > 12) { state.world.month = 1; state.world.year++; } }
S.refreshDerived(state);
ok(S.activeBuffPower(state) === 0, '3 月后临时增益过期（activeBuffPower=0）');
ok(S.calcPower(state) === beforePower, '过期后战力回落至服用前');
// 存档往返（过期态应被清理为 power=0）
let ser = serialize(state);
let de = deserialize(ser);
ok(de.buffs && de.buffs.power === 0, '存档往返：过期态 buffs.power=0');
// 未过期 buff 持久化
state.buffs = { power: 100, expireMonth: state.world.year * 12 + state.world.month + 2 };
ser = serialize(state);
de = deserialize(ser);
ok(de.buffs && de.buffs.power === 100 && de.buffs.expireMonth === state.world.year * 12 + state.world.month + 2, '未过期 buff 存档往返正确');
// 解锁判定：筑基期（21级）解锁、低等级不解锁
ok(isRecipeUnlocked({ player: { level: 21 }, sect: { rank: 0 }, arts: { 炼丹: { level: 0 } }, flags: {} }, '狂战丹') === true, '狂战丹在筑基期（21级）解锁');
ok(isRecipeUnlocked(state, '狂战丹') === false, '狂战丹在低等级未解锁');

'''
edit(T,
     "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);",
     TEST_BLOCK + "console.log(`\\n===== 本轮新功能专项测试：${pass} 通过，${fail} 失败 =====`);",
     count=1)

print('\\n=== 补丁执行完毕 ===')
