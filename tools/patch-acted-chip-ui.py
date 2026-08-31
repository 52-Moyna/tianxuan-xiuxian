#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补丁：ui.js renderAll 顶栏新增「本月行动状态」chip 渲染。"""
import io

ROOT = "Z:/1/xiuxian"
path = ROOT + "/public/js/ui.js"

with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

anchor = """      sectChip.style.display = 'none';
    }
  }

  // 状态卡"""
assert anchor in src, "未找到 sectChip 结束锚点"

block = """      sectChip.style.display = 'none';
    }
  }

  // 本月行动状态常驻提示：游戏采用「每月仅能推进有限行动」闸门（state.flags.actedThisMonth 按行动分类记载），
  // 罗盘内已有横幅，但切到其它标签页即不可见；此处做顶栏常驻 chip，随时提示本月是否已行动，点击直达决策罗盘
  // （延续「跨标签页不可见状态常驻化」主题：储物袋/丹炉/灵草/旅行/宗门贡献/危机预警 之后的最后盲区）。
  const ma = S.monthActionStatus(st);
  const actedChip = document.getElementById('tb-acted');
  if (actedChip) {
    actedChip.style.display = '';
    actedChip.classList.add('tb-clickable');
    if (ma.done) {
      actedChip.classList.add('tb-acted-done');
      actedChip.innerHTML = `${ICO('<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}本月已行动（${ma.count} 项）`;
      actedChip.title = `本月已完成 ${ma.count} 类行动，其余选项暂锁定；待月末结算进入下月后解锁。点击返回决策罗盘。`;
    } else {
      actedChip.classList.remove('tb-acted-done');
      actedChip.innerHTML = `${ICO('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>')}本月可行动`;
      actedChip.title = `本月尚未行动，可前往决策罗盘选择一项主要行动。点击打开决策罗盘。`;
    }
    actedChip.onclick = () => { if (typeof setSideTab === 'function') setSideTab('destiny'); };
  }

  // 状态卡"""

assert block != anchor, "块未发生变更"
new = src.replace(anchor, block, 1)
assert new != src, "写入失败：文本未变化"
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("OK: ui.js 已新增 tb-acted 渲染")
