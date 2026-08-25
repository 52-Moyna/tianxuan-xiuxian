/**
 * ui.js —— 界面渲染与交互模块
 * ============================================================
 * 职责：全部 DOM 渲染、动画、弹窗、界面流转。
 * 不直接修改游戏数值，一切数值变更经由 systems.js 完成。
 *
 * 界面结构：
 *   screen-title   标题界面（新的仙途 / 继续仙途）
 *   screen-create  角色创建向导（七步）
 *   screen-game    主界面（状态栏 / 决策罗盘 / 天机简报 / 侧栏页签）
 *
 * 【扩展点】新增界面时在 SCREENS 登记，并用 switchScreen() 切换；
 *   新增弹窗类型时在 openModal() 的渲染分支中登记。
 */

import * as D from './data.js';
import * as S from './systems.js';
import * as CX from './codex.js';
import { GameState, bus, Rng } from './state.js';
import { saveGame, serialize } from './save.js';
import { listSlots, setSaveSlot, getSaveSlot, deleteSlot, checkSaveExists, listBackups, restoreBackup } from './save.js';
import { ensureLifeState, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, relationBenefit, relationIndex, startTravel, upgradeBag, craftRecipe, inventoryUsed, organizeBag, gardenCapacity, herbQuality, plantHerb, harvestHerb, irrigateHerb, crossbreedHerbs, HERB_IRRIGATE_COST, HERB_IRRIGATE_CAP_PER_MONTH, herbSpringBonus, HERB_IRRIGATE_YIELD_CAP, omenActive, refinePill, isRecipeUnlocked, alchemySlots } from './life.js';
import { EQUIP_SLOTS } from './data.js';

// 品阶 / 好感颜色集中管理：避免在多处渲染重复硬编码与散落的 EQUIP_GRADES 查找
function gradeColor(item) {
  if (!item) return '';
  const g = (typeof item.品阶 === 'string') ? D.getEquipGrade(item.品阶) : null;
  if (g) return g.color;
  // 兜底：个别旧数据可能直接存中文名
  return D.EQUIP_GRADES.find((x) => x.name === item.品阶)?.color || '#d8b15a';
}
// 品阶中文名取用（O(1)，优先按 id 索引）
function gradeName(id) {
  if (!id) return '';
  return D.getEquipGrade(id)?.name || id;
}
function favorColor(f) {
  return f >= 80 ? '#d8b15a' : f >= 50 ? '#7fb3d5' : f >= 20 ? '#8fbf9f' : '#9aa0a8';
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const THEME_KEY = 'tianxuan-theme';
let currentTheme = 'dark';
const LAYOUT_KEY = 'tianxuan-layout';
const DEFAULT_LAYOUT = { left: 292, right: 330 };

// 内置头像：6 种仙侠风格 SVG，以 data URL 提供
// 2026-08-19 视觉升级（二）：去除黑底，改为多彩径向渐变底 + 白/金描线，按角色配色。
// sword=青金(青底金线) / dao=青白(青底白线) / fox=粉橙 / lotus=金粉 / shadow=紫红 / cloud=蓝青。
const BUILT_IN_AVATARS = [
  { id: 'sword', name: '剑修', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="bg1" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#7fd6c4"/><stop offset="1" stop-color="#14806f"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#bg1)" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.5"/><g fill="none" stroke="#ffe08a" stroke-linecap="round" stroke-width="2.2"><path d="M32 12v36"/><path d="M26 22l6-8 6 8"/><path d="M22 42c4-6 16-6 20 0"/></g><circle cx="32" cy="48" r="2.5" fill="#ffe08a"/></svg>` },
  { id: 'dao', name: '道人', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="bg2" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#aee3df"/><stop offset="1" stop-color="#2f8f99"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#bg2)" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.5"/><g fill="none" stroke="#ffffff" stroke-linejoin="round" stroke-linecap="round" stroke-width="2"><path d="M24 20h16l-4 8H28z"/><circle cx="32" cy="36" r="7"/><path d="M22 48c0-8 20-8 20 0"/><path d="M32 20v-6"/></g></svg>` },
  { id: 'fox', name: '狐仙', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="bg3" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#ffc6a8"/><stop offset="1" stop-color="#ef7a3c"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#bg3)" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.5"/><path d="M18 20l10 14-6 4zM46 20l-10 14 6 4z" fill="#ffffff" opacity=".9"/><circle cx="26" cy="40" r="2" fill="#ffffff"/><circle cx="38" cy="40" r="2" fill="#ffffff"/><path d="M30 47q2 3 4 0" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/><circle cx="32" cy="28" r="3" fill="#ffffff"/></svg>` },
  { id: 'lotus', name: '莲心', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="bg4" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#ffe2a8"/><stop offset="1" stop-color="#ec8fb0"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#bg4)" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.5"/><g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"><path d="M32 44V28"/><path d="M32 28c-6-8-12-4-10 2s8 8 10 6c2 2 8 0 10-6s-4-10-10-2z"/></g><circle cx="32" cy="30" r="3.5" fill="#ffffff"/></svg>` },
  { id: 'shadow', name: '魔修', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="bg5" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#e0a8dc"/><stop offset="1" stop-color="#9c2f63"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#bg5)" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.5"/><g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"><path d="M20 24c4-4 20-4 24 0"/><path d="M28 46c2-3 6-3 8 0"/><path d="M16 18l6 6M42 24l6-6"/></g><circle cx="24" cy="34" r="3" fill="#ffffff"/><circle cx="40" cy="34" r="3" fill="#ffffff"/></svg>` },
  { id: 'cloud', name: '云游', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="bg6" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#a9d2f0"/><stop offset="1" stop-color="#2f7fb0"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#bg6)" stroke="#ffffff" stroke-opacity=".75" stroke-width="1.5"/><g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 38c3-10 13-6 16-12 3 6 13 2 16 12-2 8-12 8-16 6-4 2-14 2-16-6z"/><path d="M32 24v-8M28 20h8"/></g><circle cx="24" cy="42" r="2" fill="#ffffff" opacity=".85"/><circle cx="40" cy="42" r="2" fill="#ffffff" opacity=".85"/></svg>` },
];
function builtInAvatarDataUrl(id) {
  const item = BUILT_IN_AVATARS.find((a) => a.id === id);
  if (!item) return null;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(item.svg)))}`;
}

export function initTheme() {
  const storage = window.localStorage;
  const saved = storage?.getItem(THEME_KEY);
  const systemLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  currentTheme = saved || (systemLight ? 'light' : 'dark');
  applyTheme();
}

function applyTheme() {
  document.documentElement.dataset.theme = currentTheme;
  const text = currentTheme === 'dark' ? '切换日间' : '切换夜间';
  const lbl = $('#btn-theme-label');
  if (lbl) lbl.textContent = text;
  const t = $('#btn-theme-title');
  if (t) t.textContent = text;
}

function applyUiSettings(settings = {}) {
  document.documentElement.dataset.textSize = settings.textSize || 'normal';
  document.documentElement.classList.toggle('reduce-motion', settings.animations === false);
}

/* ---------------- 点击特效（水波/光晕） ---------------- */
let clickFxBound = false;
export function initClickFx() {
  if (clickFxBound) return;
  clickFxBound = true;
  const SELECTOR = 'button, .side-tab, .compass-item, .item-row, .npc-row, .shop-item, .route-row, .avatar-preset, .codex-filter, .log-filter, .recipe-row, .beast-slot, .sect-task, .art-block, .modal-actions button, .text-btn';
  document.addEventListener('click', (e) => {
    const st = GameState.data;
    if (!st || st.settings?.clickFx === false) return;
    if (document.documentElement.classList.contains('reduce-motion')) return;
    const el = e.target.closest(SELECTOR);
    if (!el || el.classList.contains('acted') || el.disabled) return;
    spawnRipple(e.clientX, e.clientY);
  }, true);

  // 键盘快捷键：数字键 1-9 / 0 选择决策罗盘选项（仅在仙途页、无弹窗、未聚焦输入框时生效）
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const root = $('#modal-root');
    if (root && !root.classList.contains('hidden')) return; // 弹窗开启时不抢占按键
    const st = GameState.data;
    if (!st || sideTab !== 'destiny') return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    if (!/^[0-9]$/.test(e.key)) return;
    const idx = e.key === '0' ? 9 : Number(e.key) - 1;
    const items = [...document.querySelectorAll('#compass-list .compass-item')].filter((el) => !el.classList.contains('acted'));
    const item = items[idx];
    if (item) { e.preventDefault(); item.click(); }
  });
}

/**
 * 键盘可达性增强：为「真实可点击的 <div>」（决策罗盘项 / 创建向导选项）补 role=button + tabindex=0，
 * 并支持 Enter/Space 触发其已绑定的 click。
 * 说明：其余「卡片」(.npc-card/.item-row/.achv-card/地域卡等) 均为展示容器，交互在内部原生 <button> 上，本就可达，
 * 故不在此处处理，避免把非交互元素误标成按钮（反而损害 a11y）。
 */
let a11yBound = false;
export function initA11y() {
  if (a11yBound) return;
  a11yBound = true;
  // 测试环境（jsdom）可能未实现 MutationObserver，直接跳过，不影响功能
  if (typeof MutationObserver === 'undefined') return;
  const CLICKABLE = '.compass-item, .opt-card';
  const enhance = (el) => {
    if (el.hasAttribute('role')) return;
    el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  };
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches?.(CLICKABLE)) enhance(n);
        n.querySelectorAll?.(CLICKABLE).forEach(enhance);
      });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  // 键盘激活：聚焦到可点击 div 时，Enter/Space 触发其已绑定的 click（Space 阻止页面滚动）
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = document.activeElement;
    if (!el || !el.matches?.(CLICKABLE)) return;
    e.preventDefault();
    el.click();
  });
}
function spawnRipple(x, y) {
  const ripple = document.createElement('span');
  ripple.className = 'click-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
}

function applyLayout(layout) {
  const value = { ...DEFAULT_LAYOUT, ...(layout || {}) };
  document.documentElement.style.setProperty('--status-width', `${value.left}px`);
  document.documentElement.style.setProperty('--side-width', `${value.right}px`);
}

function loadLayout() {
  try { return JSON.parse(window.localStorage?.getItem(LAYOUT_KEY) || 'null') || DEFAULT_LAYOUT; } catch { return DEFAULT_LAYOUT; }
}

function saveLayout(layout) { window.localStorage?.setItem(LAYOUT_KEY, JSON.stringify(layout)); }

function resetLayout() { applyLayout(DEFAULT_LAYOUT); saveLayout(DEFAULT_LAYOUT); }

function initLayoutResizers() {
  applyLayout(loadLayout());
  $$('.layout-splitter').forEach((splitter) => {
    splitter.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      splitter.setPointerCapture?.(event.pointerId);
      const startX = event.clientX;
      const computed = getComputedStyle(document.documentElement);
      const current = { left: parseInt(computed.getPropertyValue('--status-width')) || DEFAULT_LAYOUT.left, right: parseInt(computed.getPropertyValue('--side-width')) || DEFAULT_LAYOUT.right };
      const side = splitter.dataset.side;
      const move = (e) => {
        const delta = e.clientX - startX;
        const next = { ...current };
        if (side === 'left') next.left = Math.max(230, Math.min(430, current.left + delta));
        else next.right = Math.max(260, Math.min(460, current.right - delta));
        applyLayout(next);
      };
      const up = () => { const computedNow = getComputedStyle(document.documentElement); saveLayout({ left: parseInt(computedNow.getPropertyValue('--status-width')) || DEFAULT_LAYOUT.left, right: parseInt(computedNow.getPropertyValue('--side-width')) || DEFAULT_LAYOUT.right }); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
    });
  });
}

export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  window.localStorage?.setItem(THEME_KEY, currentTheme);
  applyTheme();
  // 限时挂上过渡类，让明暗切换平滑淡入，随后移除以免拖累日常渲染
  const root = document.documentElement;
  root.classList.add('theme-anim');
  setTimeout(() => root.classList.remove('theme-anim'), 420);
  toast(currentTheme === 'dark' ? '已切换为夜间主题' : '已切换为日间主题', 'gold');
}

/* ============================================================
 * 界面切换（带平滑过渡动画）
 * ========================================================== */
export function switchScreen(id) {
  $$('.screen').forEach((el) => {
    if (el.id === id) {
      el.classList.remove('hidden');
      requestAnimationFrame(() => el.classList.add('active'));
    } else {
      el.classList.remove('active');
      setTimeout(() => el.classList.add('hidden'), 450);
    }
  });
}

/* ============================================================
 * 轻提示 Toast
 * ========================================================== */
export function toast(text, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = text;
  $('#toast-root').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2600);
}

/* ============================================================
 * 通用弹窗
 * 注意：弹窗连续切换时（如战斗窗→结算窗），旧弹窗的延时清理
 * 绝不能误删新弹窗 —— 用「代际号 + 清理定时器」保证只清理自己那一代。
 * ========================================================== */
let modalGen = 0;        // 弹窗代际号，每开一个 +1
let modalCleanup = null; // 待执行的清理定时器

function openModal(html, opts = {}) {
  modalGen += 1;
  if (modalCleanup) { clearTimeout(modalCleanup); modalCleanup = null; } // 取消上一代遗留清理
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-mask"></div>
    <div class="modal ${opts.cls || ''}" role="dialog">
      ${opts.title ? `<div class="modal-title">${opts.title}</div>` : ''}
      <div class="modal-body">${html}</div>
    </div>`;
  root.classList.remove('hidden');
  requestAnimationFrame(() => root.classList.add('show'));
  const mask = root.querySelector('.modal-mask');
  if (!opts.lock) mask.addEventListener('click', closeModal);
  return root.querySelector('.modal');
}
function closeModal() {
  const gen = modalGen;
  const root = $('#modal-root');
  root.classList.remove('show');
  modalCleanup = setTimeout(() => {
    // 只有当期间没有新弹窗打开时，才执行隐藏与清空
    if (gen === modalGen) { root.classList.add('hidden'); root.innerHTML = ''; }
    modalCleanup = null;
  }, 350);
}
/** Promise 版确认框 */
function confirmModal(text, okText = '确定', cancelText = '取消') {
  return new Promise((resolve) => {
    const m = openModal(`
      <p class="modal-text">${text}</p>
      <div class="modal-actions">
        <button class="btn btn-gold" data-v="1">${okText}</button>
        <button class="btn" data-v="0">${cancelText}</button>
      </div>`, { lock: true });
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      closeModal(); resolve(b.dataset.v === '1');
    }));
  });
}

/* 编辑角色信息（名字/道号/签名） */
function editProfileModal() {
  const st = GameState.data;
  const p = st.player;
  const m = openModal(`
    <div class="edit-profile">
      <div class="ep-field">
        <label class="ep-label">角色名称</label>
        <input class="ep-input" id="ep-name" value="${p.name}" maxlength="8" placeholder="你的修真之名">
        <span class="ep-hint">2~8字，显示在头像下方</span>
      </div>
      <div class="ep-field">
        <label class="ep-label">道号</label>
        <input class="ep-input" id="ep-title" value="${p.title || ''}" maxlength="12" placeholder="如「青云子」「无尘客」">
        <span class="ep-hint">他人对你的尊称，留空则用境界自动生成</span>
      </div>
      <div class="ep-field">
        <label class="ep-label">自定义道号</label>
        <input class="ep-input" id="ep-dao-title" value="${p.daoTitle || ''}" maxlength="30" placeholder="自拟道号，彰显个性">
        <span class="ep-hint">30字内，替代系统生成的道号显示</span>
      </div>
      <div class="ep-field">
        <label class="ep-label">个性签名</label>
        <textarea class="ep-textarea" id="ep-signature" maxlength="30" placeholder="写下一句话，让同道记住你...">${p.signature || ''}</textarea>
        <span class="ep-hint"><span id="ep-sig-count">${(p.signature || '').length}</span>/30 字</span>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="ep-cancel">取消</button>
      <button class="btn btn-gold" id="ep-save">保存</button>
    </div>`, { title: '✏️ 编辑角色信息', lock: true, cls: 'modal-lg' });

  // 签名字数实时计数
  const sigInput = m.querySelector('#ep-signature');
  const sigCount = m.querySelector('#ep-sig-count');
  sigInput.addEventListener('input', () => { sigCount.textContent = sigInput.value.length; });

  m.querySelector('#ep-cancel').addEventListener('click', () => closeModal());
  m.querySelector('#ep-save').addEventListener('click', () => {
    const name = m.querySelector('#ep-name').value.trim();
    const title = m.querySelector('#ep-title').value.trim();
    const daoTitle = m.querySelector('#ep-dao-title').value.trim().slice(0, 30);
    const signature = m.querySelector('#ep-signature').value.trim().slice(0, 30);
    if (!name) { toast('角色名不能为空', 'danger'); return; }
    if (name.length < 2) { toast('角色名至少2个字', 'danger'); return; }
    p.name = name;
    p.title = title;
    p.daoTitle = daoTitle;
    p.signature = signature;
    // 更新显示
    $('#st-name').textContent = name;
    closeModal();
    renderAll();
    saveNow();
    toast('角色信息已更新', 'gold');
  });
}

/* ============================================================
 * 标题界面
 * ========================================================== */
export function renderTitle(hasSave) {
  $('#btn-continue').classList.toggle('hidden', !hasSave);
  switchScreen('screen-title');
  renderSlotPicker();
}

/** 标题页：多存档槽选择 */
async function renderSlotPicker() {
  const listBox = $('#slot-list');
  if (!listBox) return;
  const slots = await listSlots();
  const current = getSaveSlot();
  if (!slots.length) {
    listBox.innerHTML = `<div class="slot-empty">尚未开启任何仙途。</div>`;
    return;
  }
  // 附带各槽历史备份数量（备份数不多，并发查询开销极小）
  const enriched = await Promise.all(slots.map(async (s) => {
    let backups = [];
    try { backups = await listBackups(s.slot); } catch { backups = []; }
    return { ...s, backups };
  }));
  listBox.innerHTML = enriched.map((s) => `
    <button class="slot-card ${String(s.slot) === String(current) ? 'on' : ''}" data-slot="${s.slot}">
      <div class="slot-avatar">${slotAvatarHTML(s)}</div>
      <div class="slot-info">
        <div class="slot-name">存档 ${s.slot}${String(s.slot) === String(current) ? ' · 使用中' : ''}</div>
        <div class="slot-sub">${s.hasSave ? `${s.name || '无名'} ｜ ${s.realm || ''} ｜ ${s.age || ''}岁` : '（空）'}</div>
        ${s.savedTime ? `<div class="slot-time">${s.savedTime}</div>` : ''}
        ${s.backups && s.backups.length ? `<div class="slot-backup">🗄 历史备份 ${s.backups.length} 份</div>` : ''}
      </div>
      <div class="slot-ops">
        ${s.hasSave ? `<span class="slot-play">进入 ▶</span>` : `<span class="slot-play muted">新建</span>`}
        ${s.backups && s.backups.length ? `<span class="slot-restore" data-restore="${s.slot}">还原</span>` : ''}
        <span class="slot-del" data-del="${s.slot}" title="删除该存档">✕</span>
      </div>
    </button>`).join('');

  listBox.querySelectorAll('.slot-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.slot-del') || e.target.closest('.slot-restore')) return; // 删除/还原单独处理
      chooseSlot(card.dataset.slot);
    });
  });
  listBox.querySelectorAll('.slot-del').forEach((d) => d.addEventListener('click', async (e) => {
    e.stopPropagation();
    const slot = d.dataset.del;
    if (await confirmModal(`确定删除「存档 ${slot}」？此操作将移入历史备份，可手动恢复。`, '删除', '取消')) {
      await deleteSlot(slot);
      toast(`存档 ${slot} 已删除`, 'gold');
      renderSlotPicker();
    }
  }));
  listBox.querySelectorAll('.slot-restore').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    openRestoreModal(b.dataset.restore);
  }));
}

/** 历史备份还原弹窗：列出某槽全部历史备份，玩家择一还原 */
async function openRestoreModal(slot) {
  let backups = [];
  try { backups = await listBackups(slot); } catch { backups = []; }
  if (!backups.length) { toast('该存档暂无历史备份', 'warn'); return; }
  const fmt = (stamp) => {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp || '');
    return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : (stamp || '');
  };
  const m = openModal(`
    <div class="modal-title">存档 ${slot} · 历史备份还原</div>
    <div class="modal-intro">选择一份历史备份还原；当前进度会先自动滚入新备份，不会丢失。</div>
    <div class="backup-list">
      ${backups.map((b) => `
        <div class="backup-row" data-backup="${b.name}">
          <span class="backup-time">${fmt(b.stamp)}</span>
          <span class="backup-act">还原</span>
        </div>`).join('')}
    </div>
  `, { title: '历史备份', lock: true });
  m.querySelectorAll('.backup-row').forEach((row) => row.addEventListener('click', async () => {
    const name = row.dataset.backup;
    if (!(await confirmModal('确定还原到该历史备份？当前进度将自动备份。', '还原', '取消'))) return;
    closeModal();
    const okRestore = await restoreBackup(slot, name);
    toast(okRestore ? '已还原至所选历史备份' : '还原失败', okRestore ? 'gold' : 'warn');
    renderSlotPicker();
  }));
}

function slotAvatarHTML(s) {
  // 使用 slots 摘要里的内置头像预设（服务端从 设置.ini 读出），避免 /api/avatar 404 与转义问题
  const preset = s?.avatarPreset;
  const url = preset ? builtInAvatarDataUrl(preset) : null;
  if (url) return `<img src="${url}" alt="">`;
  return defaultAvatarSvg();
}

/** 选定存档槽：设置当前槽并刷新标题页按钮状态 */
async function chooseSlot(slot) {
  setSaveSlot(slot);
  const has = await checkSaveExists(slot);
  $('#btn-continue').classList.toggle('hidden', !has);
  $('#btn-new').querySelector('.ma-text b').textContent = has ? '重开新仙途' : '开启新仙途';
  $('#btn-new').querySelector('.ma-text i').textContent = has ? '将覆盖本存档，从凡人重来' : '从一介凡人，问道长生';
  renderSlotPicker();
}

export async function backToTitle() {
  const hasChoices = WIZARD.step > 0 || WIZARD.picks.name;
  if (hasChoices && !await confirmModal('返回标题会放弃本次尚未完成的角色选择。', '返回标题', '继续创建')) return;
  switchScreen('screen-title');
}

