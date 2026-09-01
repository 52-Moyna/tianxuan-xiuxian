# -*- coding: utf-8 -*-
"""接线自定义头像：服务器 /api/avatar 与 save.js 封装早已就绪，但 UI 从未使用（玩家无法自定义头像）。
本补丁：设置面板加「上传 / 移除自定义头像」，并把时间戳写入 settings（含存档白名单）。
"""
import io, sys

UI = 'Z:/1/xiuxian/public/js/ui.js'
SAVE = 'Z:/1/xiuxian/public/js/save.js'


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def rep(src, old, new, tag):
    if src.count(old) != 1:
        print('!! 锚点命中 %d 次，中止：%s' % (src.count(old), tag))
        sys.exit(1)
    print('OK 替换：%s' % tag)
    return src.replace(old, new)


# ---------------- ui.js ----------------
ui = read(UI)

# 1) import 三个头像 API
ui = rep(ui,
         "import { saveGame, serialize } from './save.js';",
         "import { saveGame, serialize, uploadAvatar, removeAvatar, avatarUrl } from './save.js';",
         'ui.js: import 头像 API')

# 2) resolveAvatarUrl 支持自定义头像
old2 = (
    "function resolveAvatarUrl() {\n"
    "  const st = GameState.data;\n"
    "  // 只用内置头像预设（本地 data URL，无需联网，绝不会 404/报错）\n"
    "  // 兼容旧档中文键「头像预设」\n"
    "  const preset = st?.settings?.avatarPreset || st?.settings?.['头像预设'];\n"
    "  if (preset) {\n"
    "    const url = builtInAvatarDataUrl(preset);\n"
    "    if (url) return url;\n"
    "  }\n"
    "  return null;\n"
    "}"
)
new2 = (
    "function resolveAvatarUrl() {\n"
    "  const st = GameState.data;\n"
    "  // 自定义上传头像优先：图片存于 存档/<槽>/头像.png，由 /api/avatar 提供。\n"
    "  // customAvatarTs 为上传时刻时间戳（仅在成功上传后写入），既保证换图后立即刷新，\n"
    "  // 又避免每次渲染都带新时间戳造成重复请求。未上传过时 ts 为 0，不产生任何请求。\n"
    "  const ts = Number(st?.settings?.customAvatarTs) || 0;\n"
    "  if (ts) return avatarUrl(currentSaveSlot(), ts);\n"
    "  // 内置头像预设（本地 data URL，无需联网，绝不会 404/报错）\n"
    "  // 兼容旧档中文键「头像预设」\n"
    "  const preset = st?.settings?.avatarPreset || st?.settings?.['头像预设'];\n"
    "  if (preset) {\n"
    "    const url = builtInAvatarDataUrl(preset);\n"
    "    if (url) return url;\n"
    "  }\n"
    "  return null;\n"
    "}\n"
    "\n"
    "/** 当前存档槽（与设置面板同口径），取不到时回落 '1' */\n"
    "function currentSaveSlot() {\n"
    "  return (window.__save?.getSaveSlot) ? window.__save.getSaveSlot() : '1';\n"
    "}"
)
ui = rep(ui, old2, new2, 'ui.js: resolveAvatarUrl 支持自定义')

# 3) renderHeroAvatar 加载失败兜底（自定义图片被手动删掉时回落默认框，不留破图）
old3 = "  box.innerHTML = url ? `<img class=\"hero-avatar-img\" src=\"${url}\" alt=\"头像\">` : defaultAvatarSvg();"
new3 = (
    "  // onerror 兜底：自定义头像文件被手动删除时会 404，此时隐藏破图、露出头像框底色，\n"
    "  // 玩家可在设置页点「移除自定义头像」彻底回落。\n"
    "  box.innerHTML = url\n"
    "    ? `<img class=\"hero-avatar-img\" src=\"${url}\" alt=\"头像\" onerror=\"this.style.display='none'\">`\n"
    "    : defaultAvatarSvg();"
)
ui = rep(ui, old3, new3, 'ui.js: 头像加载失败兜底')

