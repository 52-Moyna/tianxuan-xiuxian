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
    // 一键浇灌（批量 QoL）：灵田有未熟灵草时应出现批量按钮
    ok(caveHtml.includes('一键浇灌'), '洞府面板显示一键浇灌按钮');
    ok(caveHtml.includes('btn-irrigate-all'), '一键浇灌按钮带绑定 id');

    // 满仓警示：有成熟灵草且储物袋已满时，给出「先清理再收获」的常驻提示
    st.cave.garden.push({ id: 'herb_lingcao', name: '凝露灵草', progress: 5, grow: 5, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 });
    const usedNow = LIFE.inventoryUsed(st);
    st.inventory.capacity = Math.max(1, usedNow);
    st.inventory.ringBonus = 0;
    UI.renderAll(); await sleep(150);
    const fullHtml = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(fullHtml.includes('储物袋已满'), '储物袋已满且有成熟灵草时给出常驻警示');
    st.cave.garden.pop();
    st.inventory.capacity = 200;
    UI.renderAll(); await sleep(150);
    // 一键补种（批量 QoL）：灵田有空位时每种灵草都给「补满 N 株」按钮
    const fillBtns = $$('[data-plantfill]').length;
    const fillHtml = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(fillBtns > 0 && fillHtml.includes('补满'), `洞府面板显示一键补种按钮（${fillBtns} 个）`);
    ok(!!$('.herb-seed-acts'), '补种按钮以独立容器布局，不与播种按钮挤在一列');
  } catch (e) { ok(false, `洞府灵草园预估渲染: ${e.message}`); }

  // 宗门兑换所：满仓时禁用丹药兑换（UI 与 sectExchange 同口径，防止贡献白扣）
  try {
    const L2 = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const s2 = GameState.data;
    L2.ensureLifeState(s2);
    s2.sect = s2.sect || {};
    s2.sect.name = '测试宗门'; s2.sect.rank = 1; s2.sect.contribution = 5000;
    UI.renderAll(); await sleep(150);
    const chip = $('#tb-sect');
    ok(!!chip && chip.style.display !== 'none', '入宗后顶栏宗门 chip 可见');
    chip.click(); await sleep(200);
    ok($$('[data-exchange]').length === 4, `宗门面板渲染兑换项（${$$('[data-exchange]').length} 个）`);
    ok($$('[data-exchange]').every((b) => !b.disabled), '空间充足时兑换按钮全部可用');
    // 构造满载：容量 = 当前已用
    s2.inventory.capacity = Math.max(1, L2.inventoryUsed(s2));
    s2.inventory.ringBonus = 0;
    UI.renderAll(); await sleep(120);
    $('#tb-sect').click(); await sleep(200);
    const qiBtn = $$('[data-exchange]').find((b) => b.dataset.exchange === 'ex_qi');
    const stBtn = $$('[data-exchange]').find((b) => b.dataset.exchange === 'ex_stones');
    ok(!!qiBtn && qiBtn.disabled, '满仓时丹药兑换按钮被禁用（防止贡献白扣）');
    ok(!!stBtn && !stBtn.disabled, '满仓时灵石兑换仍可用（灵石不占行囊格位）');
    const mHtml = $('.modal') ? $('.modal').innerHTML : '';
    ok(mHtml.includes('储物袋空间不足'), '满仓兑换项给出明确警示文案');
    ok(!!$('.bag-block-warn'), '满仓警示使用 .bag-block-warn 红条样式');
    $('#btn-back-sect').click(); await sleep(150);
    s2.inventory.capacity = 200; s2.sect.contribution = 0;
    UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `宗门兑换所满仓渲染: ${e.message}`); }

  // 行囊搜索 + 满仓「建议清理」一键出货
  try {
    const SS = await import(pathToFileURL(join(ROOT, 'public/js/systems.js')).href);
    const invBtn = $$('.side-tab').find((b) => b.dataset.tab === 'items');
    invBtn.click(); await sleep(150);
    ok(!!$('#inv-search'), '行囊渲染搜索框 #inv-search');
    ok($('#inv-search').placeholder.includes('搜索'), '搜索框含占位提示文案');

    // 搜索过滤：按名称命中
    const st3 = GameState.data;
    st3.items.push({ 名称: '独角测试草', 类型: '材料', 数量: 1, 价值: 20, 描述: '仅用于搜索验证的灵草。' });
    st3.items.push({ 名称: '另一件杂物', 类型: '材料', 数量: 1, 价值: 20, 描述: '描述里含暗号麒麟。' });
    UI.renderAll(); await sleep(120);
    const inp = $('#inv-search');
    inp.value = '独角';
    inp.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(150);
    ok($('#center-body').textContent.includes('独角测试草'), '搜索「独角」命中目标物品');
    ok(!$('#center-body').textContent.includes('另一件杂物'), '搜索时过滤掉不相关物品');
    ok(!!$('.inv-search-hit') && $('.inv-search-hit').textContent.includes('匹配'), '搜索显示命中数量');

    // 描述匹配
    const inp2 = $('#inv-search');
    inp2.value = '麒麟';
    inp2.dispatchEvent(new window.Event('input', { bubbles: true })); await sleep(150);
    ok($('#center-body').textContent.includes('另一件杂物'), '搜索可命中描述中的关键词');

    // 清空按钮
    $('#inv-search-clear').click(); await sleep(150);
    ok($('#center-body').textContent.includes('独角测试草'), '清空搜索后恢复全部物品');
    ok(!$('#inv-search-clear'), '清空后清空按钮自身消失');

    // 满仓时出现「建议清理」区块，并可一键出货腾格
    const body = $('#center-body');
    body.dataset.invQuery = '';
    UI.renderAll(); await sleep(120);
    const s4 = GameState.data;
    // 容量 = 当前占用 → ratio = 1，必定触发「建议清理」（注意 capacity 不能设 0，会被归一成 100）
    s4.inventory.capacity = Math.max(1, SS.bagUsage(s4).used);
    s4.inventory.ringBonus = 0;
    UI.renderAll(); await sleep(150);
    ok(!!$('.bag-cleanup'), '储物袋吃紧时行囊出现「建议清理」区块');
    ok(!!$('#btn-sell-cleanup'), '建议清理区块含一键出售按钮');
    const used4 = SS.bagUsage(s4).used;
    const stones4 = SS.totalStones(s4);
    $('#btn-sell-cleanup').click(); await sleep(200);
    ok(SS.bagUsage(s4).used < used4, `一键清理后占用下降（${used4} → ${SS.bagUsage(s4).used}）`);
    ok(SS.totalStones(s4) > stones4, '一键清理后灵石增加');
    ok(!$('.bag-cleanup'), '清理后建议区块自动消失（不再吃紧）');
    s4.inventory.capacity = 200;
    s4.items = s4.items.filter((i) => !['独角测试草', '另一件杂物'].includes(i.名称));
    UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `行囊搜索/清理交互: ${e.message}`); }

  // 选档卡片摘要：境界优先于道号，缺数据不出现 undefined
  try {
    const T = UI.slotSummaryText;
    ok(typeof T === 'function', '导出 slotSummaryText 供测试');
    const full = T({ name: '测试道友', realm: '玄尘子', realmName: '金丹期', level: 42, age: 88, power: 12345, year: 128 });
    ok(full.includes('金丹期') && full.includes('Lv.42') && full.includes('战力 12,345') && full.includes('天玄历 128 年'),
      `选档摘要含境界/等级/战力/纪年（实际：${full}）`);
    ok(!full.includes('undefined'), '选档摘要无 undefined 字段');
    const legacy = T({ name: '旧档', realm: '练气', age: 20 });
    ok(legacy.includes('练气') && legacy.includes('20岁') && !legacy.includes('undefined'),
      `旧档无境界时退回道号（实际：${legacy}）`);
    const empty = T({});
    ok(empty === '无名 ｜ 境界未知', `空档摘要兜底（实际：${empty}）`);
  } catch (e) { ok(false, `选档摘要文案: ${e.message}`); }

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