export function showBeginnerGuide() {
  const m = openModal(`
    <div class="guide-steps">
      <div><b>1. 看目标</b><span>先看主界面黄色引导条，它会告诉你当前最重要的事。</span></div>
      <div><b>2. 选一件事</b><span>每月只能完成一个主要行动。推荐行动适合新手，其他分类可自由探索。</span></div>
      <div><b>3. 读结果</b><span>月末结算会列出获得、损失和状态变化，然后自动存档。</span></div>
      <div><b>4. 逐步变强</b><span>修炼提升等级，突破跨越境界，历练获取材料，道缘和百艺提供长期收益。</span></div>
    </div>
    <div class="guide-note">
      <h4>⚑ 两条核心规则</h4>
      <ul>
        <li><b>每月只能推进一件事。</b>选定任一行动后，本月即标记「已行动」，需等到月末结算、进入下月才能再选；重复点击已行动项会提示「本月已行动」。</li>
        <li><b>确认不等于执行。</b>闭关 / 研读 / 拜访等属于「轻量确认」，点「继续行动」才会真正执行并消耗本月行动；提交前都可反悔，不必担心误操作。</li>
      </ul>
    </div>
    <div class="modal-actions"><button class="btn btn-gold" id="btn-guide-ok">我明白了</button></div>`,
    { title: '新手玩法说明', lock: true, cls: 'modal-lg' });
  m.querySelector('#btn-guide-ok').addEventListener('click', closeModal);
}

/* ============================================================
 * 角色创建向导
 * ========================================================== */
const WIZARD = { step: 0, picks: {}, maxReroll: 2 };

const WIZARD_STEPS = [
  {
    key: 'base', title: '道友如何称呼？',
    render() {
      return `
        <div class="form-row"><label>姓名</label><input id="wiz-name" maxlength="8" placeholder="请输入姓名（2-8字）" value="${WIZARD.picks.name || ''}"></div>
        <div class="form-row"><label>性别</label>
          <div class="seg">
            <button class="seg-btn ${WIZARD.picks.gender === '男' ? 'on' : ''}" data-g="男">男</button>
            <button class="seg-btn ${WIZARD.picks.gender === '女' ? 'on' : ''}" data-g="女">女</button>
          </div>
        </div>`;
    },
    bind(box) {
      box.querySelector('#wiz-name').addEventListener('input', (e) => { WIZARD.picks.name = e.target.value.trim(); });
      box.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => {
        WIZARD.picks.gender = b.dataset.g;
        box.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b));
      }));
    },
    valid() { return (WIZARD.picks.name || '').length >= 1 && WIZARD.picks.gender; },
  },
  {
    key: 'race', title: '选择种族',
    options: () => D.RACES.map((r) => ({ id: r.id, name: r.name, desc: r.desc })),
  },
  {
    key: 'age', title: '选择年岁',
    options: () => D.AGE_GROUPS.map((a) => ({ id: a.id, name: a.name, desc: a.desc })),
  },
  {
    key: 'region', title: '选择出生地',
    options: () => D.REGIONS.map((r) => ({ id: r.id, name: r.name, desc: r.desc })),
  },
  {
    key: 'pack', title: '选择开局资产包（绑定天命主线）',
    options: () => D.START_PACKS.map((p) => ({ id: p.id, name: `${'①②③④⑤⑥⑦⑧⑨⑩'[p.id - 1]} ${p.name}`, desc: `资产：${p.items.join('、')}＋灵石${p.stones}枚<br>天命：${p.line}` })),
  },
  { key: 'root', title: '灵根觉醒（天命随机）' },
  { key: 'confirm', title: '仙途总览' },
];

export function startCreation(inherit) {
  WIZARD.step = 0;
  WIZARD.picks = { gender: '男' };
  WIZARD.inherit = inherit || null;
  WIZARD.rerollLeft = 2;
  renderWizard();
  switchScreen('screen-create');
}

function renderWizard() {
  const st = WIZARD_STEPS[WIZARD.step];
  const box = $('#create-body');
  $('#create-progress').textContent = `第 ${WIZARD.step + 1} / ${WIZARD_STEPS.length} 步`;
  $('#create-title').textContent = st.title;

  let html = '';
  if (st.options) {
    html = `<div class="opt-grid">` + st.options().map((o) => `
      <div class="opt-card ${WIZARD.picks[st.key] === o.id ? 'on' : ''}" data-id="${o.id}">
        <div class="opt-name">${o.name}</div>
        <div class="opt-desc">${o.desc}</div>
      </div>`).join('') + `</div>`;
  } else if (st.key === 'base') {
    html = st.render();
  } else if (st.key === 'root') {
    const r = WIZARD.picks.spiritRoot;
    html = `
      <div class="root-stage">
        <div id="root-orb" class="root-orb ${r ? 'awakened' : ''}"><span class="root-orb-ring"></span><span class="root-orb-text">${r ? r.grade : '？'}</span></div>
        ${r ? `<div class="root-info fade-in">
          <div class="root-grade">${r.grade}灵根 · ${r.elements.join('、')}系</div>
          <div class="opt-desc">${r.desc}</div>
          <div class="opt-desc">修炼速度：×${r.speed}</div>
        </div>` : '<div class="opt-desc">天地灵根，尚未觉醒。点击下方法阵，测你仙缘。</div>'}
        <div class="modal-actions">
          <button id="btn-roll-root" class="btn btn-gold">${r ? `重新觉醒（剩${WIZARD.rerollLeft}次）` : '觉醒灵根'}</button>
        </div>
      </div>`;
  } else if (st.key === 'confirm') {
    const p = WIZARD.picks;
    const race = D.RACES.find((x) => x.id === p.race);
    const age = D.AGE_GROUPS.find((x) => x.id === p.age);
    const region = D.REGIONS.find((x) => x.id === p.region);
    const pack = D.START_PACKS.find((x) => x.id === p.pack);
    const row = (k, v) => `<div class="sum-row"><span>${k}</span><b>${v}</b></div>`;
    html = `<div class="summary fade-in">
      ${row('姓名', `${p.name}（${p.gender}）`)}
      ${row('种族', race.name)}
      ${row('年岁', age.name)}
      ${row('出生地', region.name)}
      ${row('开局', `${pack.name} → 天命【${D.DESTINY_LINES[pack.destiny].name}】`)}
      ${row('道韵', '未觉醒（修行机缘中可觉醒）')}
      ${row('灵根', `${p.spiritRoot.grade} · ${p.spiritRoot.elements.join('、')}系 · 速度×${p.spiritRoot.speed}`)}
      ${WIZARD.inherit ? row('前世遗泽', '灵石半数、道基三成、主修功法将随你转世') : ''}
    </div>`;
  }

  box.innerHTML = html;
  box.classList.remove('fade-step'); void box.offsetWidth; box.classList.add('fade-step');

  // 绑定
  if (st.bind) st.bind(box);
  if (st.options) {
    box.querySelectorAll('.opt-card').forEach((c) => c.addEventListener('click', () => {
      WIZARD.picks[st.key] = c.dataset.id;
      if (st.key === 'pack') WIZARD.picks[st.key] = Number(c.dataset.id);
      box.querySelectorAll('.opt-card').forEach((x) => x.classList.toggle('on', x === c));
    }));
  }
  if (st.key === 'root') {
    box.querySelector('#btn-roll-root').addEventListener('click', () => {
      if (WIZARD.picks.spiritRoot && WIZARD.rerollLeft <= 0) { toast('仙缘已定，不可再改', 'warn'); return; }
      if (WIZARD.picks.spiritRoot) WIZARD.rerollLeft -= 1;
      const orb = box.querySelector('#root-orb');
      orb.classList.add('rolling');
      let n = 0;
      const timer = setInterval(() => {
        orb.textContent = Rng.pick(D.SPIRIT_ROOTS).name;
        if (++n > 12) {
          clearInterval(timer);
          orb.classList.remove('rolling');
          WIZARD.picks.spiritRoot = S.rollSpiritRoot();
          renderWizard();
        }
      }, 90);
    });
  }

  $('#btn-prev').classList.toggle('hidden', WIZARD.step === 0);
  $('#btn-next').textContent = WIZARD.step === WIZARD_STEPS.length - 1 ? '踏入仙途 ➤' : '下一步';
}

export function wizardNext() {
  const st = WIZARD_STEPS[WIZARD.step];
  if (st.valid && !st.valid()) { toast('请先完善本步信息', 'warn'); return; }
  if (st.options && WIZARD.picks[st.key] === undefined) { toast('请先做出选择', 'warn'); return; }
  if (st.key === 'root' && !WIZARD.picks.spiritRoot) { toast('请先觉醒灵根', 'warn'); return; }
  if (WIZARD.step < WIZARD_STEPS.length - 1) { WIZARD.step += 1; renderWizard(); return; }
  // 完成创建（向导键名 -> 系统入参键名映射）
  const state = S.createNewGame({
    name: WIZARD.picks.name,
    gender: WIZARD.picks.gender,
    raceId: WIZARD.picks.race,
    ageId: WIZARD.picks.age,
    regionId: WIZARD.picks.region,
    packId: WIZARD.picks.pack,
    spiritRoot: WIZARD.picks.spiritRoot,
  });
  if (WIZARD.inherit) {
    S.addStones(state, WIZARD.inherit.stones);
    for (const [k, lv] of Object.entries(WIZARD.inherit.daoBase)) {
      if (state.player.daoBase[k]) state.player.daoBase[k].level += lv;
    }
    if (WIZARD.inherit.tech) state.techniques.push({ ...WIZARD.inherit.tech });
    S.refreshDerived(state);
    toast('前世遗泽已随你转世', 'gold');
  }
  GameState.setData(state);
  enterGame(true);
}
export function wizardPrev() {
  if (WIZARD.step > 0) { WIZARD.step -= 1; renderWizard(); }
}

/* ============================================================
 * 主界面渲染
 * ========================================================== */
export function enterGame(isNew = false) {
  ensureLifeState(GameState.data);
  applyUiSettings(GameState.data.settings);
  applyWindowSize(GameState.data.settings.windowSize);
  initLayoutResizers();
  switchScreen('screen-game');
  const ach0 = CX.checkAchievements(GameState.data);
  ach0.forEach((a) => renderAchievementToast(a));
  renderAll();
  if (isNew) {
    pushLog(`天玄历${GameState.world.year}年，${GameState.player.name}于${GameState.world.region}踏上仙途。`, 'gold');
    // 道韵改为修行中逐步觉醒（#42）：起步未觉醒时不写「觉醒」日志
    if (GameState.player.daoYun?.id && GameState.player.daoYun.id !== 'none') {
      pushLog(`先天道韵「${GameState.player.daoYun.name}」觉醒，天命主线【${GameState.data.destiny.lineName}】就此展开。`, 'gold');
    }
    saveNow(true);
  }
  refreshCompass();
  renderNews();
}

/** 大数格式化：≥1万显示「x.x万」，≥1亿显示「x.x亿」，提升后期可读性 */
function fmtBig(n) {
  n = Number(n) || 0;
  if (n >= 1e8) {
    const v = n / 1e8;
    return (Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')) + '亿';
  }
  if (n >= 1e4) {
    const v = n / 1e4;
    return (Number.isInteger(v) ? v : v.toFixed(1).replace(/\.0$/, '')) + '万';
  }
  return String(n);
}

// 成就进度等通用数字分组（千分位），避免科学计数法
function formatNum(n) {
  n = Number(n) || 0;
  return Math.round(n).toLocaleString('zh-CN');
}

function fmtStonesShort() {
  const c = GameState.data.currencies;
  return `${fmtBig(c['下品灵石'] || 0)}下｜${fmtBig(c['中品灵石'] || 0)}中｜${fmtBig(c['上品灵石'] || 0)}上｜${fmtBig(c['极品灵石'] || 0)}极｜${fmtBig(c['灵晶'] || 0)}晶`;
}

export function renderAll() {
  const st = GameState.data;
  if (!st) return;
  const p = st.player;
  const w = st.world;
  ensureLifeState(st);

  // 顶栏（SVG 线描图标 + 文本，统一仙侠风格）
  const ICO = (d) => `<svg class="gm-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  $('#tb-time').innerHTML = `${ICO('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}天玄历·${w.year}年·${D.MONTH_NAMES[w.month - 1]}`;
  // 英雄卡生命体征：骨龄 / 寿元余 / 气血(血条) / 伤势，渲染到头像下方的 #hero-vitals
  const wounds = st.flags?.wounded || 0;
  const lifeLeft = Math.max(0, p.lifespan - p.age);
  const ageEl = $('#st-age'); if (ageEl) ageEl.textContent = `${p.age} 岁`;
  const lifeEl = $('#st-life'); if (lifeEl) lifeEl.textContent = `${lifeLeft} 年`;
  const lifeRow = $('#st-life-row'); if (lifeRow) lifeRow.classList.toggle('danger', lifeLeft <= 10);
  // 气血条：100 为满血，每层伤势扣 15 点，最低 5
  const maxHp = 100;
  const hpPct = Math.round((Math.max(5, maxHp - wounds * 15) / maxHp) * 100);
  const hpColor = hpPct > 60 ? '#6fbf8f' : hpPct > 30 ? '#d4b85a' : '#e07a6a';
  const hpFill = $('#st-hp-fill'); if (hpFill) { hpFill.style.width = `${hpPct}%`; hpFill.style.background = hpColor; }
  const hpPctEl = $('#st-hp-pct'); if (hpPctEl) hpPctEl.textContent = `${hpPct}%`;
  const hpRow = $('#st-hp-row'); if (hpRow) hpRow.classList.toggle('danger', wounds >= 3);
  const woundRow = $('#st-wound-row');
  if (woundRow) {
    if (wounds > 0) { woundRow.style.display = ''; const we = $('#st-wound'); if (we) we.textContent = `${wounds} 月`; }
    else woundRow.style.display = 'none';
  }
  $('#tb-loc').innerHTML = `${ICO('<path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>')}${w.region}`;
  $('#tb-stones').innerHTML = `${ICO('<path d="M6 3h12l3 6-9 12L3 9z"/>')}${fmtStonesShort()}`;
  $('#tb-code').innerHTML = `${ICO('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l-3 3 3 3M16 9l3 3-3 3"/>')}道果码 ${st.meta.saveCode}`;

  // 状态卡
  const need = S.expNeed(p.level);
  const atBottleneck = !!S.checkBottleneck(st);
  $('#st-name').textContent = p.title ? `${p.name}·${p.title}` : p.name;
  // 显示自定义道号或签名
  const sigEl = $('#st-signature');
  if (sigEl) {
    const parts = [];
    if (p.daoTitle) parts.push(`「${p.daoTitle}」`);
    if (p.signature) parts.push(p.signature);
    sigEl.textContent = parts.join('  ');
    sigEl.style.display = parts.length ? '' : 'none';
  }
  // 编辑按钮
  const epBtn = $('#btn-edit-profile');
  if (epBtn) epBtn.addEventListener('click', editProfileModal);
  $('#st-realm').textContent = `${S.realmLevelName(p.level)}（Lv.${p.level}）`;
  $('#st-exp-bar').style.width = `${Math.min(100, Math.round(p.exp / need * 100))}%`;
  $('#st-exp-text').textContent = atBottleneck ? `修为满溢，可冲击瓶颈！` : `修为 ${fmtBig(p.exp)} / ${fmtBig(need)}`;
  $('#st-power').textContent = fmtBig(p.power);
  $('#st-rating').textContent = S.realmOf(p.level).rating;
  $('#st-root').innerHTML = `
    <span class="root-grade">${p.spiritRoot.grade}</span>
    <span class="root-elements">${p.spiritRoot.elements.map((el) => `<i>${el}</i>`).join('')}</span>
    <span class="root-speed">修炼×${p.spiritRoot.speed}</span>`;
  $('#st-yun').innerHTML = p.daoYun.id === 'none'
    ? '<span class="yun-pending">未觉醒 · 机缘中可觉醒</span>'
    : `<span class="yun-name">${p.daoYun.name}</span><span class="yun-level">Lv.${p.daoYun.level}</span>`;
  const tech = st.techniques.find((t) => t.名称 === p.mainTechnique);
  $('#st-tech').textContent = tech ? `《${tech.名称}》(${tech.品级}) 第${tech.等级}层` : '无';
  const eqList = [
    st.equipment.weapon, st.equipment.armor, st.equipment.pants,
    st.equipment.boots, st.equipment.accessory, st.equipment.artifact,
  ].filter(Boolean);
  $('#st-equip').textContent = eqList.length ? `${eqList.length}件装备 · 战力+${eqList.reduce((s, e) => s + (e.战力 || 0), 0)}` : '身无长物';
  renderEquipSection();
  $('#st-cave').textContent = `${st.cave.name}（+${Math.round(st.cave.bonus * 100)}%）`;
  const arts = Object.entries(st.arts).filter(([, v]) => v.level > 0).map(([k, v]) => `${k}Lv.${v.level}`).join('｜');
  $('#st-arts').textContent = arts || '尚未涉猎';
  renderChronicle();

  // 道基条
  const daoBaseTotal = Object.values(p.daoBase || {}).reduce((s, v) => s + (v.level || 0), 0);
  const milestone = D.getDaoBaseMilestoneBonus ? D.getDaoBaseMilestoneBonus(daoBaseTotal) : null;
  const djIcon = { 悟性: '📖', 道心: '🔥', 根骨: '🛡', 气运: '🍀', 血脉: '🐉' };
  const djMilestones = D.DAO_BASE_MILESTONES || [50, 100, 150, 200];
  let djNext = null;
  for (const m of djMilestones) { if (daoBaseTotal < m) { djNext = m; break; } }
  let djPct = 100;
  if (djNext != null) {
    const prev = djMilestones.filter((m) => m < djNext).pop() || 0;
    djPct = Math.max(4, Math.min(100, Math.round((daoBaseTotal - prev) / (djNext - prev) * 100)));
  }
  $('#daoji-list').innerHTML = `
    <div class="daoji-summary">
      <span class="dj-label">道基总等级</span>
      <span class="dj-total">${daoBaseTotal}</span>
      ${milestone ? `<span class="daoji-milestone">${milestone.name}</span>` : ''}
      ${milestone ? `<span class="dj-bonus">战力+${Math.round(milestone.powerMul * 100)}% 修为+${Math.round(milestone.expMul * 100)}%</span>` : `<span class="dj-bonus dim">尚未凝练道基里程碑</span>`}
      <span class="dj-track"><i style="width:${djPct}%"></i></span>
    </div>
    <div class="daoji-chips">
      ${Object.entries(p.daoBase).map(([k, v]) => {
        const db = D.DAO_BASES.find((b) => b.name === k) || { desc: '' };
        const bonuses = [];
        if (db.bonus?.power) bonuses.push(`战力+${Math.round(v.level * db.bonus.power * 100)}%`);
        if (db.bonus?.expRate) bonuses.push(`修炼+${Math.round(v.level * db.bonus.expRate * 100)}%`);
        if (db.bonus?.tribulation) bonuses.push(`渡劫+${Math.round(v.level * db.bonus.tribulation * 100)}%`);
        const bonusTxt = bonuses.length ? bonuses.join(' · ') : db.desc;
        // 进度条：以单条道基 50 级为视觉满载
        const fill = Math.max(4, Math.min(100, Math.round(v.level / 50 * 100)));
        return `<span class="daoji-chip" title="${k} Lv.${v.level} — ${bonusTxt || db.desc}"><span class="dc-ico">${djIcon[k] || '✦'}</span><b>${k}</b> <i>Lv.${v.level}</i><span class="dc-track"><span class="dc-fill" style="width:${fill}%"></span></span></span>`;
      }).join('')}
    </div>`;

  // 头像（自定义 / 默认）
  renderHeroAvatar();

  // 图鉴：消费本次新发现，弹提示（图鉴面板内会闪烁对应条目）
  const pendingNames = CX.consumeCodexPending(st);
  if (pendingNames.length) {
    pendingCodexFlash = pendingNames;
    pendingNames.forEach((n) => toast(`📖 发现新图鉴：${n}`, 'gold'));
  } else {
    pendingCodexFlash = [];
  }
  renderCenter();
}

/* ---------------- 天机简报 ---------------- */
function renderNews() {
  const el = $('#news-list');
  if (!el) return; // 仅仙途页存在该节点；结算时若停留在其它页签则跳过，待回到仙途再渲染
  const st = GameState.data;
  const news = st.world.news;
  const omen = st.flags?.omen && omenActive(st) ? st.flags.omen : null;
  const omenHtml = omen
    ? `<li class="omen-line fade-in">🔮 天机运势 · <b>${omen.icon}${omen.label}</b>：${omen.desc}（生效至 ${omen.expireYear}年${omen.expireMonth}月）</li>`
    : '';
  el.innerHTML = omenHtml + (news.length
    ? news.map((n) => `<li class="fade-in">${n}</li>`).join('')
    : '<li>天机未显，世间平静。</li>');
}

/* ---------------- 决策罗盘 ---------------- */
let compassFilter = '推荐';
let pendingCodexFlash = [];

function actionGroup(option) {
  if (['天命', '突破'].includes(option.tag)) return '推荐';
  if (['闭关'].includes(option.tag)) return '修炼';
  if (['历练', '因缘'].includes(option.tag)) return '探索';
  if (['坊市', '百艺', '经营'].includes(option.tag)) return '经营';
  if (option.tag === '道缘') return '社交';
  return '其他';
}

function playerGuidance(st, opts) {
  const bottleneck = S.checkBottleneck(st);
  const destiny = S.destinyCurrent(st);
  if (bottleneck) return { title: `当前目标：冲击「${bottleneck.name}」`, detail: '修为已满。突破有风险，可先准备对应丹药，或继续经营积累资源。', action: '突破' };
  if (st.flags.wounded > 0) return { title: '当前目标：恢复伤势', detail: `伤势还需 ${st.flags.wounded} 个月恢复。可服用凝血丹立即痊愈，受伤期间高风险历练收益会降低。`, action: '行囊' };
  if (destiny && S.destinyAvailable(st) && st.world.month <= 3) return { title: `当前目标：推进天命「${destiny.name}」`, detail: '天命行动只在年初稳定出现。完成后会获得关键成长奖励。', action: '天命' };
  if (st.player.level < 6) return { title: '当前目标：先熟悉修炼', detail: '推荐闭关苦修提升等级；达到更高修为后，天命、秘境和装备玩法会逐步展开。', action: '闭关' };
  const materials = st.items.filter((i) => i.类型 === '材料').length;
  if (materials >= 3) return { title: '当前目标：处理历练收获', detail: `储物袋中有 ${materials} 类材料，可到坊市出售，或保留给后续炼丹玩法。`, action: '坊市' };
  return { title: `当前目标：提升至 Lv.${st.player.level + 1}`, detail: '修炼最稳定，历练能获得材料和机缘，经营与道缘适合积累长期优势。', action: '修炼' };
}

function isRecommended(option, guide, st) {
  if (guide.action === '突破') return option.tag === '突破';
  if (guide.action === '天命') return option.action.type === 'destiny';
  if (guide.action === '坊市') return option.action.type === 'market';
  if (guide.action === '闭关') return option.action.type === 'cultivate' && option.action.mode === 'seclusion';
  return option.action.type === 'cultivate' || option.action.kind === 'wander';
}

function refreshCompass() {
  const st = GameState.data;
  const opts = S.generateCompass(st);
  const guide = playerGuidance(st, opts);
  const gs = $('#guide-strip');
  if (gs) gs.innerHTML = `<div><b>${guide.title}</b><span>${guide.detail}</span></div><button class="text-btn" id="btn-open-guide">玩法说明</button>`;
  const ob = $('#btn-open-guide');
  if (ob) ob.addEventListener('click', showBeginnerGuide);

  const groups = ['推荐', '全部', '修炼', '探索', '经营', '社交'];
  const cf = $('#compass-filters');
  if (cf) {
    cf.innerHTML = groups.map((g) => `<button class="compass-filter ${compassFilter === g ? 'on' : ''}" data-group="${g}">${g}</button>`).join('');
    cf.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
      compassFilter = b.dataset.group;
      refreshCompass();
    }));

    let shown = compassFilter === '全部' ? opts : compassFilter === '推荐' ? [...opts].sort((a, b) => Number(isRecommended(b, guide, st)) - Number(isRecommended(a, guide, st))) : opts.filter((o) => actionGroup(o) === compassFilter);
    if (!shown.length) shown = opts;
    const box = $('#compass-list');
    if (!box) return;
    box.innerHTML = '';
  const acted = st.flags.actedThisMonth || {};
  const banner = $('#acted-banner');
  if (banner) {
    const keys = Object.keys(acted).filter((k) => acted[k]);
    if (keys.length) {
      banner.hidden = false;
      banner.innerHTML = `✅ 本月已行动（${keys.length} 项已锁定），其余选项暂不可选，待月末结算进入下月后即可再决。`;
    } else {
      banner.hidden = true;
    }
  }
  shown.forEach((o, i) => {
    const key = lightActionKey(o);
    const done = key && acted[key];
    const el = document.createElement('button');
    const recommended = isRecommended(o, guide, st);
    el.className = `compass-item tag-${o.tag} ${recommended ? 'recommended' : ''} ${done ? 'acted' : ''}`;
    el.style.animationDelay = `${i * 45}ms`;
    el.innerHTML = `
      <span class="ci-icon">${o.icon}</span>
      <span class="ci-body">
        <span class="ci-title">${o.title}${recommended ? ' <em class="recommend">推荐</em>' : ''}${o.risk ? ' <em class="risk">有风险</em>' : ''}${done ? ' <em class="done">本月已进行</em>' : ''}</span>
        <span class="ci-desc">${done ? '本月已进行过，进入下月后可再次选择。' : o.desc}</span>
        ${o.preview && !done ? `<span class="ci-preview">${o.preview}</span>` : ''}
      </span>
      <span class="ci-tag">${o.tag}</span>`;
    if (!done) el.addEventListener('click', () => onCompassPick(o));
    box.appendChild(el);
  });
  renderQuickActions(opts, acted);
  } // end if (cf) guard
}

