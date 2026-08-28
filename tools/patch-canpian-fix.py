"""残片法宝补丁·修正：用引擎公式算法宝战力，使描述/日志/实际战力一致；修正测试断言。"""
import io

ROOT = "Z:/1/xiuxian"


def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8") as f:
        txt = f.read()
    if old not in txt:
        raise SystemExit("PATCH FAIL [%s]: 锚点未命中\n%s" % (label, old[:160]))
    if new in txt:
        print("SKIP [%s]: 已应用。" % label)
        return
    txt = txt.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    print("OK   [%s]: 已写入。" % label)


# A. systems.js：用引擎公式算战力，描述与实际一致
sys_path = ROOT + "/public/js/systems.js"
sys_old = "      const repairedName = '灵珠法宝';\n      const artPower = 16;"
sys_new = "      const repairedName = '灵珠法宝';\n      const artPower = calcEquipPower('artifact', 3, getEquipGrade('faqi'));"
patch(sys_path, sys_old, sys_new, "systems.artPower")

# B. life.js：配方卡描述去掉会失真的“战力+16”
life_path = ROOT + "/public/js/life.js"
life_old = "output: { name: '灵珠法宝', type: '法宝', quantity: 1, level: 3, desc: '由法宝残片重铸而成的灵珠法宝，战力+16。' }"
life_new = "output: { name: '灵珠法宝', type: '法宝', quantity: 1, level: 3, desc: '由法宝残片重铸而成的灵珠法宝（法器）。' }"
patch(life_path, life_old, life_new, "life.desc")

# C. 测试断言：装备成功后法宝槽战力>0（实际由引擎公式重算，不硬编码）
test_path = ROOT + "/tests/test-newfeatures.mjs"
test_old = "ok(rcEquip.equipment.artifact && rcEquip.equipment.artifact.战力 === 16, '残片修复产出可被装备，法宝槽战力+16');"
test_new = "ok(rcEquip.equipment.artifact && rcEquip.equipment.artifact.名称 === '灵珠法宝' && rcEquip.equipment.artifact.战力 > 0, '残片修复产出可被装备为灵珠法宝，法宝槽战力>0');"
patch(test_path, test_old, test_new, "tests.assert")

print("FIX DONE.")
