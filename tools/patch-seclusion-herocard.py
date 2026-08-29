import sys
ROOT = 'Z:/1/xiuxian'
edits = []

# 1) systems.js: 新增 seclusionRiskWarning 纯函数（在 addDaoBaseExp 之前）
sys_path = ROOT + '/public/js/systems.js'
old1 = "export function addDaoBaseExp(state, name, amount, logs) {"
new1 = '''/** 闭关走火入魔风险预警（纯函数，不修改状态；供英雄卡常驻展示）。
 *  真实机制：Lv.30+ 连续闭关（state.flags.seclusionStreak）满 3 月必触发走火入魔（qihuo，渡劫大幅衰减、修为倒退）。
 *  此前该风险仅在「修炼」弹窗内可见、切走即丢失；现做常驻预警，让玩家随时知晓连关积累。
 *  level: 'danger' 连关≥2（再闭关即触发）、'warn' 连关≥1（风险积累）、'ok' 安全。 */
export function seclusionRiskWarning(state) {
  const p = state.player;
  const streak = Number(state.flags?.seclusionStreak || 0);
  if (p.level < 30 || streak < 1) return { level: 'ok', streak: 0, text: '' };
  if (streak >= 2) return { level: 'danger', streak, text: `连续闭关 ${streak} 月` };
  return { level: 'warn', streak, text: `连续闭关 ${streak} 月` };
}

export function addDaoBaseExp(state, name, amount, logs) {'''
edits.append((sys_path, old1, new1))

# 2) index.html: 英雄卡新增「闭关」常驻行
idx_path = ROOT + '/public/index.html'
old2 = '''            <span class="vital-label">战力增益</span><b id="st-buff">—</b>
          </div>
        </div>'''
new2 = '''            <span class="vital-label">战力增益</span><b id="st-buff">—</b>
          </div>
          <div class="vital-row seclusion-row" id="st-seclusion-row" style="display:none">
            <svg class="vi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3-1 4-1 6a3 3 0 006 0c0-1-.5-2-1-3 2 1 4 3 4 6a6 6 0 01-12 0c0-3 2-5 4-9z"/></svg>
            <span class="vital-label">闭关</span><b id="st-seclusion">—</b>
          </div>
        </div>'''
edits.append((idx_path, old2, new2))

# 3) main.css: 新增 .seclusion-row 样式
css_path = ROOT + '/public/css/main.css'
old3 = ".buff-row b { color: #e08a4a; font-weight: 600; }"
new3 = """.buff-row b { color: #e08a4a; font-weight: 600; }
.seclusion-row { border-radius: 8px; padding: 2px 6px; margin: 0 -6px; }
.seclusion-row .vital-label { color: var(--gold, #d4af37); }
.seclusion-row b { color: var(--gold, #d4af37); font-weight: 600; }
.seclusion-row.danger .vital-label, .seclusion-row.danger b { color: var(--danger); }"""
edits.append((css_path, old3, new3))

# 4) ui.js: renderAll 渲染闭关风险行
ui_path = ROOT + '/public/js/ui.js'
old4 = '''      buffRow.style.display = 'none';
    }
  }
  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径；若行囊正好有对应解药，渲染可点击「服用」按钮（预警→行动闭环）'''
new4 = '''      buffRow.style.display = 'none';
    }
  }
  // 闭关走火入魔风险常驻预警：Lv.30+ 连续闭关（flags.seclusionStreak）满 3 月必触发走火入魔，
  // 此前该风险仅在「修炼」弹窗内可见、切走即丢失；现做英雄卡常驻行，延续「跨标签页不可见状态常驻化」+「危机预警」主题，
  // 让玩家随时知晓连关积累，避免误入走火入魔。
  const seclWarn = S.seclusionRiskWarning(st);
  const seclRow = document.getElementById('st-seclusion-row');
  const seclB = document.getElementById('st-seclusion');
  if (seclRow && seclB) {
    if (seclWarn.level !== 'ok') {
      seclRow.style.display = '';
      seclRow.classList.toggle('danger', seclWarn.level === 'danger');
      seclB.textContent = seclWarn.text;
      seclB.title = '连续闭关累积：Lv.30+ 连续闭关满 3 月将触发走火入魔（渡劫大幅衰减、修为倒退）。当前已连续 ' + seclWarn.streak + ' 月，下月再闭关即触发，建议改普通修炼化解。';
    } else {
      seclRow.style.display = 'none';
    }
  }
  // 危机提示横幅：汇总寿元/丹毒预警，给出可行的延寿/解毒途径；若行囊正好有对应解药，渲染可点击「服用」按钮（预警→行动闭环）'''
edits.append((ui_path, old4, new4))

# 5) test-newfeatures.mjs: 新增确定性断言
t_path = ROOT + '/tests/test-newfeatures.mjs'
old5 = "ok(isRecipeUnlocked({ player: { level: 1 }, sect: { rank: 0 }, arts: { 炼丹: { level: 0 } }, flags: {} }, '狂战丹') === false, '狂战丹在低等级未解锁');"
new5 = old5 + '''

// 闭关走火入魔风险预警（纯函数，与修炼弹窗同口径；Lv.30+ 连关满 3 月触发）
ok(S.seclusionRiskWarning(state).level === 'ok', '低等级无闭关风险预警');
state.player.level = 35;
state.flags.seclusionStreak = 0;
ok(S.seclusionRiskWarning(state).level === 'ok', 'Lv.30+ 连关0月无预警');
state.flags.seclusionStreak = 1;
const sw1 = S.seclusionRiskWarning(state);
ok(sw1.level === 'warn' && sw1.streak === 1 && sw1.text === '连续闭关 1 月', 'Lv.30+ 连关1月 warn');
state.flags.seclusionStreak = 2;
const sw2 = S.seclusionRiskWarning(state);
ok(sw2.level === 'danger' && sw2.streak === 2 && sw2.text === '连续闭关 2 月', 'Lv.30+ 连关2月 danger（再闭关即触发）');
state.flags.seclusionStreak = 3;
ok(S.seclusionRiskWarning(state).level === 'danger', 'Lv.30+ 连关3月 danger（必触发走火入魔）');
state.flags.seclusionStreak = 0;'''
edits.append((t_path, old5, new5))

for path, old, new in edits:
    with open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    cnt = s.count(old)
    if cnt != 1:
        print('ANCHOR FAIL', path, cnt)
        sys.exit(1)
    s = s.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print('OK', path)
print('ALL DONE')