/* ---------------- 叙事日志 ---------------- */
function renderChronicle() {
  const box = $('#log-list');
  const st = GameState.data;
  if (!box || !st) return;
  const entries = (st.chronicle || []).slice(-80);
  box.innerHTML = entries.length
    ? entries.map((entry) => `<div class="log-line ${entry.type === '战斗' ? 'battle' : entry.type === '天命' ? 'gold' : ''}"><span class="chronicle-time">${entry.time || ''}</span><b>${entry.title || '仙途新事'}</b><span>${entry.text || ''}</span></div>`).join('')
    : '<div class="chronicle-empty">你的故事还没有落笔。完成一次修炼、历练、交易、道缘互动或旅行，就会在这里留下记录。</div>';
  box.scrollTop = box.scrollHeight;
}

function pushLog(text, kind = '') {
  const st = GameState.data;
  if (!st) return;
  const entry = { time: `${st.world.year}年${st.world.month}月`, title: kind === 'gold' ? '天机提示' : '仙途新事', text, type: kind === 'gold' ? '天命' : '事件' };
  const last = st.chronicle?.[st.chronicle.length - 1];
  if (!last || last.text !== text) {
    st.chronicle.push(entry);
    if (st.chronicle.length > 80) st.chronicle.shift();
  }
  renderChronicle();
  renderChronicleActions();
}

function renderChronicleActions() {
  const box = $('#chronicle-actions');
  if (!box) return;
  box.innerHTML = `<button class="btn btn-sm" id="btn-clear-chronicle">清空纪事</button><span>记录会随游戏自动保存</span>`;
  box.querySelector('#btn-clear-chronicle').addEventListener('click', async () => {
    if (await confirmModal('清空仙途纪事？日志页的分类日志不会受影响。', '清空纪事', '取消')) {
      GameState.data.chronicle = [];
      renderChronicle();
      toast('仙途纪事已清空', 'gold');
    }
  });
}

/* ============================================================
 * 月度行动主流程
 * ========================================================== */
let acting = false;

async function onCompassPick(option) {
  if (acting) return;
  acting = true;
  try {
    // 需要子界面的行动；返回时不消耗月份
    if (option.action.type === 'market') { await flowMarket(); return; }
    if (option.action.type === 'art') { await flowArt(); return; }
    if (option.action.type === 'socialList') { await flowSocial(); return; }
    if (option.action.type === 'map') { await flowMap(); return; }
    if (option.action.type === 'auction') { await flowAuction(); return; }
    if (option.action.type === 'tameBeast') { await flowTameBeast(); return; }
    if (option.action.type === 'sectTask') { await flowSectTask(); return; }
    if (option.action.type === 'sectRealm') {
      const depth = await chooseSectDepth();
      if (!depth) return;
      const r = S.performAction(GameState.data, option, { depth });
      await resolveFlows(r, option);
      return;
    }

    if (option.action.type === 'mystic') {
      const depth = await chooseMysticDepth();
      if (!depth) return;
      const r = S.performAction(GameState.data, option, { depth });
      await resolveFlows(r, option);
      return;
    }

    // ★ 轻量行动（闭关/研读/拜访）：像秘境一样简单确认，不预览结果
    const key = lightActionKey(option);
    if (key) {
      const st = GameState.data;
      const acted = (st.flags.actedThisMonth || {})[key];
      if (acted) { toast('本月已进行过此行动，进入下月后可再次选择。', 'gold'); return; }
      const proceed = await confirmModal(`${option.title}\n\n${option.desc || '潜心修行，不问世事。'}`, '继续行动', '返回选择');
      if (!proceed) return;
      // 确认后才执行
      const r = S.performAction(st, option);
      // 标记本月已行动
      st.flags.actedThisMonth = st.flags.actedThisMonth || {};
      st.flags.actedThisMonth[key] = true;
      await resolveFlows(r, option);
      return;
    }

    // 有风险的行动 / 普通重行动（游历/秘境/天命等）：先确认再执行，不预览结果
    if (option.risk) {
      const proceed = await confirmModal(`${option.title}\n\n${option.desc}\n\n此行动存在失败或损失风险。`, '继续行动', '返回选择');
      if (!proceed) return;
    } else {
      const proceed = await confirmModal(`${option.title}\n\n${option.desc || '踏上征程，未知的际遇在等待。'}`, '继续行动', '返回选择');
      if (!proceed) return;
    }

    // 确认后才执行，不再支持「返回不进行」回滚
    const r = S.performAction(GameState.data, option);
    await resolveFlows(r, option);
  } finally {
    acting = false;
  }
}

/** 轻量行动（闭关/研读/拜访）的标识，用于每月限一次 + 返回选择 */
function lightActionKey(option) {
  const a = option.action;
  if (!a) return null;
  if (a.type === 'cultivate' && a.mode === 'seclusion') return 'seclusion';
  if (a.type === 'study') return 'study';
  if (a.type === 'social' && a.target) return 'social:' + a.target;
  return null;
}

/** 处理行动后续：战斗/渡劫弹窗 → 月末结算 */
async function resolveFlows(r, option) {
  const settle = { title: option.title, logs: [...r.logs], battleReport: null, bt: r.breakthrough || null };
  if (r.battle) {
    settle.battleReport = await battleModal(r.battle);
    settle.logs.push(...settle.battleReport.logs);
  }
  if (r.breakthrough) await breakthroughModal(r.breakthrough);

  await settleMonth(settle);
}

/* ---------------- 月末结算 ---------------- */
async function settleMonth(info) {
  const st = GameState.data;
  const nm = S.nextMonth(st); // 时间推进 + 世界演化
  const logs = [...info.logs, ...nm.logs];

  // 把本月结算叙事补记到持久化日志（去重），确保「弹窗看到的每一条事件」都能在日志页查到
  for (const t of logs) {
    if (t && !(st.logs || []).some((l) => l.type === '事件' && l.text === t)) {
      S.addLog(st, '事件', t);
    }
  }

  renderAll();

  const body = `
    <div class="settle-head">
      <span>🌙 天玄历·${st.world.year}年·${D.MONTH_NAMES[st.world.month - 1]}</span>
      <span>🎂 骨龄 ${st.player.age} 岁</span>
    </div>
    ${info.battleReport ? battleSummaryHtml(info.battleReport) : ''}
    <div class="settle-logs">${logs.map((l) => `<div class="settle-line">${l}</div>`).join('')}</div>
    <div class="modal-actions">
      <button class="btn btn-gold" id="btn-next-month">进入下一月 ➤</button>
    </div>`;

  await new Promise((resolve) => {
    const m = openModal(body, { title: '📜 月末结算', lock: true, cls: 'modal-lg' });
    m.querySelector('#btn-next-month').addEventListener('click', () => { closeModal(); resolve(); });
  });

  if (nm.dead) { await flowDeath(); return; }

  await maybeAwakenYun();
  // 成就结算：扫描已达成里程碑，新解锁的弹提示
  const newly = CX.checkAchievements(st);
  for (const a of newly) toast(`🏆 成就达成：${a.name}`, 'gold');
  await saveNow();
  renderNews();
  refreshCompass();
  renderAll();
}

/* ---------------- 先天道韵觉醒（游戏中逐步发现） ---------------- */
async function maybeAwakenYun() {
  const st = GameState.data;
  if (st.player.daoYun?.id !== 'none') return;
  const candidates = S.tryAwakenYun(st); // 未觉醒时按概率触发；返回候选列表或 null
  if (!candidates) return;
  const choice = await new Promise((resolve) => {
    const m = openModal(`
      <div class="choice-intro">
        <div class="settle-line">🌟 修行机缘已至！你冥冥中感应到一道先天道韵流转，是否在此刻觉醒？</div>
        <div class="settle-line opt-desc">选择后将觉醒对应的先天道韵，影响你后续的机缘、判定与成长。</div>
      </div>
      <div class="yun-choose-grid">
        ${candidates.map((y) => `
          <button class="yun-choose-btn" data-yun="${y.id}">
            <b>${y.name}</b>
            <span>${y.effect}</span>
            <small>成长于：${y.grow}</small>
          </button>`).join('')}
      </div>`, { title: '✦ 先天道韵觉醒', lock: true, cls: 'modal-lg' });
    m.querySelectorAll('[data-yun]').forEach((b) => b.addEventListener('click', () => { closeModal(); resolve(b.dataset.yun); }));
  });
  if (!choice) return;
  const y = S.awakenYun(st, choice);
  if (!y) return;
  pushLog(`✦ 你于修行中觉醒先天道韵【${y.name}】：${y.effect}`);
  renderAll();
  toast(`觉醒道韵：${y.name}`, 'gold');
}

function battleSummaryHtml(rep) {
  if (rep.fled) return `<div class="battle-sum fled">你选择了遁走，未分胜负。</div>`;
  return `
    <div class="battle-sum ${rep.win ? 'win' : 'lose'}">
      <div>⚔️ ${D.BATTLE_TYPES[rep.type].name} ｜ 对手：${rep.enemy.name}（${rep.enemy.realm}）</div>
      ${rep.dice ? `<div>🎲 命运骰子：${rep.dice.icon}${rep.dice.name}（${rep.dice.mod >= 0 ? '+' : ''}${rep.dice.mod}%）→ 最终胜率 ${rep.finalRate}%</div>` : `<div>双方修为相近，全凭真本事。</div>`}
      <div>${rep.win ? `🎉 判定：胜！${rep.loot.length ? '战利品：' + rep.loot.join('、') : ''}` : '💔 判定：败……'}</div>
    </div>`;
}

/* ---------------- 战斗弹窗 ---------------- */
function battleModal(battle) {
  const st = GameState.data;
  let tactic = 'normal';
  let blessed = false;
  const canBless = () => S.totalStones(st) >= 50;
  return new Promise((resolve) => {
    const m = openModal(`
      <div class="battle-intro">${battle.intro}</div>
      <div class="enemy-card">
        <div class="enemy-name">${battle.enemy.name}</div>
        <div class="enemy-info">${battle.enemy.realm} ｜ 战力约 ${battle.enemy.power}${battle.enemy.danger ? ` ｜ 危险度${battle.enemy.danger}/5` : ''}</div>
      </div>
      <div class="battle-feedback" id="battle-feedback">「${S.winRateFeedback(S.previewBattle(st, battle.enemy, battle.type, 'normal').finalRate)}」</div>
      <div class="battle-preview-rate" id="battle-preview-rate"></div>
      <div class="tactic-row" id="tactic-row">
        <span class="tactic-label">战术</span>
        <button class="tactic-btn on" data-tactic="normal">寻常</button>
        <button class="tactic-btn" data-tactic="aggro">强攻·胜↑败重</button>
        <button class="tactic-btn" data-tactic="defend">稳守·胜↓败轻</button>
      </div>
      <div class="blessed-row" id="blessed-row">
        <button class="tactic-btn ${canBless() ? '' : 'btn-dim'}" data-bless ${canBless() ? '' : 'disabled'}>🔥 天命加持 · 胜+10%（耗50灵石）</button>
        <span class="blessed-tip">${canBless() ? '可邀天命相助' : '灵石不足50，暂不可邀'}</span>
      </div>
      <div class="dice-stage hidden" id="dice-stage"><div class="dice-roller" id="dice-roller">🎲</div><div class="dice-result" id="dice-result"></div></div>
      <div class="battle-result hidden" id="battle-result"></div>
      <div class="modal-actions" id="battle-actions">
        <button class="btn btn-red" id="btn-fight">⚔️ 迎战</button>
        <button class="btn" id="btn-flee">💨 遁走</button>
      </div>`, { title: '⚔️ 斗法', lock: true });

    const renderPreview = () => {
      const pv = S.previewBattle(st, battle.enemy, battle.type, tactic, blessed);
      const fb = S.winRateFeedback(pv.finalRate);
      const fbEl = m.querySelector('#battle-feedback'); if (fbEl) fbEl.textContent = `「${fb}」`;
      const prEl = m.querySelector('#battle-preview-rate');
      if (prEl) {
        const bd = pv.breakdown || {};
        const rows = [];
        const add = (label, val) => {
          if (val) rows.push(`<div class="wr-row"><span>${label}</span><b class="${val > 0 ? 'up' : 'down'}">${val > 0 ? '+' : ''}${val}%</b></div>`);
        };
        add('道友援护', bd.ally);
        add('灵兽助阵', bd.beasts);
        add('出战护主', bd.activeBeast);
        add('丹毒侵蚀', bd.toxic);
        add('伤势未愈', bd.wound);
        if (bd.tactic) add(bd.tactic > 0 ? '强攻战术' : '稳守战术', bd.tactic);
        add('天命加持', bd.blessed);
        prEl.innerHTML = `<div class="wr-head">基础胜率 <b>${bd.base}%</b></div>${rows.join('')}<div class="wr-total">预估胜率 <b>${pv.finalRate}%</b></div><div class="wr-note">（命运未卜，或生波动）</div>`;
      }
    };
    m.querySelectorAll('[data-tactic]').forEach((b) => b.addEventListener('click', () => {
      tactic = b.dataset.tactic;
      m.querySelectorAll('[data-tactic]').forEach((x) => x.classList.toggle('on', x === b));
      renderPreview();
    }));
    const blessBtn = m.querySelector('[data-bless]');
    if (blessBtn) blessBtn.addEventListener('click', () => {
      if (!canBless()) return;
      blessed = !blessed;
      blessBtn.classList.toggle('on', blessed);
      renderPreview();
    });
    renderPreview();

    m.querySelector('#btn-flee').addEventListener('click', () => {
      const rep = S.resolveBattle(st, battle.enemy, battle.type, true);
      closeModal(); resolve(rep);
    });
    m.querySelector('#btn-fight').addEventListener('click', () => {
      m.querySelector('#battle-actions').classList.add('hidden');
      const stage = m.querySelector('#dice-stage');
      const roller = m.querySelector('#dice-roller');
      stage.classList.remove('hidden');
      // 骰子滚动动画
      let n = 0;
      const timer = setInterval(() => {
        roller.textContent = Rng.pick(D.FATE_DICE).icon;
        if (++n > 14) {
          clearInterval(timer);
          const rep = S.resolveBattle(st, battle.enemy, battle.type, false, tactic, blessed);
          if (rep.dice) {
            roller.textContent = rep.dice.icon;
            m.querySelector('#dice-result').innerHTML = `<b>${rep.dice.name}</b>（${rep.dice.mod >= 0 ? '+' : ''}${rep.dice.mod}%）<br><span>${rep.dice.desc}</span>`;
          } else {
            roller.textContent = '⚔️';
            m.querySelector('#dice-result').textContent = '同阶之战，实力定胜负！';
          }
          const box = m.querySelector('#battle-result');
          box.classList.remove('hidden');
          const lootRe = /获得|缴获|修为\+/;
          box.innerHTML = `
            <div class="br-clash" aria-hidden="true">
              <div class="br-fighter you">⚔️ 你</div>
              <div class="br-spark">✦</div>
              <div class="br-fighter foe">${battle.enemy.name}</div>
            </div>
            <div class="br-verdict ${rep.win ? 'win' : 'lose'}">${rep.win ? '胜' : '败'}</div>
            ${rep.logs.map((l, i) => `<div class="settle-line${lootRe.test(l) ? ' loot-hi' : ''}" style="--i:${i}">${l}</div>`).join('')}
            <div class="modal-actions"><button class="btn btn-gold" id="btn-battle-ok">收下战报</button></div>`;
          box.querySelector('#btn-battle-ok').addEventListener('click', () => { closeModal(); resolve(rep); });
          renderAll();
        }
      }, 80);
    });
  });
}

/* ---------------- 渡劫弹窗 ---------------- */
function breakthroughModal(bt) {
  return new Promise((resolve) => {
    const m = openModal(`
      <div class="bt-intro">${bt.tribulation}</div>
      <div class="bt-rate">天道推演成功率：<b>${bt.rate}%</b></div>
      <div class="bt-waves" id="bt-waves">
        ${bt.waves.map(() => `<div class="bt-wave pending">⬡</div>`).join('')}
      </div>
      <div class="bt-result hidden" id="bt-result"></div>
      <div class="modal-actions"><button class="btn btn-gold hidden" id="btn-bt-ok">继续</button></div>`,
      { title: `⚡ 渡劫 · ${bt.name}`, lock: true });

    const waveEls = [...m.querySelectorAll('.bt-wave')];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= bt.waves.length) {
        clearInterval(timer);
        const box = m.querySelector('#bt-result');
        box.classList.remove('hidden');
        box.innerHTML = `<div class="br-verdict ${bt.success ? 'win' : 'lose'}">${bt.success ? '渡劫成功' : '渡劫失败'}</div>
          ${bt.logs.map((l) => `<div class="settle-line">${l}</div>`).join('')}`;
        m.querySelector('#btn-bt-ok').classList.remove('hidden');
        m.querySelector('#btn-bt-ok').addEventListener('click', () => { closeModal(); resolve(); });
        return;
      }
      const w = bt.waves[i];
      const el = waveEls[i];
      el.classList.remove('pending');
      el.classList.add(w.pass ? 'pass' : 'fail');
      el.textContent = w.pass ? '⚡' : '💥';
      i += 1;
    }, 650);
  });
}

