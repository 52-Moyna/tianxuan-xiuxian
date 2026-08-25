# -*- coding: utf-8 -*-
# 灵兽「伴生天赋」实装补丁（确定性，无 RNG）
import io

DATA = 'Z:/1/xiuxian/public/js/data.js'
SYS  = 'Z:/1/xiuxian/public/js/systems.js'
UI   = 'Z:/1/xiuxian/public/js/ui.js'
TEST = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, t):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(t)

def apply(text, old, new, label):
    assert old in text, f"[FAIL] anchor not found: {label}\n--- {old[:60]}"
    c = text.count(old)
    assert c == 1, f"[FAIL] anchor not unique ({c}): {label}\n--- {old[:60]}"
    text = text.replace(old, new, 1)
    print(f"[OK] {label}")
    return text

# ---------- data.js: 新增 BEAST_SKILL_EFFECTS ----------
d = read(DATA)
old = "export const BEAST_WINRATE = { '雷翅隼': 8, '九尾灵狐': 5, 'default': 3 }; // 灵兽助战胜率加成(%)"
new = old + """
// 灵兽「伴生天赋」：出战灵兽技能的真实效果（确定性，无 RNG）。
// 与 BEAST_WINRATE 的全体常驻助战加成互补——BEAST_WINRATE 是所有灵兽小幅加胜率，
// 这里只由「当前出战灵兽」触发其专属天赋，让不同灵兽产生差异化陪伴价值。
export const BEAST_SKILL_EFFECTS = {
  '风刃突袭': { winRate: 5 },            // 先手突袭：出战额外 +5% 胜率
  '幻境迷心': { vsStronger: 8 },         // 惑乱强敌：出战且敌方等级高于己方时额外 +8% 胜率（越级专用）
  '铁背护主': { defeatRelief: true },     // 铁背护体：出战战败时大幅减免惩罚（免重伤、免失灵石）
  '玄水护盾': { gather: 1 },              // 玄水护持：出战秘境探索时灵材获取 +1
  '雷击俯冲': {},                         // 已由 BEAST_WINRATE['雷翅隼']=8 覆盖，保持
  '涅槃残焰': {},                         // 极稀有（幼凰，Lv.50+），渡劫保命另行实装
};"""
d = apply(d, old, new, "data.js 新增 BEAST_SKILL_EFFECTS")
write(DATA, d)

# ---------- systems.js ----------
s = read(SYS)

# 1) import BEAST_SKILL_EFFECTS
old = "CAVE_UPGRADE_BASE, BEAST_WINRATE,\n  TITLES, TITLE_MAP, MYSTIC_DEPTH, AUCTION_RIVAL,"
new = "CAVE_UPGRADE_BASE, BEAST_WINRATE, BEAST_SKILL_EFFECTS,\n  TITLES, TITLE_MAP, MYSTIC_DEPTH, AUCTION_RIVAL,"
s = apply(s, old, new, "systems.js import BEAST_SKILL_EFFECTS")

# 2) 新增 helper（activeBeastSkill / activeBeastSkillEffect）
old = """  const star = act.star || 1;
  return 2 + (star - 1) * 2;
}

/** 预估战斗最终胜率（纯函数，不修改任何状态，供战前展示）。"""
new = """  const star = act.star || 1;
  return 2 + (star - 1) * 2;
}

/** 出战灵兽的「伴生天赋」技能名（仅当前出战灵兽；无出战返回 null）。 */
export function activeBeastSkill(state) {
  const beasts = state?.beasts;
  if (!beasts || beasts.activeIdx == null || beasts.activeIdx < 0) return null;
  const act = beasts.slots?.[beasts.activeIdx];
  if (!act) return null;
  return act.skill || null;
}
/** 读取出战灵兽某天赋效果的数值（未装备/无该天赋返回 undefined）。 */
export function activeBeastSkillEffect(state, key) {
  const sk = activeBeastSkill(state);
  if (!sk) return undefined;
  const eff = BEAST_SKILL_EFFECTS[sk];
  return eff ? eff[key] : undefined;
}

/** 预估战斗最终胜率（纯函数，不修改任何状态，供战前展示）。"""
s = apply(s, old, new, "systems.js 新增伴生天赋 helper")

# 3) previewBattle：出战灵兽天赋胜率加成
old = """    apply(activeBeastBonus(state), 'activeBeast');
  }
  // 丹毒 / 伤势 惩罚"""
new = """    apply(activeBeastBonus(state), 'activeBeast');
    // 出战灵兽「伴生天赋」：风刃突袭先手 +5%；幻境迷心越级（敌方等级高于己方）额外 +8%
    const skill = activeBeastSkill(state);
    if (skill === '风刃突袭') apply(5, 'skill');
    else if (skill === '幻境迷心' && enemy && enemy.level > state.player.level) apply(8, 'skill');
  }
  // 丹毒 / 伤势 惩罚"""
