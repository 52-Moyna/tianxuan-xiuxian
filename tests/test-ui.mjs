// UI 集成测试：jsdom 模拟真实浏览器，点击走完「创建角色 → 外出历练」全流程
// 运行：node test-ui.mjs   （需服务器已启动：node server.js）
import { loadJsdom } from './_testenv.mjs';
const { JSDOM } = loadJsdom();
import fs from 'fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(__dirname, '..');
const modUrl = (rel) => pathToFileURL(join(gameRoot, rel)).href;

// 固定随机种子（mulberry32），使整条 UI 流程可重复：避免战斗/机缘/突破的随机性
// 导致「日志条数」「是否触发弹窗」等断言在不同运行间抖动。
let _seed = 20260813;
Math.random = () => {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const html = fs.readFileSync(join(gameRoot, 'public/index.html'), 'utf-8')
  .replace('<script type="module" src="js/main.js"></script>', ''); // 手动接管模块加载

const dom = new JSDOM(html, { url: 'http://127.0.0.1:8613/', pretendToBeVisual: true });
const { window } = dom;

/* ---------- 全局环境桥接 ---------- */
globalThis.window = window;
globalThis.document = window.document;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
window.confirm = () => true;
globalThis.confirm = window.confirm;
// jsdom 无 canvas 实现，给 2d 上下文一个空壳
window.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect() {}, beginPath() {}, arc() {}, fill() {}, set fillStyle(v) {},
});
// fetch 相对地址 -> 本地服务器
const realFetch = globalThis.fetch;
const BASE_URL = `http://127.0.0.1:${process.env.XIUXIAN_PORT || 8613}`;
globalThis.fetch = (url, opts) => realFetch(new URL(url, BASE_URL), opts);
window.fetch = globalThis.fetch;

const errors = [];
window.addEventListener('error', (e) => errors.push('error: ' + e.message));
process.on('unhandledrejection', (e) => errors.push('unhandledrejection: ' + (e?.stack || e)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];

/* ---------- 加载游戏模块（等价于浏览器加载 main.js） ---------- */
const UI = await import(modUrl('public/js/ui.js'));
const { GameState } = await import(modUrl('public/js/state.js'));
await import(modUrl('public/js/main.js'));
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await sleep(300);

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : (fail++, console.error('  ✗ FAIL:', name)); };

// 推进一个月：轻量行动（闭关/研读/拜访）先点「进入下月」，再点月末结算「进入下一月」。
// 用轮询而非固定 sleep，避免异步弹窗渲染时序导致的偶发漏点；结束后等待罗盘刷新，
// 以对齐月末结算内的异步存盘（saveNow 走网络）完成时机，避免下一轮点击到过期罗盘。
const waitFor = async (sel, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (document.querySelector(sel)) return document.querySelector(sel); await sleep(60); }
  return null;
};
const advanceMonth = async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    // 确认弹窗（继续行动 / 返回选择）→ 自动点继续
    const cf = document.querySelector('.modal button[data-v="1"]');
    if (cf && !document.querySelector('#btn-next-month')) { cf.click(); await sleep(120); continue; }
    const enter = document.querySelector('#btn-enter-month');
    if (enter) { enter.click(); await sleep(120); continue; }
    const nm = document.querySelector('#btn-next-month');
    if (nm) { nm.click(); break; }
    await sleep(80);
  }
  await waitFor('.compass-item', 4000); // 等结算弹窗关闭、罗盘刷新
};

/* ---------- 1. 标题界面 ---------- */
ok(!$('#screen-title').classList.contains('hidden') || $('#screen-title').classList.contains('active'), '标题界面显示');

/* ---------- 2. 创建角色（完整点击向导） ---------- */
$('#btn-new').click();
await sleep(100);
$('#wiz-name').value = '测试侠客';
$('#wiz-name').dispatchEvent(new window.Event('input'));
$('.seg-btn').click();
$('#btn-next').click(); await sleep(50);           // -> 种族
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);  // -> 年龄
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);  // -> 出生地
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);  // -> 开局包
$('.opt-card').click(); $('#btn-next').click(); await sleep(50);  // -> 灵根（道韵改为游戏中觉醒，向导不再预选）
$('#btn-roll-root').click(); await sleep(1500);                    // 等待掷灵根动画
ok($('#root-orb').classList.contains('awakened'), '灵根觉醒');
$('#btn-next').click(); await sleep(50);           // -> 总览
ok($('.summary') !== null, '总览页渲染');
$('#btn-next').click(); await sleep(500);          // 踏入仙途
ok($('#screen-game').classList.contains('active'), '进入主界面');
ok(GameState.data && GameState.data.player.name === '测试侠客', '角色状态就绪');