/* ---------------- 坊市 ---------------- */
async function flowMarket() {
  const st = GameState.data;
  const stock = S.shopStock(st);
  const logs = [];
  let action = 'refresh';
  let marketTab = 'buy'; // 'buy' | 'sell'
  // 循环重开弹窗以刷新列表，直到玩家主动离开
  while (action !== 'leave' && action !== 'back') {
    action = await new Promise((resolve) => {
      const groups = {};
      stock.forEach((g, i) => { (groups[g.类型] = groups[g.类型] || []).push({ g, i }); });
      const order = ['丹药', '法宝', '装备', '功法', '材料', '消耗品', '服务', '线索'];
      const catLabel = { 丹药: '丹药', 法宝: '法宝', 装备: '装备（六部位细分）', 功法: '功法', 材料: '材料', 消耗品: '消耗品', 服务: '服务', 线索: '线索' };
      const gradeName = (id) => D.PILL_GRADES.find((x) => x.id === id)?.name || id;

      // ---- 购买页 HTML ----
      const buyHtml = order.filter((t) => groups[t]).map((t) => `
        <div class="shop-cat-group">
          <div class="shop-cat">${catLabel[t]}</div>
          ${groups[t].map(({ g, i }) => `
            <div class="shop-item" data-buy="${i}">
              <div class="si-body"><b>${g.名称}${g.品阶 ? ` <em class="grade-${g.品阶}">${gradeName(g.品阶)}</em>` : ''}${g.品级 ? ` <em class="grade-tag">${g.品级}</em>` : ''}</b><span>${g.描述}</span></div>
              <div class="si-price">${g.价格} 灵石</div>
              <button class="btn btn-sm btn-gold shop-buy-btn">购买</button>
            </div>`).join('')}
        </div>`).join('') || '<div class="opt-desc">今日坊市无货。</div>';

      // ---- 出售页 HTML（抽成函数，便于批量/单件出售后就地重渲染，避免索引漂移） ----
      const buildSellHtml = () => st.items.length ? st.items.map((it, i) => {
        const mul = S.newsPriceMul(st, it);
        const trendTag = mul > 1 ? '<em class="price-up">行情↑</em>' : mul < 1 ? '<em class="price-down">行情↓</em>' : '';
        const est = Math.max(1, Math.round((it.价值 || (it.类型 === '材料' ? 35 : 15)) * (it.数量 || 1) * mul));
        return `
          <div class="shop-item" data-sell="${i}">
            <div class="si-body"><b>${it.名称}</b>${it.数量 > 1 ? `<span> ×${it.数量}</span>` : ''}<span>${it.描述 || ''} ${trendTag}</span></div>
            <div class="si-price">约${est}灵石</div>
            <button class="btn btn-sm shop-sell-btn">出售</button>
          </div>`;
      }).join('') : '<div class="opt-desc">储物袋空空如也。</div>';

      const m = openModal(`
        <div class="shop-money">随身灵石（折下品）：<b>${S.totalStones(st)}</b></div>
        <div class="shop-book">
          <div class="shop-tabs">
            <button class="shop-tab ${marketTab === 'buy' ? 'on' : ''}" data-stab="buy">🛒 购买货品</button>
            <button class="shop-tab ${marketTab === 'sell' ? 'on' : ''}" data-stab="sell">💰 出售行囊</button>
          </div>
          <!-- 购买页 -->
          <div class="shop-page ${marketTab === 'buy' ? 'active' : ''}" id="shop-page-buy">
            <div class="shop-page-header">
              <span class="shop-page-title">坊市货单</span>
              <span class="shop-page-hint">点击购买 · 灵石自动扣除</span>
            </div>
            <div class="shop-buy-list">${buyHtml}</div>
          </div>
          <!-- 出售页 -->
          <div class="shop-page ${marketTab === 'sell' ? 'active' : ''}" id="shop-page-sell">
            <div class="shop-page-header">
              <span class="shop-page-title">出售行囊</span>
              <span class="shop-page-hint">售价随行情浮动</span>
            </div>
            <div class="shop-batch">
              <span class="shop-batch-label">一键清空：</span>
              <button class="btn btn-sm" data-batch="材料">全部材料</button>
              <button class="btn btn-sm" data-batch="杂物">全部杂物</button>
              <button class="btn btn-sm" data-batch="消耗品">全部消耗品</button>
            </div>
            <div class="shop-sell-list">${buildSellHtml()}</div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" id="btn-back-shop">返回本月选择</button>
          <button class="btn btn-gold" id="btn-leave-shop">完成交易并结束本月</button>
        </div>`,
        { title: '💰 坊市', lock: true, cls: 'modal-lg' });

      // Tab 切换（不刷新列表，只切换显示）
      m.querySelectorAll('.shop-tab').forEach((t) => t.addEventListener('click', () => {
        marketTab = t.dataset.stab;
        m.querySelectorAll('.shop-tab').forEach((x) => x.classList.toggle('on', x.dataset.stab === marketTab));
        m.querySelectorAll('.shop-page').forEach((p) => p.classList.toggle('active', p.id === `shop-page-${marketTab}`));
      }));

      // 购买按钮 —— 就地更新，不重开弹窗
      m.querySelectorAll('.shop-buy-btn').forEach((b) => b.addEventListener('click', () => {
        const row = b.closest('.shop-item');
        const idx = row?.dataset.buy;
        if (idx == null) return;
        const msg = S.buyItem(st, stock[Number(idx)]);
        toast(msg, 'gold'); logs.push(msg);
        // 就地更新灵石显示 + 标记已购（变淡）
        m.querySelector('.shop-money b').textContent = S.totalStones(st);
        if (row) { row.style.opacity = '.4'; row.style.pointerEvents = 'none'; }
        renderAll();
      }));

      // 出售列表就地重渲染（每次出售后重建，索引始终与 state.items 对齐，避免漂移）
      const renderSellList = () => {
        const list = m.querySelector('.shop-sell-list');
        if (list) list.innerHTML = buildSellHtml();
        m.querySelector('.shop-money b').textContent = S.totalStones(st);
        m.querySelectorAll('.shop-sell-btn').forEach((b) => b.addEventListener('click', () => {
          const row = b.closest('.shop-item');
          const idx = row?.dataset.sell;
          if (idx == null) return;
          const msg = S.sellItem(st, Number(idx));
          toast(msg, 'gold'); logs.push(msg);
          renderSellList();
          renderAll();
        }));
      };
      renderSellList();

      // 批量出售按钮（一键清空某类杂物）
      m.querySelectorAll('[data-batch]').forEach((b) => b.addEventListener('click', () => {
        const type = b.dataset.batch;
        const res = S.sellItems(st, (it) => it.类型 === type);
        if (!res.count) { toast(`行囊中没有可出售的「${type}」。`, 'gold'); return; }
        toast(`已售出 ${res.count} 件${type}，共得灵石${res.stones}。`, 'gold');
        logs.push(`批量售出 ${res.count} 件${type}，得灵石${res.stones}。`);
        renderSellList();
        renderAll();
      }));

      m.querySelector('#btn-back-shop').addEventListener('click', () => { closeModal(); resolve('back'); });
      m.querySelector('#btn-leave-shop').addEventListener('click', () => { closeModal(); resolve('leave'); });
      renderAll();
    });
  }
  if (action === 'back') {
    if (logs.length) toast('交易已保留，本月尚未结束', 'gold');
    renderAll();
    refreshCompass();
    return;
  }
  if (!logs.length) logs.push('你在坊市逛了一圈，增长了些见闻。');
  await settleMonth({ title: '坊市交易', logs });
}

/* ---------------- 地图与旅行 ---------------- */
async function flowMap() {
  const st = GameState.data;
  const current = REGION_TRAVEL[st.world.regionId] || REGION_TRAVEL.zhongzhou;
  const names = Object.fromEntries(D.REGIONS.map((r) => [r.id, r.name]));
  const routes = current.neighbors.map((id) => ({ id, ...REGION_TRAVEL[id] }));
  const target = await new Promise((resolve) => {
    const m = openModal(`
      <div class="choice-intro">你现在位于「${st.world.region}」。旅行会消耗灵石和月份，抵达后将改变坊市库存、野外材料和天机简报。</div>
      <div class="map-current"><b>当前地域</b><span>${st.world.region}</span><em>${current.specialty} · ${current.flavor}</em></div>
      <div class="route-list">${routes.map((r) => `<button class="route-row" data-region="${r.id}"><span>${names[r.id]}</span><small>${r.specialty} · 路费约${r.cost}灵石 · ${r.months}个月</small></button>`).join('')}</div>
      <div class="modal-actions"><button class="btn" id="btn-back-map">返回本月选择</button></div>`,
      { title: '天玄地图', lock: true, cls: 'modal-lg' });
    m.querySelectorAll('[data-region]').forEach((b) => b.addEventListener('click', () => { closeModal(); resolve(b.dataset.region); }));
    m.querySelector('#btn-back-map').addEventListener('click', () => { closeModal(); resolve(null); });
  });
  if (!target) return;
  const result = startTravel(st, target);
  toast(result.text, result.ok ? 'gold' : 'warn');
  if (!result.ok) return;
  await settleMonth({ title: '前往新地域', logs: [result.text] });
}

/* ---------------- 拍卖会 ---------------- */
async function flowAuction() {
  const st = GameState.data;
  S.openAuction(st); // 整场拍卖只生成一次拍品，避免每次出价都重刷
  let done = false;
  const feed = [];
  const m = openModal(`
    <div class="choice-intro">修真拍卖会正在进行！各路修士齐聚竞价。你持有灵石：<b id="auc-stones">${S.formatStones(st)}</b>。</div>
    <div id="auction-feed" class="auction-feed"></div>
    <div id="auction-list" class="auction-list"></div>
    <div class="modal-actions"><button class="btn" id="btn-leave-auction">离开拍卖会（结束本月）</button></div>`,
    { title: '修真拍卖会', lock: true, cls: 'modal-lg' });
  const feedEl = m.querySelector('#auction-feed');
  const listEl = m.querySelector('#auction-list');
  const stonesEl = m.querySelector('#auc-stones');
  const pushFeed = (text, cls = '') => {
    feed.unshift({ text, cls });
    feedEl.innerHTML = feed.slice(0, 10).map((f) => `<div class="feed-item ${f.cls}">${f.text}</div>`).join('');
  };
  const renderList = () => {
    if (stonesEl) stonesEl.textContent = S.formatStones(st);
    listEl.innerHTML = st.auction.items.length ? st.auction.items.map((it, i) => `
      <div class="auction-item ${it._flash ? 'auction-rise' : ''}" data-i="${i}">
        <div class="codex-name"><b>${it.name}</b> <span class="codex-rarity ${it.rarity}">${it.rarity}</span></div>
        <div class="codex-effect">${it.desc}</div>
        <div class="codex-source">起拍价：${it.basePrice} 灵石 ｜ 当前价：<span class="auc-price">${it.currentBid}</span>（${it.bidder}）</div>
        <div class="auction-rival">对手「${it.rivalName}」心理价位约 <b>${it.rivalBudget}</b> 灵石${it.buyout ? ` ｜ 一口价 <b class="auc-buyout">${it.buyout}</b>` : ''}</div>
        <div class="auction-bid">
          <input type="number" placeholder="出价" min="${it.currentBid + 1}" id="bid-${i}">
          <button class="btn btn-sm btn-gold" data-bid="${i}">竞价</button>
          ${it.buyout ? `<button class="btn btn-sm" data-buyout="${i}" title="以一口价直接拿下，对手不再竞价">一口价</button>` : ''}
          <button class="btn btn-sm text-btn" data-withdraw="${i}">放弃（流拍）</button>
        </div>
      </div>`).join('') : '<div class="opt-desc">所有拍品已成交或流拍，拍卖会圆满收场。</div>';
    listEl.querySelectorAll('[data-bid]').forEach((b) => b.addEventListener('click', () => onBid(Number(b.dataset.bid))));
    listEl.querySelectorAll('[data-buyout]').forEach((b) => b.addEventListener('click', () => onBuyout(Number(b.dataset.buyout))));
    listEl.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', () => onWithdraw(Number(b.dataset.withdraw))));
    st.auction.items.forEach((it) => { it._flash = false; });
  };
  const onBid = (idx) => {
    const input = m.querySelector(`#bid-${idx}`);
    const amount = Number(input?.value);
    const r = S.placeBid(st, idx, amount);
    if (r.ok) {
      pushFeed(r.logs[0], 'feed-win');
      const el = listEl.querySelector(`[data-i="${idx}"]`);
      if (el) el.classList.add('auction-hammer');
      toast(r.logs[0], 'gold');
      setTimeout(() => { renderList(); }, 700);
    } else {
      toast(r.logs[0], 'warn');
      pushFeed(r.logs[0], 'feed-npc');
      st.auction.items.forEach((it, i) => { if (i === idx) it._flash = true; });
      renderList();
    }
  };
  const onBuyout = (idx) => {
    const r = S.buyoutAuction(st, idx);
    if (r.ok) {
      pushFeed(r.logs[0], 'feed-win');
      toast(r.logs[0], 'gold');
      setTimeout(() => { renderList(); }, 500);
    } else { toast(r.logs[0], 'warn'); }
  };
  const onWithdraw = (idx) => {
    const r = S.withdrawAuctionItem(st, idx);
    if (r.ok) { pushFeed(r.logs[0], 'feed-npc'); toast(r.logs[0], 'gold'); renderList(); }
  };
  pushFeed('🔨 拍卖正式开始，诸位道友请出价！', 'feed-sys');
  renderList();
  m.querySelector('#btn-leave-auction').addEventListener('click', () => { done = true; closeModal(); });
  /* 等待离开后 resolve，避免 acting 永久锁死 */
  await new Promise((res) => {
    const poll = () => { if (done) res(); else requestAnimationFrame(poll); };
    poll();
  });
  if (done) await settleMonth({ title: '参加拍卖会', logs: ['你参加了修真拍卖会。'] });
}

/* ---------------- 秘境探索深度选择 ---------------- */
async function chooseMysticDepth() {
  const st = GameState.data;
  const depths = D.MYSTIC_DEPTH.levels;
  let pick = null;
  await new Promise((resolve) => {
    const m = openModal(`
      <div class="choice-intro">选择本次探索的深度。越深，灵石、材料与法宝越丰厚，但护宝妖兽更凶、更可能出现隐藏奇遇。</div>
      <div class="depth-list">
        ${depths.map((d) => `
          <div class="depth-opt">
            <div class="depth-name">${d.name}<span class="depth-idx">第 ${depths.indexOf(d) + 1} 层</span></div>
            <div class="depth-detail">灵石×${d.stoneMul} ｜ 材料×${d.matMul} ｜ 法宝×${d.artMul} ｜ 妖兽风险 +${Math.round(d.beastAdd * 100)}%${d.hiddenChance > 0 ? ` ｜ 隐藏奇遇 ${Math.round(d.hiddenChance * 100)}%` : ''}</div>
            <button class="btn btn-sm btn-gold" data-depth="${depths.indexOf(d) + 1}">深入${d.name}</button>
          </div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn" id="btn-cancel-depth">取消</button></div>`,
      { title: '秘境探索 · 深度选择', lock: true, cls: 'modal-lg' });
    m.querySelectorAll('[data-depth]').forEach((b) => b.addEventListener('click', () => { pick = Number(b.dataset.depth); closeModal(); resolve(); }));
    m.querySelector('#btn-cancel-depth').addEventListener('click', () => { closeModal(); resolve(); });
  });
  return pick;
}

/* ---------------- 宗门秘境深度选择 ---------------- */
async function chooseSectDepth() {
  const depths = D.MYSTIC_DEPTH.levels;
  let pick = null;
  await new Promise((resolve) => {
    const m = openModal(`
      <div class="choice-intro">选择本次潜修的纵深。越深，宗门贡献、灵石与材料越丰厚；深处更藏有宗门丹房旧藏（聚气丹）。无妖兽风险。</div>
      <div class="depth-list">
        ${depths.map((d) => `
          <div class="depth-opt">
            <div class="depth-name">${d.name}<span class="depth-idx">第 ${depths.indexOf(d) + 1} 层</span></div>
            <div class="depth-detail">贡献&灵石×${d.stoneMul} ｜ 材料×${d.matMul}${d.depth >= 2 ? ' ｜ 深处得聚气丹' : ''}</div>
            <button class="btn btn-sm btn-gold" data-depth="${depths.indexOf(d) + 1}">深入${d.name}</button>
          </div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn" id="btn-cancel-sectdepth">取消</button></div>`,
      { title: '宗门秘境 · 深度选择', lock: true, cls: 'modal-lg' });
    m.querySelectorAll('[data-depth]').forEach((b) => b.addEventListener('click', () => { pick = Number(b.dataset.depth); closeModal(); resolve(); }));
    m.querySelector('#btn-cancel-sectdepth').addEventListener('click', () => { closeModal(); resolve(); });
  });
  return pick;
}

/* ---------------- 灵兽收服 ---------------- */
async function flowTameBeast() {
  const st = GameState.data;
  const beasts = CX.BEAST_TEMPLATES.filter((b) => st.player.level >= b.minLevel - 10);
  const m = openModal(`
    <div class="choice-intro">你前往灵兽栖息地。御兽等级越高，收服成功率越高。当前灵兽栏：${st.beasts?.slots?.length || 0}/${st.beasts?.maxSlots || 1}。</div>
    ${beasts.map((b, i) => `<div class="beast-slot">
      <div class="beast-name">🐺 ${b.name} <span class="codex-rarity">Lv.${b.minLevel}+</span></div>
      <div class="beast-skill">技能：${b.skill}</div>
      <div class="beast-desc">${b.desc} 战力加成 +${b.power}</div>
      <div class="modal-actions"><button class="btn btn-sm btn-gold" data-beast="${i}">尝试收服</button></div>
    </div>`).join('')}
    <div class="modal-actions"><button class="btn" id="btn-back-beast">返回本月选择</button></div>`,
    { title: '灵兽栖息地', lock: true, cls: 'modal-lg' });
  let settled = false;
  m.querySelectorAll('[data-beast]').forEach((b) => b.addEventListener('click', async () => {
    const idx = Number(b.dataset.beast);
    const hasIncense = st.items.some((i) => i.名称 === '驭兽香');
    let useIncense = false;
    if (hasIncense) useIncense = await confirmModal('是否消耗「驭兽香」提高收服成功率？', '使用', '不使用');
    const r = S.tameBeast(st, beasts[idx], useIncense);
    toast(r.logs[0], r.ok ? 'gold' : 'warn');
    settled = true;
    closeModal();
    renderAll();
    await settleMonth({ title: '收服灵兽', logs: r.logs });
  }));
  m.querySelector('#btn-back-beast').addEventListener('click', () => { closeModal(); });
}

/* ---------------- 宗门任务 ---------------- */
async function flowSectTask() {
  const st = GameState.data;
  if (!st.sect?.name) {
    const defaultName = `${st.player.name}之宗`;
    if (await confirmModal(`你尚未加入宗门。是否创建「${defaultName}」并成为外门弟子？`, '创建宗门', '返回')) {
      const msg = S.joinSect(st, defaultName);
      toast(msg, 'gold');
      renderAll();
    }
    return;
  }
  const m = openModal(`
    <div class="sect-info">
      <div class="codex-name"><b>🏯 ${st.sect.name}</b></div>
      <div class="codex-source">职级：${CX.SECT_RANKS[st.sect.rank]?.name} ｜ 贡献：${st.sect.contribution}</div>
      <div class="codex-effect">${CX.SECT_RANKS[st.sect.rank]?.benefit}</div>
    </div>
    <div class="sect-stipend ${st.sect.stipend > 0 ? 'has' : ''}">
      <div class="stipend-text">本月俸禄累积：<b>${st.sect.stipend || 0}</b> 下品灵石</div>
      <button class="btn btn-sm ${st.sect.stipend > 0 ? 'btn-gold' : 'btn-dim'}" data-claimstipend ${st.sect.stipend > 0 ? '' : 'disabled'}>领取俸禄</button>
    </div>
    <div class="choice-intro">选择一个宗门任务执行：</div>
    ${CX.SECT_TASKS.map((t) => `<div class="sect-task">
      <div class="codex-body"><b>${t.name}</b><div class="codex-source">${t.desc} ｜ 贡献 +${t.contribution}</div></div>
      <button class="btn btn-sm btn-gold" data-task="${t.id}">执行</button>
    </div>`).join('')}
    <div class="choice-intro">宗门兑换所（消耗贡献）：</div>
    ${CX.SECT_EXCHANGE.map((e) => `<div class="sect-task">
      <div class="codex-body"><b>${e.name}</b><div class="codex-source">${e.desc} ｜ 需贡献 ${e.cost}</div></div>
      <button class="btn btn-sm ${st.sect.contribution >= e.cost ? 'btn-gold' : 'btn-dim'}" data-exchange="${e.id}" ${st.sect.contribution >= e.cost ? '' : 'disabled'}>兑换</button>
    </div>`).join('')}
    <div class="modal-actions"><button class="btn" id="btn-back-sect">返回本月选择</button></div>`,
    { title: '宗门任务', lock: true, cls: 'modal-lg' });
  let settled = false;
  m.querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', async () => {
    const r = S.doSectTask(st, b.dataset.task);
    closeModal();
    renderAll();
    settled = true;
    await resolveFlows({ logs: r.logs, battle: r.battle || null }, { title: '执行宗门任务' });
  }));
  m.querySelector('#btn-back-sect').addEventListener('click', () => { closeModal(); });
  m.querySelectorAll('[data-exchange]').forEach((b) => b.addEventListener('click', () => {
    const r = S.sectExchange(st, b.dataset.exchange);
    if (r.ok) toast(r.logs[0], 'gold'); else toast(r.logs[0], 'warn');
    closeModal(); renderAll(); settled = true;
  }));
  const claimBtn = m.querySelector('[data-claimstipend]');
  if (claimBtn) claimBtn.addEventListener('click', () => {
    const r = S.claimSectStipend(st);
    if (r.ok) { toast(r.logs[0], 'gold'); closeModal(); renderAll(); }
    else { toast(r.logs[0], 'warn'); }
  });
}

/* ---------------- 百艺 ---------------- */
async function flowArt() {
  const st = GameState.data;
  const chosen = await new Promise((resolve) => {
    let batchSel = 1;
    const m = openModal(`
      <div class="choice-intro">百艺不再只是涨经验：选择配方会消耗储物袋中的材料，产出丹药、装备、符箓和阵旗；没有材料也可以练习但不会凭空产出。</div>
      <div class="art-batch">
        <span class="art-batch-label">批量开炉</span>
        ${[1, 5, 10].map((n) => `<button class="batch-btn ${n === 1 ? 'on' : ''}" data-batch="${n}">×${n}</button>`).join('')}
      </div>
      <div class="art-recipe-grid">
        ${D.ARTS.map((a) => {
          const recipes = ART_RECIPES[a] || [];
          return `<div class="art-block"><div class="art-block-title">${a} Lv.${st.arts[a].level}</div>${recipes.map((r) => `<button class="recipe-row" data-art="${a}" data-recipe="${r.id}"><b>${r.name}</b><span>${Object.entries(r.need).map(([n, c]) => `${n}×${c}`).join('、')}</span><small>产出：${r.output.name} · ${r.output.desc}</small></button>`).join('') || '<div class="opt-desc">暂无配方，先研习以解锁。</div>'}</div>`;
        }).join('')}
      </div>
      <div class="modal-actions"><button class="btn" id="btn-back-art">返回本月选择</button></div>`,
      { title: '修仙百艺', lock: true, cls: 'modal-lg' });
    m.querySelectorAll('[data-batch]').forEach((b) => b.addEventListener('click', () => {
      batchSel = Number(b.dataset.batch);
      m.querySelectorAll('[data-batch]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    m.querySelectorAll('[data-art]').forEach((c) => c.addEventListener('click', async () => {
      const art = c.dataset.art;
      const recipe = c.dataset.recipe;
      // 炼器·自由锻造：先选部位再开炉
      if (art === '炼器' && recipe === 'free') {
        const slot = await chooseCraftSlot();
        if (!slot) { flowArt().then((r) => resolve(r)); return; }
        closeModal();
        resolve({ art, recipe, slot, batch: batchSel });
        return;
      }
      closeModal();
      resolve({ art, recipe, batch: batchSel });
    }));
    m.querySelector('#btn-back-art').addEventListener('click', () => { closeModal(); resolve(null); });
  });
  if (!chosen) return;
  const logs = S.practiceArt(st, chosen.art, chosen.recipe, chosen.slot, chosen.batch);
  await settleMonth({ title: `研习${chosen.art}`, logs });
}

/** 炼器·自由锻造：选择要锻造的装备部位 */
function chooseCraftSlot() {
  return new Promise((resolve) => {
    const m = openModal(`
      <div class="choice-intro">选择本次自由锻造的装备部位：</div>
      <div class="craft-slot-grid">
        ${EQUIP_SLOTS.map((s) => `<button class="recipe-row" data-slot="${s.id}"><b>${s.icon} ${s.name}</b><span>${s.desc}</span></button>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn" id="btn-cancel-slot">返回配方</button></div>`,
      { title: '选择锻造部位', lock: true });
    m.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => { closeModal(); resolve(b.dataset.slot); }));
    m.querySelector('#btn-cancel-slot').addEventListener('click', () => { closeModal(); resolve(null); });
  });
}

