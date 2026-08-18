// 日志系统专项测试：验证「每一次事件（含异常/警告）都优先写入游戏日志」。
// 运行：node test-logging.mjs   （需服务器已启动：node server.js --port 8613）
import { loadJsdom } from './_testenv.mjs';
const { JSDOM } = loadJsdom();
import fs from 'fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(__dirname, '..');
const modUrl = (rel) => pathToFileURL(join(gameRoot, rel)).href;

// 固定随机种子（mulberry32），使「创建角色 → 进入游戏」流程可重复
let _seed = 20260813;
Math.random = () => {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const html = fs.readFileSync(join(gameRoot, 'public/index.html'), 'utf-8')
  .replace('<script type="module" src="js/main.js"></script>', '');

const dom = new JSDOM(html, { url: 'http://127.0.0.1:8613/', pretendToBeVisual: true });
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
window.confirm = () => true;
globalThis.confirm = window.confirm;
window.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect() {}, beginPath() {}, arc() {}, fill() {}, set fillStyle(v) {},
});
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => realFetch(new URL(url, 'http://127.0.0.1:8613'), opts);
window.fetch = globalThis.fetch;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];

const UI = await import(modUrl('public/js/ui.js'));
const { GameState } = await import(modUrl('public/js/state.js'));
const { addLog } = await import(modUrl('public/js/systems.js'));
await import(modUrl('public/js/main.js'));
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await sleep(300);

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : (fail++, console.error('  ✗ FAIL:', name)); };

/* ---------- 创建角色进入游戏 ---------- */
$('#btn-new').click(); await sleep(100);
$('#wiz-name').value = '日志测试侠';
$('#wiz-name').dispatchEvent(new window.Event('input'));
$('.seg-btn').click();
$('#btn-next').click(); await sleep(50);
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);
$('#btn-roll-root').click(); await sleep(1500);
$('#btn-next').click(); await sleep(50);
$('#btn-next').click(); await sleep(500);
ok($('#screen-game').classList.contains('active'), '已进入主界面');
ok(GameState.data && GameState.data.player.name === '日志测试侠', '角色状态就绪');

/* ---------- 1. 基础事件日志存在 ---------- */
const before = (GameState.data.logs || []).length;
ok(Array.isArray(GameState.data.logs), `日志容器已初始化（进入游戏尚无操作，当前 ${before} 条）`);

/* ---------- 2. 全局 error 事件 → 写入「异常」日志（含来源+堆栈） ---------- */
const errEvt = new window.ErrorEvent('error', { message: '日志测试·脚本异常X', filename: 'buggy.js', lineno: 12, colno: 3 });
window.dispatchEvent(errEvt);
await sleep(60);
const errLog = (GameState.data.logs || []).find((l) => l.type === '异常' && l.text.includes('脚本异常X'));
ok(!!errLog, '未捕获 error 事件已写入「异常」日志');
ok(errLog && errLog.text.includes('buggy.js:12:3'), '异常日志含来源(filename:lineno:colno)');

/* ---------- 3. 全局 unhandledrejection → 写入「异常」日志 ---------- */
const rejEvt = new window.Event('unhandledrejection');
Object.defineProperty(rejEvt, 'reason', { value: new Error('日志测试·拒绝原因Z') });
window.dispatchEvent(rejEvt);
await sleep(60);
const rejLog = (GameState.data.logs || []).find((l) => l.type === '异常' && l.text.includes('拒绝原因Z'));
ok(!!rejLog, 'unhandledrejection 已写入「异常」日志');

/* ---------- 4. 资源加载错误（img onerror）→ 写入「警告」日志（非噪声） ---------- */
// 真实浏览器中资源加载错误冒泡到 window 且 e.target 为 img 元素；
// jsdom 下手动构造 target=img 的 error 事件以确定性触发 main.js 的资源分支。
const img = window.document.createElement('img');
const resErr = new window.Event('error');
Object.defineProperty(resErr, 'target', { value: img });
window.dispatchEvent(resErr);
await sleep(60);
const warnLog = (GameState.data.logs || []).find((l) => l.type === '警告' && l.text.includes('资源加载失败'));
ok(!!warnLog, '资源加载失败已写入「警告」日志（不与逻辑异常混淆）');

/* ---------- 5. addLog 健壮性：world 未就绪 / state 缺失也不抛 ---------- */
let threw = false;
try {
  addLog({ logs: [] }, '异常', 'world 缺失也应能写');
  addLog(undefined, '异常', 'state 缺失不应抛');
  addLog({ world: { year: 1 } }, '系统', 'month 缺失也应能写');
} catch (e) { threw = true; }
ok(!threw, 'addLog 在 state/world 缺失时仍安全（不抛错）');

/* ---------- 6. 异常日志持久化：存档 → 读档 → 异常条目仍在 ---------- */
await UI.saveNow(true); await sleep(300);
const loadRes = await globalThis.fetch('/api/load').then((r) => r.json());
ok(!!loadRes.files['日志.ini'], '日志.ini 已写入存档');
const { deserialize } = await import(modUrl('public/js/save.js'));
const restored = deserialize(loadRes.files);
const rErr = (restored.logs || []).find((l) => l.type === '异常' && l.text.includes('脚本异常X'));
const rWarn = (restored.logs || []).find((l) => l.type === '警告' && l.text.includes('资源加载失败'));
ok(!!rErr, '读档后「异常」日志保留');
ok(!!rWarn, '读档后「警告」日志保留');

console.log(`\n捕获的页面异常: （本测试不统计页面异常，专注日志写入）`);
console.log(`\n===== 日志系统专项测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail ? 1 : 0);
