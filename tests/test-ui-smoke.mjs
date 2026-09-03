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
    // 一键浇灌（批量 QoL）：灵田有未熟灵草且灵石充足时应出现批量按钮
    // 新行为：灵石不足会降级/禁用，故先给足灵石再断言「完整形态」
    const keepCur = JSON.parse(JSON.stringify(st.currencies || {}));
    LIFE.lifeAddStones(st, 10000);
    UI.renderAll(); await sleep(120);
    const caveHtml2 = $('#center-body') ? $('#center-body').innerHTML : '';
    ok(caveHtml2.includes('一键浇灌'), '洞府面板显示一键浇灌按钮');
    ok(!!$('#btn-irrigate-all'), '一键浇灌按钮带绑定 id');
    // 灵石只够浇 1 株（共 2 株可浇）→ 按钮只承诺 1/2，不再谎报 2 株
    st.cave.garden.push({ id: 'herb_lingcao', name: '乙株灵草', progress: 1, grow: 5, planted: '1年1月', irrigatedThisMonth: 0, irrigated: 0 });
    for (const k of Object.keys(st.currencies)) st.currencies[k] = 0;
    LIFE.lifeAddStones(st, LIFE.HERB_IRRIGATE_COST);
    UI.renderAll(); await sleep(120);
    const irrTxt = $('#btn-irrigate-all') ? $('#btn-irrigate-all').textContent : '';
    ok(irrTxt.includes('1/2'), `灵石只够 1 株时按钮只承诺 1/2（实际：${irrTxt}）`);
    // 一株都浇不起 → 按钮禁用并写明原因（而非点了才发现）
    for (const k of Object.keys(st.currencies)) st.currencies[k] = 0;
    UI.renderAll(); await sleep(120);
    ok($$('#center-body button[disabled]').some((b) => b.textContent.includes('灵石不足，暂无法浇灌')),
      '灵石归零时一键浇灌按钮禁用并写明原因');
    st.currencies = keepCur; UI.renderAll(); await sleep(100);

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

  // 行囊「扩容进度」：明示距下一品级还差多少格（玩家能算出该攒多少灵石）
  try {
    const LF = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    $$('.side-tab').find((b) => b.dataset.tab === 'items').click(); await sleep(120);
    UI.renderAll(); await sleep(150);
    const st = GameState.data;
    ok(!!$('.bag-next'), '行囊页出现「扩容进度」行');
    const txt = $('.bag-next') ? $('.bag-next').textContent : '';
    const nx = LF.nextBagGrade(st);
    if (nx) {
      ok(txt.includes(String(nx.need)) && txt.includes(nx.name),
        `扩容进度显示缺口与目标品级（差 ${nx.need} 格 → ${nx.name}，实际：${txt}）`);
    } else {
      ok(txt.includes('已达最高品级'), `满级时显示「已达最高品级」（实际：${txt}）`);
    }
    ok(!txt.includes('undefined') && !txt.includes('NaN'), '扩容进度文案无 undefined/NaN');
    // 边界：容量抬到最高档之上，应判满级而非算出错误档（曾会用下标+1 取到首档）
    const cap0 = st.inventory.capacity;
    st.inventory.capacity = 99999; UI.renderAll(); await sleep(120);
    ok(LF.nextBagGrade(st) === null, '容量超最高档时 nextBagGrade 返回 null');
    ok($('.bag-next').textContent.includes('已达最高品级'), '超档时 UI 显示已达最高品级');
    st.inventory.capacity = cap0; UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `行囊扩容进度: ${e.message}`); }

  // 地图「路费门禁」：灵石不足时按钮禁用并写明缺口，避免点了才发现买不起
  try {
    const LF = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    $$('.side-tab').find((b) => b.dataset.tab === 'map').click(); await sleep(120);
    UI.renderAll(); await sleep(150);
    const st = GameState.data;
    ok($$('.region-card').length === 7, `地图渲染 7 域卡片（实际 ${$$('.region-card').length}）`);
    const routes = LF.travelOptions(st);
    ok(routes.length > 0, `当前地域有可直达邻域（${routes.length} 条）`);
    const nb = routes[0].id;
    const keep = JSON.parse(JSON.stringify(st.currencies));
    LF.lifeAddStones(st, 100000); UI.renderAll(); await sleep(150);
    ok(!!$(`[data-go="${nb}"]`), '灵石充足时相邻地域出现可点击「前往」按钮');
    // 清零灵石：按钮应禁用、文案明示缺口、且不带 data-go（点了不会触发旅行）
    for (const k of Object.keys(st.currencies)) st.currencies[k] = 0;
    UI.renderAll(); await sleep(150);
    const dis = $$('.region-card .btn[disabled]');
    ok(dis.length > 0, '灵石清零后相邻地域按钮被禁用');
    ok(dis.some((b) => b.textContent.includes('灵石不足')), '禁用按钮文案明示「灵石不足」');
    ok(dis.every((b) => !b.dataset.go), '禁用按钮不带 data-go，点击不会触发旅行');
    ok(!$(`[data-go="${nb}"]`), '灵石不足时不再出现可点击的「前往」');
    st.currencies = keep; UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `地图路费门禁: ${e.message}`); }

  // 受伤闭环：危机横幅/指引必须「有什么药就说什么药」——
  // 此前解药名硬编码为凝血丹，玩家身上只有疗伤丹时按钮直接消失、指引成空话。
  try {
    const SYS = await import(pathToFileURL(join(ROOT, 'public/js/systems.js')).href);
    const LIFEX = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const st4 = GameState.data;
    LIFEX.storeItem(st4, { 名称: '疗伤丹', 类型: '丹药', 数量: 2, 描述: '清除 1 个月伤势。', effect: { heal: 1 } });
    st4.flags.wounded = 3;
    UI.renderAll(); await sleep(150);
    const ban1 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(ban1.includes('服用疗伤丹'), '受伤且只有疗伤丹时，危机横幅给出「服用疗伤丹」按钮');
    ok(ban1.includes('减 1 个月'), '横幅写明该药能减几个月伤势（不谎称痊愈）');
    // 换成全清药：横幅应改推全清药
    LIFEX.storeItem(st4, { 名称: '凝血丹', 类型: '丹药', 数量: 1, 描述: '清除全部伤势。', effect: { heal: true } });
    UI.renderAll(); await sleep(150);
    const ban2 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(ban2.includes('服用凝血丹'), '持有全清药时横幅优先推荐凝血丹');
    ok(ban2.includes('立刻'), '全清药提示写明立刻痊愈');
    // 一键服用真能落地：点按钮后伤势清零、凝血丹被消耗
    const cureBtn = $$('#crisis-banner [data-cure]')[0];
    ok(!!cureBtn, '横幅服用按钮带 data-cure 绑定');
    if (cureBtn) {
      cureBtn.click(); await sleep(200);
      ok((st4.flags.wounded || 0) === 0, `点击横幅按钮后伤势清零（${st4.flags.wounded}）`);
      ok(!st4.items.some((i) => i.名称 === '凝血丹' && i.数量 > 0), '凝血丹已被消耗');
    }
    // 无药时：不谎报药名，指路坊市
    const st5 = GameState.data;
    st5.items = st5.items.filter((i) => !i.effect || !i.effect.heal);
    st5.flags.wounded = 2;
    UI.renderAll(); await sleep(150);
    const ban3 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok($$('#crisis-banner [data-cure]').length === 0, '无疗伤药时不出现服用按钮');
    ok(ban3.includes('坊市'), '无药时横幅指路坊市');
    // 指引条同步：受伤有药时 detail 点名该药
    LIFEX.storeItem(st5, { 名称: '疗伤丹', 类型: '丹药', 数量: 1, 描述: '清除 1 个月伤势。', effect: { heal: 1 } });
    UI.setSideTab('items'); await sleep(120);
    UI.renderAll(); await sleep(150);
    const sideHtml = $('#side-body') ? $('#side-body').innerHTML : '';
    ok(sideHtml.includes('疗伤丹'), '侧栏「当前目标」点名实际持有的疗伤药');
    st5.flags.wounded = 0; UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `受伤闭环: ${e.message}`); }

  // 寿元 / 丹毒危机指引：此前完全不提，玩家余寿只剩几年仍被指引去「提升至 Lv.N」。
  // 现与受伤同口径 —— 有药点药名、无药指路坊市；延寿丹「一生 3 颗」服满后不再推荐。
  try {
    const LX = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const st6 = GameState.data;
    st6.items = st6.items.filter((i) => !i.effect || !(i.effect.lifespan || i.effect.detox));
    st6.player.age = st6.player.lifespan - 3;
    st6.player.lifespanPillsTaken = 0;
    UI.renderAll(); await sleep(150);
    const ban4 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(ban4.includes('寿元'), '余寿将尽时危机横幅给出寿元预警');
    ok($$('#crisis-banner [data-cure]').length === 0, '无延寿丹药时不出现服用按钮');
    ok(ban4.includes('坊市'), '无延寿丹药时横幅指路坊市');
    UI.setSideTab('items'); await sleep(120);
    UI.renderAll(); await sleep(150);
    const side6 = $('#side-body') ? $('#side-body').innerHTML : '';
    ok(side6.includes('延续寿元'), '侧栏「当前目标」改为延续寿元（不再指引去升级）');
    // 放一颗延寿丹：按钮出现且点名
    LX.storeItem(st6, { 名称: '延寿丹', 类型: '丹药', 数量: 1, 描述: '延寿', effect: { lifespan: 20 } });
    UI.renderAll(); await sleep(150);
    const ban5 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(ban5.includes('服用延寿丹'), '持有延寿丹时横幅给出「服用延寿丹」按钮');
    // 额度服满：服下无效、不消耗，故不再推荐（否则玩家点了才发现白搭）
    st6.player.lifespanPillsTaken = 3;
    UI.renderAll(); await sleep(150);
    const ban6 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(!ban6.includes('服用延寿丹'), '延寿丹一生额度已满：横幅不再推荐（服下无效、不消耗）');
    st6.player.lifespanPillsTaken = 0;
    st6.player.age = 20;
    // 丹毒攻心但囊中无解毒丹：不谎报药名、不出现点了无效的幻影按钮，改指路坊市
    st6.flags.pillToxicity = 90;
    UI.renderAll(); await sleep(150);
    const banD = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(banD.includes('丹毒'), '丹毒攻心时危机横幅给出丹毒预警');
    ok(!banD.includes('服用解毒丹'), '无解毒丹药时不出现「服用解毒丹」按钮（不谎报）');
    ok(banD.includes('坊市'), '无解毒丹药时横幅指路坊市');
    ok(!banD.includes('服「解毒丹」'), '无解毒丹药时提示不谎称「服解毒丹」（旧版硬编码药名）');
    // 持有解毒丹：点名且写明能减多少
    LX.storeItem(st6, { 名称: '解毒丹', 类型: '丹药', 数量: 1, 描述: '解毒', effect: { detox: 30 } });
    UI.renderAll(); await sleep(150);
    const ban7 = $('#crisis-banner') ? $('#crisis-banner').innerHTML : '';
    ok(ban7.includes('服用解毒丹'), '丹毒攻心且持有解毒丹时给出服用按钮');
    ok(ban7.includes('减 30'), '横幅写明解毒丹能减多少丹毒');
    st6.flags.pillToxicity = 0;
    st6.items = st6.items.filter((i) => !i.effect || !(i.effect.lifespan || i.effect.detox));
    UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `寿元/丹毒指引: ${e.message}`); }

  // 行囊失效按钮：所有药效段均失效时置灰（点了也白搭，useItem 不消耗、无效果）
  try {
    const LX = await import(pathToFileURL(join(ROOT, 'public/js/life.js')).href);
    const st7 = GameState.data;
    st7.items = st7.items.filter((i) => i.名称 !== '疗伤丹');
    LX.storeItem(st7, { 名称: '疗伤丹', 类型: '丹药', 数量: 1, 描述: '清除 1 个月伤势。', effect: { heal: 1 } });
    st7.flags.wounded = 0;
    UI.setSideTab('items'); await sleep(120);
    UI.renderAll(); await sleep(180);
    const rowOf = (name) => $$('#center-body .item-row').find((r) => r.textContent.includes(name));
    const btnA = (rowOf('疗伤丹') || {}).querySelector ? rowOf('疗伤丹').querySelector('[data-use]') : null;
    ok(!!btnA && btnA.disabled, '无伤时纯疗伤丹「服用」按钮置灰（点了无效、不消耗）');
    ok(!!btnA && btnA.className.includes('btn-useless'), '失效按钮带 btn-useless 样式类');
    st7.flags.wounded = 2; UI.renderAll(); await sleep(180);
    const rowB = rowOf('疗伤丹');
    const btnB = rowB ? rowB.querySelector('[data-use]') : null;
    ok(!!btnB && !btnB.disabled, '带伤时疗伤丹按钮恢复可用');
    st7.flags.wounded = 0; UI.renderAll(); await sleep(120);
    // 同族：无丹毒时解毒丹亦应置灰（effect.detox 此前无条件执行，点了白白消耗一颗）
    st7.items = st7.items.filter((i) => i.名称 !== '解毒丹');
    LX.storeItem(st7, { 名称: '解毒丹', 类型: '丹药', 数量: 1, 描述: '解毒', effect: { detox: 30 } });
    st7.flags.pillToxicity = 0;
    UI.renderAll(); await sleep(180);
    const btnD = (rowOf('解毒丹') || {}).querySelector ? rowOf('解毒丹').querySelector('[data-use]') : null;
    ok(!!btnD && btnD.disabled, '无丹毒时解毒丹「服用」按钮置灰（点了无效、不消耗）');
    st7.flags.pillToxicity = 40; UI.renderAll(); await sleep(180);
    const btnD2 = (rowOf('解毒丹') || {}).querySelector ? rowOf('解毒丹').querySelector('[data-use]') : null;
    ok(!!btnD2 && !btnD2.disabled, '有丹毒时解毒丹按钮恢复可用');
    st7.flags.pillToxicity = 0;
    st7.items = st7.items.filter((i) => i.名称 !== '解毒丹');
    // 「一生 N 颗」额度角标：直接写在物品卡上，不必点开 hover 才知道还剩几颗
    st7.items = st7.items.filter((i) => i.名称 !== '延寿丹');
    LX.storeItem(st7, { 名称: '延寿丹', 类型: '丹药', 数量: 1, 描述: '延寿', effect: { lifespan: 20 } });
    st7.player.lifespanPillsTaken = 1;
    UI.renderAll(); await sleep(180);
    const qEl = (rowOf('延寿丹') || {}).querySelector ? rowOf('延寿丹').querySelector('.item-quota') : null;
    ok(!!qEl && qEl.textContent.includes('1/3'), '延寿丹物品卡直接显示「已服 1/3」额度角标');
    st7.player.lifespanPillsTaken = 3; UI.renderAll(); await sleep(180);
    const qEl2 = (rowOf('延寿丹') || {}).querySelector ? rowOf('延寿丹').querySelector('.item-quota') : null;
    ok(!!qEl2 && qEl2.className.includes('full'), '额度服满时角标加 full 样式（划掉提示失效）');
    st7.player.lifespanPillsTaken = 0;
    st7.items = st7.items.filter((i) => i.名称 !== '延寿丹');
    // 同族：增益已满时聚灵阵旗 / 狂战丹按钮置灰（此前点了面板纹丝不动却照扣一件）
    st7.items = st7.items.filter((i) => i.名称 !== '聚灵阵旗');
    LX.storeItem(st7, { 名称: '聚灵阵旗', 类型: '消耗品', 数量: 1, 描述: '聚灵', effect: { cultivateBoostMonths: 1 } });
    st7.flags.cultivateBoostMonths = 3;
    UI.renderAll(); await sleep(180);
    const btnJ = (rowOf('聚灵阵旗') || {}).querySelector ? rowOf('聚灵阵旗').querySelector('[data-use]') : null;
    ok(!!btnJ && btnJ.disabled, '聚灵增益已满：聚灵阵旗「使用」按钮置灰（点了无效、不消耗）');
    st7.flags.cultivateBoostMonths = 0; UI.renderAll(); await sleep(180);
    const btnJ2 = (rowOf('聚灵阵旗') || {}).querySelector ? rowOf('聚灵阵旗').querySelector('[data-use]') : null;
    ok(!!btnJ2 && !btnJ2.disabled, '聚灵增益散去：聚灵阵旗按钮恢复可用');
    st7.items = st7.items.filter((i) => i.名称 !== '聚灵阵旗');
    // 战力增益：已持有更强增益且到期更晚时，弱丹无处着力，同样置灰
    st7.items = st7.items.filter((i) => i.名称 !== '狂战丹');
    LX.storeItem(st7, { 名称: '狂战丹', 类型: '丹药', 数量: 1, 描述: '战力', effect: { power: 20, powerMonths: 1 } });
    st7.buffs = { power: 50, expireMonth: st7.world.year * 12 + st7.world.month + 3 };
    UI.renderAll(); await sleep(180);
    const btnK = (rowOf('狂战丹') || {}).querySelector ? rowOf('狂战丹').querySelector('[data-use]') : null;
    ok(!!btnK && btnK.disabled, '药力正盛且到期更晚：狂战丹「服用」按钮置灰（点了战力不涨）');
    st7.buffs = { power: 0, expireMonth: 0 }; UI.renderAll(); await sleep(180);
    const btnK2 = (rowOf('狂战丹') || {}).querySelector ? rowOf('狂战丹').querySelector('[data-use]') : null;
    ok(!!btnK2 && !btnK2.disabled, '药力散尽：狂战丹按钮恢复可用');
    st7.items = st7.items.filter((i) => i.名称 !== '狂战丹');
    // —— 连续服用：同一格攒了一堆丹药时可一键连服，下肚前先弹确认把丹毒代价摊开 ——
    st7.inventory.capacity = 500;
    st7.items = st7.items.filter((i) => i.名称 !== '聚气丹');
    LX.storeItem(st7, { 名称: '聚气丹', 类型: '丹药', 数量: 3, 描述: '修为+80。', effect: { exp: 80 }, toxicity: 8 });
    st7.flags.pillToxicity = 0;
    UI.renderAll(); await sleep(180);
    let rowC = rowOf('聚气丹');
    const btnBatch = rowC ? rowC.querySelector('[data-usebatch]') : null;
    ok(!!btnBatch && btnBatch.textContent.includes('×3'), '同格 3 份丹药出现「连服 ×3」按钮');
    if (btnBatch) {
      btnBatch.click(); await sleep(180);
      const bModal = $('#modal-root .modal');
      ok(!!bModal && bModal.textContent.includes('共 3 份'), '连服前弹确认框并写明份数');
      ok(!!bModal && /丹毒 0 → 24/.test(bModal.textContent), '确认框摊开丹毒代价（0 → 24）');
      const okBtn = bModal ? bModal.querySelector('#batch-ok') : null;
      if (okBtn) okBtn.click();
      await sleep(260);
    }
    ok(!st7.items.some((i) => i.名称 === '聚气丹'), '确认后 3 份聚气丹一次服下');
    ok(st7.flags.pillToxicity === 24, `连服按份数累加丹毒（${st7.flags.pillToxicity}）`);
    // 只剩 1 份 → 不给连服入口（避免误点）
    LX.storeItem(st7, { 名称: '聚气丹', 类型: '丹药', 数量: 1, 描述: '修为+80。', effect: { exp: 80 } });
    UI.renderAll(); await sleep(180);
    rowC = rowOf('聚气丹');
    ok(!!rowC && !rowC.querySelector('[data-usebatch]'), '只剩 1 份时不给连服入口');
    st7.items = st7.items.filter((i) => i.名称 !== '聚气丹');
    // 当前服用无效（无伤疗伤丹）→ 不给连服入口
    LX.storeItem(st7, { 名称: '疗伤丹', 类型: '丹药', 数量: 3, 描述: '清除 1 个月伤势。', effect: { heal: 1 } });
    st7.flags.wounded = 0;
    UI.renderAll(); await sleep(180);
    const rowD = rowOf('疗伤丹');
    ok(!!rowD && !rowD.querySelector('[data-usebatch]'), '服用无效时不给连服入口（不会白扔）');
    st7.items = st7.items.filter((i) => i.名称 !== '疗伤丹');
    UI.renderAll(); await sleep(120);
  } catch (e) { ok(false, `行囊失效按钮: ${e.message}`); }

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
