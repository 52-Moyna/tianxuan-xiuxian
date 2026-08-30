# -*- coding: utf-8 -*-
"""2026-08-30 16:34 轮次补丁（幂等版）：落实 codex 四大幽灵丹药为真实道具 + 补全丹毒危机恢复闭环。"""
import io, sys, os

ROOT = 'Z:/1/xiuxian'
files = {
    'life': os.path.join(ROOT, 'public/js/life.js'),
    'systems': os.path.join(ROOT, 'public/js/systems.js'),
    'ui': os.path.join(ROOT, 'public/js/ui.js'),
}

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)

patches = {
'life': [
("""    { id: 'shougu_dan', name: '兽骨续命丹', need: { '妖兽兽骨': 2 }, output: { name: '兽骨续命丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除全部伤势。' }, value: 90 },
  ],""",
"""    { id: 'shougu_dan', name: '兽骨续命丹', need: { '妖兽兽骨': 2 }, output: { name: '兽骨续命丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除全部伤势。' }, value: 90 },
    // 落实 codex 幽灵丹药：解毒丹（丹毒 -30，丹毒危机唯一主动恢复途径）
    { id: 'jiedu_dan', name: '解毒丹', need: { '百年灵芝': 1, '星砂': 1 }, output: { name: '解毒丹', type: '丹药', quantity: 1, effect: { detox: 30 }, desc: '服用后丹毒 -30；是连续嗑药的必备解药。' }, value: 90 },
    // 神识丹：悟性经验丹（codex 承诺「悟性经验增加」）
    { id: 'shenshi_dan', name: '神识丹', need: { '凝露草': 1, '妖兽灵草': 1 }, output: { name: '神识丹', type: '丹药', quantity: 1, effect: { wuxing: 80 }, desc: '服用后悟性经验 +80。', toxicity: 10 }, value: 90 },
    // 破境丹：大量修为经验，足以直冲瓶颈（codex 承诺「大量修为，可能直接突破一级」）
    { id: 'pojing_dan', name: '破境丹', need: { '玉髓芝': 1, '天材地宝·月华露': 1 }, output: { name: '破境丹', type: '丹药', quantity: 1, effect: { exp: 600 }, desc: '服用后获得大量修为，足以直冲瓶颈。', toxicity: 25 }, value: 300 },
    // 法力丹：下次战斗胜率 +5%（战斗后失效，由 resolveBattle 战后清零）
    { id: 'fali_dan', name: '法力丹', need: { '海灵珠': 1, '凝露草': 1 }, output: { name: '法力丹', type: '丹药', quantity: 1, effect: { battleBuff: 5 }, desc: '服用后下次战斗胜率 +5%（战斗后失效）。', toxicity: 6 }, value: 80 },
  ],"""),
("""  lingnan: [
    { name: '百越灵草', type: '材料', price: 45, desc: '炼丹主药，灵植师最喜欢的材料。' },
    { name: '百毒囊', type: '装备', price: 240, level: 2, desc: '探索妖兽巢穴时额外获得材料。' },
    { name: '驱虫粉', type: '消耗品', price: 35, desc: '降低雨林探索风险。', effect: { explore: 15 } },
  ],""",
"""  lingnan: [
    { name: '百越灵草', type: '材料', price: 45, desc: '炼丹主药，灵植师最喜欢的材料。' },
    { name: '百毒囊', type: '装备', price: 240, level: 2, desc: '探索妖兽巢穴时额外获得材料。' },
    { name: '驱虫粉', type: '消耗品', price: 35, desc: '降低雨林探索风险。', effect: { explore: 15 } },
    { name: '解毒丹', type: '丹药', price: 90, desc: '服用后丹毒 -30；连续嗑药的必备解药。', effect: { detox: 30 } },
    { name: '神识丹', type: '丹药', price: 90, desc: '服用后悟性经验 +80。', effect: { wuxing: 80 } },
    { name: '破境丹', type: '丹药', price: 300, desc: '服用后获得大量修为，足以直冲瓶颈。', effect: { exp: 600 } },
    { name: '法力丹', type: '丹药', price: 80, desc: '服用后下次战斗胜率 +5%（战斗后失效）。', effect: { battleBuff: 5 } },
  ],"""),
],
'systems': [
("""    else { state.beasts.maxSlots += 1; logs.push(`契约生效，灵兽栏上限提升至 ${state.beasts.maxSlots} 栏。`); }
  }
  // 丹毒累加""",
"""    else { state.beasts.maxSlots += 1; logs.push(`契约生效，灵兽栏上限提升至 ${state.beasts.maxSlots} 栏。`); }
  }
  // 解毒丹：服用降低丹毒（与 codex 承诺「丹毒 -30」一致），是丹毒危机唯一主动恢复途径
  if (it.effect.detox) {
    const cur = Number(state.flags?.pillToxicity || 0);
    const after = Math.max(0, cur - it.effect.detox);
    state.flags.pillToxicity = after;
    logs.push(`服下「${it.名称}」，丹毒 ${cur} → ${after}（－${cur - after}）。`);
  }
  // 法力丹：服用后下次战斗胜率提升（战斗后失效，由 resolveBattle 在战后清零）
  if (it.effect.battleBuff) {
    state.flags.nextBattleWin = (Number(state.flags?.nextBattleWin) || 0) + it.effect.battleBuff;
    logs.push(`服下「${it.名称}」，下次战斗胜率 +${it.effect.battleBuff}%（战斗后失效）。`);
  }
  // 丹毒累加"""),
# itemUsePreview：灵兽栏用三元表达式，锚点须含整行
("""    parts.push(cur >= 6 ? `灵兽栏上限 +1（已达上限 ${cur}/6，服用无效）` : `灵兽栏上限 +1（现 ${cur}/6 栏）`);
  }
  if (!parts.length) return none;""",
"""    parts.push(cur >= 6 ? `灵兽栏上限 +1（已达上限 ${cur}/6，服用无效）` : `灵兽栏上限 +1（现 ${cur}/6 栏）`);
  }
  if (eff.detox) parts.push(`丹毒 -${eff.detox}`);
  if (eff.battleBuff) parts.push(`下次战斗胜率 +${eff.battleBuff}%`);
  if (!parts.length) return none;"""),
("""  const bd = { base: Math.round(rate), ally: 0, beasts: 0, activeBeast: 0, toxic: 0, wound: 0, tactic: 0, blessed: 0 };""",
"""  const bd = { base: Math.round(rate), ally: 0, beasts: 0, activeBeast: 0, toxic: 0, wound: 0, tactic: 0, blessed: 0, buff: 0 };"""),
("""  if (blessed && totalStones(state) >= 50) apply(10, 'blessed');
  return { rate: Math.round(rate), finalRate: Math.round(cur), sameLevel, breakdown: bd };""",
"""  if (blessed && totalStones(state) >= 50) apply(10, 'blessed');
  // 战前增益（法力丹等）：下次战斗胜率提升，预览同口径展示
  if (state.flags?.nextBattleWin) apply(state.flags.nextBattleWin, 'buff');
  return { rate: Math.round(rate), finalRate: Math.round(cur), sameLevel, breakdown: bd };"""),
("""    else logs.push('灵石不足，无力邀得天命加持。');
  }
  // 道友援护：心腹/道侣级道友有概率临阵仗义相助（高关系层级方有此情义）""",
"""    else logs.push('灵石不足，无力邀得天命加持。');
  }
  // 战前增益（法力丹等）：下次战斗胜率提升，战后清零（遁走则保留）
  if (state.flags?.nextBattleWin && !fled) {
    finalRate = Math.min(95, finalRate + state.flags.nextBattleWin);
    logs.push(`战前增益生效，胜率 +${state.flags.nextBattleWin}%。`);
    state.flags.nextBattleWin = 0;
  }
  // 道友援护：心腹/道侣级道友有概率临阵仗义相助（高关系层级方有此情义）"""),
],
'ui': [
("""        const cure = w === lifeWarn ? '延寿丹' : '凝血丹';""",
"""        const cure = w === lifeWarn ? '延寿丹' : '解毒丹';"""),
],
}

ok = True
for key, plist in patches.items():
    p = files[key]
    s = read(p)
    applied = 0
    for i, (old, new) in enumerate(plist):
        cnt = s.count(old)
        if cnt == 1:
            s = s.replace(old, new, 1)
            applied += 1
        elif cnt == 0 and new in s:
            pass  # 已应用（幂等）
        else:
            sys.stderr.write(f'[{key}] patch #{i} 匹配数={cnt}（期望 1 或已应用），终止！\n')
            ok = False
            break
    if not ok:
        break
    write(p, s)
    print(f'OK {key}: 新应用 {applied} 处')

print('ALL_OK' if ok else 'FAILED')
sys.exit(0 if ok else 1)