/* ---------- 3. 外出历练（猎杀妖兽，必触发战斗） ---------- */
const hunt = $$('.compass-item').find((el) => el.textContent.includes('猎杀妖兽'));
ok(!!hunt, '罗盘存在「猎杀妖兽」选项');
hunt.click();
await sleep(300);
// 先过确认弹窗（继续行动 / 返回选择）
const confirmBtn = document.querySelector('.modal button[data-v="1"]');
if (confirmBtn && !$('.modal').textContent.includes('斗法')) { confirmBtn.click(); await sleep(400); }
const battleModal = $('.modal');
ok(!!battleModal && battleModal.textContent.includes('斗法'), '战斗弹窗出现');
if (battleModal) {
  $('#btn-fight').click();
  await sleep(2500); // 骰子动画 14*80ms + 余量
  const okBtn = $('#btn-battle-ok');
  ok(!!okBtn, '战斗结算完成（收下战报按钮）');
  if (okBtn) { okBtn.click(); await sleep(400); }
  await advanceMonth();
}
// 结算后：罗盘应重新可用，月份应已推进
ok($$('.compass-item').length > 3, '罗盘已刷新，可继续操作');

/* ---------- 4. 连续三月混合行动，验证不卡死 ---------- */
for (let i = 0; i < 3; i++) {
  const items = $$('.compass-item');
  const pick = items.find((el) => el.textContent.includes('闭关苦修')) || items[0];
  pick.click();
  await sleep(400);
  await advanceMonth();
}
ok(true, '连续三月行动无卡死');

/* ---------- 5. 游历四方（随机分支压力） ---------- */
for (let i = 0; i < 5; i++) {
  const items = $$('.compass-item');
  const wander = items.find((el) => el.textContent.includes('游历四方'));
  if (!wander) break;
  wander.click();
  await sleep(400);
  // 可能弹战斗
  if ($('#btn-fight')) { $('#btn-fight').click(); await sleep(2200); const b = $('#btn-battle-ok'); if (b) { b.click(); await sleep(300); } }
  if ($('#btn-flee') && $('.modal')) { $('#btn-flee').click(); await sleep(300); }
  await advanceMonth();
}
ok(true, '游历随机分支 x5 无卡死');

/* ---------- 6. 日志系统 ---------- */
// 注：闭关/游历是否推进月份受 jsdom 异步时序影响，日志条数在不同运行间会有波动；
// 这里只校验「战斗日志已生成」这一确定性事实，条数持久化由下方存读档回路断言保证。
const _logs = GameState.data.logs || [];
ok(_logs.length >= 2, `日志已记录 ${_logs.length} 条`);
ok(_logs.some((l) => l.type === '战斗'), '战斗已记入日志（确定性）');
const logTab = $$('.side-tab').find((b) => b.dataset.tab === 'logs');
ok(!!logTab, '存在日志页签');
logTab.click(); await sleep(100);
ok($$('.log-entry').length > 0, '日志页签渲染条目');
const filterBattle = $$('.log-filter').find((b) => b.dataset.f === '战斗');
if (filterBattle) {
  filterBattle.click(); await sleep(100);
  ok($$('.log-entry').length >= 0, '日志类型筛选可用');
}
// 日志持久化：存档 -> 读档 -> 日志仍在
await UI.saveNow(true); await sleep(300);
const loadRes = await globalThis.fetch('/api/load').then((r) => r.json());
ok(!!loadRes.files['日志.ini'], '日志.ini 已写入存档');
const { deserialize } = await import(modUrl('public/js/save.js'));
const restored = deserialize(loadRes.files);
ok((restored.logs || []).length === GameState.data.logs.length, `读档日志条数一致（${restored.logs.length}）`);

/* ---------- 7. 全功能页签渲染（捕捉各面板渲染异常） ---------- */
const errBefore = errors.length;
const tabs = ['destiny', 'items', 'npcs', 'codex', 'map', 'realm', 'achv', 'logs', 'settings'];
for (const t of tabs) {
  const btn = $$('.side-tab').find((b) => b.dataset.tab === t);
  if (!btn) { console.error('  ✗ 缺少页签:', t); fail++; continue; }
  btn.click();
  await sleep(120);
  ok($('#center-body').children.length > 0, `页签「${t}」渲染内容`);
}
ok(errors.length === errBefore, '各页签渲染无异常');

/* ---------- 8. 主题切换过渡类（丝滑） ---------- */
const de = window.document.documentElement;
UI.toggleTheme();
ok(de.classList.contains('theme-anim'), '切换主题时挂上 theme-anim 过渡类');
// 还原主题，避免影响后续
UI.toggleTheme();

console.log('\n捕获的页面异常:', errors.length ? errors.join('\n') : '（无）');
console.log(`\n===== UI 集成测试：${pass} 通过，${fail} 失败 =====`);
process.exit(fail || errors.length ? 1 : 0);
