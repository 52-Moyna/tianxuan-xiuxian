/**
 * main.js —— 启动引导模块
 * ============================================================
 * 职责：页面加载后串联各模块——检测存档、绑定全局事件、进入标题界面。
 * 本文件只做「组装」，不含业务逻辑。
 */

import { GameState } from './state.js';
import { checkSaveExists, loadGame, setSaveSlot, getSaveSlot, listSlots } from './save.js';
import * as UI from './ui.js';
import * as SAVE from './save.js';
import { addLog } from './systems.js';

async function boot() {
  // 各初始化相互独立：任一失败都不应阻断后续（尤其按钮绑定），故逐个兜底。
  const safe = (label, fn) => { try { fn(); } catch (e) { console.warn(`[boot] ${label} 初始化失败：`, e?.message || e); } };
  safe('initTheme', UI.initTheme);
  safe('initParticles', UI.initParticles);
  safe('initClickFx', UI.initClickFx);
  safe('initA11y', UI.initA11y);
  safe('initTitleAtmos', UI.initTitleAtmos);

  // 把存档模块暴露给头像/槽渲染（ui.js 内通过 window.__save 取用）
  window.__save = SAVE;
  // 恢复上次使用的存档槽
  setSaveSlot(getSaveSlot());

  // 全局错误兜底：任何未捕获异常/拒绝，除 Toast 提示外，【优先写入游戏日志】
  // （含来源与堆栈前几行，便于下次据日志定位根因）。日志写入本身包 try，避免在错误监听内再次抛错引发递归。
  function logException(kind, message, detail) {
    try {
      const st = GameState.data;
      if (st) addLog(st, kind, detail ? `${message}｜${detail}` : `${message}`);
    } catch (_) { /* 绝不在错误监听内再次抛错 */ }
  }
  window.addEventListener('error', (e) => {
    // 资源加载错误（img/link/script）无 message，单独记为「警告」，避免噪声
    const t = e.target;
    if (t && t !== window && (t.tagName === 'IMG' || t.tagName === 'LINK' || t.tagName === 'SCRIPT')) {
      const src = t.src || t.href || '';
      // 头像接口在「未上传头像」时返回 404 是预期行为，静默回退默认头像，不写日志
      if (src.includes('/api/avatar')) return;
      const msg = `资源加载失败：${t.tagName} ${src}`;
      UI.toast('资源加载失败，已记入日志', 'warn');
      logException('警告', msg, '');
      return;
    }
    const msg = e.message || '未知脚本错误';
    const src = [e.filename, e.lineno, e.colno].filter(Boolean).join(':');
    const stack = (e.error && e.error.stack) ? e.error.stack.split('\n').slice(0, 4).join(' ↩ ') : '';
    UI.toast(`出现异常：${msg}`, 'warn');
    logException('异常', msg, [src, stack].filter(Boolean).join(' ｜ '));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const msg = (r && r.message) || String(r);
    const stack = (r && r.stack) ? r.stack.split('\n').slice(0, 4).join(' ↩ ') : '';
    UI.toast(`出现异常：${msg}`, 'warn');
    logException('异常', msg, stack);
  });

  // 标题界面按钮
  const hasSave = await checkSaveExists().catch(() => false);
  UI.renderTitle(hasSave);

  // 拉取服务器信息（作者署名 / 存档目录），用于标题页 footer 动态显示
  if (typeof fetch === 'function') {
    fetch('/api/info').then((r) => r.json()).then((info) => {
      const dirEl = document.querySelector('#title-savedir');
      if (info && info.saveRoot && dirEl) dirEl.textContent = info.saveRoot;
    }).catch(() => { /* 取不到信息不影响游戏 */ });
  }

  document.querySelector('#btn-new').addEventListener('click', async () => {
    const slot = getSaveSlot();
    const exists = await checkSaveExists(slot);
    if (exists) {
      // 已有存档：提示将覆盖当前槽
      const ok = confirm(`存档 ${slot} 已存在，开始新仙途将覆盖该存档。\n是否继续？`);
      if (!ok) return;
    }
    UI.startCreation(null);
  });

  document.querySelector('#btn-continue').addEventListener('click', async () => {
    try {
      const state = await loadGame();
      if (!state) { UI.toast('存档损坏或不存在', 'warn'); return; }
      GameState.setData(state);
      UI.enterGame(false);
      UI.pushLog(`欢迎回来，${state.player.name}。仙途再续。`, 'gold');
    } catch (e) {
      UI.toast(`读档失败：${e.message}`, 'warn');
    }
  });

  // 新建存档槽
  document.querySelector('#btn-new-slot').addEventListener('click', async () => {
    const slots = await listSlots();
    const nums = slots.map((s) => Number(s.slot)).sort((a, b) => a - b);
    let next = 1;
    for (const n of nums) { if (n === next) next++; else break; }
    setSaveSlot(String(next));
    UI.toast(`已切换到新存档 ${next}，可开启新仙途`, 'gold');
    UI.renderTitle(false);
  });

  document.querySelector('#btn-guide-title').addEventListener('click', UI.showBeginnerGuide);
  document.querySelector('#btn-theme-title').addEventListener('click', UI.toggleTheme);

  // 创建向导按钮
  document.querySelector('#btn-next').addEventListener('click', UI.wizardNext);
  document.querySelector('#btn-prev').addEventListener('click', UI.wizardPrev);
  document.querySelector('#btn-create-back').addEventListener('click', UI.backToTitle);

  // 主界面：手动存档 & 自由行动 & 侧栏页签
  document.querySelector('#btn-save').addEventListener('click', () => UI.saveNow());
  document.querySelector('#btn-goto-destiny').addEventListener('click', () => UI.setSideTab('destiny'));
  document.querySelector('#btn-theme').addEventListener('click', UI.toggleTheme);
  document.querySelectorAll('.side-tab').forEach((b) =>
    b.addEventListener('click', () => UI.setSideTab(b.dataset.tab)));

  // 关闭启动加载层（尊重 reduce-motion：过渡会被全局规则即时化，无残留闪烁）
  const bootEl = document.getElementById('boot-loader');
  if (bootEl) {
    requestAnimationFrame(() => {
      bootEl.classList.add('hide');
      setTimeout(() => bootEl.remove(), 460);
    });
  }
}

document.addEventListener('DOMContentLoaded', boot);
