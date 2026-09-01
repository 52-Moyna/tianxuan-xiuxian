# -*- coding: utf-8 -*-
"""把本轮（22:09）摘要追加到 C:/Z: 两份日志副本，避免漂移。"""
import io

NOTE = """
## 约 22:10 轮次 · 补交上轮遗留 + 修复地域归一键序 bug + 坊市售价口径统一
- 开局发现工作树有未提交改动（上轮约 19:50 被中断）：行囊搜索 + 满仓「建议清理」一键出货，
  含一处真 bug 修复（行囊分类渲染下标此前相对 nonContainerItems 计算，持有容器时整体错位，
  「使用/出售」会作用到错误物品；改为相对 state.items）。验证零失败后提交 fbf5162。
- 本轮自查发现并修复两个真问题：
  1) **ensureLifeState 地域归一被键序顶替（P1）**：原实现把「id 命中」与「中文名命中」混在同一次
     `Object.entries(REGION_NAMES).find(...)` 的 OR 条件里，结果取决于对象键序。一旦 world.region
     与 world.regionId 不一致，regionId 就被键序第一的 zhongzhou 悄悄顶替 —— 连带影响坊市特产售价、
     妖兽等级区间、野外材料与旅行路线判定。改为 **regionId 权威**：合法即采信并据此刷新显示名，
     仅当缺失/非法时按中文名反查（exact 优先，再退化 includes 模糊匹配），最后兜底中州。
  2) **坊市出售页预估价漏算加成**：`buildSellHtml` 的 est 只乘行情 newsPriceMul，漏掉地域特产 1.25x
     与交易运势 omenMul('trade')，玩家看到的价与实际到手价系统性偏差（可达 25%+）。改为与结算
     共用 itemSellPrice(...,false) 口径，并明示「本地特产↑25%」「交易运势↑/↓N%」标签。
- 新增纯函数：systems.js `sellPriceFactors`（售价加成拆解 regional/news/omen/base/est，确定性无 RNG）、
  `sellBatchPreview(state, predicate)`（批量出售件数/预估灵石/腾出格位，跳过在用容器，无副作用）。
- 优化：一键清空按钮标注「N件 · 约M灵石 · 腾K格」，无货禁用；出售列表把在用储物袋标为「在用」
  且按钮禁用（此前混在可售行里误导点击）；批量按钮预览随每次出售重建（否则显示过期数字）。
- CSS：新增 .price-spec / .batch-est / .shop-item-locked / .shop-batch .btn-sm[disabled]。
- 测试：test-newfeatures 955（+32，覆盖七大地域归一稳定性、旧档反查、模糊匹配、非法兜底、
  存读档往返不漂移；售价加成拆解、30 轮预估价与结算价 ±8% 区间校验、批量预览一致性与纯函数性）。
  因改动 ensureLifeState 影响面大，自行跑满全 11 套：**1266 通过 / 0 失败**。
- 提交 fbf5162（上轮遗留）、f428c2a（本轮）均已推送 origin/main。
  补丁脚本：tools/patch-sell-price-transparency.py、patch-css-sell-tags.py、
  patch-region-id-authority.py、patch-test-sell-price.py、patch-test-region-authority.py。
- 下一步：自由优化/审查。候选方向：① 同类「OR 条件混用导致键序依赖」的归一逻辑排查（其它
  ensureXxxState 是否有同款写法）；② 坊市购买页是否也存在预估/结算口径不一致；③ 行囊搜索
  可扩展到装备库/功法栏。
"""

for p in ('C:/z/1/xiuxian/.workbuddy/memory/2026-09-01.md',
          'Z:/1/xiuxian/.workbuddy/memory/2026-09-01.md'):
    try:
        with io.open(p, 'r', encoding='utf-8') as f:
            cur = f.read()
    except IOError:
        cur = ''
    if '约 22:10 轮次' in cur:
        print('已存在，跳过：' + p)
        continue
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(cur.rstrip('\n') + '\n' + NOTE)
    print('已追加：' + p)
