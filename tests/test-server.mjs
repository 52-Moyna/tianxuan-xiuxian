/**
 * 后端集成测试：真实拉起 server.js，打通全部 /api/* 与静态资源，
 * 覆盖新增的「历史备份列举 / 还原」与「静态目录穿越防护 / 安全响应头」。
 * 不依赖 jsdom；用托管 node 子进程 + 全局 fetch（Node 18+）。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL:', m); } };

function startServer() {
  return new Promise((resolve, reject) => {
    const saveRoot = mkdtempSync(join(tmpdir(), 'xb-srv-'));
    const port = 18713 + Math.floor(Math.random() * 50);
    const child = spawn(process.execPath, [join(process.cwd(), 'server.js'), '--port', String(port)], {
      env: { ...process.env, XB_SAVE_ROOT: saveRoot },
      cwd: process.cwd(),
    });
    let buf = '';
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/游戏地址：http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) resolve({ child, port, saveRoot });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => reject(new Error('服务器启动超时')), 8000);
  });
}

const BASE = (port) => `http://127.0.0.1:${port}`;
const jget = (port, p) => fetch(BASE(port) + p).then(async (r) => ({ s: r.status, h: r.headers, j: await r.json().catch(() => null) }));
const jpost = (port, p, body) => fetch(BASE(port) + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(async (r) => ({ s: r.status, j: await r.json().catch(() => null) }));

// 原始 HTTP 请求：保留路径中的编码 ../（fetch 会规范化折叠，无法复现目录穿越）
function rawGet(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ s: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const { child, port, saveRoot } = await startServer();
  try {
    // 1) /api/info
    const info = await jget(port, '/api/info');
    ok(info.s === 200 && info.j?.title === '天玄修仙录', '/api/info 返回标题');
    ok(info.h.get('x-content-type-options') === 'nosniff', '/api/info 含 nosniff 头');
    ok(info.h.get('x-frame-options') === 'DENY', '/api/info 含 X-Frame-Options:DENY');

    // 2) /api/slots 初始：默认槽目录已建，但无任何存档
    const slots0 = await jget(port, '/api/slots');
    ok(slots0.s === 200 && Array.isArray(slots0.j.slots) && slots0.j.slots.every((s) => s.hasSave === false), '/api/slots 初始无存档');

    // 3) POST /api/save 写入
    const sample = { files: { '个人信息.ini': { 基本信息: { 姓名: '测试道友', 道号: '练气', 骨龄: 18 }, 元数据: { 道果码: 'TESTCODE' } } } };
    const sv = await jpost(port, '/api/save?slot=1', sample);
    ok(sv.s === 200 && sv.j.ok && sv.j.written.includes('个人信息.ini'), '/api/save 写入成功');

    // 4) GET /api/load 读回
    const load = await jget(port, '/api/load?slot=1');
    ok(load.s === 200 && load.j.hasSave && load.j.files['个人信息.ini']?.基本信息?.姓名 === '测试道友', '/api/load 读回数据');

    // 5) GET /api/status
    const st = await jget(port, '/api/status?slot=1');
    ok(st.s === 200 && st.j.hasSave === true, '/api/status 标记有存档');

    // 6) POST /api/reset 滚入历史备份
    const reset = await jpost(port, '/api/reset?slot=1', {});
    ok(reset.s === 200 && reset.j.ok && reset.j.moved.includes('个人信息.ini') && /^历史备份_1_\d{14}$/.test(reset.j.backup || ''), '/api/reset 生成历史备份');
    const loadAfterReset = await jget(port, '/api/load?slot=1');
    ok(loadAfterReset.j.hasSave === false, '/api/reset 后槽位清空');

    // 7) GET /api/backups 列举
    const backs = await jget(port, '/api/backups?slot=1');
    ok(backs.s === 200 && backs.j.backups.length >= 1 && /^历史备份_1_\d{14}$/.test(backs.j.backups[0].name), '/api/backups 列举备份');
    const backupName = backs.j.backups[0].name;

    // 8) POST /api/restore 还原
    const restore = await jpost(port, '/api/restore?slot=1', { backup: backupName });
    ok(restore.s === 200 && restore.j.ok && restore.j.restored.includes('个人信息.ini'), '/api/restore 还原成功');
    const loadAfterRestore = await jget(port, '/api/load?slot=1');
    ok(loadAfterRestore.j.hasSave && loadAfterRestore.j.files['个人信息.ini']?.基本信息?.姓名 === '测试道友', '/api/restore 后数据恢复');

    // 9) 非法备份名被拒
    const badRestore = await jpost(port, '/api/restore?slot=1', { backup: '../../etc/passwd' });
    ok(badRestore.s === 400 || badRestore.s === 404, '/api/restore 拒绝非法备份名（防穿越）');

    // 10) GET /api/avatar 无头像 → 404
    const av = await jget(port, '/api/avatar?slot=1');
    ok(av.s === 404, '/api/avatar 无头像返回 404');

    // 11) 静态资源
    const html = await fetch(BASE(port) + '/');
    ok(html.status === 200 && (html.headers.get('content-type') || '').includes('text/html'), '静态 / 返回 HTML');
    ok(html.headers.get('x-frame-options') === 'DENY', '静态响应含 X-Frame-Options:DENY');
    const css = await fetch(BASE(port) + '/css/main.css');
    ok(css.status === 200, '静态 /css/main.css 200');
    const js = await fetch(BASE(port) + '/js/main.js');
    ok(js.status === 200, '静态 /js/main.js 200');

    // 12) 目录穿越防护：编码 ../ 访问根目录外的 server.js → 403（用原始请求避免被客户端规范化）
    const trav = await rawGet(port, '/%2e%2e/server.js');
    ok(trav.s === 403 && !trav.body.includes('createServer'), '静态目录穿越被拦截（403，且不泄漏 server.js 源码）');
  } catch (e) {
    fail++; console.log('FAIL: 异常', e.message);
  } finally {
    child.kill('SIGKILL');
    rmSync(saveRoot, { recursive: true, force: true });
  }
  console.log(`\n===== 后端集成测试：${pass} 通过，${fail} 失败 =====`);
  process.exit(fail ? 1 : 0);
})();