/* ---------------- 道缘（选择 NPC） ---------------- */
async function flowSocial() {
  const st = GameState.data;
  const known = S.knownNpcs(st);
  const r = await new Promise((resolve) => {
    const m = openModal(`
      <div class="choice-intro">道缘互动会影响好感和关系层级。切磋属于战斗，其他互动通常没有直接风险。</div>
      <div class="npc-list">
        ${known.length ? known.map((n, i) => `
          <button class="npc-row" data-npc="${st.npcs.indexOf(n)}" title="${relationBenefit(n.favor).benefit}">
            <div class="npc-main"><b>${n.name}</b><span>${n.realm} · ${n.job} · ${n.mood || '平静'}</span><div class="npc-mini-progress"><i style="width:${n.favor}%"></i></div></div>
            <div class="npc-favor">好感 ${n.favor} ｜ ${n.relationName}</div>
          </button>`).join('') : `<div class="opt-desc">你尚未结识同道。先在「游历」或「寻访」中邂逅有缘人吧。</div>`}
      </div>
      <div class="opt-desc">${known.length ? `世间尚有 ${st.npcs.length - known.length} 位有缘人未遇，随修行机缘逐步结识。` : '随着游历推进，会陆续结识新的道友。'}</div>
      <div class="modal-actions"><button class="btn" id="btn-back-social">返回本月选择</button></div>`,
      { title: '选择道缘对象', lock: true, cls: 'modal-lg' });
    m.querySelectorAll('[data-npc]').forEach((c) => c.addEventListener('click', async () => {
      const npc = st.npcs[Number(c.dataset.npc)];
      closeModal();
      const result = await npcInteractModal(npc);
      if (result?.back) { resolve(await flowSocial()); return; }
      resolve(result);
    }));
    m.querySelector('#btn-back-social').addEventListener('click', () => { closeModal(); resolve(null); });
  });
  if (!r) return;
  // 互动结果进入月末结算（切磋可能触发战斗）
  const logs = [...(r.logs || [])];
  let battleReport = null;
  if (r.battle) {
    battleReport = await battleModal(r.battle);
    logs.push(...battleReport.logs);
  }
  await settleMonth({ title: '道缘往来', logs, battleReport });
}

/** NPC 互动子菜单（返回 {logs, battle} 供结算） */
function npcInteractModal(npc) {
  return new Promise((resolve) => {
    const st = GameState.data;
    const m = openModal(`
      <div class="npc-card">
        <div class="npc-name">${npc.name} <span class="npc-trait">${npc.trait}</span></div>
        <div class="npc-info">${npc.gender} ｜ ${npc.race} ｜ ${npc.realm} ｜ ${npc.job}</div>
        <div class="npc-info">好感 ${npc.favor} ｜ ${npc.relationName} ｜ 第${npc.meetCount || 0}次往来</div>
        <div class="relation-progress"><i style="width:${npc.favor}%"></i></div>
        <div class="relation-benefit">当前作用：${relationBenefit(npc.favor).benefit}${npc.skill ? ` 当前专长：${npc.skill}` : ''}${(npc.relation || 0) >= 4 ? ' ｜ ⚔️ 可临阵援护' : ''}</div>
      </div>
      <div class="modal-actions col">
        <button class="btn btn-gold" data-k="chat">煮茶叙旧 · 好感 +5~15</button>
        <button class="btn" data-k="lundao">坐而论道 · 好感与悟性</button>
        <button class="btn" data-k="gift">备礼登门 · 消耗 50 灵石，好感 +10~20</button>
        <button class="btn" data-k="invite">邀请同行 · 需达到「道友」</button>
        <button class="btn btn-gold ${npc.relation >= 3 ? '' : 'btn-dim'}" data-k="deep" ${(npc.relation >= 3) ? '' : 'disabled'}>💞 秉烛深谈 · 道友专属支线（好感+18~30${(npc.relation >= 3) ? '' : ' · 需达道友'}）</button>
        ${(npc.relation >= 3) ? (() => { const ci = S.commissionInfo(st, npc); return ci.cdRemaining > 0 ? `<button class="btn btn-dim" disabled>委托筹措中（剩 ${ci.cdRemaining} 月）</button>` : `<button class="btn btn-gold" data-k="commission">交付委托 · 需 ${ci.need} ${ci.task.item}（持 ${ci.have}）</button>`; })() : ''}
        <button class="btn btn-red" data-k="qiecuo">切磋较技 · 会进入斗法</button>
        <button class="btn" data-k="back">返回对象列表</button>
      </div>`, { title: '道缘往来', lock: true });
    m.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'back') { closeModal(); resolve({ back: true }); return; }
      const r = S.interactNpc(st, npc, k);
      closeModal();
      resolve(Array.isArray(r) ? { logs: r } : r);
    }));
  });
}

/* ---------------- 寿元已尽 / 转世 ---------------- */
async function flowDeath() {
  const st = GameState.data;
  const re = await new Promise((resolve) => {
    const m = openModal(`
      <p class="modal-text">寿元已尽，坐化于洞府之中。然仙途不绝，轮回有路——</p>
      <div class="modal-actions col">
        <button class="btn btn-gold" data-v="re">🔄 轮回转世（继承半数灵石、三成道基、主修功法）</button>
        <button class="btn" data-v="new">🌑 完全重开（世界重归初始）</button>
      </div>`, { title: '💀 身死道消', lock: true });
    m.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      closeModal(); resolve(b.dataset.v);
    }));
  });
  const { resetSave } = await import('./save.js');
  if (re === 're') {
    const inherit = S.reincarnate(st, false);
    await resetSave();
    startCreation(inherit);
  } else {
    await resetSave();
    location.reload();
  }
}

/* ============================================================
 * 侧栏页签（仙途 / 行囊 / 道缘 / 图鉴 / 境界 / 日志 / 设置）
 * ========================================================== */
let sideTab = 'destiny';
let logFilter = '全部';
let sysLogMode = 'game';  // 'game' | 'system' — 日志子面板切换

/* ---- 系统错误捕获（写入 sysLogs 供日志面板展示） ---- */
function captureError(msg, source, lineno, colno, error) {
  try {
    const st = GameState?.data;
    if (!st) return;
    const now = new Date();
    const time = `${now.getFullYear()}年${String(now.getMonth()+1).padStart(2,'0')}月${String(now.getDate()).padStart(2,'0')}日`;
    const entry = { type: '异常', time, text: `[${source || '?'}:${lineno || 0}] ${msg}${error ? ` · ${error.message || error}` : ''}` };
    st.sysLogs = st.sysLogs || [];
    st.sysLogs.push(entry);
    if (st.sysLogs.length > 200) st.sysLogs = st.sysLogs.slice(-200);  // 防止无限膨胀
  } catch(e) { /* 捕获本身不能抛错 */ }
}
// 全局 JS 错误
window.onerror = captureError;
// 未捕获的 Promise rejection
window.addEventListener('unhandledrejection', (ev) => {
  captureError(`未捕获Promise: ${ev.reason?.message || ev.reason || 'unknown'}`, 'Promise', 0, 0, ev.reason);
});
export function setSideTab(tab) {
  if (tab === sideTab) return; // 同一标签页不重播入场动画
  sideTab = tab;
  const box = $('#center-body');
  if (box && !document.documentElement.classList.contains('reduce-motion')) {
    box.classList.remove('view-enter');
    void box.offsetWidth; // 强制回流以重启动画
    box.classList.add('view-enter');
    // 入场动画播毕后移除类，避免页内筛选/重渲染时子项重复入场造成闪烁
    clearTimeout(box._viewEnterT);
    box._viewEnterT = setTimeout(() => box.classList.remove('view-enter'), 650);
  }
  renderCenter();
}

function toxicityBarHTML(toxic) {
  const pct = Math.min(100, toxic);
  return `<div class="opt-desc" style="margin-top:8px">💊 丹毒值：${toxic} / 100</div>
    <div class="toxicity-bar"><i style="width:${pct}%"></i></div>`;
}

/* 头像：标题页/仙籍卡显示当前存档头像（内置预设） */
function resolveAvatarUrl() {
  const st = GameState.data;
  // 只用内置头像预设（本地 data URL，无需联网，绝不会 404/报错）
  // 兼容旧档中文键「头像预设」
  const preset = st?.settings?.avatarPreset || st?.settings?.['头像预设'];
  if (preset) {
    const url = builtInAvatarDataUrl(preset);
    if (url) return url;
  }
  return null;
}

function renderHeroAvatar() {
  const box = $('#hero-avatar');
  if (!box) return;
  const url = resolveAvatarUrl();
  box.innerHTML = url ? `<img class="hero-avatar-img" src="${url}" alt="头像">` : defaultAvatarSvg();
}

/* 备用装备相对已穿戴同部位的战力差值徽标（一眼看出该换谁） */
function stashCmpBadge(item, eq) {
  const cur = item && item.部位 && eq[item.部位];
  if (!cur) return '';
  const d = (Number(item.战力) || 0) - (Number(cur.战力) || 0);
  if (d === 0) return `<em class="stash-cmp" style="color:var(--muted,#888)">＝</em>`;
  if (d > 0) return `<em class="stash-cmp" style="color:#e0533d;font-weight:600">▲+${d}</em>`;
  return `<em class="stash-cmp" style="color:#3a9d6b">▼${d}</em>`;
}

/* 个人属性卡内的「装备」板块（#47：从行囊移入） —— 紧凑网格布局 */
function renderEquipSection() {
  const box = $('#equip-section');
  if (!box) return;
  const st = GameState.data;
  const eq = st.equipment;
  // 槽位图标映射
  const SLOT_ICONS = { weapon: '⚔️', artifact: '✦', armor: '🛡️', accessory: '💍', pants: '👖', boots: '👢' };
  // 按用户截图：2列网格（武器/法宝 | 衣服/戒指 | 裤子/鞋子）
  const slotPairs = [
    [EQUIP_SLOTS.find(s => s.id === 'weapon'), EQUIP_SLOTS.find(s => s.id === 'artifact')],
    [EQUIP_SLOTS.find(s => s.id === 'armor'),  EQUIP_SLOTS.find(s => s.id === 'accessory')],
    [EQUIP_SLOTS.find(s => s.id === 'pants'),  EQUIP_SLOTS.find(s => s.id === 'boots')],
  ];
  const slotGrid = slotPairs.map(pair => pair.map(s => {
    const e = eq[s.id];
    const setOf = e ? CX.itemSetOf(e.名称) : null;
    const gradeClr = gradeColor(e);
    return `<div class="equip-cell ${e ? 'equipped' : 'empty'}">
      <div class="equip-cell-head"><span class="equip-slot-icon">${SLOT_ICONS[s.id] || '📿'}</span><span class="equip-slot-label">${s.name}</span></div>
      ${e ? `
        <div class="equip-cell-body">
          <div class="equip-item-name" style="${gradeClr ? `color:${gradeClr}` : ''}">${e.名称}</div>
          <div class="equip-item-meta"><span class="equip-grade">${gradeName(e.品阶)}</span><span class="equip-power">+${e.战力}战</span></div>
          ${setOf ? `<em class="equip-set-badge">${setOf}套</em>` : ''}
        </div>
        <button class="btn btn-xs btn-unequip" data-unequip="${s.id}" title="卸下装备">卸</button>
        <button class="btn btn-xs btn-enhance" data-enhance-equip="${s.id}" title="淬炼强化">淬</button>
      ` : `<div class="equip-cell-empty"><i>空</i></div>`}
    </div>`;
  }).join('')).map(row => `<div class="equip-grid-row">${row}</div>`).join('');
  const stash = eq.stash || [];
  box.innerHTML = `
    <div class="equip-grid">${slotGrid}</div>
    <div class="equip-mini-stash">
      <span class="equip-mini-name">备用 · ${stash.length}件</span>
      <div class="equip-mini-stash-items">${stash.length ? stash.map((a, i) => {
        const gClr = gradeColor(a);
        const cmp = stashCmpBadge(a, eq);
        return `<span class="equip-stash-row"><button class="btn btn-xs equip-stash-btn" data-equip="${i}" title="${a.描述 || ''}">${a.名称}<em style="color:${gClr};font-size:.72rem;margin-left:4px">+${a.战力}</em></button>${cmp}<button class="btn btn-xs equip-stash-enhance" data-enhance-stash="${i}" title="淬炼强化">淬</button><button class="btn btn-xs text-btn equip-stash-return" data-return-bag="${i}" title="放回行囊">↩</button></span>`;
      }).join('') : '<i>空</i>'}</div>
    </div>`;
  box.querySelectorAll('[data-unequip]').forEach((b) => b.addEventListener('click', () => {
    if (S.unequipItem(st, b.dataset.unequip)) { toast('已卸下', 'gold'); renderAll(); }
  }));
  box.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', () => {
    requestEquip(st, Number(b.dataset.equip));
  }));
  box.querySelectorAll('[data-return-bag]').forEach((b) => b.addEventListener('click', () => {
    const idx = Number(b.dataset.returnBag);
    if (S.stashToBag(st, idx)) { toast('已放回行囊', 'jade'); renderAll(); }
    else { toast('行囊空间不足', 'warn'); }
  }));
  box.querySelectorAll('[data-enhance-equip]').forEach((b) => b.addEventListener('click', () => enhanceEquipModal(st, { where: 'equip', slot: b.dataset.enhanceEquip })));
  box.querySelectorAll('[data-enhance-stash]').forEach((b) => b.addEventListener('click', () => enhanceEquipModal(st, { where: 'stash', idx: Number(b.dataset.enhanceStash) })));
}

/** 装备淬炼（强化）确认弹窗：展示消耗与成功率，确认后调用 S.enhanceEquip */
function enhanceEquipModal(state, target) {
  const item = target.where === 'stash' ? state.equipment.stash[target.idx] : state.equipment[target.slot];
  if (!item || !item.名称 || item.名称 === '无') return;
  const level = Number(item.等级) || 1;
  if (level >= 30) { toast('该装备已臻化境，无法继续淬炼。', 'warn'); return; }
  const cost = 40 * (level + 1);
  const rate = Math.max(35, 88 - level * 2);
  const m = openModal(`
    <div class="enhance-wrap">
      <div class="enhance-head">淬炼 · ${item.名称}</div>
      <div class="enhance-info">当前 <b>Lv.${level}</b> ｜ 战力 <b>+${item.战力}</b>${gradeName(item.品阶) ? ` ｜ ${gradeName(item.品阶)}` : ''}</div>
      <div class="enhance-grid">
        <div class="enhance-cell"><span>耗灵石</span><b>${cost}</b></div>
        <div class="enhance-cell"><span>成功率</span><b>${rate}%</b></div>
        <div class="enhance-cell"><span>失败损耗</span><b>仅灵石</b></div>
      </div>
      <div class="opt-desc">淬炼成功则等级 +1、战力同步提升；失败仅损耗灵石，装备无损（友好设计，避免数值崩坏与挫败）。</div>
      <div class="modal-actions">
        <button class="btn btn-gold" id="btn-enhance-ok">引灵淬炼</button>
        <button class="btn" id="btn-enhance-cancel">再想想</button>
      </div>
    </div>`, { lock: true, cls: 'modal-enhance' });
  m.querySelector('#btn-enhance-ok').addEventListener('click', () => {
    closeModal();
    const res = S.enhanceEquip(state, target);
    (res.logs || []).forEach((l) => pushLog(l));
    if (res.ok) toast(res.success ? '淬炼成功！装备更上一层楼' : '淬炼未成，灵石已耗，装备无损', res.success ? 'gold' : 'warn');
    else toast(res.logs[0] || '无法淬炼', 'warn');
    renderAll();
  });
  m.querySelector('#btn-enhance-cancel').addEventListener('click', closeModal);
}

/** 装备对比：若目标部位已有装备，弹窗对比（旧 vs 新），确认后才替换 */
function gradeNameOf(it) {
  const g = (typeof it.品阶 === 'string') ? D.getEquipGrade(it.品阶) : null;
  return g ? g.name : `Lv.${it.等级 || 1}`;
}
function requestEquip(state, stashIdx) {
  const item = state.equipment.stash[stashIdx];
  if (!item) return;
  const old = state.equipment[item.部位];
  if (old) {
    compareEquipModal(old, item, () => {
      if (S.equipItem(state, stashIdx)) { toast('装备已更换', 'gold'); renderAll(); }
    });
  } else if (S.equipItem(state, stashIdx)) {
    toast('已装备', 'gold'); renderAll();
  }
}
function compareEquipModal(oldItem, newItem, onConfirm) {
  const slotName = EQUIP_SLOTS.find((s) => s.id === newItem.部位)?.name || '装备';
  const diff = (Number(newItem.战力) || 0) - (Number(oldItem.战力) || 0);
  const diffCls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const diffTxt = diff === 0 ? '战力持平' : (diff > 0 ? `战力 +${diff}` : `战力 ${diff}`);
  const m = openModal(`
    <div class="compare-wrap">
      <div class="compare-head">${slotName} · 更换确认</div>
      <div class="compare-grid">
        <div class="compare-col old">
          <div class="compare-tag">当前</div>
          <div class="compare-name">${oldItem.名称}</div>
          <div class="compare-power">战力 +${oldItem.战力}</div>
          <div class="compare-meta">${gradeNameOf(oldItem)}</div>
        </div>
        <div class="compare-vs"><div class="compare-diff ${diffCls}">${diffTxt}</div></div>
        <div class="compare-col new">
          <div class="compare-tag">更换为</div>
          <div class="compare-name">${newItem.名称}</div>
          <div class="compare-power">战力 +${newItem.战力}</div>
          <div class="compare-meta">${gradeNameOf(newItem)}</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-gold" id="btn-compare-ok">确认更换</button>
        <button class="btn" id="btn-compare-cancel">保留当前</button>
      </div>
    </div>`, { lock: true, cls: 'modal-compare' });
  m.querySelector('#btn-compare-ok').addEventListener('click', () => { closeModal(); onConfirm(); });
  m.querySelector('#btn-compare-cancel').addEventListener('click', closeModal);
}

/** 月令快捷操作栏：把每月最常用的行动前置为一排按钮，减少进入罗盘列表的选择成本 */
function renderQuickActions(opts, acted) {
  const row = $('#compass-quick');
  if (!row) return;
  const quickDefs = [
    { key: 'seclusion', label: '闭关', icon: '🧘', match: (o) => o.action.type === 'cultivate' && o.action.mode === 'seclusion' },
    { key: 'explore', label: '历练', icon: '🌄', match: (o) => o.action.type === 'explore' },
    { key: 'market', label: '坊市', icon: '💰', match: (o) => o.action.type === 'market' },
    { key: 'social', label: '道缘', icon: '📜', match: (o) => o.action.type === 'socialList' },
    { key: 'map', label: '地图', icon: '🗺️', match: (o) => o.action.type === 'map' },
    { key: 'art', label: '百艺', icon: '⚗️', match: (o) => o.action.type === 'art' },
    { key: 'cave', label: '洞府', icon: '🏠', match: (o) => o.action.type === 'upgradeCave' },
    { key: 'break', label: '突破', icon: '⚡', match: (o) => o.action.type === 'breakthrough' },
  ];
  row.innerHTML = quickDefs.map((def) => {
    const opt = opts.find(def.match);
    if (!opt) return '';
    const key = lightActionKey(opt);
    const done = key && acted[key];
    return `<button class="quick-act ${done ? 'acted' : ''}" data-qk="${def.key}" title="${opt.title}">${def.icon}<span>${def.label}</span></button>`;
  }).filter(Boolean).join('');
  row.querySelectorAll('[data-qk]').forEach((b) => {
    if (b.classList.contains('acted')) return;
    const def = quickDefs.find((d) => d.key === b.dataset.qk);
    const opt = opts.find(def.match);
    if (opt) b.addEventListener('click', () => onCompassPick(opt));
  });
}

