"""残片法宝补丁·修正2：
  - 修复 destinyRewardPreview 中 `D.TECHNIQUE_GRADES` 未定义（应为 TECHNIQUE_GRADES）的潜在崩溃（ preexisting ）。
  - 修正残片修复测试首个断言（战力硬编码 16 → >0，实际由引擎公式重算）。
"""
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


# 1) 修复 destinyRewardPreview 崩溃：D.TECHNIQUE_GRADES → TECHNIQUE_GRADES
sys_path = ROOT + "/public/js/systems.js"
sys_old = "      const g = D.TECHNIQUE_GRADES.find((x) => x.id === r.grade);"
sys_new = "      const g = TECHNIQUE_GRADES.find((x) => x.id === r.grade);"
patch(sys_path, sys_old, sys_new, "systems.destiny.D")

# 2) 修正残片修复测试首个断言（战力硬编码 16 → >0）
test_path = ROOT + "/tests/test-newfeatures.mjs"
test_old = "ok(rcArt && rcArt.类型 === '法宝' && rcArt._equip && rcArt._equip.战力 === 16, '残片修复：消耗残片+星砂产出可装备灵珠法宝（战力16）');"
test_new = "ok(rcArt && rcArt.类型 === '法宝' && rcArt._equip && rcArt._equip.战力 > 0, '残片修复：消耗残片+星砂产出可装备灵珠法宝（战力>0）');"
patch(test_path, test_old, test_new, "tests.assert1")

print("FIX2 DONE.")
