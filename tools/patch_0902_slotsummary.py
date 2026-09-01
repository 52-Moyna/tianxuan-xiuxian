# -*- coding: utf-8 -*-
"""
补丁：选存档槽卡片补上「真实境界 / 等级 / 战力 / 天玄历年」。

问题：listSlots 原先把 个人信息.ini 的「道号」当成 realm 返回，那是玩家自取的
称号（如「玄尘子」），不是境界。多存档时玩家看着卡片根本不知道每个档练到哪
一境界，只能靠猜（谁也不想点进去读完档才发现是最废的那个档）。

改法：
  1. server.js /api/slots 额外读 属性.ini 的「修为」段（境界/等级/战力）
     与 世界.ini 的「时间」段（天玄历年），随摘要一并返回；旧档缺文件降级为空。
  2. ui.js 槽位卡片改展示境界与等级，并补一行战力/年份。
"""
import io, sys, re

ROOT = 'Z:/1/xiuxian/'

def read(p):
    with io.open(ROOT + p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(ROOT + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

# ---------------- server.js ----------------
srv = read('server.js')

OLD_SUMMARY = """    const summary = { slot: e.name, hasSave: files.includes('个人信息.ini'), name: '', realm: '', age: '', saveCode: '', savedTime: '', avatarPreset: '' };"""
NEW_SUMMARY = """    // 说明：realm 取自「道号」（玩家自取称号，可能是「玄尘子」这类），并非境界；
    // 真正的境界/等级/战力在 属性.ini 的「修为」段，另读一份，供选档卡片展示。
    const summary = { slot: e.name, hasSave: files.includes('个人信息.ini'), name: '', realm: '', age: '', saveCode: '', savedTime: '', avatarPreset: '', realmName: '', level: 0, power: 0, year: 0 };"""
assert srv.count(OLD_SUMMARY) == 1, 'server.js summary 定义未唯一命中'
srv = srv.replace(OLD_SUMMARY, NEW_SUMMARY)

OLD_TAIL = """      try {
        const settings = (fs.existsSync(path.join(dir, '设置.ini'))) ? IniCodec.parse(fs.readFileSync(path.join(dir, '设置.ini'), 'utf-8'))['游戏设置'] || {} : {};
        summary.avatarPreset = settings.avatarPreset || settings['头像预设'] || '';
      } catch { /* 忽略解析失败 */ }
    }"""
NEW_TAIL = """      try {
        const settings = (fs.existsSync(path.join(dir, '设置.ini'))) ? IniCodec.parse(fs.readFileSync(path.join(dir, '设置.ini'), 'utf-8'))['游戏设置'] || {} : {};
        summary.avatarPreset = settings.avatarPreset || settings['头像预设'] || '';
      } catch { /* 忽略解析失败 */ }
      // 境界 / 等级 / 战力 / 纪年：老存档可能缺文件，缺则留空由 UI 容错。
      try {
        const attrFile = path.join(dir, '属性.ini');
        if (fs.existsSync(attrFile)) {
          const xiu = IniCodec.parse(fs.readFileSync(attrFile, 'utf-8'))['修为'] || {};
          summary.realmName = String(xiu.境界 || '');
          summary.level = Number(xiu.等级) || 0;
          summary.power = Number(xiu.战力) || 0;
        }
        const worldFile = path.join(dir, '世界.ini');
        if (fs.existsSync(worldFile)) {
          const t = IniCodec.parse(fs.readFileSync(worldFile, 'utf-8'))['时间'] || {};
          summary.year = Number(t.天玄历年) || 0;
        }
      } catch { /* 忽略解析失败 */ }
    }"""
assert srv.count(OLD_TAIL) == 1, 'server.js 头像读取段未唯一命中'
srv = srv.replace(OLD_TAIL, NEW_TAIL)

write('server.js', srv)
print('server.js 已打补丁')

# ---------------- ui.js ----------------
ui = read('public/js/ui.js')

OLD_SUB = """        <div class="slot-sub">${s.hasSave ? `${s.name || '无名'} ｜ ${s.realm || ''} ｜ ${s.age || ''}岁` : '（空）'}</div>"""
NEW_SUB = """        <div class="slot-sub" title="${s.hasSave ? slotSummaryText(s) : ''}">${s.hasSave ? slotSummaryText(s) : '（空）'}</div>"""
assert ui.count(OLD_SUB) == 1, 'ui.js slot-sub 未唯一命中'
ui = ui.replace(OLD_SUB, NEW_SUB)

# 在 renderSlotPicker 之前插入 slotSummaryText 纯函数
OLD_FN = """/** 标题页：多存档槽选择 */
async function renderSlotPicker() {"""
NEW_FN = """/** 选档卡片摘要文案（纯函数）：境界优先于道号，等级/岁数/战力/纪年一并列出。
 *  老存档只有道号没有境界时，退回道号，保证不出现空白卡片。 */
function slotSummaryText(s) {
  const who = s.name || '无名';
  const rank = [s.realmName ? `${s.realmName}` : (s.realm || ''), s.level ? `Lv.${s.level}` : ''].filter(Boolean).join(' · ');
  const head = [who, rank || '境界未知', s.age ? `${s.age}岁` : ''].filter(Boolean).join(' ｜ ');
  const tail = [s.power ? `战力 ${s.power.toLocaleString('zh-CN')}` : '', s.year ? `天玄历 ${s.year} 年` : ''].filter(Boolean).join(' ｜ ');
  return tail ? `${head} ｜ ${tail}` : head;
}

/** 标题页：多存档槽选择 */
async function renderSlotPicker() {"""
assert ui.count(OLD_FN) == 1, 'ui.js renderSlotPicker 未唯一命中'
ui = ui.replace(OLD_FN, NEW_FN)

write('public/js/ui.js', ui)
print('ui.js 已打补丁')
