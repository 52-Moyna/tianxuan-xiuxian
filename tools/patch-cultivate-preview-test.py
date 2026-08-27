# -*- coding: utf-8 -*-
"""向 test-newfeatures.mjs 插入「修炼收益确定性预览」断言（replace 写回，防截断）。"""
import io, os
TEST = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'
with io.open(TEST, 'r', encoding='utf-8') as f:
    s = f.read()

old = r'''  ok(rb && typeof rb.ok === 'boolean' && Array.isArray(rb.logs), 'tameBeast 仍返回结构化结果');
}

console.log(`'''

new = r'''  ok(rb && typeof rb.ok === 'boolean' && Array.isArray(rb.logs), 'tameBeast 仍返回结构化结果');
}

/* ---------- 修炼收益确定性预览 ---------- */
const cgN = S.cultivateGainPreview(state, 'normal');
const cgS = S.cultivateGainPreview(state, 'seclusion');
ok(cgN && cgN.gain > 0 && cgS && cgS.gain > 0, '修炼预览收益为正');
ok(cgS.gain > cgN.gain, `闭关预览收益高于普通修炼(${cgS.gain}>${cgN.gain})`);
const cgBefore = S.cultivateGainPreview(state, 'normal').gain;
const _savedLv = state.cave.level, _savedBonus = state.cave.bonus;
state.cave.level = Math.min(8, state.cave.level + 1);
state.cave.bonus = (state.cave.bonus || 0) + 0.25;
const cgAfter = S.cultivateGainPreview(state, 'normal').gain;
ok(cgAfter > cgBefore, `洞府加成提升后预览收益增加(${cgAfter}>${cgBefore})`);
state.cave.level = _savedLv; state.cave.bonus = _savedBonus;
const cgA = S.cultivateGainPreview(state, 'normal').gain;
const cgB = S.cultivateGainPreview(state, 'normal').gain;
ok(cgA === cgB, '修炼预览确定性（同状态两次一致，无 RNG 波动）');
const _savedTox = state.flags.pillToxicity;
const cgLowTox = S.cultivateGainPreview(state, 'normal').gain;
state.flags.pillToxicity = 90;
const cgHighTox = S.cultivateGainPreview(state, 'normal').gain;
ok(cgHighTox < cgLowTox, `丹毒升高拉低修炼预览收益(${cgHighTox}<${cgLowTox})`);
state.flags.pillToxicity = _savedTox;

console.log(`'''

if s.count(old) != 1:
    raise SystemExit('[FAIL] 测试锚点命中 %d 次（期望 1）' % s.count(old))
s = s.replace(old, new, 1)
with io.open(TEST, 'w', encoding='utf-8') as f:
    f.write(s)
print('[OK] test-newfeatures.mjs 已插入修炼预览断言')
