# -*- coding: utf-8 -*-
"""审计：扫描 data/codex/life 中定义的配置字段，找出全代码库只写不读的死字段。"""
import re, os, collections

SRC = 'public/js'
files = ['data.js','codex.js','life.js','systems.js','ui.js','save.js','state.js','extensions.js','main.js']
texts = {}
for f in files:
    p = os.path.join(SRC, f)
    texts[f] = open(p, encoding='utf-8').read()
allsrc = '\n'.join(texts.values())

# 收集对象字面量里的 key（英文标识符 key，形如  key:  ）
defs = collections.defaultdict(set)   # key -> 定义所在文件
for f in ['data.js','codex.js','life.js','systems.js']:
    for m in re.finditer(r'(?<![\w$.\'"])([a-zA-Z_][a-zA-Z0-9_]{2,})\s*:', texts[f]):
        k = m.group(1)
        defs[k].add(f)

# 统计每个 key 的「读取」次数：.key 或 ['key'] 或 ?.key 或解构 { key }
report = []
for k, where in sorted(defs.items()):
    reads = 0
    reads += len(re.findall(r'\.\s*'+re.escape(k)+r'(?![\w$:])', allsrc))
    reads += len(re.findall(r'\[\s*[\'"]'+re.escape(k)+r'[\'"]\s*\]', allsrc))
    if reads == 0:
        report.append((k, sorted(where)))

print('=== 疑似死字段（定义了但全库无 .key / ["key"] 读取）===')
for k, where in report:
    # 排除函数定义/方法名（这些是被 export 的对象成员，通过 S.xxx 调用亦算读取，已计入）
    print(f'{k:32s} 定义于 {",".join(where)}')
print(f'\n共 {len(report)} 个')
