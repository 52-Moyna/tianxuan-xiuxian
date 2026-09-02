# -*- coding: utf-8 -*-
"""测试口径转换（第二批）：test-codex.mjs / test-life.mjs。

与 patch_0902_test_currency_tiers.py 同逻辑：
  - 赋值  X.currencies['下品灵石'] = N  →  setStones(X, N)
  - 读取  X.currencies['下品灵石']      →  stones(X)
适配点：各测试文件导入风格不同（有的 `import * as S`，有的具名导入），
故辅助函数按实际导入情况生成；缺 data.js 导入时自动补一行。
"""
import io
import re
import sys

BASE = 'Z:/1/xiuxian/tests/'

ASSIGN = re.compile(r"([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.currencies(\?\.|)\['下品灵石'\]\s*=\s*([^;\n]+);")
READ = re.compile(r"([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.currencies(\?\.|)\['下品灵石'\]")


def helpers(has_ns):
    total = 'S.totalStones' if has_ns else 'totalStones'
    add = 'S.addStones' if has_ns else 'addStones'
    return """
/* 分层货币辅助：货币分 5 档、1:100 递进，收入/支出都会重新分档，
 * 故「下品灵石」单档账面恒 < 100。测试一律以总资产（下品单位）存取，
 * 避免用单档账面断言——那正是历史 bug 的潜伏方式。 */
const stones = (st) => %s(st);
function setStones(st, n) {
  st.currencies = st.currencies || {};
  for (const c of CURRENCIES) st.currencies[c] = 0;
  %s(st, n);
}
""" % (total, add)


def ensure_named_import(src, module, name):
    """确保 `import { ... } from '<module>';` 中含 name；无该 import 行则新增。"""
    pat = re.compile(r"import \{([^}]*)\} from '%s';" % re.escape(module))
    m = pat.search(src)
    if m:
        names = [x.strip() for x in m.group(1).split(',') if x.strip()]
        if name in names:
            return src
        names.append(name)
        return src[:m.start()] + 'import { ' + ', '.join(names) + " } from '%s';" % module + src[m.end():]
    return "import { %s } from '%s';\n" % (name, module) + src


def convert(path):
    p = BASE + path
    with io.open(p, encoding='utf-8') as f:
        src = f.read()
    if 'const stones = (st)' in src:
        print('SKIP（已转换）', path)
        return

    src, n_assign = ASSIGN.subn(lambda m: 'setStones(%s, %s);' % (m.group(1), m.group(3)), src)
    src, n_read = READ.subn(lambda m: 'stones(%s)' % m.group(1), src)

    has_ns = "import * as S from '../public/js/systems.js';" in src
    anchor = 'let pass = 0, fail = 0;'
    if anchor not in src:
        print('!! 找不到锚点：', path)
        sys.exit(1)
    src = src.replace(anchor, anchor + '\n' + helpers(has_ns), 1)

    src = ensure_named_import(src, '../public/js/data.js', 'CURRENCIES')
    if not has_ns:
        src = ensure_named_import(src, '../public/js/systems.js', 'totalStones')
        src = ensure_named_import(src, '../public/js/systems.js', 'addStones')

    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(src)
    print('OK %s：赋值 %d 处、读取 %d 处' % (path, n_assign, n_read))


convert('test-codex.mjs')
convert('test-life.mjs')
print('完成')
