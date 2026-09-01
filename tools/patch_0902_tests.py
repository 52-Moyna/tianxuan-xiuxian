# -*- coding: utf-8 -*-
"""
补丁：为「选档卡片展示真实境界」补回归测试。

  - tests/test-server.mjs：/api/slots 摘要必须含 境界/等级/战力/天玄历年，
    且「道号」与「境界」是两个字段、不得互相顶替（本轮修的就是这个）。
  - tests/test-ui-smoke.mjs：slotSummaryText 纯函数断言
    （境界优先、旧档退回道号、缺数据时不出 undefined）。
"""
import io

ROOT = 'Z:/1/xiuxian/'

def read(p):
    with io.open(ROOT + p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, s):
    with io.open(ROOT + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

# ---------------- tests/test-server.mjs ----------------
t = read('tests/test-server.mjs')

OLD = """    const sample = { files: { '个人信息.ini': { 基本信息: { 姓名: '测试道友', 道号: '练气', 骨龄: 18 }, 元数据: { 道果码: 'TESTCODE' } } } };"""
NEW = """    // 道号是玩家自取的称号（如「玄尘子」），境界才是修行进度；两者都要写，
    // 用来验证 /api/slots 不会再把道号当境界返回（选档卡片靠境界分辨进度）。
    const sample = { files: {
      '个人信息.ini': { 基本信息: { 姓名: '测试道友', 道号: '玄尘子', 骨龄: 18 }, 元数据: { 道果码: 'TESTCODE' } },
      '属性.ini': { 修为: { 等级: 42, 经验: 100, 境界: '金丹期', 战力: 12345 } },
      '世界.ini': { 时间: { 天玄历年: 128, 月: 3, 总回合: 88 } },
    } };"""
assert t.count(OLD) == 1, 'test-server sample 未唯一命中'
t = t.replace(OLD, NEW)

OLD2 = """    const sv = await jpost(port, '/api/save?slot=1', sample);
    ok(sv.s === 200 && sv.j.ok && sv.j.written.includes('个人信息.ini'), '/api/save 写入成功');"""
NEW2 = """    const sv = await jpost(port, '/api/save?slot=1', sample);
    ok(sv.s === 200 && sv.j.ok && sv.j.written.includes('个人信息.ini'), '/api/save 写入成功');

    // 3.1) /api/slots 摘要：境界/等级/战力/纪年来自 属性.ini 与 世界.ini，道号另存
    const slots1 = await jget(port, '/api/slots');
    const sum1 = (slots1.j?.slots || []).find((x) => String(x.slot) === '1');
    ok(!!sum1 && sum1.hasSave === true, '/api/slots 标记槽1有存档');
    ok(sum1?.realmName === '金丹期' && sum1?.level === 42 && sum1?.power === 12345 && sum1?.year === 128,
      '/api/slots 摘要含真实境界/等级/战力/纪年');
    ok(sum1?.realm === '玄尘子', '/api/slots 道号独立返回，不被境界顶替');"""
assert t.count(OLD2) == 1, 'test-server 保存断言未唯一命中'
t = t.replace(OLD2, NEW2)

write('tests/test-server.mjs', t)
print('tests/test-server.mjs 已打补丁')

# ---------------- tests/test-ui-smoke.mjs ----------------
u = read('tests/test-ui-smoke.mjs')

OLD3 = """  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""
NEW3 = """  // 选档卡片摘要：境界优先于道号，缺数据不出现 undefined
  try {
    const T = UI.slotSummaryText;
    ok(typeof T === 'function', '导出 slotSummaryText 供测试');
    const full = T({ name: '测试道友', realm: '玄尘子', realmName: '金丹期', level: 42, age: 88, power: 12345, year: 128 });
    ok(full.includes('金丹期') && full.includes('Lv.42') && full.includes('12345') && full.includes('天玄历 128 年'),
      `选档摘要含境界/等级/战力/纪年（实际：${full}）`);
    ok(!full.includes('undefined'), '选档摘要无 undefined 字段');
    const legacy = T({ name: '旧档', realm: '练气', age: 20 });
    ok(legacy.includes('练气') && legacy.includes('20岁') && !legacy.includes('undefined'),
      `旧档无境界时退回道号（实际：${legacy}）`);
    const empty = T({});
    ok(empty === '无名 ｜ 境界未知', `空档摘要兜底（实际：${empty}）`);
  } catch (e) { ok(false, `选档摘要文案: ${e.message}`); }

  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）"""
assert u.count(OLD3) == 1, 'ui-smoke 设置面板段未唯一命中'
u = u.replace(OLD3, NEW3)

write('tests/test-ui-smoke.mjs', u)
print('tests/test-ui-smoke.mjs 已打补丁')
