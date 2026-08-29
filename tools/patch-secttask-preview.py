# -*- coding: utf-8 -*-
"""补丁：宗门任务 / 兑换所 奖励确定性预览（自由优化·延续确定性预览主题）。"""
import io, sys

ROOT = 'Z:/1/xiuxian'
SYS = ROOT + '/public/js/systems.js'
UI = ROOT + '/public/js/ui.js'
TEST = ROOT + '/tests/test-newfeatures.mjs'

def patch(path, old, new, label):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    if old not in s:
        raise SystemExit('[{}] 锚点未命中：{!r}'.format(label, old[:50]))
    if new in s:
        print('[{}] 已存在，跳过'.format(label))
        return
    s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print('[{}] OK'.format(label))

# ---------- 1. systems.js：新增 sectTaskPreview 纯函数 ----------
sys_old = """  addLog(state, '操作', `完成宗门任务「${task.name}」，贡献+${task.contribution}。`);
  return { logs };
}

/* ============================================================
 * 十七、拍卖会（竞价玩法）"""
sys_new = """  addLog(state, '操作', `完成宗门任务「${task.name}」，贡献+${task.contribution}。`);
  return { logs };
}

/**
 * 宗门任务奖励确定性预览（与 doSectTask 同口径，不消耗状态、无 RNG）。
 * - 常规任务：贡献 +X、悟性 +3~8（与 doSectTask 的 Rng.int(3,8) 一致）。
 * - 「降服试炼恶修」(subdue)：触发战斗，给出基于典型敌人力量的预估胜率。
 */
export function sectTaskPreview(state, taskId) {
  const task = SECT_TASKS.find((t) => t.id === taskId);
  if (!task) return null;
  const out = { id: task.id, name: task.name, desc: task.desc, contribution: task.contribution, wuxing: [3, 8], battle: null };
  if (task.id === 'subdue') {
    // 代表性试炼恶修：玩家境界 +5、战力约玩家 1.05 倍（对齐 makeEnemy 区间中点）
    const p = state.player;
    const enemy = { name: '宗门试炼恶修', level: Math.max(1, p.level + 5), power: Math.max(1, Math.round(p.power * 1.05)), beast: false };
    out.battle = previewBattle(state, enemy, 'shengci').rate;
  }
  return out;
}

/* ============================================================
 * 十七、拍卖会（竞价玩法）"""
patch(SYS, sys_old, sys_new, 'systems.sectTaskPreview')

# ---------- 2. ui.js：宗门任务 / 兑换所卡片明示预计奖励 ----------
ui_old = """    <div class="choice-intro">选择一个宗门任务执行：</div>
    ${CX.SECT_TASKS.map((t) => `<div class="sect-task">
      <div class="codex-body"><b>${t.name}</b><div class="codex-source">${t.desc} ｜ 贡献 +${t.contribution}</div></div>
      <button class="btn btn-sm btn-gold" data-task="${t.id}">执行</button>
    </div>`).join('')}
    <div class="choice-intro">宗门兑换所（消耗贡献）：</div>
    ${CX.SECT_EXCHANGE.map((e) => `<div class="sect-task">
      <div class="codex-body"><b>${e.name}</b><div class="codex-source">${e.desc} ｜ 需贡献 ${e.cost}</div></div>
      <button class="btn btn-sm ${st.sect.contribution >= e.cost ? 'btn-gold' : 'btn-dim'}" data-exchange="${e.id}" ${st.sect.contribution >= e.cost ? '' : 'disabled'}>兑换</button>
    </div>`).join('')}"""
ui_new = """    <div class="choice-intro">选择一个宗门任务执行：</div>
    ${CX.SECT_TASKS.map((t) => {
      const pv = S.sectTaskPreview(st, t.id);
      const reward = pv.battle != null
        ? `贡献 +${pv.contribution} ｜ 降服试炼恶修（预估胜率 ${pv.battle}%）`
        : `贡献 +${pv.contribution} ｜ 悟性 +${pv.wuxing[0]}~${pv.wuxing[1]}`;
      return `<div class="sect-task">
        <div class="codex-body"><b>${t.name}</b><div class="codex-source">${t.desc}</div><div class="codex-effect">预计奖励：${reward}</div></div>
        <button class="btn btn-sm btn-gold" data-task="${t.id}">执行</button>
      </div>`;
    }).join('')}
    <div class="choice-intro">宗门兑换所（消耗贡献）：</div>
    ${CX.SECT_EXCHANGE.map((e) => {
      const get = e.type === 'stones' ? `下品灵石 +${e.amount}` : `丹药：${e.item} ×${e.qty || 1}`;
      return `<div class="sect-task">
        <div class="codex-body"><b>${e.name}</b><div class="codex-source">${e.desc} ｜ 需贡献 ${e.cost}</div><div class="codex-effect">可得：${get}</div></div>
        <button class="btn btn-sm ${st.sect.contribution >= e.cost ? 'btn-gold' : 'btn-dim'}" data-exchange="${e.id}" ${st.sect.contribution >= e.cost ? '' : 'disabled'}>兑换</button>
      </div>`;
    }).join('')}"""
patch(UI, ui_old, ui_new, 'ui.sectTaskPreview')

# ---------- 3. 测试：新增宗门任务预览确定性断言（插入汇总前最后一个测试组之后） ----------
test_old = "studyPreviewGroup();"
test_new = """studyPreviewGroup();

/* ---------- 宗门任务 / 兑换所 确定性预览 ---------- */
{
  const st = S.createNewGame({ name: '宗门预览', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(st);
  S.joinSect(st, '预览宗门');
  const normal = S.sectTaskPreview(st, 'escort');
  ok(normal && normal.contribution > 0 && normal.wuxing[0] === 3 && normal.wuxing[1] === 8 && normal.battle === null, '常规宗门任务预览：贡献>0、悟性 3~8、无战斗');
  const subdue = S.sectTaskPreview(st, 'subdue');
  ok(subdue && typeof subdue.battle === 'number' && subdue.battle >= 0 && subdue.battle <= 100, '降服任务预览：返回 0~100 区间预估胜率');
  ok(S.sectTaskPreview(st, '不存在的任务') === null, '未知任务 id 预览返回 null');
  const p1 = S.sectTaskPreview(st, 'escort'), p2 = S.sectTaskPreview(st, 'escort');
  ok(p1.contribution === p2.contribution && p1.wuxing[1] === p2.wuxing[1], '宗门任务预览纯函数：重复调用结果一致（无副作用）');
}"""
patch(TEST, test_old, test_new, 'test.sectTaskPreview')

print('全部补丁应用完成。')
