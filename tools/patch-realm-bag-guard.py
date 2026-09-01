# -*- coding: utf-8 -*-
"""秘境/宗门秘境满仓前置校验补丁（天玄修仙录）
问题：exploreMysticRealm 会先扣 3 张「海上遗府残图」+ 护阵灵石，再 storeItem 材料；
     储物袋满时 storeItem 静默返回 false，玩家白付代价且日志谎报成功。
方案：新增纯函数 mysticBagBlockReason 作为唯一容量口径（UI 与结算共用），
     扣任何代价之前先拦截；结算处 storeItem 失败也补明确日志，不再静默。
"""
import io, sys

P = 'Z:/1/xiuxian/public/js/systems.js'
s = io.open(P, encoding='utf-8').read()
orig = s

# ---------- 1) 新增纯函数 mysticBagBlockReason ----------
anchor = "export function exploreMysticRealm(state, realmId, depth = 1) {"
assert s.count(anchor) == 1, 'exploreMysticRealm 锚点不唯一'
fn = '''/**
 * 秘境 / 宗门秘境入内前的行囊容量校验（纯函数，不消耗状态）。
 * 海上遗府需缴纳 3 张残图 + 护阵灵石，若储物袋已满，材料产出会被 storeItem 静默丢弃，
 * 玩家等于白付代价。故在扣任何代价之前拦截，与 harvestHerb / craftRecipe
 * 「先确保产出能入袋、后扣代价」同口径。UI 深度选择面板也复用此函数做按钮禁用与警示。
 * @param {object} state
 * @param {object|null} realm 传 null 表示只做通用材料容量校验（宗门秘境）
 * @param {string} what 产出名称，用于提示文案
 * @returns {string|null} null 表示可进入；否则为不可进入的中文原因
 */
export function mysticBagBlockReason(state, realm = null, what = '秘境所得灵材') {
  ensureLifeState(state);
  if (realm && !(realm.rewards?.materials?.length || 0)) return null; // 该秘境本无材料产出，无需校验
  const usage = bagUsage(state);
  if (usage.total - usage.used >= 1) return null;
  return `储物袋已满，${what}无处安放 —— 请先出售杂物或扩容储物袋`;
}

'''
s = s.replace(anchor, fn + anchor, 1)

# ---------- 2) exploreMysticRealm 扣代价前拦截 ----------
old = """  if (state.player.level < realm.minLevel) return { logs: [`修为不足，需达到 Lv.${realm.minLevel}。`] };"""
new = """  if (state.player.level < realm.minLevel) return { logs: [`修为不足，需达到 Lv.${realm.minLevel}。`] };
  // 行囊容量前置校验：先确保灵材放得下，再扣残图与护阵灵石（避免「付费后静默丢失」）
  const bagBlock = mysticBagBlockReason(state, realm, '秘境所得灵材');
  if (bagBlock) return { logs: [`${bagBlock}。本次未消耗残图与护阵灵石。`] };"""
assert s.count(old) == 1, 'minLevel 锚点不唯一'
s = s.replace(old, new, 1)

# ---------- 3) 秘境材料结算：失败不再静默 ----------
old = """    if (storeItem(state, mat)) logs.push(`获得材料：${matName} ×${mat.数量}${gather ? '（玄水护盾相助，灵材丰盈）' : ''}。`);"""
new = """    if (storeItem(state, mat)) logs.push(`获得材料：${matName} ×${mat.数量}${gather ? '（玄水护盾相助，灵材丰盈）' : ''}。`);
    else logs.push(`储物袋空间不足，「${matName} ×${mat.数量}」只得遗落秘境。`);"""
assert s.count(old) == 1, '秘境材料结算锚点不唯一'
s = s.replace(old, new, 1)

# ---------- 4) 宗门秘境：材料/丹药结算不再静默 ----------
old = """  if (storeItem(state, mat)) logs.push(`获得材料：宗门灵脉晶 ×${mat.数量}。`);"""
new = """  if (storeItem(state, mat)) logs.push(`获得材料：宗门灵脉晶 ×${mat.数量}。`);
  else logs.push(`储物袋空间不足，宗门灵脉晶 ×${mat.数量} 未能带走（贡献与灵石已入账）。`);"""
assert s.count(old) == 1, '宗门材料锚点不唯一'
s = s.replace(old, new, 1)

old = """    if (storeItem(state, pill)) logs.push(`于深处丹室寻得宗门旧藏：聚气丹 ×${pillCount}。`);"""
new = """    if (storeItem(state, pill)) logs.push(`于深处丹室寻得宗门旧藏：聚气丹 ×${pillCount}。`);
    else logs.push(`储物袋空间不足，宗门旧藏聚气丹 ×${pillCount} 未能带走。`);"""
assert s.count(old) == 1, '宗门丹药锚点不唯一'
s = s.replace(old, new, 1)

# ---------- 5) 宗门秘境入内前满仓提示（不拦截：贡献与灵石收益不受行囊影响） ----------
old = """  const logs = [`你步入「宗门秘境·${dcfg.name}」，灵脉环绕，宗门先辈留下的洞天福地静候你的体悟……`];"""
new = """  const logs = [`你步入「宗门秘境·${dcfg.name}」，灵脉环绕，宗门先辈留下的洞天福地静候你的体悟……`];
  // 满仓预警：宗门秘境无入门代价，贡献与灵石照常入账，但灵脉晶与深处丹药需占格
  const sectBagWarn = mysticBagBlockReason(state, null, '灵脉晶与丹房旧藏');
  if (sectBagWarn) logs.push(`⚠ ${sectBagWarn}，本次所得灵脉晶与丹药将无法带走。`);"""
assert s.count(old) == 1, '宗门 logs 锚点不唯一'
s = s.replace(old, new, 1)

# ---------- 6) 清理预览函数中的怪异空格（历史编辑残留） ----------
s = s.replace("realm.rewards.stones[ 0 ]", "realm.rewards.stones[0]")
s = s.replace("realm.rewards.stones[ 1 ]", "realm.rewards.stones[1]")

if s == orig:
    print('NO CHANGE'); sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('systems.js patched OK')
