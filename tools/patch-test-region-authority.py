# -*- coding: utf-8 -*-
"""为「ensureLifeState 地域归一以 regionId 为权威」补回归测试。
覆盖：id 与中文名冲突时以 id 为准、旧档只有中文名时按名反查、
包含式模糊匹配、非法值兜底中州、存读档往返后地域不漂移。
"""
import io

T = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'

with io.open(T, 'r', encoding='utf-8') as f:
    t = f.read()

anchor = "console.log(`\n===== 本轮新功能专项测试："
assert anchor in t, '测试文件锚点缺失'

block = """
/* ---------- 地域归一：regionId 为权威口径（防键序依赖导致悄悄被拉回中州） ---------- */
{
  const mk = () => S.createNewGame({ name: '地域测试', gender: '男', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });

  // 1) id 与中文名冲突时以 id 为准，并据此刷新显示名
  const a = mk();
  a.world.regionId = 'haiwai';
  a.world.region = '中州圣城'; // 故意残留旧显示名
  ensureLifeState(a);
  ok(a.world.regionId === 'haiwai', `id 与名冲突时以 regionId 为准（${a.world.regionId}）`);
  ok(a.world.region === '海外仙岛', `显示名按 regionId 刷新（${a.world.region}）`);

  // 2) 遍历全部地域：设 id 后归一不应改变 id（此前中州键序靠前会顶替其它地域）
  const allIds = ['zhongzhou', 'donghuang', 'nanming', 'xiji', 'beiming', 'lingnan', 'haiwai'];
  let stable = true;
  for (const id of allIds) {
    const s2 = mk();
    s2.world.regionId = id;
    s2.world.region = '中州圣城';
    ensureLifeState(s2);
    if (s2.world.regionId !== id) stable = false;
  }
  ok(stable, '七大地域设定 id 后归一均保持不变');

  // 3) 旧档兼容：缺 regionId 时按中文名反查
  const b = mk();
  b.world.regionId = '';
  b.world.region = '东荒妖域';
  ensureLifeState(b);
  ok(b.world.regionId === 'donghuang', `缺 id 时按中文名反查（${b.world.regionId}）`);

  // 4) 包含式模糊匹配（旧档名可能带后缀）
  const c = mk();
  c.world.regionId = '';
  c.world.region = '北冥瀚海·外港';
  ensureLifeState(c);
  ok(c.world.regionId === 'beiming', `含后缀的旧档名可模糊匹配（${c.world.regionId}）`);

  // 5) 非法 id + 非法名 → 兜底中州，不抛错
  const d = mk();
  d.world.regionId = 'not_a_region';
  d.world.region = '虚无之地';
  ensureLifeState(d);
  ok(d.world.regionId === 'zhongzhou' && d.world.region === '中州圣城', '非法地域兜底中州');

  // 6) 归一正确后，地域相关派生口径随之正确（坊市特产售价）
  const e = mk();
  e.world.regionId = 'donghuang';
  e.world.region = '中州圣城';
  ensureLifeState(e);
  ok(S.sellPriceFactors(e, { 名称: '兽骨', 类型: '材料', 数量: 1, 价值: 100 }).regional === 1.25,
    '归一后东荒妖兽材料特产加成正确生效');

  // 7) 存读档往返后地域不漂移
  const f2 = mk();
  f2.world.regionId = 'lingnan';
  f2.world.region = '岭南百越';
  ensureLifeState(f2);
  const back = deserialize(serialize(f2));
  ensureLifeState(back);
  ok(back.world.regionId === 'lingnan', `存读档往返后 regionId 保持（${back.world.regionId}）`);
  ok(back.world.region === '岭南百越', '存读档往返后地域显示名保持');
}

"""

t = t.replace(anchor, block + anchor, 1)

with io.open(T, 'w', encoding='utf-8', newline='') as f:
    f.write(t)
print('test-newfeatures.mjs: 追加地域归一权威口径回归测试')
