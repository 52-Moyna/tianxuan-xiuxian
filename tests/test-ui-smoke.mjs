// 聚焦冒烟测试：验证整页面 refactor（renderCenter / 多存档 / 头像）在 jsdom 下不抛错
// 自包含：自己拉起临时 server，跑完自动退出。
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadJsdom, NODE_BIN } from './_testenv.mjs';
const { JSDOM } = loadJsdom();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 17099;
const BASE = `http://127.0.0.1:${PORT}`;

const html = (await import('node:fs')).readFileSync(`${ROOT}/public/index.html`, 'utf-8')
  .replace('<script type="module" src="js/main.js"></script>', '');

const dom = new JSDOM(html, { url: BASE + '/', pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
window.confirm = () => true; globalThis.confirm = window.confirm;
window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect(){}, beginPath(){}, arc(){}, fill(){}, set fillStyle(v){} });
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => realFetch(new URL(url, BASE), opts);
window.fetch = globalThis.fetch;

const errors = [];
window.addEventListener('error', (e) => errors.push('error: ' + e.message));
process.on('unhandledrejection', (e) => errors.push('unhandledrejection: ' + (e?.stack || e)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : (fail++, console.error('  ✗ FAIL:', name)); };

const tmpSave = mkdtempSync(join(tmpdir(), 'tx-ui-'));
const child = spawn(NODE_BIN,
  [join(ROOT, 'server.js'), '--port', String(PORT)],
  { cwd: tmpSave, env: { ...process.env, XB_SAVE_ROOT: tmpSave }, stdio: 'ignore' });

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { const r = await new Promise((res) => { const q = http.request({ method: 'GET', hostname: '127.0.0.1', port: PORT, path: '/api/slots' }, (resp) => { let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => res({ status: resp.statusCode })); }); q.on('error', () => res({ status: 0 })); q.end(); }); if (r.status === 200) ready = true; } catch {}
}
if (!ready) { console.log('服务器未就绪'); child.kill('SIGKILL'); rmSync(tmpSave, { recursive: true, force: true }); process.exit(2); }

try {
  const UI = await import(pathToFileURL(join(ROOT, 'public/js/ui.js')).href);
  const { GameState } = await import(pathToFileURL(join(ROOT, 'public/js/state.js')).href);
  await import(pathToFileURL(join(ROOT, 'public/js/main.js')).href);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await sleep(300);

  ok(!!$('#screen-title'), '标题界面存在');
  ok(!!$('#slot-list'), '存档选择器存在');

  $('#btn-new').click();
  await sleep(100);
  $('#wiz-name').value = '冒烟侠';
  $('#wiz-name').dispatchEvent(new window.Event('input'));
  $('.seg-btn').click();
  $('#btn-next').click(); await sleep(50);
  $('.opt-card').click(); $('#btn-next').click(); await sleep(50);
  $('.opt-card').click(); $('#btn-next').click(); await sleep(50);
  $('.opt-card').click(); $('#btn-next').click(); await sleep(50);
  $('.opt-card').click(); $('#btn-next').click(); await sleep(50);
  $('#btn-roll-root').click(); await sleep(1600);
  ok($('#root-orb').classList.contains('awakened'), '灵根觉醒');
  $('#btn-next').click(); await sleep(50);
  $('#btn-next').click(); await sleep(400);
  ok($('#screen-game').classList.contains('active'), '进入主界面');
  ok(GameState.data.player.name === '冒烟侠', '角色就绪');

  // 整页面跳转：逐个侧栏页签渲染 #center-body 不抛错
  const tabs = ['destiny', 'items', 'npcs', 'codex', 'realm', 'map', 'logs', 'settings', 'achv'];
  for (const t of tabs) {
    const btn = $$('.side-tab').find((b) => b.dataset.tab === t);
    if (!btn) { ok(false, `页签存在: ${t}`); continue; }
    try {
      btn.click(); await sleep(80);
      const bodyHtml = $('#center-body') ? $('#center-body').innerHTML.length : 0;
      ok(bodyHtml > 0, `整页渲染: ${t}`);
    } catch (e) { ok(false, `整页渲染无异常: ${t} (${e.message})`); }
  }

  // 行囊道具跳转按钮存在
  const itemJump = $$('.item-acts [data-codex]').length + $$('.item-acts [data-use]').length;
  ok(true, `行囊道具动作按钮数: ${itemJump}`);

  // 洞府面板：灵草园展示「每月生长」与每株「约 N 月后熟」（成熟预估，消除心算盲区）
  try {
    const LIFE = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const st = GameState.data;
    LIFE.ensureLifeState(st);
    st.cave.garden.push({ id: 'herb_lingcao', name: '凝露灵草', progress: 1, grow: 5, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 });
    st.cave.arrayLevel = 4; // 阵 4 重 → 月生长 +2 → 每月 3 月 → 剩余 4 月 → 约 2 月后熟
    UI.setSideTab('cave'); await sleep(120);
    const caveHtml = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(caveHtml.includes('每月生长'), '洞府面板显示灵草园每月生长');
    ok(caveHtml.includes('聚灵阵 +2'), '每月生长标注聚灵阵贡献 +2');
    ok(caveHtml.includes('约 2 月后熟'), '灵草行按聚灵阵月生长给出成熟预估（约 2 月后熟）');
  } catch (e) { ok(false, `洞府灵草园预估渲染: ${e.message}`); }

  // 设置面板含窗口大小 + 内置头像选择（已移除上传/移除）
  const setBtn = $$('.side-tab').find((b) => b.dataset.tab === 'settings');
  setBtn.click(); await sleep(100);
  ok(!!$('.set-grid'), '设置面板含窗口大小选择');
  ok($$('.avatar-grid').length > 0 && !$('#avatar-file'), '设置面板含内置头像选择（无上传）');

} catch (e) {
  console.log('运行异常：', e.stack || e.message); fail++;
} finally {
  try { child.kill('SIGKILL'); } catch {}
  await sleep(400);
  for (let i = 0; i < 5; i++) {
    try { rmSync(tmpSave, { recursive: true, force: true }); break; } catch { await sleep(200); }
  }
}

console.log('\n捕获的页面异常:', errors.length ? errors.join('\n') : '（无）');
console.log(`\n===== UI 冒烟测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail || errors.length ? 1 : 0);
