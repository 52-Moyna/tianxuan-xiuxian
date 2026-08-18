// 多存档 + 头像 API 端到端测试
// 自包含：自己用 child_process 拉起一个临时 server（隔离端口 + 临时存档目录），跑完自动退出。
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_BIN } from './_testenv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 18123;
const BASE = `http://127.0.0.1:${PORT}`;

// 真实 PNG（1x1 红点），magic = 89 50 4e 47 0d 0a 1a 0a
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
  '890000000a49444154789c6360000002000154a24f3b0000000049454e44ae42' +
  '6082', 'hex');
// 真实 JPEG（极小值）
const JPG = Buffer.from(
  'ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffff' +
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' +
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' +
  'ffffffffffffff3ffd9', 'hex');

let pass = 0, fail = 0;
const log = (ok, name, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : fail++;
};

function req(method, path, { body, headers, multipart } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const opts = { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: headers || {} };
    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, text: buf.toString('utf-8'), buf });
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    if (multipart) {
      // multipart 由调用方拼好整体 buffer
      r.write(multipart.body);
    }
    r.end();
  });
}

function buildMultipart(fieldName, filename, contentType, fileBuf) {
  const boundary = '----xbtestboundary7';
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileBuf, tail]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function main() {
  const tmpSave = mkdtempSync(join(tmpdir(), 'tx-save-'));
  const child = spawn(NODE_BIN,
    [join(ROOT, 'server.js'), '--port', String(PORT)],
    { cwd: tmpSave, env: { ...process.env, XB_SAVE_ROOT: tmpSave }, stdio: 'ignore' });

  // 等服务器就绪
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { const r = await req('GET', '/api/slots'); if (r.status === 200) ready = true; } catch {}
  }
  if (!ready) { console.log('服务器未就绪，退出'); child.kill(); process.exit(2); }

  try {
    // 1. 初始槽位列表
    let r = await req('GET', '/api/slots');
    log(r.status === 200 && Array.isArray(r.text ? JSON.parse(r.text).slots : []), '槽位列表返回', r.status);

    // 2. 写入/读取隔离：槽位1 与 槽位2
    // 服务端 /api/save 接受 { files: { '文件名.ini': <已解析的 INI 对象> } }
    const files1 = { '个人信息.ini': { '角色': { 姓名: '测试甲' } } };
    const files2 = { '个人信息.ini': { '角色': { 姓名: '测试乙' } } };
    r = await req('POST', '/api/save?slot=1', { body: JSON.stringify({ files: files1 }), headers: { 'Content-Type': 'application/json' } });
    log(r.status === 200, '保存 槽位1', r.status);
    r = await req('POST', '/api/save?slot=2', { body: JSON.stringify({ files: files2 }), headers: { 'Content-Type': 'application/json' } });
    log(r.status === 200, '保存 槽位2', r.status);

    r = await req('GET', '/api/load?slot=1');
    const name1 = r.text && JSON.parse(r.text).files['个人信息.ini']?.['角色']?.['姓名'];
    r = await req('GET', '/api/load?slot=2');
    const name2 = r.text && JSON.parse(r.text).files['个人信息.ini']?.['角色']?.['姓名'];
    log(name1 === '测试甲' && name2 === '测试乙', '槽位隔离', `1=${name1} 2=${name2}`);

    // 3. 头像上传（PNG）
    let mp = buildMultipart('avatar', '头像.png', 'image/png', PNG);
    r = await req('POST', '/api/avatar?slot=1', { multipart: mp, headers: { 'Content-Type': mp.contentType } });
    const up1 = (() => { try { return JSON.parse(r.text); } catch { return {}; } })();
    log(r.status === 200 && up1.ok && up1.ext === 'png', '头像上传成功(PNG)', `${r.status} ${r.text.trim()}`);

    // 4. 头像读取 200 + content-type
    r = await req('GET', '/api/avatar?slot=1');
    log(r.status === 200, '头像读取 200', r.status);
    log((r.headers['content-type'] || '').includes('image/png'), '头像类型 png', r.headers['content-type']);
    log(r.buf.equals(PNG), '头像内容一致', `len=${r.buf.length}`);

    // 5. 头像上传（JPG）
    mp = buildMultipart('avatar', '头像.jpg', 'image/jpeg', JPG);
    r = await req('POST', '/api/avatar?slot=1', { multipart: mp, headers: { 'Content-Type': mp.contentType } });
    const up2 = (() => { try { return JSON.parse(r.text); } catch { return {}; } })();
    log(r.status === 200 && up2.ok && up2.ext === 'jpg', '头像上传成功(JPG)', `${r.status} ${r.text.trim()}`);
    r = await req('GET', '/api/avatar?slot=1');
    log((r.headers['content-type'] || '').includes('image/jpeg'), '头像类型替换为 jpg', r.headers['content-type']);

    // 6. 头像与槽位隔离：槽位2 无头像
    r = await req('GET', '/api/avatar?slot=2');
    log(r.status === 404, '槽位2 无头像(404)', r.status);

    // 7. 删除头像
    r = await req('DELETE', '/api/avatar?slot=1');
    log(r.status === 200, '删除头像', r.status);
    r = await req('GET', '/api/avatar?slot=1');
    log(r.status === 404, '删除后头像 404', r.status);

    // 8. 非图片被拒
    mp = buildMultipart('avatar', 'x.txt', 'text/plain', Buffer.from('hello'));
    r = await req('POST', '/api/avatar?slot=1', { multipart: mp, headers: { 'Content-Type': mp.contentType } });
    log(r.status === 400, '非图片被拒(400)', `${r.status} ${r.text.trim()}`);

    // 9. 删除槽位2 后无法读取
    r = await req('POST', '/api/delete-slot?slot=2');
    log(r.status === 200, '删除槽位2', r.status);
    r = await req('GET', '/api/load?slot=2');
    const gone = r.text && !JSON.parse(r.text).files['个人信息.ini'];
    log(gone, '槽位2 删除后无数据', JSON.stringify(gone));

  } catch (e) {
    console.log('运行异常：', e.message);
    fail++;
  } finally {
    try { child.kill('SIGKILL'); } catch {}
    for (let i = 0; i < 5; i++) {
      try { rmSync(tmpSave, { recursive: true, force: true }); break; } catch { try { await new Promise((r) => setTimeout(r, 200)); } catch {} }
    }
  }

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}

main();
