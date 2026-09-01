# -*- coding: utf-8 -*-
"""把本轮摘要追加到当日工作日志与自动化记忆（Z: / C: 双副本）。"""
import io, os

DAILY = """## 04:30 打磨轮：选档卡片补真实境界 + 图鉴死内容防线（commit 30bebca，已推送）

- **修 bug（玩家强感知）**：`/api/slots` 摘要里的 `realm` 取的其实是 `基本信息.道号`
  （玩家自取称号，如「玄尘子」），不是境界。多存档时卡片显示「张三 ｜ 玄尘子 ｜ 45岁」，
  玩家分不出每个档练到哪一层，只能逐个点进去读档试。
  → server.js 另读 `属性.ini` 的「修为」段（境界/等级/战力）与 `世界.ini` 的「时间」段（天玄历年）；
  → ui.js 新增纯函数 `slotSummaryText`（境界优先、旧档退回道号、无 undefined）；
  → 卡片现在显示：`张三 ｜ 金丹期 · Lv.42 ｜ 88岁 ｜ 战力 12,345 ｜ 天玄历 128 年`。
- **新增第 12 套测试 `tests/test-codex-paths.mjs`**：扫描 CODEX_ITEMS 全 194 条，
  必须在 data/life/systems/… 中出现（图鉴本身不算），否则报「幽灵条目」。
  把历史上「解毒丹/神识丹/破境丹/法力丹四个死条目」的事故固化成防线。
  本轮跑审计结果：194 条全部有产出路径，无幽灵条目。
- 补丁脚本 `tools/patch_0902_slotsummary.py`、`tools/patch_0902_tests.py` 入 tools/。
- 自检（仅跑相关套件）：test-server 22、test-ui-smoke 50、test-ui 29、test-multisave 16、
  test-save 35、test-codex-paths 4，全部 0 失败。
- 另：MEMORY.md 已按系统要求压缩重写（15043 → 6552 字符），去重合并同类坑位。
"""

AUTO = """
- 2026-09-02 04:30 轮次：修复选存档槽把「道号」当境界显示（玩家分不清各档进度），
  改为真实境界/等级/战力/纪年；新增第 12 套测试 test-codex-paths（图鉴幽灵条目防线）。
  相关 6 套自检零失败，commit 30bebca 已推送。另已压缩 MEMORY.md（15043→6552 字符）。
  候选下一步：游戏内「切换存档槽」入口复查 / 新手说明是否覆盖洞府丹炉与灵草杂交 / 坊市库存地域差异体验。
"""

for rel, text, mode in [
    ('.workbuddy/memory/2026-09-02.md', DAILY, 'a'),
    ('.workbuddy/memory/automations/08ff0a63-fd2c-4756-91d0-0a11d0bab0f2/memory.md', AUTO, 'a'),
]:
    for root in ('Z:/1/xiuxian/', 'C:/z/1/xiuxian/'):
        p = root + rel
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with io.open(p, mode, encoding='utf-8') as f:
            f.write(text)
print('日志已写入双副本')