s = apply(s, old, new, "systems.js previewBattle 天赋胜率")

# 4) resolveBattle：出战灵兽天赋胜率加成
old = """    logs.push(`出战灵兽「${act.name}」（${star}★）冲锋在前，誓死护主，胜率 +${ACTIVE_BEAST_BONUS}%。`);
  }
  // 丹毒过高降低胜率"""
new = """    logs.push(`出战灵兽「${act.name}」（${star}★）冲锋在前，誓死护主，胜率 +${ACTIVE_BEAST_BONUS}%。`);
    // 出战灵兽「伴生天赋」：风刃突袭先手 +5%；幻境迷心越级额外 +8%
    if (act.skill === '风刃突袭') { finalRate = Math.min(95, finalRate + 5); logs.push(`「${act.name}」风刃突袭抢占先手，胜率 +5%。`); }
    else if (act.skill === '幻境迷心' && enemy.level > state.player.level) { finalRate = Math.min(95, finalRate + 8); logs.push(`「${act.name}」幻境迷心惑乱强敌，越级胜率 +8%。`); }
  }
  // 丹毒过高降低胜率"""
s = apply(s, old, new, "systems.js resolveBattle 天赋胜率")

# 5) defeat：铁背护主 relief 变量
old = "    let wardKind = null;"
new = """    let wardKind = null;
    const relief = activeBeastSkillEffect(state, 'defeatRelief');"""
s = apply(s, old, new, "systems.js defeat relief 变量")

# 6) beast 战败分支：免重伤（注意嵌套缩进 6/8）
old = """      if (wardKind !== 'ward') {
        state.flags.wounded = pen.wounded;
      } else {
        logs.push('护身符光华流转，替你挡去重伤，安然脱身。');
      }"""
new = """      if (wardKind !== 'ward' && !relief) {
        state.flags.wounded = pen.wounded;
      } else {
        logs.push(wardKind ? '护身符光华流转，替你挡去重伤，安然脱身。' : '铁背苍熊铁背护体，替你挡去重伤，安然脱身。');
      }"""
s = apply(s, old, new, "systems.js 铁背护主免重伤")

# 7) beast 战败分支：免失灵石（嵌套缩进 6/8/10/12）
old = """      if (pen.loseStones > 0) {
        if (!wardKind) {
          const lost = Math.round(totalStones(state) * pen.loseStones);
          if (lost > 0) { spendStones(state, lost); logs.push(`险地溃败，被劫去灵石约${lost}。`); }
        } else {
          logs.push('护符护体，灵石分毫未失。');
        }
      }"""
new = """      if (pen.loseStones > 0) {
        if (!wardKind && !relief) {
          const lost = Math.round(totalStones(state) * pen.loseStones);
          if (lost > 0) { spendStones(state, lost); logs.push(`险地溃败，被劫去灵石约${lost}。`); }
        } else {
          logs.push(wardKind ? '护符护体，灵石分毫未失。' : '铁背护体，灵石分毫未失。');
        }
      }"""
s = apply(s, old, new, "systems.js 铁背护主免失灵石")

# 8) human 战败分支：免修为倒退（嵌套缩进 6/8）
old = """      if (wardKind !== 'ward') {
        p.level = Math.max(1, p.level - back);
        p.exp = 0;
      } else {
        logs.push('护身符碎裂，替你稳住道基，修为未损。');
      }"""
new = """      if (wardKind !== 'ward' && !relief) {
        p.level = Math.max(1, p.level - back);
        p.exp = 0;
      } else {
        logs.push(wardKind ? '护身符碎裂，替你稳住道基，修为未损。' : '铁背苍熊铁背护体，替你稳住道基，修为未损。');
      }"""
s = apply(s, old, new, "systems.js 铁背护主免修为倒退")

# 9) human 战败分支：免失灵石（嵌套缩进 6/8）
old = """      if (!wardKind) {
        const lost = Math.round(totalStones(state) * loseRate * 0.5);
        spendStones(state, lost);
        logs.push(`修为倒退至 ${realmLevelName(p.level)}，损失灵石约${lost}。`);
      } else {
        logs.push('护符护体，灵石分毫未失。');
      }"""
new = """      if (!wardKind && !relief) {
        const lost = Math.round(totalStones(state) * loseRate * 0.5);
        spendStones(state, lost);
        logs.push(`修为倒退至 ${realmLevelName(p.level)}，损失灵石约${lost}。`);
      } else {
        logs.push(wardKind ? '护符护体，灵石分毫未失。' : '铁背护体，灵石分毫未失。');
      }"""
