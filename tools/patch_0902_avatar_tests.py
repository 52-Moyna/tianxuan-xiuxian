# -*- coding: utf-8 -*-
"""补自定义头像时间戳的持久化回归测试（防设置白名单遗漏）。"""
import io, sys

P = 'Z:/1/xiuxian/tests/test-newfeatures.mjs'


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


src = read(P)

anchor = "console.log(`\n===== 本轮新功能专项测试："
if src.count(anchor) != 1:
    print('!! 尾部锚点命中 %d 次' % src.count(anchor)); sys.exit(1)

block = """/* ---------- 自定义头像时间戳持久化（设置白名单） ---------- */
{
  const s3 = S.createNewGame({ name: '头像测试', gender: '女', raceId: 'human', ageId: 'young', regionId: 'zhongzhou', packId: 2, yunId: 'qihuo', spiritRoot: S.rollSpiritRoot() });
  ensureLifeState(s3);
  ok((Number(s3.settings.customAvatarTs) || 0) === 0, '新建档默认未使用自定义头像（ts=0）');
  s3.settings.customAvatarTs = 1712345678901;
  const files = serialize(s3);
  ok(Number(files['设置.ini']?.游戏设置?.customAvatarTs) === 1712345678901, 'customAvatarTs 已进入设置存档白名单');
  const back3 = deserialize(files);
  ok(Number(back3.settings?.customAvatarTs) === 1712345678901, 'customAvatarTs 存读档往返保持（自定义头像不会刷新即失效）');
  // 旧档无该字段：必须回落 0，而不是 undefined 引发渲染异常
  const legacy = { ...files, '设置.ini': { 游戏设置: { avatarPreset: 'x' } } };
  const back4 = deserialize(legacy);
  ok((Number(back4.settings?.customAvatarTs) || 0) === 0, '旧档缺 customAvatarTs 时回落为 0');
}

"""

src = src.replace(anchor, block + anchor, 1)
write(P, src)
print('OK 插入头像持久化测试段')
