# -*- coding: utf-8 -*-
"""修复口径转换残留的多余右括号。

误伤链：原行 `... && s.currencies['下品灵石'] === before + 100);`
被赋值正则吃掉末尾的 `)` 后补成 `setStones(s, == before + 100);`，
再改回比较形式后变成 `stones(s) === before + 100));`，少一个左括号。

修法：对含 stones( 的行做括号计数，右括号多于左括号时从行尾删去多余部分。
"""
import io
import re

BASE = 'Z:/1/xiuxian/tests/'

for path in ['test-newfeatures.mjs', 'test-codex.mjs', 'test-life.mjs']:
    p = BASE + path
    with io.open(p, encoding='utf-8') as f:
        lines = f.read().split('\n')
    fixed = 0
    for i, line in enumerate(lines):
        if 'stones(' not in line:
            continue
        # 去掉字符串字面量后再数括号，避免文案里的括号干扰
        stripped = re.sub(r"'[^']*'", "''", line)
        stripped = re.sub(r'"[^"]*"', '""', stripped)
        stripped = re.sub(r'`[^`]*`', '``', stripped)
        diff = stripped.count(')') - stripped.count('(')
        if diff > 0:
            lines[i] = line
            # 从行尾删掉 diff 个右括号
            for _ in range(diff):
                idx = lines[i].rfind(')')
                if idx == -1:
                    break
                lines[i] = lines[i][:idx] + lines[i][idx + 1:]
            fixed += 1
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print('%s：修正 %d 行' % (path, fixed))
