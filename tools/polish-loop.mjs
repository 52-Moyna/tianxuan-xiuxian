// 天玄修仙录 · 5 分钟打磨守护循环
// 每 5 分钟运行全 11 套测试，记录结果；发现回归即写告警。
// 注意：本脚本只做「持续验证 / 防回归」，AI 代码打磨由 WorkBuddy 自动任务驱动。
//
// 用法：
//   node tools/polish-loop.mjs                 # 默认：项目根 /z/1/xiuxian，间隔 300s
//   XB_ROOT=/z/1/xiuxian INTERVAL=300 node tools/polish-loop.mjs
// 常驻：后台运行即可；跨重启可用 Windows 计划任务 (schtasks) 拉起本脚本。

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.XB_ROOT || join(__dirname, '..');          // 游戏根目录
const INTERVAL = parseInt(process.env.INTERVAL || '300', 10) * 1000; // 两轮间隔(ms)
const NODE_PATH_UI = process.env.XB_NODE_PATH ||
  '/c/Users/HaiTang/.workbuddy/binaries/node/workspace/node_modules';
const NODE = process.env.XB_NODE || 'node';

const LOG_DIR = join(ROOT, '.workbuddy', 'memory');
const LOG_FILE = join(LOG_DIR, 'polish-watchdog.log');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const LOGIC = ['test-smoke', 'test-features', 'test-codex', 'test-life', 'test-save',
  'test-cultivation', 'test-multisave', 'test-newfeatures', 'test-server'];
const UI = ['test-ui-smoke', 'test-ui'];

function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function runSuite(file, env) {
  const r = spawnSync(NODE, [join(ROOT, 'tests', `${file}.mjs`)], {
    cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  // 从输出里抓各类汇总（不同套件措辞不同，宽松匹配）
  const m = out.match(/(\d+)\s*通过[，,\s]*(\d+)\s*失败|通过[：: ]*(\d+)[，,\s]*失败[：: ]*(\d+)|(\d+)\s*\/\s*\d+\s*通过|FAIL/m);
  return { file, ok, status: r.status ?? -1, out, m };
}

function runRound() {
  let pass = 0, fail = 0, suites = 0, bad = [];
  const lines = [];
  for (const f of LOGIC) {
    const r = runSuite(f);
    suites++;
    if (r.ok) { pass++; lines.push(`  [PASS] ${f}`); }
    else { fail++; bad.push(f); lines.push(`  [FAIL rc=${r.status}] ${f}`);
      lines.push('    ' + (r.out.split('\n').slice(-8).join('\n    ')).trim()); }
  }
  for (const f of UI) {
    const r = runSuite(f, { NODE_PATH: NODE_PATH_UI });
    suites++;
    if (r.ok) { pass++; lines.push(`  [PASS] ${f}`); }
    else { fail++; bad.push(f); lines.push(`  [FAIL rc=${r.status}] ${f}`);
      lines.push('    ' + (r.out.split('\n').slice(-8).join('\n    ')).trim()); }
  }
  const verdict = fail === 0 ? 'GREEN' : 'RED';
  const summary = `[${ts()}] ${verdict} suites=${suites} pass=${pass} fail=${fail}` +
    (bad.length ? ` REGRESSION: ${bad.join(',')}` : '');
  const full = `${summary}\n${lines.join('\n')}\n`;
  appendFileSync(LOG_FILE, full + '\n');
  console.log(summary);
  if (fail) console.log(lines.join('\n'));
  return { verdict, fail, suites, pass };
}

let running = false;
let stop = false;

async function sleepInterruptible(ms) {
  const step = 250;
  let waited = 0;
  while (waited < ms && !stop) { await new Promise((r) => setTimeout(r, step)); waited += step; }
}

async function loop() {
  console.log(`[${ts()}] polish-loop started: root=${ROOT} interval=${INTERVAL / 1000}s`);
  appendFileSync(LOG_FILE, `[${ts()}] polish-loop started (interval ${INTERVAL / 1000}s)\n`);
  while (!stop) {
    if (running) { console.log(`[${ts()}] skip: previous round still running`); }
    else {
      running = true;
      try { runRound(); }
      catch (e) { console.error(`[${ts()}] round error:`, e); }
      running = false;
    }
    await sleepInterruptible(INTERVAL);
  }
  appendFileSync(LOG_FILE, `[${ts()}] polish-loop stopped\n`);
  console.log(`[${ts()}] polish-loop stopped`);
}

process.on('SIGINT', () => { stop = true; });
process.on('SIGTERM', () => { stop = true; });

loop();