s = apply(s, old, new, "systems.js 铁背护主(人)免失灵石")

# 10) exploreMysticRealm：玄水护盾采集 +1
old = """  if (realm.rewards.materials?.length) {
    const matName = Rng.pick(realm.rewards.materials);
    const mat = { 名称: matName, 类型: '材料', 数量: Math.max(1, Math.round(Rng.int(1, 3) * dcfg.matMul)), 描述: '秘境所得' };
    if (storeItem(state, mat)) logs.push(`获得材料：${matName} ×${mat.数量}。`);
  }"""
new = """  if (realm.rewards.materials?.length) {
    const matName = Rng.pick(realm.rewards.materials);
    let matQty = Math.max(1, Math.round(Rng.int(1, 3) * dcfg.matMul));
    const gather = activeBeastSkillEffect(state, 'gather'); // 玄水护盾：出战灵兽助采集，灵材 +1
    if (gather) matQty += gather;
    const mat = { 名称: matName, 类型: '材料', 数量: matQty, 描述: '秘境所得' };
    if (storeItem(state, mat)) logs.push(`获得材料：${matName} ×${mat.数量}${gather ? '（玄水护盾相助，灵材丰盈）' : ''}。`);
  }"""
s = apply(s, old, new, "systems.js 玄水护盾采集+1")
write(SYS, s)

# ---------- ui.js: 展示天赋文案 ----------
u = read(UI)
old = "/** 灵兽面板：展示已收服灵兽、栏位信息、战力加成 */"
new = """const BEAST_TALENT_TEXT = {
  '风刃突袭': '先手突袭：出战时额外 +5% 胜率',
  '幻境迷心': '惑乱强敌：出战且对战更强对手时额外 +8% 胜率',
  '铁背护主': '铁背护体：出战战败时大幅减免惩罚（免重伤、免失灵石）',
  '玄水护盾': '玄水护持：出战秘境探索时灵材获取 +1',
  '雷击俯冲': '雷霆俯冲：常驻战斗胜率 +8%（见灵兽助阵）',
  '涅槃残焰': '涅槃残焰：极稀有，渡劫保命（另行实装）',
};
/** 灵兽面板：展示已收服灵兽、栏位信息、战力加成 */"""
u = apply(u, old, new, "ui.js 新增 BEAST_TALENT_TEXT")

old = """              <div class="beast-skill">技能：${b.skill}</div>
              <div class="beast-desc">${b.desc}</div>"""
new = """              <div class="beast-skill">技能：${b.skill}</div>
              <div class="beast-talent ${isActive ? 'talent-active' : ''}">${isActive ? '出战天赋' : '天赋'}：${BEAST_TALENT_TEXT[b.skill] || '（暂无特殊天赋）'}</div>
              <div class="beast-desc">${b.desc}</div>"""
u = apply(u, old, new, "ui.js 灵兽卡片显示天赋")
write(UI, u)