/** 从行囊页跳转到个人属性卡的装备板块（高亮提示） */
function flashEquip() {
  const el = $('#equip-section');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

/** 右抽屉：辅助详情面板（随当前导航切换内容，作为「快捷信息」） */
function renderSidePanel() {
  const box = $('#side-body');
  if (!box) return;
  const st = GameState.data;
  if (!st) return;
  const guide = (typeof playerGuidance === 'function') ? playerGuidance(st) : null;
  const now = sideTab;
  if (now === 'destiny' || now === 'items' || now === 'npcs' || now === 'codex' || now === 'realm' || now === 'map' || now === 'cave' || now === 'achv' || now === 'beasts') {
    const c = st.currencies;
    const eqList = [st.equipment.weapon, st.equipment.armor, st.equipment.pants, st.equipment.boots, st.equipment.accessory, st.equipment.artifact].filter(Boolean);
    const stoneSummary = `${c['下品灵石'] || 0}下 ${c['中品灵石'] || 0}中 ${c['上品灵石'] || 0}上 ${c['极品灵石'] || 0}极 ${c['灵晶'] || 0}晶`;
    const daoBaseTotal = Object.values(st.player.daoBase || {}).reduce((s, v) => s + (v.level || 0), 0);
    const codex = CX.codexStats(st);
    const yunName = st.player.daoYun.id === 'none' ? '未觉醒' : st.player.daoYun.name;
    box.innerHTML = `
      <div class="side-subtitle">仙籍速览</div>
      <div class="side-quick">
        <div class="sq-row"><span>道号</span><b>${st.player.daoTitle || st.player.title || '暂无'}</b></div>
        <div class="sq-row"><span>境界</span><b>${S.realmLevelName(st.player.level)}（Lv.${st.player.level}）</b></div>
        <div class="sq-row"><span>战力</span><b>${st.player.power}</b></div>
        <div class="sq-row"><span>灵根</span><b>${st.player.spiritRoot.grade} ×${st.player.spiritRoot.speed}</b></div>
        <div class="sq-row"><span>道韵</span><b>${yunName}</b></div>
        <div class="sq-row"><span>寿元</span><b>余 ${Math.max(0, st.player.lifespan - st.player.age)} 年</b></div>
        <div class="sq-row"><span>伤势</span><b class="${(st.flags?.wounded || 0) > 0 ? 'sq-wounded' : ''}">${(st.flags?.wounded || 0) > 0 ? st.flags.wounded + ' 个月（战斗力下降）' : '无'}</b></div>
        <div class="sq-row"><span>道基</span><b>总 ${daoBaseTotal} 级</b></div>
        <div class="sq-row"><span>洞府</span><b>${st.cave?.name || '洞府'} +${Math.round((st.cave?.bonus || 0) * 100)}%</b></div>
        <div class="sq-row"><span>功法</span><b>${st.player.mainTechnique || '无'}</b></div>
        <div class="sq-row"><span>装备</span><b>${eqList.length} 件</b></div>
        <div class="sq-row"><span>灵石</span><b>${stoneSummary}</b></div>
        <div class="sq-row"><span>图鉴</span><b>${codex.totalFound}/${codex.totalAll}</b></div>
        <div class="sq-row"><span>道缘</span><b>${st.npcs.filter((n) => S.isMet(n)).length} 人（待缘 ${st.npcs.length - st.npcs.filter((n) => S.isMet(n)).length}）</b></div>
      </div>
      ${guide ? `<div class="side-subtitle">当前目标</div><div class="guide-strip" style="margin-bottom:0"><div><b>${guide.title}</b><span>${guide.detail}</span></div></div>` : ''}
      <div class="side-subtitle">操作提示</div>
      <div class="opt-desc">${sidePanelHint(now)}</div>`;
  } else if (now === 'logs') {
    box.innerHTML = `<div class="side-subtitle">日志说明</div><div class="opt-desc">日志按类型自动归类，最新记录置顶。可一键清空，不影响其他存档数据。</div>`;
  } else if (now === 'settings') {
    box.innerHTML = `<div class="side-subtitle">设置说明</div><div class="opt-desc">此处可调整文字大小、窗口尺寸与头像，管理存档槽与转世重修。所有更改即时生效并自动存档。</div>`;
  }
}
function sidePanelHint(tab) {
  return ({
    destiny: '每月在主区「决策罗盘」选择一件大事推进仙途。',
    items: '行囊物品点击「使用 / 查图鉴」即可触发；装备管理已移至左侧「个人属性」卡，可点上方按钮跳转。',
    npcs: '在决策罗盘选择「道缘」行动即可与故人往来增进好感。',
    codex: '持有过的物品会自动录入图鉴，点击分类可筛选。',
    realm: '修为满溢时出现瓶颈，可冲击境界延寿与解锁玩法。',
    map: '点击相邻地域的「前往」即可启程，旅行消耗灵石与月份。当前所在地域可在此查看特产与坊市。',
  })[tab] || '';
}

/** 图鉴二级详情弹窗：展示物品完整功能介绍 */
const CODEX_CAT_ICON = { '装备': '🗡️', '法宝': '✨', '丹药': '💊', '道具': '📜', '材料': '🌿', '容器': '🎒', '线索': '🗺️', '灵兽': '🐾', '功法': '📜' };
const CODEX_SLOT_NAMES = { weapon: '武器', armor: '衣服', pants: '裤子', boots: '鞋子', accessory: '戒指', artifact: '法宝' };
function openCodexModal(name, category) {
  const entry = CX.codexEntries(GameState.data, '全部').find((e) => e.name === name && e.category === category);
  if (!entry) return;
  const modal = document.getElementById('codex-modal');
  if (!modal) return;
  const setOf = entry.discovered ? CX.itemSetOf(entry.name) : null;
  const icon = entry.discovered ? (CODEX_CAT_ICON[entry.category] || '❓') : '❓';
  const ownPower = entry.slot ? CX.ownedEquipPower(GameState.data, entry.name) : null;
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="${entry.name}">
      <button class="modal-close" type="button" aria-label="关闭">×</button>
      <div class="codex-detail-head">
        <div class="codex-detail-icon">${icon}</div>
        <div>
          <div class="codex-detail-name">${entry.discovered ? entry.name : '？？？'}</div>
          <div class="codex-detail-sub">${entry.discovered ? entry.category : '未发现'}${entry.rarity ? ' · 品阶 ' + entry.rarity : ''}</div>
        </div>
      </div>
      ${entry.discovered ? `
      ${entry.slot ? `<div class="codex-detail-row"><b>部位</b><span>${CODEX_SLOT_NAMES[entry.slot] || entry.slot}</span></div>` : ''}
      <div class="codex-detail-row"><b>获取途径</b><span>${entry.source || '未知'}</span></div>
      <div class="codex-detail-row"><b>功能介绍</b><span>${entry.effect || '暂无描述'}</span></div>
      ${ownPower != null ? `<div class="codex-detail-row"><b>你持有版本战力</b><span>${ownPower}</span></div>` : ''}
      ${setOf ? `<div class="codex-detail-row"><b>所属套装</b><span>${setOf}套装</span></div>` : ''}
      <div class="codex-detail-row"><b>持有情况</b><span>${entry.count ? '当前持有 ' + entry.count + ' 件' : '暂未持有'}</span></div>
      ` : '<div class="codex-detail-row"><span>尚未发现，继续探索修真界以解锁详细功能介绍。</span></div>'}
    </div>`;
  modal.hidden = false;
  modal.querySelector('.modal-close').addEventListener('click', closeCodexModal);
  modal.onclick = (e) => { if (e.target === modal) closeCodexModal(); };
}
function closeCodexModal() {
  const m = document.getElementById('codex-modal');
  if (m) m.hidden = true;
}

/** 整页渲染中央区：点击左导航即整页跳转（替代旧版右抽屉分页） */
function renderCenter() {
  const st = GameState.data;
  if (!st) return;
  $$('.side-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === sideTab));
  const box = $('#center-body');
  if (!box) return;

  if (sideTab === 'destiny') {
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          <svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span class="pt-text">天机简报</span>
          <span class="pt-eyebrow">天机</span>
        </div>
        <ul id="news-list" class="news-list"></ul>
      </div>
      <div class="panel panel-core">
        <div class="panel-title">
          <svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/></svg>
          <span class="pt-text">决策罗盘</span>
          <span class="panel-hint">每月单决 · 选一件事推进仙途</span>
        </div>
        <div id="guide-strip" class="guide-strip"></div>
        <div id="acted-banner" class="acted-banner" hidden></div>
        <div id="compass-filters" class="compass-filters"></div>
        <div id="compass-quick" class="compass-quick"></div>
        <div id="compass-list" class="compass-list"></div>
        <div class="free-action">
          <input id="free-action-input" maxlength="30" placeholder="自由描述本月想做的一件事，回车生效…">
          <button id="btn-free-action" class="btn btn-sm">行动</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">
          <svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>
          <span class="pt-text">仙途纪事</span>
          <span class="panel-hint">记录真正发生过的故事</span>
        </div>
        <div id="log-list" class="log-list"></div>
        <div id="chronicle-actions" class="chronicle-actions"></div>
      </div>`;
    renderCenterButtons();
    renderNews();
    refreshCompass();
    renderChronicle();
    renderChronicleActions();
    renderSidePanel();
    return;
  }

  /** 行囊内的「功法」区块：列出已修习功法，可设为主修 */
  function techSectionHtml(st) {
    const techs = st.techniques || [];
    // 功法战力 = 品级power倍率 × 等级 × 基础值3（向上取整）
    const techPwrOf = (t) => {
      const g = D.TECHNIQUE_GRADES.find((gr) => gr.name === t.品级);
      const mul = g ? g.power : 1;
      return Math.round(mul * (t.等级 || 1) * 3);
    };
    if (!techs.length) return '<div class="item-section-title">功法 <span>已修习 · 可设为主修</span></div><div class="opt-desc">尚未修习任何功法。可在坊市购买功法玉简，或于历练、机缘中获得。</div>';
    const main = st.player.mainTechnique;
    return `<div class="item-section-title">功法 <span>已修习 ${techs.length} 部 · 可设为主修</span></div>
      <div class="tech-list">${techs.map((t, i) => `
        <div class="tech-row ${t.名称 === main ? 'tech-main' : ''}">
          <div class="tech-main-info"><b>${t.名称}</b><span>${t.品级} · 第${t.等级}层 · 经验 ${t.经验}/${t.等级 * 20} · 战力+${techPwrOf(t)}</span></div>
          <div class="item-acts">${t.名称 === main ? '<span class="tech-current">主修中</span>' : `<button class="btn btn-sm btn-gold" data-setmain="${i}">设为主修</button>`}</div>
        </div>`).join('')}</div>`;
  }

  if (sideTab === 'items') {
    const TYPE_ORDER = ['装备', '法宝', '丹药', '道具', '消耗品', '材料', '杂物'];
    const TYPE_ICONS = { '装备': '🗡️', '法宝': '✨', '丹药': '💊', '道具': '📜', '消耗品': '🔧', '材料': '🌿', '杂物': '📦' };
    const resolveType = (it) => {
      if (it._equip) return '装备';
      if (it.类型 === '装备' || it.类型 === '法宝' || it.部位) return '装备';
      if (it.类型 === '容器') return 'container';
      return it.类型 || '杂物';
    };
    const nonContainerItems = st.items.filter((it) => resolveType(it) !== 'container');
    const grouped = {};
    for (const it of nonContainerItems) {
      const t = resolveType(it);
      (grouped[t] = grouped[t] || []).push(it);
    }
    const isDirectlyUsable = (it) => {
      if (it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝') return false;
      if (!it.effect) return false;
      return !!(it.effect.exp || it.effect.heal);
    };
    const isEquipable = (it) => !!(it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝');
    const itemFilter = box.dataset.itemFilter || '全部';

    box.innerHTML = `
      <div class="panel">
        ${(() => {
          const bg = D.bagGradeOf(st.inventory.capacity + (st.inventory.ringBonus || 0));
          return `<div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2"/></svg><span class="pt-text">行囊 · ${st.inventory.bagName}</span><span class="bag-grade" style="--bc:${bg.color}">${bg.name}</span></div>`;
        })()}
        ${(() => { const effCap = st.inventory.capacity + (st.inventory.ringBonus || 0); return `
        <div class="bag-capacity"><b>${st.inventory.used}/${effCap} 格</b><span>占用按数量计算${st.inventory.ringBonus ? ` · 含戒指+${st.inventory.ringBonus}` : ''}</span></div>
        <div class="bag-meter"><i style="width:${Math.min(100, st.inventory.used / effCap * 100)}%"></i></div>`; })()}
        <div class="opt-desc">普通物品每件 1 格；装备和法宝每件 2 格。扩容可通过坊市服务、百艺或特殊机缘获得。</div>

        <div class="item-section-title">装备管理 <span>已移至左侧「个人属性」</span></div>
        <button class="btn btn-sm btn-gold" id="btn-jump-equip">🛡 前往个人属性管理装备</button>

        <div class="item-section-title">行囊物品 <span>按类型分类 · 可直接使用的显示「使用」</span></div>
        <div class="inv-filters">
          ${['全部', ...TYPE_ORDER].filter((t) => t === '全部' || grouped[t]?.length).map((t) => `<button class="inv-filter ${itemFilter === t ? 'on' : ''}" data-itemfilter="${t}">${t}</button>`).join('')}
        </div>
        <button class="btn btn-sm" id="btn-organize">🧹 整理行囊（归类 · 合并）</button>
        ${TYPE_ORDER.filter((t) => (itemFilter === '全部' || t === itemFilter) && grouped[t]?.length).map((t) => `
          <div class="inv-category">
            <div class="inv-cat-header">${TYPE_ICONS[t] || '📦'} ${t} <span class="inv-cat-count">${grouped[t].length}种</span></div>
            ${grouped[t].map((it, _) => {
              const i = nonContainerItems.indexOf(it);
              const usable = isDirectlyUsable(it);
              return `
              <div class="item-row">
                <div class="item-icon">${TYPE_ICONS[t] || '📦'}</div>
                <div class="item-main"><b>${it.名称}</b><span>${it.描述 || ''}${it.价值 ? ` · 价值${it.价值}灵石` : ''}</span></div>
                ${it.数量 > 1 ? `<div class="item-qty">×${it.数量}</div>` : ''}
                <div class="item-acts">
                  ${isEquipable(it) ? `<button class="btn btn-sm btn-gold" data-use="${i}">装备</button>` : ''}
                  ${usable ? `<button class="btn btn-sm btn-gold" data-use="${i}">使用</button>` : ''}
                  <button class="btn btn-sm" data-codex="${it.名称}">图鉴</button>
                </div>
              </div>`;
            }).join('')}
          </div>
        `).join('') || '<div class="opt-desc">空空如也。</div>'}
        ${techSectionHtml(st)}
      </div>`;
    box.querySelector('#btn-jump-equip').addEventListener('click', () => flashEquip());
    box.querySelectorAll('[data-itemfilter]').forEach((b) => b.addEventListener('click', () => { box.dataset.itemFilter = b.dataset.itemfilter; renderCenter(); }));
    box.querySelector('#btn-organize').addEventListener('click', () => {
      const n = organizeBag(st);
      toast(`行囊已整理，共 ${n} 件物品。`, 'gold');
      renderAll();
    });
    box.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
      const logs = S.useItem(st, Number(b.dataset.use));
      if (logs) { logs.forEach((l) => pushLog(l)); toast(logs[0], 'gold'); renderAll(); }
    }));
    box.querySelectorAll('[data-codex]').forEach((b) => b.addEventListener('click', () => {
      setSideTab('codex');
      const name = b.dataset.codex;
      setTimeout(() => {
        const box2 = $('#center-body');
        const entry = [...box2.querySelectorAll('.codex-entry')].find((e) => e.textContent.includes(name));
        if (entry) entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      toast(`已跳转至图鉴 · ${name}`, 'gold');
    }));
    box.querySelectorAll('[data-setmain]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.setmain);
      const t = st.techniques[i];
      if (!t) return;
      st.player.mainTechnique = t.名称;
      S.refreshDerived(st);
      toast(`已将《${t.名称}》设为主修功法。`, 'jade');
      renderAll();
    }));
    renderSidePanel();
    return;
  }

  if (sideTab === 'npcs') {
    const known = S.knownNpcs(st);
    const knownCount = known.length;
    const pendingCount = st.npcs.length - knownCount;
    // 好感度颜色映射（使用模块级 favorColor 助手）
    // 种族图标
    const raceIcon = (r) => ({ '人': '👤', '妖': '🦊', '灵': '✨', '仙': '⚡', '魔': '🌑' }[r] || '👤');
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg><span class="pt-text">道缘关系网（已识 ${knownCount} 人 · 待缘 ${pendingCount} 人）</span></div>
        <div class="npc-grid">
        ${known.length ? known.map((n) => {
          const fc = favorColor(n.favor);
          return `
          <div class="npc-card" data-i="${st.npcs.indexOf(n)}">
            <div class="npc-avatar">${raceIcon(n.race)}</div>
            <div class="npc-info">
              <div class="npc-name-row"><b class="npc-name">${n.name}</b><span class="npc-relation" style="color:${fc}">${n.relationName}</span></div>
              <div class="npc-detail">${n.realm} · ${n.job} · <em class="npc-trait">${n.trait}</em></div>
              <div class="npc-favor-bar"><i style="width:${Math.min(100, n.favor)}%;background:${fc}"></i><span>${n.favor}</span></div>
            </div>
          </div>`}).join('') : '<div class="opt-desc">尚无道缘。在决策罗盘的「道缘」行动可结识同道。</div>'}
        </div>
        <div class="opt-desc" style="margin-top:12px">${pendingCount > 0 ? `世间尚有 ${pendingCount} 位有缘人未遇，可在游历、寻访或主动拜访中逐步结识。` : '所有有缘人均已相识，莫负道友情。'}</div>
      </div>`;
    box.querySelectorAll('.npc-card[data-i]').forEach((r) => r.addEventListener('click', () => {
      const n = st.npcs[Number(r.dataset.i)];
      if (n && n.met !== false) npcInteractModal(n);
    }));
    renderSidePanel();
    return;
  }

  if (sideTab === 'codex') {
    const { codexEntries, codexStats, ITEM_TYPES, activeSetBonuses, itemSetOf } = CX;
    const SLOT_NAMES = { weapon: '武器', armor: '衣服', pants: '裤子', boots: '鞋子', accessory: '戒指', artifact: '法宝' };
    const stats = codexStats(st);
    let cat = box.dataset.codexCat || '全部';
    const q = (box.dataset.codexSearch || '').trim().toLowerCase();
    let entries = codexEntries(st, cat);
    if (q) entries = entries.filter((e) => [e.name, e.category, e.rarity, e.source, e.effect].some((f) => String(f || '').toLowerCase().includes(q)));
    const sortKey = box.dataset.codexSort || 'default';
    if (sortKey === 'power') entries = [...entries].sort((a, b) => (b.realPower ?? -1) - (a.realPower ?? -1) || Number(b.discovered) - Number(a.discovered));
    else if (sortKey === 'name') entries = [...entries].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh') || Number(b.discovered) - Number(a.discovered));
    const sets = activeSetBonuses(st);
    box.innerHTML = `
      <div class="panel">
        <div class="codex-header">
        <div class="panel-title" style="position:static;margin:0;padding:0;border:none;background:none;"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0zM14 4c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0z"/></svg><span class="pt-text">万物图鉴</span></div>
        <div class="codex-search"><input id="codex-search-input" type="search" placeholder="搜索名称 / 品阶 / 来源 / 功能…" value="${q}" aria-label="搜索图鉴"></div>
        <div class="codex-stats">
          <div class="codex-stat"><b>${stats.totalFound}</b><span>已发现 / ${stats.totalAll}</span></div>
          ${ITEM_TYPES.map((t) => `<div class="codex-stat"><b>${stats.byType[t]?.found || 0}</b><span>${t}</span></div>`).join('')}
        </div>
        ${sets.length ? `<div class="set-bonus-list">${sets.map((s) => `<div class="set-bonus-item"><b>✨ ${s.name}套装（${s.count}件）</b><span>${s.text}</span></div>`).join('')}</div>` : ''}
        <div class="codex-filters">
          ${['全部', ...ITEM_TYPES].map((t) => `<button class="codex-filter compass-filter ${cat === t ? 'on' : ''}" data-cat="${t}">${t}</button>`).join('')}
        </div>
        <div class="codex-sort">
          <span class="codex-sort-label">排序</span>
          ${[['default', '默认'], ['power', '战力'], ['name', '名称']].map(([k, lbl]) => `<button class="codex-sort-btn ${sortKey === k ? 'on' : ''}" data-sort="${k}">${lbl}</button>`).join('')}
        </div>
        </div>
        ${entries.length ? entries.map((e) => {
          const setOf = e.discovered ? itemSetOf(e.name) : null;
          return `
          <div class="codex-entry ${e.discovered ? '' : 'codex-undiscovered'} ${pendingCodexFlash.includes(e.name) ? 'codex-flash' : ''}" data-codex-name="${e.name}" data-codex-cat="${e.category}" role="button" tabindex="0">
            <div class="codex-icon">${e.discovered ? ({ '装备': '🗡️', '法宝': '✨', '丹药': '💊', '道具': '📜', '材料': '🌿', '容器': '🎒', '线索': '🗺️', '灵兽': '🐾', '功法': '📜', '灵草': '🌱' }[e.category] || '❓') : '❓'}</div>
            <div class="codex-body">
              <div class="codex-name">${e.discovered ? e.name : '???'} <span class="codex-rarity ${e.rarity}">${e.rarity}</span>${e.slot ? `<span class="codex-slot">${SLOT_NAMES[e.slot] || ''}</span>` : ''}${e.count ? `<span class="codex-count">持有${e.count}件</span>` : ''}${setOf ? `<span class="codex-set-tag">${setOf}套装</span>` : ''}${e.realPower != null ? `<span class="codex-power">实测战力 ${e.realPower}</span>` : ''}</div>
              ${e.discovered ? `<div class="codex-effect">${e.effect}</div><div class="codex-source">获取：${e.source}</div>` : '<div class="codex-effect">尚未发现，继续探索修真界</div>'}
            </div>
          </div>`;
        }).join('') : `<div class="opt-desc">没有匹配「${q}」的图鉴条目。</div>`}
        <div class="opt-desc" style="margin-top:8px">提示：点击任意条目查看详细功能介绍；获得物品会自动记录到图鉴。未发现的物品显示为未知。</div>
      </div>`;
    const searchInput = box.querySelector('#codex-search-input');
    if (searchInput) searchInput.addEventListener('input', () => { box.dataset.codexSearch = searchInput.value; renderCenter(); });
    box.querySelectorAll('.codex-filter').forEach((b) => b.addEventListener('click', () => { box.dataset.codexCat = b.dataset.cat; box.dataset.codexSearch = ''; renderCenter(); }));
    box.querySelectorAll('.codex-sort-btn').forEach((b) => b.addEventListener('click', () => { box.dataset.codexSort = b.dataset.sort; renderCenter(); }));
    box.querySelectorAll('.codex-entry').forEach((el) => {
      el.addEventListener('click', () => openCodexModal(el.dataset.codexName, el.dataset.codexCat));
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCodexModal(el.dataset.codexName, el.dataset.codexCat); } });
    });
    renderSidePanel();
    return;
  }

  if (sideTab === 'realm') {
    const { realmGuide, REALM_GUIDE } = CX;
    const cur = realmGuide(st.player.level);
    const toxic = Number(st.flags?.pillToxicity || 0);
    const sideEffect = CX.pillSideEffect(st);
    const bd = S.powerBreakdown(st);
    const btRate = S.breakthroughRate(st);
    const maxItem = Math.max(1, ...bd.items.map((i) => i.value));
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19l5-9 4 6 3-5 6 8z"/></svg><span class="pt-text">境界修为</span></div>
        <div class="realm-current">
          <div class="realm-current-name">${cur.name}</div>
          <div class="realm-current-range">修为 Lv.${st.player.level}（范围 ${cur.min}-${cur.max}）</div>
          <div class="realm-current-life">寿元上限：${st.player.lifespan} 年 ｜ 当前骨龄：${st.player.age} 岁</div>
          <div class="realm-current-detail">${cur.detail}</div>
          <div class="realm-unlock">🔓 已解锁：${cur.unlock}</div>
          <div class="realm-bottleneck">⚡ 瓶颈：${cur.bottleneck}</div>
          ${cur.next ? `<div class="opt-desc" style="margin-top:8px">下一阶段：${cur.next}</div>` : ''}
        </div>
        ${sideEffect ? `<div class="toxicity-hint ${sideEffect.level}">💊 ${sideEffect.text}</div>` : ''}
        ${toxicityBarHTML(toxic)}
        <div class="side-subtitle">七大境界</div>
        ${REALM_GUIDE.map((r) => {
          const isCurrent = st.player.level >= r.min && st.player.level <= r.max;
          const isPast = st.player.level > r.max;
          return `<div class="realm-list-item ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}">
            <div class="realm-list-name">${r.name} ${isCurrent ? '← 当前' : isPast ? '✓' : ''}</div>
            <div class="realm-list-range">Lv.${r.min}-${r.max} ｜ 寿元 ${r.life} 年</div>
            <div class="realm-list-detail">${r.detail}</div>
            <div class="realm-list-detail" style="color:var(--jade)">🔓 ${r.unlock}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20a8 8 0 1 1 16 0"/><path d="M12 12v8M9 14l3 3 3-3"/></svg><span class="pt-text">战力构成</span><span class="panel-hint">十维拆解 · 平衡核查</span></div>
        <div class="powerbd">
          ${bd.items.map((i) => `
            <div class="powerbd-row">
              <div class="powerbd-label">${i.label}<span>${i.hint}</span></div>
              <div class="powerbd-bar"><i style="width:${Math.round((i.value / maxItem) * 100)}%"></i><b>${i.value}</b></div>
            </div>`).join('')}
        </div>
        <div class="powerbd-total">合计战力 <b>${bd.total}</b>${bd.milestone ? ` · <span class="powerbd-milestone">道基里程碑「${bd.milestone}」×${bd.daoBaseMul.toFixed(2)}</span>` : ''}</div>
        <div class="opt-desc">战力由境界、灵根、装备、法宝、功法、灵兽、套装、道韵、丹药、道基十项叠加，再乘道基里程碑倍率。数值已收束至合理区间，无单项崩坏。</div>
      </div>
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg><span class="pt-text">渡劫突破</span><span class="panel-hint">引动天劫 · 问鼎更高境界</span></div>
        ${btRate == null ? `<div class="opt-desc">当前境界尚未触及瓶颈，安心修炼、稳固道基，以待突破时机。</div>` : `
        <div class="bt-rate-text">本次突破成功率 <b>${btRate}%</b></div>
        <div class="bt-rate-bar"><i style="width:${btRate}%"></i></div>
        <div class="opt-desc">成功率受瓶颈基础值、道心/气运道基、渡劫丹、灵根与道韵影响；失败仅跌落若干境界，不致身死（飞升之劫除外）。</div>
        <button class="btn btn-gold btn-block" id="btn-breakthrough">⚡ 引动天劫 · 尝试突破</button>`}
      </div>`;
    if (btRate != null) {
      const btBtn = box.querySelector('#btn-breakthrough');
      if (btBtn) btBtn.addEventListener('click', () => {
        const res = S.attemptBreakthrough(st);
        (res.logs || []).forEach((l) => pushLog(l));
        toast(res.success ? `渡劫成功！突破${res.name}` : `渡劫失败 · ${res.name}`, res.success ? 'gold' : 'warn');
        renderAll();
      });
    }
    renderSidePanel();
    return;
  }

  if (sideTab === 'cave') {
    const cave = (st.cave = st.cave || {});
    cave.garden = Array.isArray(cave.garden) ? cave.garden : [];
    cave.alchemy = Array.isArray(cave.alchemy) ? cave.alchemy : [];
    const CAVE_LEVELS = D.CAVE_LEVELS;
    const curCave = CAVE_LEVELS[Math.min(cave.level || 0, CAVE_LEVELS.length - 1)];
    const garden = cave.garden;
    const herbs = D.HERB_TYPES;
    const recipes = Object.values(D.PILL_RECIPES);
    const alchemySection = `
      <div class="side-subtitle">丹炉 · 炼制中 ${cave.alchemy.length}/${alchemySlots(st)} 炉</div>
      <div class="alchemy-box">
        ${cave.alchemy.length ? cave.alchemy.map((p) => {
          const r = D.PILL_RECIPES[p.recipeId];
          if (!r) return '';
          const total = (p.dueYear - p.startedYear) * 12 + (p.dueMonth - p.startedMonth);
          const elapsed = (st.world.year - p.startedYear) * 12 + (st.world.month - p.startedMonth);
          const pct = total > 0 ? Math.max(0, Math.min(100, Math.round(elapsed / total * 100))) : 100;
          return `
          <div class="alchemy-row refining">
            <div class="alchemy-flame"><span class="flame"></span></div>
            <div class="alchemy-info"><b>${r.icon} ${r.name}</b><span>炼制中 · 预计 ${p.dueYear}年${p.dueMonth}月出炉</span></div>
            <div class="alchemy-prog"><i style="width:${pct}%"></i><span>${pct}%</span></div>
          </div>`;
        }).join('') : '<div class="opt-desc">丹炉空置，挑选丹方开炉吧。</div>'}
        <div class="side-subsubtitle">丹方（${recipes.filter((r) => isRecipeUnlocked(st, r.id)).length}/${recipes.length} 已解锁）</div>
        <div class="alchemy-recipes">
          ${recipes.map((r) => {
            const unlocked = isRecipeUnlocked(st, r.id);
            const matsOk = Object.entries(r.need).every(([n, c]) => (st.items.find((x) => x.名称 === n)?.数量 || 0) >= c);
            const stoneOk = !r.stoneCost || S.totalStones(st) >= r.stoneCost;
            const full = cave.alchemy.length >= alchemySlots(st);
            const cls = !unlocked ? 'locked' : (!matsOk || !stoneOk || full ? 'lacking' : 'ready');
            return `
            <div class="alchemy-recipe ${cls}">
              <div class="ar-head"><b>${r.icon} ${r.name}</b><span class="ar-tier">${r.tier}品</span></div>
              <div class="ar-meta">耗时 ${r.months}月 ｜ 基础成丹 ${r.baseRate}%</div>
              <div class="ar-need">
                ${Object.entries(r.need).map(([n, c]) => {
                  const have = st.items.find((x) => x.名称 === n)?.数量 || 0;
                  return `<span class="ar-mat ${have >= c ? 'ok' : 'no'}">${n} ${have}/${c}</span>`;
                }).join('')}
                ${r.stoneCost ? `<span class="ar-mat ${stoneOk ? 'ok' : 'no'}">灵石 ${S.totalStones(st)}/${r.stoneCost}</span>` : ''}
              </div>
              <button class="btn btn-sm btn-gold" data-refine="${r.id}" ${(!unlocked || !matsOk || !stoneOk || full) ? 'disabled' : ''}>${unlocked ? (full ? '丹炉已满' : '开炉炼制') : '未解锁'}</button>
              ${!unlocked ? `<div class="ar-hint">${D.PILL_UNLOCK_HINT[r.id] || ''}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12H3zM9 21v-6h6v6"/></svg><span class="pt-text">洞府 · ${cave.name || curCave.name}</span><span class="panel-hint">Lv.${cave.level || 0} ｜ 修炼加成 +${Math.round((cave.bonus || 0) * 100)}%</span></div>
        <div class="opt-desc">洞府是修行根基。此处可经营灵草园，于灵田播种灵草、按月生长、成熟后收入储物袋炼丹。洞府升级（修炼加成）仍于决策罗盘的「经营」行动进行。<b>灵田随洞府等级进阶</b>：Lv.2 起灵草品质渐升、收获产量更高，Lv.1 起灵草园容量逐步扩展（最高 8 株）。</div>
        <div class="side-subtitle">灵草园 · ${garden.length}/${gardenCapacity(st)} 株${herbSpringBonus(st) > 0 ? ` · 💧灵泉涌动（引泉 ${st.cave?.springLevel || 0} 重）` : ''}</div>
        <div class="opt-desc" style="margin:6px 0 10px">💧 灵泉涌动分「洞府基础（Lv.5+ 自动 +1）」与「引泉重数」两部分，可在决策罗盘「经营」中耗灵石引泉升级，每重令灵草月生长额外 +1 月。</div>
        ${garden.length ? garden.map((h, i) => {
          const mature = h.progress >= h.grow;
          const atCap = (h.irrigatedThisMonth || 0) >= HERB_IRRIGATE_CAP_PER_MONTH;
          return `
          <div class="herb-row ${mature ? 'mature' : ''}">
            <div class="herb-info"><b>${h.name}</b><span>播种于 ${h.planted || '?'}</span><span class="herb-q">${herbQuality(st).label}灵田${herbSpringBonus(st) > 0 ? ' · 💧灵泉' : ''}${(h.irrigated||0) > 0 ? ` · 💧浸润${h.irrigated}（收获+${Math.min(h.irrigated, HERB_IRRIGATE_YIELD_CAP)}）` : ''}</span></div>
            <div class="herb-grow"><i style="width:${Math.min(100, Math.round(h.progress / h.grow * 100))}%"></i><span>${h.progress}/${h.grow} 月${mature ? ' · 可收获' : (atCap ? ' · 本月浇灌已满' : '')}</span></div>
            <button class="btn btn-sm btn-gold" data-harvest="${i}" ${mature ? '' : 'disabled'}>${mature ? '收获' : '未熟'}</button>
            <button class="btn btn-sm btn-gold" data-irrigate="${i}" ${mature || atCap ? 'disabled' : ''}>浇灌（${HERB_IRRIGATE_COST}灵石）·剩${HERB_IRRIGATE_CAP_PER_MONTH - (h.irrigatedThisMonth || 0)}</button>
          </div>`;
        }).join('') : '<div class="opt-desc">灵田空置，挑选一株灵草播下灵种吧。</div>'}
        <div class="side-subtitle">播种灵草</div>
        <div class="herb-seed-list">
          ${herbs.map((hb) => `
            <div class="herb-seed">
              <div class="herb-seed-info"><b>${hb.name}</b><span>${hb.desc} ｜ ${hb.grow}月熟 ｜ 产出 ${hb.yield.名称}×${hb.yield.数量 || 1}</span></div>
              <button class="btn btn-sm btn-gold" data-plant="${hb.id}" ${garden.length >= gardenCapacity(st) ? 'disabled' : ''}>播种（${hb.seedCost}灵石）</button>
            </div>`).join('')}
        </div>
        <div class="opt-desc" style="margin-top:8px">灵草成熟需若干月（随游戏月度推进），<b>播种即解锁「灵草」图鉴</b>，收获产物自动入袋，可在行囊「材料」分类与图鉴中查看。集齐全部 4 种灵草可触发「百草通鉴」成就。<b>灵泉浇灌除加速生长外，每次还会累积提升最终收获产量（累计封顶 +${HERB_IRRIGATE_YIELD_CAP}）。</b></div>
        <div class="side-subtitle">🌿 灵草杂交</div>
        <div class="opt-desc">将两种不同的灵草产物杂交，凝成奇珍灵材（图鉴收集 + 高价可售）。每次消耗灵石 ${D.HERB_HYBRID_COST}。</div>
        <div class="herb-seed-list">
          ${D.HERB_HYBRIDS.map((hy) => {
            const ca = (st.items.find((x) => x.名称 === hy.a)?.数量) || 0;
            const cb = (st.items.find((x) => x.名称 === hy.b)?.数量) || 0;
            const can = ca >= 1 && cb >= 1 && (st.currencies['下品灵石'] || 0) >= D.HERB_HYBRID_COST;
            return `<div class="herb-seed">
              <div class="herb-seed-info"><b>${hy.out.名称}</b><span>${hy.a} + ${hy.b} → ${hy.out.名称}（价值 ${hy.out.价值}）</span><span class="herb-q">持有：${ca}/${cb}</span></div>
              <button class="btn btn-sm btn-gold" data-cross="${hy.a}|${hy.b}" ${can ? '' : 'disabled'}>杂交</button>
            </div>`;
          }).join('')}
        </div>
        ${alchemySection}
      </div>`;
    box.querySelectorAll('[data-plant]').forEach((b) => b.addEventListener('click', () => {
      const r = plantHerb(st, b.dataset.plant);
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法播种'), r.ok ? 'jade' : 'warn');
      renderAll();
    }));
    box.querySelectorAll('[data-harvest]').forEach((b) => b.addEventListener('click', () => {
      const r = harvestHerb(st, Number(b.dataset.harvest));
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法收获'), r.ok ? 'gold' : 'warn');
      renderAll();
    }));
    box.querySelectorAll('[data-irrigate]').forEach((b) => b.addEventListener('click', () => {
      const r = irrigateHerb(st, Number(b.dataset.irrigate));
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法浇灌'), r.ok ? 'jade' : 'warn');
      renderAll();
    }));
    box.querySelectorAll('[data-cross]').forEach((b) => b.addEventListener('click', () => {
      const [a, bname] = b.dataset.cross.split('|');
      const r = crossbreedHerbs(st, a, bname);
      (r.logs || []).forEach((l) => pushLog(l));
      toast(r.ok ? r.logs[0] : (r.logs[0] || '无法杂交'), r.ok ? 'gold' : 'warn');
      renderAll();
    }));
    box.querySelectorAll('[data-refine]').forEach((b) => b.addEventListener('click', () => {
      const r = refinePill(st, b.dataset.refine);
      (r.logs || []).forEach((l) => pushLog(l));
      if (r.ok) toast('丹炉已点燃！' + (r.logs[0] || ''), 'gold');
      else toast(r.logs[0] || '无法炼制', 'warn');
      renderAll();
    }));
    renderSidePanel();
    return;
  }

  if (sideTab === 'achv') {
    const { checkAchievements, achievementView } = CX;
    const { TITLES } = D;
    checkAchievements(st);
    const view = achievementView(st);
    const got = st.achievements?.length || 0;
    const claimableCount = view.filter((a) => a.unlocked && !a.claimed && a.reward).length;
    const ownedTitles = (st.player.titles || []).map((id) => TITLES.find((t) => t.id === id)).filter(Boolean);
    const lockedCount = TITLES.length - ownedTitles.length;
    const activeTitle = (st.player.activeTitle && TITLES.find((t) => t.id === st.player.activeTitle)) || null;
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4"/></svg><span class="pt-text">封号 · 威名</span><span class="panel-hint">已获 ${ownedTitles.length}/${TITLES.length}${lockedCount ? ` ｜ 未获 ${lockedCount}` : ''}</span></div>
        <div class="title-active">当前佩戴：${activeTitle ? `<b class="title-name">${activeTitle.name}</b><span>${activeTitle.desc}</span>` : '<span class="title-none">（未佩戴封号）</span>'}</div>
        <div class="title-list">
          ${ownedTitles.length ? ownedTitles.map((t) => `
            <button class="title-chip ${st.player.activeTitle === t.id ? 'on' : ''}" data-title="${t.id}" title="${t.desc}">
              🏅 ${t.name}${st.player.activeTitle === t.id ? ' ✓' : ''}
            </button>`).join('') : '<span class="opt-desc">尚未获得任何封号。达成天命终局、关键里程碑与隐藏奇遇即可解锁。</span>'}
        </div>
        <div class="opt-desc" style="margin-top:8px">封号记录你的仙途威名，可随时切换佩戴。天命终局、战力/图鉴/灵石里程碑、收服幼凰与秘境深处皆可解锁封号。</div>
      </div>
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/></svg><span class="pt-text">成就·仙途里程碑</span><span class="panel-hint">已达成 ${got}/${view.length}</span>${claimableCount ? `<button class="btn btn-xs btn-gold achv-claimall" data-claimall="1">一键领取(${claimableCount})</button>` : ''}</div>
        <div class="achv-progress"><i style="width:${(got / view.length * 100).toFixed(0)}%"></i></div>
        <div class="achv-grid">
          ${view.map((a) => `
            <div class="achv-card ${a.unlocked ? 'done' : 'locked'}">
              <div class="achv-icon">${a.unlocked ? (a.id === 'start' ? '🌱' : '✅') : '🔒'}</div>
              <div class="achv-body">
                <b>${a.name}</b><span>${a.desc}</span>
                ${a.progress ? `<div class="achv-bar"><i style="width:${Math.round(a.progress.ratio * 100)}%"></i><span>${formatNum(a.progress.cur)}/${formatNum(a.progress.max)}</span></div>` : (a.unlocked ? (a.claimed ? `<small class="achv-claimed">✓ 已领取${a.reward ? ` · ${a.reward.stones || 0}灵石` : ''}</small>` : `<button class="btn btn-xs btn-gold achv-claim" data-claim="${a.id}">领取奖励${a.reward ? ` · ${a.reward.stones || 0}灵石` : ''}</button>`) : '<small>未达成</small>')}
              </div>
            </div>`).join('')}
        </div>
        <div class="opt-desc" style="margin-top:8px">成就随仙途推进自动解锁，带进度条者显示当前进度；达成后可在卡片上领取灵石奖励（仅一次）。达成立即弹出提示并计入仙途纪事。</div>
      </div>`;
    box.querySelectorAll('[data-title]').forEach((b) => b.addEventListener('click', () => {
      const r = S.setActiveTitle(st, b.dataset.title);
      toast(r.logs[0], 'gold');
      renderAll();
    }));
    box.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => {
      const r = CX.claimAchievement(st, b.dataset.claim);
      if (r.ok) r.logs.forEach((l) => toast(l, 'gold'));
      else toast(r.msg, 'warn');
      renderAll();
    }));
    box.querySelectorAll('[data-claimall]').forEach((b) => b.addEventListener('click', () => {
      const r = CX.claimAllAchievements(st);
      if (r.ok) toast(`已一键领取 ${r.total} 下品灵石`, 'gold');
      else toast('暂无可领取的成就奖励', 'warn');
      renderAll();
    }));
    renderSidePanel();
    return;
  }

  if (sideTab === 'map') {
    const regionDefs = D.REGIONS;
    const curId = st.world.regionId || 'zhongzhou';
    const cur = REGION_TRAVEL[curId] || REGION_TRAVEL.zhongzhou;
    const traveling = !!st.world.travel?.destination;
    const bonusText = (b) => Object.entries(b || {}).map(([k, v]) => `${k}+${v}`).join(' · ') || '—';
    const dangerStars = (n) => '⚔'.repeat(n) + '·'.repeat(Math.max(0, 5 - n));
    const cards = regionDefs.map((r) => {
      const t = REGION_TRAVEL[r.id] || {};
      const isCur = r.id === curId;
      const isNeighbor = (cur.neighbors || []).includes(r.id);
      const marketCount = (REGION_MARKET[r.id] || []).length;
      const canGo = isNeighbor && !isCur && !traveling;
      return `
        <div class="region-card ${isCur ? 'current' : ''}">
          <div class="region-head">
            <span class="region-name">${r.name}</span>
            ${isCur ? '<span class="region-cur">当前</span>' : ''}
          </div>
          <div class="region-specialty">特产：${t.specialty || '未知奇珍'}</div>
          <div class="region-flavor">${r.desc || t.flavor || ''}</div>
          <div class="region-meta">
            <span class="region-danger" title="危险度">危险 ${dangerStars(t.danger || 2)}</span>
            <span class="region-req">建议 ${S.realmLevelName(t.realmReq || 1)}</span>
          </div>
          <div class="region-bonus">地域加成：${bonusText(r.bonus)}</div>
          <div class="region-routes">
            相邻：${(t.neighbors || []).map((n) => `<i>${REGION_TRAVEL[n] ? D.REGIONS.find((x) => x.id === n)?.name || n : n}</i>`).join('') || '无'}
          </div>
          <div class="region-market">坊市在售 ${marketCount} 类商品</div>
          <div class="region-act">
            ${isCur
              ? '<span class="region-here">你正身处此地</span>'
              : canGo
                ? `<button class="btn btn-sm btn-gold" data-go="${r.id}">前往（${t.cost}灵石·${t.months}月）</button>`
                : traveling
                  ? '<span class="region-here">旅途中…</span>'
                  : '<span class="region-here">需先抵相邻地域</span>'}
          </div>
        </div>`;
    }).join('');
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2zM9 3v16M15 5v16"/></svg><span class="pt-text">天玄疆域图</span><span class="panel-hint">七域连通，各有奇遇</span></div>
        ${traveling ? `<div class="toxicity-hint info">🧭 你正前往${D.REGIONS.find((x) => x.id === st.world.travel.destination)?.name || '未知地域'}，还需 ${st.world.travel.remaining} 个月抵达。</div>` : ''}
        <div class="region-grid">${cards}</div>
        <div class="opt-desc" style="margin-top:8px">提示：妖兽材料、灵植、遗府奇珍皆与地域绑定。前往新地域会刷新坊市库存、野外事件与天机简报。</div>
      </div>`;
    box.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', async () => {
      const target = b.dataset.go;
      const result = startTravel(st, target);
      toast(result.text, result.ok ? 'gold' : 'warn');
      if (!result.ok) return;
      await settleMonth({ title: '前往新地域', logs: [result.text] });
    }));
    renderSidePanel();
    return;
  }

  if (sideTab === 'logs') {
    const filters = ['全部', ...S.LOG_TYPES];
    const gameList = (st.logs || []).filter((l) => logFilter === '全部' || l.type === logFilter);
    const sysList = (st.sysLogs || []).slice().reverse();
    box.innerHTML = `
      <div class="panel">
        <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg><span class="pt-text">日志</span></div>
        <div class="log-tab-bar">
          <button class="log-tab-btn ${sysLogMode === 'game' ? 'on' : ''}" data-ltab="game">📜 游戏日志 <span class="log-tab-count">${st.logs?.length || 0}</span></button>
          <button class="log-tab-btn ${sysLogMode === 'system' ? 'on' : ''}" data-ltab="system">⚠️ 系统日志 <span class="log-tab-count">${st.sysLogs?.length || 0}</span></button>
        </div>
        <div class="log-panel-game" style="${sysLogMode === 'game' ? '' : 'display:none'}">
          <div class="log-filters">
            ${filters.map((f) => `<button class="log-filter ${logFilter === f ? 'on' : ''}" data-f="${f}">${f}</button>`).join('')}
          </div>
          <div class="log-entries">
            ${gameList.length ? [...gameList].reverse().map((l) => `
              <div class="log-entry ${l.type === '异常' ? 'le-error' : l.type === '警告' ? 'le-warn' : ''}">
                <span class="log-badge lt-${l.type}">${l.type}</span>
                <span class="log-time">${l.time}</span>
                <span class="log-text">${l.text}</span>
              </div>`).join('') : '<div class="opt-desc">暂无游戏日志。行动、战斗、天命推进都会记录在此。</div>'}
          </div>
          <div class="log-actions">
            <span>游戏日志按类型筛选，最新记录在上方</span>
            <button class="btn btn-sm" id="btn-clear-logs">清空游戏日志</button>
          </div>
        </div>
        <div class="log-panel-system" style="${sysLogMode === 'system' ? '' : 'display:none'}">
          <div class="opt-desc" style="margin-bottom:8px">系统自动捕获运行时错误与异常，用于排查问题。最多保留 200 条。</div>
          <div class="log-entries">
            ${sysList.length ? sysList.map((l) => `
              <div class="log-entry le-error">
                <span class="log-badge lt-异常">${l.type}</span>
                <span class="log-time">${l.time}</span>
                <span class="log-text">${l.text}</span>
              </div>`).join('') : '<div class="opt-desc" style="color:var(--jade-soft)">✅ 暂无系统异常，运行正常。</div>'}
          </div>
          <div class="log-actions">
            <span>系统日志仅记录错误，不可手动清空（重启后清空）</span>
            <button class="btn btn-sm" id="btn-clear-syslogs">清空系统日志</button>
          </div>
        </div>
      </div>`;
    // 日志子标签切换
    box.querySelectorAll('.log-tab-btn').forEach((b) => b.addEventListener('click', () => { sysLogMode = b.dataset.ltab; renderCenter(); }));
    // 游戏日志筛选
    if (sysLogMode === 'game') {
      box.querySelectorAll('.log-filter').forEach((b) => b.addEventListener('click', () => { logFilter = b.dataset.f; renderCenter(); }));
      box.querySelector('#btn-clear-logs').addEventListener('click', async () => {
        if (await confirmModal('确定清空全部游戏日志？（不影响其他存档数据）', '清空', '取消')) { st.logs = []; renderCenter(); toast('游戏日志已清空', 'gold'); }
      });
    }
    // 系统日志清空
    const clearSysBtn = box.querySelector('#btn-clear-syslogs');
    if (clearSysBtn) clearSysBtn.addEventListener('click', async () => {
      if (await confirmModal('确定清空系统错误日志？', '清空', '取消')) { st.sysLogs = []; renderCenter(); toast('系统日志已清空', 'gold'); }
    });
    renderSidePanel();
    return;
  }

  if (sideTab === 'beasts') {
    renderBeastsPanel(box);
    return;
  }

  if (sideTab === 'settings') {
    renderSettingsPanel(box);
    return;
  }
}

