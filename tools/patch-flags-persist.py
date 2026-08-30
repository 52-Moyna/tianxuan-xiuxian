import os
ROOT = 'Z:/1/xiuxian'
p_save = os.path.join(ROOT, 'public/js/save.js')
p_test = os.path.join(ROOT, 'tests/test-save.mjs')
s = open(p_save, encoding='utf-8').read()

old_save = "        增益到期月: state.buffs?.expireMonth || 0,"
new_save = (old_save
    + "\n        炼丹总数: state.flags?.refinedPills || 0,"
    + "\n        曾疗伤: state.flags?.curedWounds || false,"
    + "\n        曾渡劫: state.flags?.tribulationSuccess || false,"
    + "\n        聚灵余月: state.flags?.cultivateBoostMonths || 0,"
    + "\n        战前增益: state.flags?.nextBattleWin || 0,")
assert s.count(old_save) == 1, "save old_save 出现 %d 次" % s.count(old_save)
s = s.replace(old_save, new_save, 1)

old_load = "    mysticDeepest: Number(flagsRaw.秘境最深) || 0,"
new_load = (old_load
    + "\n    refinedPills: Number(flagsRaw.炼丹总数) || 0,"
    + "\n    curedWounds: flagsRaw.曾疗伤 === true || flagsRaw.曾疗伤 === 'true',"
    + "\n    tribulationSuccess: flagsRaw.曾渡劫 === true || flagsRaw.曾渡劫 === 'true',"
    + "\n    cultivateBoostMonths: Number(flagsRaw.聚灵余月) || 0,"
    + "\n    nextBattleWin: Number(flagsRaw.战前增益) || 0,")
assert s.count(old_load) == 1, "save old_load 出现 %d 次" % s.count(old_load)
s = s.replace(old_load, new_load, 1)
open(p_save, 'w', encoding='utf-8').write(s)
print('save.js patched')

t = open(p_test, encoding='utf-8').read()
old_set = "st.flags.companionMonths = 3;"
new_set = (old_set
    + "\n// 运行期计数 / 一次性 flag（旧版存档会丢失）"
    + "\nst.flags.refinedPills = 17;"
    + "\nst.flags.curedWounds = true;"
    + "\nst.flags.tribulationSuccess = true;"
    + "\nst.flags.cultivateBoostMonths = 4;"
    + "\nst.flags.nextBattleWin = 5;")
assert t.count(old_set) == 1, "test old_set 出现 %d 次" % t.count(old_set)
t = t.replace(old_set, new_set, 1)

old_assert = "ok('同行月数保留', rt.flags.companionMonths === 3);"
new_assert = (old_assert
    + "\n// 运行期计数 / 一次性 flag 跨存档保留"
    + "\nok('炼丹计数保留', rt.flags.refinedPills === 17);"
    + "\nok('曾疗伤flag保留', rt.flags.curedWounds === true);"
    + "\nok('曾渡劫flag保留', rt.flags.tribulationSuccess === true);"
    + "\nok('聚灵加成余月保留', rt.flags.cultivateBoostMonths === 4);"
    + "\nok('战前增益保留', rt.flags.nextBattleWin === 5);")
assert t.count(old_assert) == 1, "test old_assert 出现 %d 次" % t.count(old_assert)
t = t.replace(old_assert, new_assert, 1)

old_tail = "ok('仅法宝时不串格', rt2.equipment.weapon?.名称 !== '寒玉佩');"
new_tail = (old_tail
    + "\n\n// 7. 旧档（不含新增字段）兼容：缺字段不报错且给默认 0/false"
    + "\nconst st3 = S.createNewGame({"
    + "\n  name: '旧档兼容', gender: '男', raceId: 'human', ageId: 'young',"
    + "\n  regionId: 'zhongzhou', packId: 1, yunId: 'panshi',"
    + "\n  spiritRoot: { grade: '上品', gradeId: 'shang', elements: ['金'], speed: 1.2, desc: '测试' },"
    + "\n});"
    + "\nconst rt3 = deserialize(serialize(st3));"
    + "\nok('旧档炼丹计数默认0', rt3.flags.refinedPills === 0);"
    + "\nok('旧档曾疗伤默认false', rt3.flags.curedWounds === false);"
    + "\nok('旧档曾渡劫默认false', rt3.flags.tribulationSuccess === false);"
    + "\nok('旧档聚灵余月默认0', rt3.flags.cultivateBoostMonths === 0);"
    + "\nok('旧档战前增益默认0', rt3.flags.nextBattleWin === 0);")
assert t.count(old_tail) == 1, "test old_tail 出现 %d 次" % t.count(old_tail)
t = t.replace(old_tail, new_tail, 1)
open(p_test, 'w', encoding='utf-8').write(t)
print('test-save.mjs patched')