# 4) 设置面板加上传/移除入口
old4 = (
    "      ${builtInAvatarGridHTML(settings.avatarPreset)}\n"
)
new4 = (
    "      ${builtInAvatarGridHTML(settings.avatarPreset)}\n"
    "\n"
    "      <div class=\"modal-actions col\">\n"
    "        <button class=\"btn\" id=\"btn-upload-avatar\">上传自定义头像（PNG / JPG，≤2MB）</button>\n"
    "        <button class=\"btn ${hasCustomAvatar ? 'btn-unequip' : 'btn-dim'}\" id=\"btn-remove-avatar\" ${hasCustomAvatar ? '' : 'disabled'}>${hasCustomAvatar ? '移除自定义头像' : '未使用自定义头像'}</button>\n"
    "      </div>\n"
    "      <input type=\"file\" id=\"avatar-file-input\" accept=\"image/png,image/jpeg\" hidden>\n"
    "      <div class=\"opt-desc\">自定义头像保存在 存档 / ${slot} / 头像.png，随存档目录整体迁移；上传后优先于内置头像显示，移除后自动回落。</div>\n"
)
ui = rep(ui, old4, new4, 'ui.js: 设置面板头像上传入口')

# 4b) 面板内常量 hasCustomAvatar
old5 = "  const slot = (window.__save?.getSaveSlot) ? window.__save.getSaveSlot() : '1';\n"
new5 = (
    "  const slot = (window.__save?.getSaveSlot) ? window.__save.getSaveSlot() : '1';\n"
    "  const hasCustomAvatar = (Number(settings.customAvatarTs) || 0) > 0;\n"
)
ui = rep(ui, old5, new5, 'ui.js: hasCustomAvatar 常量')

# 4c) 事件绑定（挂在「立即存档」按钮绑定之前）
old6 = "  box.querySelector('#btn-manual-save').addEventListener('click', () => saveNow());"
new6 = (
    "  // 自定义头像：上传前做类型/体积校验（与服务端限制一致），成功后写入时间戳并落盘\n"
    "  const avatarInput = box.querySelector('#avatar-file-input');\n"
    "  box.querySelector('#btn-upload-avatar').addEventListener('click', () => avatarInput?.click());\n"
    "  avatarInput?.addEventListener('change', async () => {\n"
    "    const file = avatarInput.files && avatarInput.files[0];\n"
    "    if (!file) return;\n"
    "    if (!/^image\\/(png|jpeg)$/.test(file.type)) { toast('仅支持 PNG / JPG 图片。', 'warn'); avatarInput.value = ''; return; }\n"
    "    if (file.size > 2 * 1024 * 1024) { toast('图片需小于 2MB。', 'warn'); avatarInput.value = ''; return; }\n"
    "    try {\n"
    "      await uploadAvatar(file, slot);\n"
    "      st.settings.customAvatarTs = Date.now();\n"
    "      toast('自定义头像已更新。', 'gold');\n"
    "      renderAll();\n"
    "      renderSidePanel();\n"
    "      saveNow();\n"
    "    } catch (e) {\n"
    "      toast(`头像上传失败：${e && e.message ? e.message : e}`, 'warn');\n"
    "    }\n"
    "    avatarInput.value = '';\n"
    "  });\n"
    "  box.querySelector('#btn-remove-avatar').addEventListener('click', async () => {\n"
    "    if (!hasCustomAvatar) return;\n"
    "    if (!(await confirmModal('确定移除自定义头像？将回落到所选内置头像。', '移除', '取消'))) return;\n"
    "    try { await removeAvatar(slot); } catch {}\n"
    "    st.settings.customAvatarTs = 0;\n"
    "    toast('已移除自定义头像。', 'info');\n"
    "    renderAll();\n"
    "    renderSidePanel();\n"
    "    saveNow();\n"
    "  });\n"
    "  box.querySelector('#btn-manual-save').addEventListener('click', () => saveNow());"
)
ui = rep(ui, old6, new6, 'ui.js: 头像上传/移除事件')

write(UI, ui)

# ---------------- save.js：设置白名单持久化 customAvatarTs ----------------
sv = read(SAVE)
sv = rep(sv,
         "        avatarPreset: state.settings.avatarPreset || '',",
         "        avatarPreset: state.settings.avatarPreset || '',\n"
         "        // 自定义头像时间戳（0=未使用）；不写入则刷新页面后自定义头像消失\n"
         "        customAvatarTs: Number(state.settings.customAvatarTs) || 0,",
         'save.js: 设置白名单补 customAvatarTs')
write(SAVE, sv)

print('\n全部补丁应用完成。')
