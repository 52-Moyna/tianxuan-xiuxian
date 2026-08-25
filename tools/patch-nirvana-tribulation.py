# -*- coding: utf-8 -*-
"""实装灵兽「涅槃残焰」渡劫保命天赋（确定性，无 RNG）。
- data.js：BEAST_SKILL_EFFECTS['涅槃残焰'] 由占位 {} 改为 { tribulationSave: true }
- systems.js：attemptBreakthrough 失败分支新增涅槃保命（境界不跌落）
- ui.js：BEAST_TALENT_TEXT['涅槃残焰'] 文案对齐真实效果
- tests/test-newfeatures.mjs：新增确定性断言（强制失败，Math.random 覆盖）
落盘前每个替换都校验命中次数，避免静默 no-op。
"""
import io, sys

ROOT = 'Z:/1/xiuxian'

def patch(path, old, new, expect=1):
    full = f'{ROOT}/{path}'
    with io.open(full, 'r', encoding='utf-8') as f:
        s = f.read()
    n = s.count(old)
    if n != expect:
        raise SystemExit(f'[FAIL] {path} 命中 {n} 次（期望 {expect}）\nOLD={old!r}')
    s = s.replace(old, new)
    with io.open(full, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'[OK] {path} 替换 {n} 处')

# ---------- data.js ----------
patch(
    'public/js/data.js',
    "'涅槃残焰': {},",
    "'涅槃残焰': { tribulationSave: true },  // 极稀有（幼凰，Lv.50+）：出战渡劫失败时替主人化解天劫反噬，境界不跌落",
)

# ---------- systems.js ----------
old_sys = """    } else {
      p.level = Math.max(1, p.level - back);
      p.exp = 0;
      logs.push(`⚡ 渡劫失败！${bn.fail}。修为跌落至 ${realmLevelName(p.level)}。`);
    }
  }"""
new_sys = """    } else {
      const nirvana = activeBeastSkillEffect(state, 'tribulationSave');
      if (nirvana) {
        const nBeast = state.beasts?.slots?.[state.beasts.activeIdx];
        logs.push(`🔥 出战灵兽「${nBeast?.name || '灵兽'}」涅槃残焰燃起，替你挡下天劫反噬，修为未损！`);
        p.exp = 0; // 仍清当前层经验，但境界不跌落
      } else {
        p.level = Math.max(1, p.level - back);
        p.exp = 0;
        logs.push(`⚡ 渡劫失败！${bn.fail}。修为跌落至 ${realmLevelName(p.level)}。`);
      }
    }
  }"""
patch('public/js/systems.js', old_sys, new_sys)

# ---------- ui.js ----------
patch(
    'public/js/ui.js',
    "'涅槃残焰': '涅槃残焰：极稀有，渡劫保命（另行实装）',",
    "'涅槃残焰': '涅槃残焰：出战渡劫失败时替你化解反噬，修为不跌落（境界无损）',",
)

# ---------- tests/test-newfeatures.mjs ----------
test_block = r'''
/* ---------- 灵兽「涅槃残焰」：出战渡劫失败保命（境界不跌落，确定性） ---------- */
{
  // 先建好 state（用真实随机），再覆盖 Math.random 恒为 0.999 强制突破失败（Rng.chance 必返 false）。
  const realRandom = Math.random;
  const gNo = S.createNewGame({ name: '涅槃对照', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gNo);
  gNo.player.level = 20; // 筑基瓶颈，失败倒退 1 级
  const gYes = S.createNewGame({ name: '涅槃保命', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(gYes);
  ensureBeastState(gYes);
  gYes.player.level = 20;
  gYes.beasts.slots = [{ name: '幼凰', element: '火', star: 5, power: 200, skill: '涅槃残焰', desc: '极稀有灵兽' }];
  gYes.beasts.activeIdx = 0;
  try {
    Math.random = () => 0.999;
    const lvB = gNo.player.level;
    const repNo = S.attemptBreakthrough(gNo);
    ok(!repNo.success, '强制失败：突破未成功（无涅槃灵兽）');
    ok(gNo.player.level === lvB - 1, `无涅槃灵兽失败跌落1级（${lvB}→${gNo.player.level}）`);
    ok(repNo.logs.some((l) => l.includes('渡劫失败')), '无涅槃灵兽失败文案出现');
    const lvY = gYes.player.level;
    const repYes = S.attemptBreakthrough(gYes);
    ok(!repYes.success, '强制失败：突破未成功（涅槃灵兽在场）');
    ok(gYes.player.level === lvY, `涅槃残焰保命：境界不跌落（${lvY}→${gYes.player.level}）`);
    ok(repYes.logs.some((l) => l.includes('涅槃残焰')), '涅槃残焰保命文案出现');
  } finally { Math.random = realRandom; }
}

'''
marker = "console.log(`\\n===== 本轮新功能专项测试："
test_path = f'{ROOT}/tests/test-newfeatures.mjs'
with io.open(test_path, 'r', encoding='utf-8') as f:
    ts = f.read()
idx = ts.find(marker)
if idx < 0:
    raise SystemExit('[FAIL] 未找到测试插入标记')
if '涅槃残焰' in ts:
    raise SystemExit('[FAIL] 测试块已存在，避免重复插入')
ts = ts[:idx] + test_block + ts[idx:]
with io.open(test_path, 'w', encoding='utf-8') as f:
    f.write(ts)
print('[OK] tests/test-newfeatures.mjs 插入涅槃残焰保命测试块')

print('\\n全部补丁应用完成。')