# ---------- test-newfeatures.mjs: 追加确定性断言 ----------
t = read(TEST)
old = "ok(stHT.beasts.maxSlots === ms0 + 1, '服用灵兽契约灵兽栏上限 +1');\n\nconsole.log(`\\n===== 本轮新功能专项测试："
new = """ok(stHT.beasts.maxSlots === ms0 + 1, '服用灵兽契约灵兽栏上限 +1');

/* ---------- 灵兽「伴生天赋」：出战技能真实效果（确定性，无 RNG） ---------- */
{
  const mk = () => {
    const g = S.createNewGame({ name: '伴生天赋', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
    ensureLifeState(g);
    const beasts = ensureBeastState(g);
    g.player.level = 10; g.player.power = 500;
    return { g, beasts };
  };
  const enemy = { name: '试炼傀儡', realm: '练气', level: 10, power: 500 };
  // 1) 风刃突袭：出战额外 +5% 胜率（与同配置无天赋灵兽对照，隔离天赋增量）
  {
    const { g, beasts } = mk();
    beasts.slots = [{ name: '青风狼', element: '风', star: 1, power: 8, skill: '风刃突袭', desc: 'x' }];
    beasts.activeIdx = 0;
    const ctrl = mk(); ctrl.beasts.slots = [{ name: '青风狼', element: '风', star: 1, power: 8, skill: 'x', desc: 'x' }]; ctrl.beasts.activeIdx = 0;
    const ctrlRate = S.previewBattle(ctrl, enemy, 'shengci').finalRate;
    const wolfRate = S.previewBattle(g, enemy, 'shengci').finalRate;
    ok(wolfRate === Math.min(95, ctrlRate + 5), `风刃突袭出战额外 +5%（对照${ctrlRate}/狼${wolfRate}）`);
    ok(S.activeBeastSkill(g) === '风刃突袭', 'activeBeastSkill 返回出战技能名');
    ok(S.activeBeastSkillEffect(g, 'winRate') === 5, 'activeBeastSkillEffect 读取天赋数值');
    ok(S.activeBeastSkillEffect(g, 'defeatRelief') === undefined, '无该天赋时返回 undefined');
  }
  // 2) 幻境迷心：越级（敌等级>己方）额外 +8%；同阶不触发
  {
    const { g, beasts } = mk();
    beasts.slots = [{ name: '九尾灵狐', element: '幻', star: 1, power: 18, skill: '幻境迷心', desc: 'x' }];
    beasts.activeIdx = 0;
    const same = S.previewBattle(g, { name: 'e', realm: '练气', level: 10, power: 500 }, 'shengci').finalRate;
    const strong = S.previewBattle(g, { name: 'e', realm: '化神', level: 60, power: 9999 }, 'shengci').finalRate;
    ok(strong === Math.min(95, same + 8), `幻境迷心越级额外 +8%（同阶${same}/越级${strong}）`);
  }
  // 3) 雷击俯冲：已由 BEAST_WINRATE 覆盖，天赋名可识别
  {
    const { g, beasts } = mk();
    beasts.slots = [{ name: '雷翅隼', element: '雷', star: 1, power: 25, skill: '雷击俯冲', desc: 'x' }];
    beasts.activeIdx = 0;
    ok(S.activeBeastSkill(g) === '雷击俯冲', '雷击俯冲技能名可识别');
  }
  // 4) 铁背护主：出战战败减免惩罚（循环至落败，确定性验证免重伤/免失灵石）
  {
    const mkB = () => { const { g, beasts } = mk(); beasts.slots = [{ name: '铁背苍熊', element: '土', star: 1, power: 12, skill: '铁背护主', desc: 'x' }]; beasts.activeIdx = 0; g.currencies = { '下品灵石': 1000, '中品灵石': 0, '上品灵石': 0 }; return g; };
    let wounded = -1, lostStones = -1, found = false;
    for (let i = 0; i < 200 && !found; i++) {
      const g = mkB();
      const e = { name: '太古凶兽', realm: '化神', level: 60, power: 999999, beast: true };
      const before = S.totalStones(g);
      const rep = S.resolveBattle(g, e, 'yaoshou', false, 'normal', false);
      if (!rep.win) {
        found = true;
        wounded = g.flags.wounded || 0;
        lostStones = before - S.totalStones(g);
        ok(rep.logs.some((l) => l.includes('铁背护体')), '铁背护主战败文案出现');
        ok(wounded === 0, `铁背护主免重伤（wounded=${wounded}）`);
        ok(lostStones === 0, `铁背护主免失灵石（lost=${lostStones}）`);
      }
    }
    ok(found, '循环至落败以验证铁背护主（非 flaky）');
  }
  // 5) 玄水护盾：出战秘境探索灵材 +1（确定性，循环验证每次掉落均带加成文案）
  {
    const { g, beasts } = mk();
    beasts.slots = [{ name: '玄水龟', element: '水', star: 1, power: 10, skill: '玄水护盾', desc: 'x' }];
    beasts.activeIdx = 0;
    g.currencies = { '下品灵石': 5000, '中品灵石': 0, '上品灵石': 0 };
    ok(S.activeBeastSkillEffect(g, 'gather') === 1, '玄水护盾天赋=采集+1');
    const realm = S.availableMysticRealms(g).find((m) => !m.requiresMap && g.player.level >= m.minLevel && m.rewards && m.rewards.materials && m.rewards.materials.length);
    if (realm) {
      let allBonus = true, anyDrop = false;
      for (let i = 0; i < 40; i++) {
        const gg = mk(); gg.currencies = { '下品灵石': 5000, '中品灵石': 0, '上品灵石': 0 };
        gg.beasts.slots = [{ name: '玄水龟', element: '水', star: 1, power: 10, skill: '玄水护盾', desc: 'x' }];
        gg.beasts.activeIdx = 0;
        const rep = S.exploreMysticRealm(gg, realm.id, 1);
        const drop = rep.logs.find((l) => l.startsWith('获得材料：'));
        if (drop) { anyDrop = true; if (!drop.includes('玄水护盾相助')) allBonus = false; }
      }
      ok(anyDrop, '秘境确有灵材掉落');
      ok(allBonus, '玄水护盾出战时每次灵材掉落均带 +1 加成文案');
    }
  }
}

console.log(`\\n===== 本轮新功能专项测试："""
t = apply(t, old, new, "test-newfeatures 追加伴生天赋断言")
write(TEST, t)

print("\n全部补丁应用成功。")