/* 重新绑定决策罗盘 / 自由行动（仙途整页重建后需要重绑） */
function renderCenterButtons() {
  const fa = $('#free-action-input');
  if (fa && !fa.dataset.bound) {
    fa.dataset.bound = '1';
    fa.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-free-action')?.click(); });
  }
  const fb = $('#btn-free-action');
  if (fb) fb.addEventListener('click', () => {
    const input = $('#free-action-input');
    const text = input.value.trim();
    if (!text) { toast('请先描述你想做的事', 'warn'); return; }
    input.value = '';
    freeAction(text);
  });
}

const BEAST_TALENT_TEXT = {
  '风刃突袭': '先手突袭：出战时额外 +5% 胜率',
  '幻境迷心': '惑乱强敌：出战且对战更强对手时额外 +8% 胜率',
  '铁背护主': '铁背护体：出战战败时大幅减免惩罚（免重伤、免失灵石）',
  '玄水护盾': '玄水护持：出战秘境探索时灵材获取 +1',
  '雷击俯冲': '雷霆俯冲：常驻战斗胜率 +8%（见灵兽助阵）',
  '涅槃残焰': '涅槃残焰：出战渡劫失败时替你化解反噬，修为不跌落（境界无损）',
};
/** 灵兽面板：展示已收服灵兽、栏位信息、战力加成 */
function renderBeastsPanel(box) {
  const st = GameState.data;
  const beasts = CX.ensureBeastState(st);
  const slots = beasts.slots || [];
  const maxSlots = beasts.maxSlots || 1;
  const totalPower = CX.beastPowerBonus(st);
  const elemIcon = (e) => ({ 风: '🌪️', 土: '🪨', 幻: '👻', 雷: '⚡', 水: '💧', 火: '🔥' }[e] || '✨');
  box.innerHTML = `
    <div class="panel">
      <div class="panel-title"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span class="pt-text">灵兽栏（${slots.length}/${maxSlots}）</span></div>
      ${slots.length ? `
        <div class="beast-list">${slots.map((b, i) => {
          const isActive = i === (beasts.activeIdx ?? -1);
          const star = b.star || 1;
          const starCost = 200 * star * star;
          const maxed = star >= 5;
          const canAfford = (st.currencies?.['下品灵石'] || 0) >= starCost;
          return `
          <div class="beast-card ${isActive ? 'active' : ''}">
            <div class="beast-icon">${elemIcon(b.element)} ${b.name}${isActive ? ' <span class="beast-active-tag">出战</span>' : ''}</div>
            <div class="beast-info">
              <div class="beast-meta"><span class="beast-element">${b.element}系</span><span class="beast-power">战力+${b.power}</span><span class="beast-star">★${star}</span></div>
              <div class="beast-skill">技能：${b.skill}</div>
              <div class="beast-talent ${isActive ? 'talent-active' : ''}">${isActive ? '出战天赋' : '天赋'}：${BEAST_TALENT_TEXT[b.skill] || '（暂无特殊天赋）'}</div>
              <div class="beast-desc">${b.desc}</div>
            </div>
            <div class="beast-acts">
              ${isActive ? `<button class="btn btn-xs text-btn" data-unbeast="${i}">收回出战</button>` : `<button class="btn btn-xs btn-gold" data-setbeast="${i}">设为出战</button>`}
              <button class="btn btn-xs ${maxed ? 'btn-dim' : 'btn-gold'}" data-starup="${i}" ${maxed || !canAfford ? 'disabled' : ''}>${maxed ? '已满星' : `升星 · ${starCost}灵石`}</button>
            </div>
          </div>`;
        }).join('')}</div>
        <div class="opt-desc" style="margin-top:8px">灵兽总战力加成：<b style="color:var(--jade)">+${totalPower}</b>（计入战斗胜率与采集收益）。指定一只「出战」灵兽可在战斗中额外护主，胜率再 +${S.activeBeastBonus(st)}%（星级越高加成越大，1★+2% → 5★+10%）。</div>
      ` : `
        <div class="opt-desc">你尚未收服任何灵兽。</div>
        <div class="opt-desc" style="margin-top:6px"><b>如何收服灵兽：</b>当灵兽栏有空位时，决策罗盘会出现「前往灵兽栖息地」选项，遭遇野生灵兽后即可尝试收服（御兽等级越高成功率越高）。</div>
        <div class="opt-desc" style="margin-top:4px"><b>提高成功率：</b>使用「驭兽香」（坊市·消耗品）或「驯兽口粮」（百艺·御兽产出）可提升收服概率；提升百艺「御兽」等级也能增加成功率。</div>
        <div class="opt-desc" style="margin-top:4px"><b>灵兽加成：</b>已收服的灵兽会在战斗中助阵（提高胜率）并提供固定战力加成。成功收服灵兽可获得「灵兽契约」作为驯兽凭证；灵兽栏默认 1 格。</div>
      `}
    </div>`;
  box.querySelectorAll('[data-setbeast]').forEach((b) => b.addEventListener('click', () => {
    const r = S.setActiveBeast(st, Number(b.dataset.setbeast));
    (r.logs || []).forEach((l) => toast(l, r.ok ? 'gold' : 'warn'));
    renderAll();
  }));
  box.querySelectorAll('[data-unbeast]').forEach((b) => b.addEventListener('click', () => {
    const r = S.setActiveBeast(st, -1);
    (r.logs || []).forEach((l) => toast(l, 'info'));
    renderAll();
  }));
  box.querySelectorAll('[data-starup]').forEach((b) => b.addEventListener('click', () => {
    const r = S.upgradeBeast(st, Number(b.dataset.starup));
    (r.logs || []).forEach((l) => toast(l, r.ok ? 'gold' : 'warn'));
    renderAll();
  }));
  renderSidePanel();
}

/** 设置页（整页）：含多存档槽、头像、窗口尺寸、文字大小等 */
function renderSettingsPanel(box) {
  const st = GameState.data;
  const settings = st.settings || {};
  const slot = (window.__save?.getSaveSlot) ? window.__save.getSaveSlot() : '1';
  box.innerHTML = `
    <div class="panel">
      <div class="panel-title"><svg class="pt-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg><span class="pt-text">游戏设置</span></div>
      <div class="set-grid">
        <div class="set-row"><span>当前存档槽</span><b id="set-slot-name">存档 ${slot}</b></div>
        <div class="set-row"><span>存档目录</span><b>存档 / ${slot}（相对游戏目录，可整体迁移到任意电脑）</b></div>
        <div class="set-row"><span>道果码</span><b>${st.meta.saveCode}</b></div>
        <div class="set-row"><span>设定版本</span><b>V8.1.3 ｜ 游戏 v${st.meta.version}</b></div>
      </div>

      <div class="side-subtitle">外观与窗口</div>
      <div class="settings-group">
        <label class="setting-toggle"><span>自动存档（每月结算后）</span><input type="checkbox" id="setting-autosave" ${settings.autoSave !== false ? 'checked' : ''}></label>
        <label class="setting-toggle"><span>过渡动画</span><input type="checkbox" id="setting-animations" ${settings.animations !== false ? 'checked' : ''}></label>
        <label class="setting-toggle"><span>点击特效（水波/光晕）</span><input type="checkbox" id="setting-clickfx" ${settings.clickFx !== false ? 'checked' : ''}></label>
        <label class="setting-select"><span>文字大小</span><select id="setting-text-size"><option value="small" ${settings.textSize === 'small' ? 'selected' : ''}>小</option><option value="normal" ${!settings.textSize || settings.textSize === 'normal' ? 'selected' : ''}>标准</option><option value="large" ${settings.textSize === 'large' ? 'selected' : ''}>大</option></select></label>
        <label class="setting-select"><span>窗口尺寸</span><select id="setting-window-size"><option value="small">小（960×640）</option><option value="normal" ${!settings.windowSize || settings.windowSize === 'normal' ? 'selected' : ''}>标准（1280×800）</option><option value="large">大（1600×960）</option><option value="full">全屏铺满</option></select></label>
      </div>

      <div class="side-subtitle">仙侠头像</div>
      <div class="avatar-block">
        <div id="set-avatar-preview" class="set-avatar-preview">${renderAvatarPreviewHTML()}</div>
        <div class="opt-desc">选择一款仙侠风格的内置头像，立即生效并自动存档。</div>
      </div>
      ${builtInAvatarGridHTML(settings.avatarPreset)}

      <div class="side-subtitle">存档备份（导出 / 导入）</div>
      <div class="modal-actions col">
        <button class="btn btn-gold" id="btn-export-save">导出存档（JSON 文件）</button>
        <button class="btn" id="btn-import-save">导入存档（从 JSON 文件 / 文本）</button>
      </div>
      <div class="opt-desc">导出会把当前仙途完整状态保存为一份 JSON 文件，可随时备份或分享；导入后可覆盖当前存档槽。导入前建议先导出一份以防万一。</div>

      <div class="side-subtitle">存档槽管理</div>
      <div class="modal-actions col">
        <button class="btn btn-gold" id="btn-manual-save">立即存档</button>
        <button class="btn" id="btn-guide-settings">重新查看新手说明</button>
        <button class="btn" id="btn-reincarnate">主动转世重修</button>
        <button class="btn btn-red" id="btn-hard-reset">删档完全重开（当前槽）</button>
      </div>
      <div class="opt-desc">存档为明文 INI 文件，按类别拆分，可直接用记事本查看和手动编辑。多存档槽彼此独立，互不影响。</div>`;

  const saveSettings = () => {
    st.settings.autoSave = $('#setting-autosave')?.checked;
    st.settings.animations = $('#setting-animations').checked;
    st.settings.clickFx = $('#setting-clickfx').checked;
    st.settings.textSize = $('#setting-text-size').value;
    st.settings.windowSize = $('#setting-window-size').value;
    applyUiSettings(st.settings);
    applyWindowSize(st.settings.windowSize);
    saveNow(true);
  };
  const updatePresetGrid = (pid) => {
    box.querySelectorAll('.avatar-preset').forEach((b) => b.classList.toggle('on', b.dataset.preset === pid));
  };
  box.querySelectorAll('#setting-autosave,#setting-animations,#setting-clickfx,#setting-text-size,#setting-window-size').forEach((el) => el.addEventListener('change', saveSettings));
  box.querySelector('#btn-manual-save').addEventListener('click', () => saveNow());
  box.querySelector('#btn-export-save').addEventListener('click', exportSave);
  box.querySelector('#btn-import-save').addEventListener('click', () => importSaveModal(box));
  box.querySelector('#btn-guide-settings').addEventListener('click', showBeginnerGuide);
  box.querySelector('#btn-reincarnate').addEventListener('click', async () => {
    if (await confirmModal('确定转世重修？将继承半数灵石、三成道基与主修功法。', '转世', '再想想')) {
      const { resetSave } = await import('./save.js');
      const inherit = S.reincarnate(st, false);
      await resetSave();
      startCreation(inherit);
    }
  });
  box.querySelector('#btn-hard-reset').addEventListener('click', async () => {
    if (await confirmModal('⚠️ 将移空当前存档槽（移入历史备份），确定重开？', '删档重开', '取消')) {
      const { resetSave } = await import('./save.js');
      await resetSave();
      location.reload();
    }
  });
  box.querySelectorAll('.avatar-preset').forEach((b) => b.addEventListener('click', () => {
    const pid = b.dataset.preset;
    try {
      st.settings.avatarPreset = pid;
      renderHeroAvatar();
      const preview = box.querySelector('#set-avatar-preview');
      if (preview) preview.innerHTML = renderAvatarPreviewHTML();
      updatePresetGrid(pid);
      toast(`已切换为${BUILT_IN_AVATARS.find((a) => a.id === pid)?.name || ''}头像`, 'gold');
      saveNow(true);
    } catch (err) {
      console.warn('切换头像失败：', err);
      toast('切换头像失败，请重试', 'warn');
    }
  }));
}

/* ---------------- 存档导出 / 导入 ---------------- */
function exportSave() {
  try {
    const payload = { app: 'xiuxian', v: 1, savedAt: new Date().toISOString(), data: GameState.data };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `仙途存档_${GameState.data.player.name}_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('💾 存档已导出为 JSON 文件', 'gold');
  } catch (e) { toast(`导出失败：${e.message}`, 'warn'); }
}

function importSaveModal() {
  const m = openModal(`
    <div class="choice-intro">选择一份之前导出的 JSON 存档文件，或把文本粘贴到下方文本框。导入将覆盖当前存档槽。</div>
    <div class="modal-actions col" style="margin-bottom:12px">
      <label class="btn btn-gold" style="cursor:pointer">📂 选择文件<input type="file" id="import-file" accept=".json,application/json" style="display:none"></label>
    </div>
    <textarea id="import-text" class="import-textarea" placeholder="或在此粘贴存档 JSON 文本…"></textarea>
    <div class="modal-actions col">
      <button class="btn btn-gold" id="btn-do-import">确认导入</button>
      <button class="btn" id="btn-cancel-import">取消</button>
    </div>`,
    { title: '导入存档', lock: true });
  const fileInput = m.querySelector('#import-file');
  const textArea = m.querySelector('#import-text');
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    textArea.value = await f.text();
  });
  m.querySelector('#btn-cancel-import').addEventListener('click', () => closeModal());
  m.querySelector('#btn-do-import').addEventListener('click', async () => {
    const text = textArea.value.trim();
    if (!text) { toast('请先选择文件或粘贴文本', 'warn'); return; }
    const ok = await applyImportedSave(text);
    closeModal();
    if (ok) { toast('✅ 存档已导入，仙途延续', 'gold'); renderAll(); }
  });
}

async function applyImportedSave(text) {
  try {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !data.player) { toast('存档格式无法识别', 'warn'); return false; }
    const { ensureLifeState } = await import('./life.js');
    const { saveGame } = await import('./save.js');
    ensureLifeState(data);
    const ok = await saveGame(data);
    if (!ok) { toast('写入存档失败', 'warn'); return false; }
    GameState.setData(data);
    return true;
  } catch (e) {
    toast(`导入失败：${e.message}`, 'warn');
    return false;
  }
}

/** 成就解锁提示（带图标与说明，自动消失） */
function renderAchievementToast(a) {
  if (!a) return;
  toast(`🏆 成就达成：${a.icon || ''} ${a.name} — ${a.desc || ''}`, 'gold', 3200);
}

function renderAvatarPreviewHTML() {
  const url = resolveAvatarUrl();
  return url ? `<img class="hero-avatar-img" src="${url}" alt="头像">` : defaultAvatarSvg();
}

function defaultAvatarSvg() {
  return `<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></svg>`;
}

function builtInAvatarGridHTML(currentPreset) {
  return `<div class="avatar-grid">${BUILT_IN_AVATARS.map((a) => `
    <button class="avatar-preset ${currentPreset === a.id ? 'on' : ''}" data-preset="${a.id}" title="${a.name}">
      <img src="${builtInAvatarDataUrl(a.id)}" alt="${a.name}">
    </button>`).join('')}</div>`;
}

/** 窗口尺寸：浏览器下用 zoom 缩放整体，Electron 下可改真实窗口（预留） */
function applyWindowSize(size) {
  const map = { small: 0.8, normal: 1, large: 1.25, full: 'full' };
  try { window.localStorage.setItem('tianxuan-window', size || 'normal'); } catch {}
  if (size === 'full') {
    document.documentElement.style.removeProperty('--app-zoom');
    return;
  }
  const z = map[size] ?? 1;
  document.documentElement.style.setProperty('--app-zoom', String(z));
}

/* ============================================================
 * 保存
 * ========================================================== */
let saving = false;
let lastSaveBody = null; // 上次成功写入的序列化体：内容未变则跳过重复写盘（前瞻性能保护，且无数据丢失风险）
export async function saveNow(silent = false) {
  if (saving || !GameState.data) return;
  saving = true;
  try {
    const body = JSON.stringify({ files: serialize(GameState.data) });
    if (body === lastSaveBody) return; // 整棵 state 序列化后内容与上次一致 → 跳过重复写盘
    const ok = await saveGame(GameState.data);
    if (ok) lastSaveBody = body;
    if (!silent) toast(ok ? '💾 道果已存档' : '存档失败，请检查存档目录', ok ? 'gold' : 'warn');
  } catch (e) {
    toast(`存档失败：${e.message}`, 'warn');
  } finally {
    saving = false;
  }
}

/* ============================================================
 * 自由行动（自定义描述）
 * ========================================================== */
export async function freeAction(text) {
  if (acting) return;
  acting = true;
  try {
    const st = GameState.data;
    const logs = [`你决定「${text}」。`];
    // 简化判定：随机小收益
    const roll = Math.random();
    if (roll < 0.4) {
      const r = S.cultivate(st, 'normal');
      logs.push('此事让你心有所悟，顺带精进了修为。', ...r.logs.slice(1));
    } else if (roll < 0.65) {
      const key = Rng.pick(['悟性', '道心', '根骨', '气运']);
      S.addDaoBaseExp(st, key, Rng.int(5, 15), logs);
      logs.push(`此行触类旁通，「${key}」有所提升。`);
    } else if (roll < 0.8) {
      const found = Rng.int(5, 40);
      S.addStones(st, found);
      logs.push(`意外之喜！获得灵石约${found}枚。`);
    } else {
      logs.push('本月平平而过，但你乐在其中。');
    }
    S.refreshDerived(st);
    await settleMonth({ title: text, logs });
  } finally {
    acting = false;
  }
}

/* ============================================================
 * 背景灵气粒子
 * ========================================================== */
export function initParticles() {
  const cv = $('#bg-particles');
  if (!cv) return;
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return;
  let dots = [];
  function resize() {
    const W = window.innerWidth || document.documentElement.clientWidth || 1280;
    const H = window.innerHeight || document.documentElement.clientHeight || 720;
    cv.width = W; cv.height = H;
    dots = Array.from({ length: Math.min(90, Math.floor(W / 14)) }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.35 + 0.08,
      o: Math.random() * 0.5 + 0.15, drift: Math.random() * 0.4 - 0.2,
    }));
  }
  resize();
  window.addEventListener('resize', resize);
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const d of dots) {
      d.y -= d.s; d.x += d.drift;
      if (d.y < -5) { d.y = cv.height + 5; d.x = Math.random() * cv.width; }
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230, 201, 122, ${d.o})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  })();
}

/* ============================================================
 * 主页氛围：鼠标光晕跟随
 * ========================================================== */
export function initTitleAtmos() {
  const screen = $('#screen-title');
  if (!screen) return;
  screen.addEventListener('mousemove', (e) => {
    const r = screen.getBoundingClientRect();
    screen.style.setProperty('--mx', `${e.clientX - r.left}px`);
    screen.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  screen.addEventListener('mouseleave', () => {
    screen.style.setProperty('--mx', '50%');
    screen.style.setProperty('--my', '42%');
  });
}

/* ---------------- 暴露给 main.js 的日志接口 ---------------- */
export { pushLog, refreshCompass, renderNews, settleMonth, npcInteractModal };
