/**
 * 天玄修仙录 · 本地服务器（零依赖）
 * ============================================================
 * 职责：
 *   1. 静态文件服务（public/ 下的前端资源）
 *   2. 多存档槽读写 API：每个存档独立存放在 存档/<槽>/ 子目录
 *      - 按类别拆分为独立中文命名文件：个人信息.ini / 货币.ini / 属性.ini ...
 *      - 全部明文、可读、可手动编辑
 *      - 槽位：1 / 2 / 3 …（URL 通过 ?slot= 指定，默认 1）
 *      - 首次启动会把根目录下散落的旧版 .ini 自动迁入 存档/1/
 *   3. 头像服务：存档/<槽>/头像.png 或 头像.jpg，通过 /api/avatar?slot= 读取
 *
 * 启动：node server.js   （默认端口 8613，被占用时自动递增）
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------
 * 配置
 * ---------------------------------------------------------- */
const SAVE_ROOT = process.env.XB_SAVE_ROOT ? path.resolve(process.env.XB_SAVE_ROOT) : path.join(__dirname, '存档'); // 默认即本程序所在目录下的 存档；测试可用 XB_SAVE_ROOT 指向临时目录隔离
const PUBLIC_DIR = path.join(__dirname, 'public');
const BASE_PORT = 8613;
const MAX_PORT_TRY = 10;
const DEFAULT_SLOT = '1';
const GAME_AUTHOR = 'babyQ'; // 作者署名（显示于标题页与 /api/info）

/** 合法存档文件名白名单前缀校验：仅允许「中文/字母/数字.ini」，防止路径穿越 */
function isValidSaveName(name) {
  return typeof name === 'string'
    && /^[一-龥A-Za-z0-9_]+\.ini$/.test(name)
    && !name.includes('..')
    && !/[\\/]/.test(name);
}

/** 合法槽位名：仅允许数字（1/2/3…），防止路径穿越 */
function isValidSlot(slot) {
  return typeof slot === 'string' && /^\d{1,3}$/.test(slot);
}

/** 取得某槽位的存档目录（不存在则创建），并兼容旧版散落存档 */
function getSlotDir(slot) {
  const s = isValidSlot(slot) ? slot : DEFAULT_SLOT;
  return path.join(SAVE_ROOT, s);
}

/** 读 URL 中的 slot 参数（默认 1） */
function readSlot(req) {
  try {
    const u = new URL(req.url, 'http://localhost');
    const s = u.searchParams.get('slot');
    return isValidSlot(s) ? s : DEFAULT_SLOT;
  } catch {
    return DEFAULT_SLOT;
  }
}

/* ------------------------------------------------------------
 * 旧版存档迁移：把 存档/*.ini 散落文件迁入 存档/1/
 * ---------------------------------------------------------- */
function migrateLegacySaves() {
  if (!fs.existsSync(SAVE_ROOT)) return;
  const loose = fs.readdirSync(SAVE_ROOT)
    .filter((f) => f.endsWith('.ini') && isValidSaveName(f) && fs.statSync(path.join(SAVE_ROOT, f)).isFile());
  if (!loose.length) return;
  const slot1 = path.join(SAVE_ROOT, DEFAULT_SLOT);
  if (fs.existsSync(slot1)) return; // 已经有 1 号槽，不覆盖
  fs.mkdirSync(slot1, { recursive: true });
  for (const f of loose) {
    try { fs.renameSync(path.join(SAVE_ROOT, f), path.join(slot1, f)); } catch { /* 忽略单文件失败 */ }
  }
  console.log(`  旧版散落存档已迁入 存档/${DEFAULT_SLOT}/（共 ${loose.length} 个文件）`);
}

/* ------------------------------------------------------------
 * INI 编解码（明文、可读、可手动编辑）
 * ---------------------------------------------------------- */
const IniCodec = {
  parse(text) {
    const root = {};
    let section = root;
    const lines = String(text).split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith(';') || line.startsWith('#')) continue;
      const secMatch = line.match(/^\[(.+)\]$/);
      if (secMatch) {
        const name = secMatch[1].trim();
        root[name] = root[name] || {};
        section = root[name];
        continue;
      }
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (val.startsWith('json:')) {
        try { val = JSON.parse(val.slice(5)); } catch { /* 保留原字符串 */ }
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        val = Number(val);
      } else if (val === 'true' || val === 'false') {
        val = val === 'true';
      }
      section[key] = val;
    }
    return root;
  },

  stringify(data) {
    let out = '; 天玄修仙录 · 明文存档（可手动编辑，保存后于游戏内读取生效）\n';
    for (const [sec, kv] of Object.entries(data || {})) {
      out += `\n[${sec}]\n`;
      for (const [k, v] of Object.entries(kv || {})) {
        if (v !== null && typeof v === 'object') {
          out += `${k}=json:${JSON.stringify(v)}\n`;
        } else {
          out += `${k}=${v}\n`;
        }
      }
    }
    return out;
  },
};

/* ------------------------------------------------------------
 * 存档文件读写（同步即可：本地单人游戏，写量极小）
 * ---------------------------------------------------------- */
function ensureSlotDir(slot) {
  const dir = getSlotDir(slot);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readSaveFiles(slot) {
  const dir = getSlotDir(slot);
  if (!fs.existsSync(dir)) return {};
  const result = {};
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ini') && isValidSaveName(f));
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(dir, f), 'utf-8');
      result[f] = IniCodec.parse(text);
    } catch (e) {
      result[f] = { 错误: { 信息: `存档解析失败：${e.message}` } };
    }
  }
  return result;
}

function writeSaveFiles(slot, files) {
  const dir = ensureSlotDir(slot);
  const written = [];
  for (const [name, data] of Object.entries(files || {})) {
    if (!isValidSaveName(name)) continue;
    const target = path.join(dir, name);
    // 直接覆盖写入目标文件。
    // 注：部分文件系统（映射盘/特殊卷）禁止 rename 覆盖已存在文件（EPERM），
    // 故不采用「写 .tmp 再 rename」的原子写法，直接写目标最稳。
    fs.writeFileSync(target, IniCodec.stringify(data), 'utf-8');
    written.push(name);
  }
  return written;
}

/* ------------------------------------------------------------
 * 槽位管理
 * ---------------------------------------------------------- */
function listSlots() {
  if (!fs.existsSync(SAVE_ROOT)) return [];
  const slots = [];
  const entries = fs.readdirSync(SAVE_ROOT, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!isValidSlot(e.name)) continue;
    const dir = path.join(SAVE_ROOT, e.name);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ini') && isValidSaveName(f));
    // 说明：realm 取自「道号」（玩家自取称号，可能是「玄尘子」这类），并非境界；
    // 真正的境界/等级/战力在 属性.ini 的「修为」段，另读一份，供选档卡片展示。
    const summary = { slot: e.name, hasSave: files.includes('个人信息.ini'), name: '', realm: '', age: '', saveCode: '', savedTime: '', avatarPreset: '', realmName: '', level: 0, power: 0, year: 0 };
    if (summary.hasSave) {
      try {
        const info = IniCodec.parse(fs.readFileSync(path.join(dir, '个人信息.ini'), 'utf-8'));
        const base = info['基本信息'] || {};
        const meta = (fs.existsSync(path.join(dir, '元数据.ini'))) ? IniCodec.parse(fs.readFileSync(path.join(dir, '元数据.ini'), 'utf-8'))['存档信息'] || {} : {};
        summary.name = base.姓名 || '';
        summary.realm = base.道号 || '';
        summary.age = base.骨龄 || '';
        summary.saveCode = meta.道果码 || '';
        summary.savedTime = meta.保存时间 || '';
      } catch { /* 忽略解析失败 */ }
      try {
        const settings = (fs.existsSync(path.join(dir, '设置.ini'))) ? IniCodec.parse(fs.readFileSync(path.join(dir, '设置.ini'), 'utf-8'))['游戏设置'] || {} : {};
        summary.avatarPreset = settings.avatarPreset || settings['头像预设'] || '';
      } catch { /* 忽略解析失败 */ }
      // 境界 / 等级 / 战力 / 纪年：老存档可能缺文件，缺则留空由 UI 容错。
      try {
        const attrFile = path.join(dir, '属性.ini');
        if (fs.existsSync(attrFile)) {
          const xiu = IniCodec.parse(fs.readFileSync(attrFile, 'utf-8'))['修为'] || {};
          summary.realmName = String(xiu.境界 || '');
          summary.level = Number(xiu.等级) || 0;
          summary.power = Number(xiu.战力) || 0;
        }
        const worldFile = path.join(dir, '世界.ini');
        if (fs.existsSync(worldFile)) {
          const t = IniCodec.parse(fs.readFileSync(worldFile, 'utf-8'))['时间'] || {};
          summary.year = Number(t.天玄历年) || 0;
        }
      } catch { /* 忽略解析失败 */ }
    }
    slots.push(summary);
  }
  // 数字槽位升序
  slots.sort((a, b) => Number(a.slot) - Number(b.slot));
  return slots;
}

function deleteSlot(slot) {
  const dir = getSlotDir(slot);
  if (!fs.existsSync(dir)) return { ok: false, error: '槽位不存在' };
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true, slot };
}

/* ------------------------------------------------------------
 * HTTP 工具
 * ---------------------------------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** 基础安全响应头：防 MIME 嗅探、防被 iframe 嵌入（本地单人游戏亦顺手加固） */
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 5 * 1024 * 1024) reject(new Error('请求体过大'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  // 跨平台安全校验：解析后必须仍落在 PUBLIC_DIR 之内（用 relative 而非 startsWith，避免 public2 这类兄弟目录误判）
  const rel = path.relative(PUBLIC_DIR, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const noCache = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.mjs';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ...SEC_HEADERS,
      ...(noCache ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } : {}),
    });
    res.end(buf);
  });
}

/** 头像读取：存档/<slot>/头像.png|jpg，找不到返回 404 */
function serveAvatar(req, res) {
  const slot = readSlot(req);
  const dir = getSlotDir(slot);
  const candidates = ['头像.png', '头像.jpg', '头像.jpeg'];
  for (const name of candidates) {
    const fp = path.join(dir, name);
    if (fs.existsSync(fp)) {
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(fp).pipe(res);
      return;
    }
  }
  res.writeHead(404); res.end('No avatar');
}

/** 头像上传：multipart/form-data，仅接受 png/jpg，大小限制 2MB */
function handleAvatarUpload(req, res) {
  const slot = readSlot(req);
  const dir = ensureSlotDir(slot);
  const ct = req.headers['content-type'] || '';
  const bm = ct.match(/boundary=(.+)$/);
  if (!bm) { sendJson(res, 400, { ok: false, error: '缺少 boundary' }); return; }
  const boundary = '--' + bm[1].trim();
  const maxBytes = 2 * 1024 * 1024;
  let chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > maxBytes) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const sep = Buffer.from('\r\n\r\n');
    const sIdx = buf.indexOf(sep);
    if (sIdx < 0) { sendJson(res, 400, { ok: false, error: '无文件内容' }); return; }
    let content = buf.slice(sIdx + 4);
    const tail = Buffer.from('\r\n' + boundary);
    const tIdx = content.lastIndexOf(tail);
    if (tIdx >= 0) content = content.slice(0, tIdx);
    const isPng = content.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpg = content.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    let ext = 'png';
    if (isPng) ext = 'png';
    else if (isJpg) ext = 'jpg';
    else { sendJson(res, 400, { ok: false, error: '仅支持 PNG/JPG 图片' }); return; }
    // 清理旧头像
    for (const old of ['头像.png', '头像.jpg', '头像.jpeg']) {
      const op = path.join(dir, old);
      if (fs.existsSync(op)) { try { fs.unlinkSync(op); } catch {} }
    }
    fs.writeFileSync(path.join(dir, `头像.${ext}`), content);
    sendJson(res, 200, { ok: true, ext });
  });
  req.on('error', () => sendJson(res, 500, { ok: false, error: '上传异常' }));
}

function deleteAvatar(req, res) {
  const slot = readSlot(req);
  const dir = getSlotDir(slot);
  let removed = false;
  for (const old of ['头像.png', '头像.jpg', '头像.jpeg']) {
    const op = path.join(dir, old);
    if (fs.existsSync(op)) { try { fs.unlinkSync(op); removed = true; } catch {} }
  }
  sendJson(res, 200, { ok: true, removed });
}

/* ------------------------------------------------------------
 * API 路由
 *   GET  /api/status?slot=1            -> { hasSave, files }
 *   GET  /api/load?slot=1              -> { hasSave, files }
 *   POST /api/save?slot=1              <- { files }
 *   POST /api/reset?slot=1             -> 清空某槽（移入历史备份）
 *   GET  /api/slots                    -> { slots: [{slot,hasSave,name,...}] }
 *   POST /api/delete-slot?slot=1       -> 删除某槽目录
 *   GET  /api/avatar?slot=1            -> 头像图片（404 表示无）
 *   POST /api/avatar?slot=1            <- multipart 上传头像
 *   DELETE /api/avatar?slot=1          -> 删除头像
 * ---------------------------------------------------------- */
async function handleApi(req, res) {
  const url = req.url.split('?')[0];

  if (url === '/api/info' && req.method === 'GET') {
    return sendJson(res, 200, {
      title: '天玄修仙录',
      author: GAME_AUTHOR,
      saveRoot: SAVE_ROOT,
      basePort: BASE_PORT,
    });
  }

  if (url === '/api/slots' && req.method === 'GET') {
    migrateLegacySaves();
    return sendJson(res, 200, { slots: listSlots() });
  }

  if (url === '/api/avatar') {
    if (req.method === 'GET') return serveAvatar(req, res);
    if (req.method === 'POST') return handleAvatarUpload(req, res);
    if (req.method === 'DELETE') return deleteAvatar(req, res);
    return sendJson(res, 405, { error: '方法不支持' });
  }

  if (url === '/api/status' && req.method === 'GET') {
    const slot = readSlot(req);
    ensureSlotDir(slot);
    const dir = getSlotDir(slot);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ini'));
    return sendJson(res, 200, { hasSave: files.includes('个人信息.ini'), files });
  }

  if (url === '/api/load' && req.method === 'GET') {
    const slot = readSlot(req);
    const files = readSaveFiles(slot);
    return sendJson(res, 200, { hasSave: !!files['个人信息.ini'], files });
  }

  if (url === '/api/save' && req.method === 'POST') {
    try {
      const slot = readSlot(req);
      const body = JSON.parse(await readBody(req));
      const written = writeSaveFiles(slot, body.files);
      return sendJson(res, 200, { ok: true, written, slot });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url === '/api/reset' && req.method === 'POST') {
    try {
      const slot = readSlot(req);
      const dir = getSlotDir(slot);
      if (!fs.existsSync(dir)) return sendJson(res, 200, { ok: true, moved: [], backup: null });
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ini') && isValidSaveName(f));
      let backupDir = null;
      if (files.length) {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        backupDir = path.join(SAVE_ROOT, `历史备份_${slot}_${stamp}`);
        fs.mkdirSync(backupDir, { recursive: true });
        for (const f of files) {
          fs.renameSync(path.join(dir, f), path.join(backupDir, f));
        }
      }
      return sendJson(res, 200, { ok: true, moved: files, backup: path.basename(backupDir) });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url === '/api/delete-slot' && req.method === 'POST') {
    try {
      const slot = readSlot(req);
      if (slot === DEFAULT_SLOT) {
        // 默认槽删空而非删目录，避免误删唯一存档根
        const dir = getSlotDir(slot);
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            if (fs.statSync(fp).isFile()) try { fs.unlinkSync(fp); } catch {}
          }
        }
        return sendJson(res, 200, { ok: true, slot, cleared: true });
      }
      return sendJson(res, 200, deleteSlot(slot));
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url === '/api/backups' && req.method === 'GET') {
    try {
      const slot = readSlot(req);
      if (!fs.existsSync(SAVE_ROOT)) return sendJson(res, 200, { slot, backups: [] });
      const prefix = `历史备份_${slot}_`;
      const backups = fs.readdirSync(SAVE_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith(prefix) && /^历史备份_\d{1,3}_\d{14}$/.test(e.name))
        .map((e) => ({ name: e.name, stamp: e.name.slice(prefix.length) }))
        .sort((a, b) => b.name.localeCompare(a.name));
      return sendJson(res, 200, { slot, backups });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (url === '/api/restore' && req.method === 'POST') {
    try {
      const slot = readSlot(req);
      const body = JSON.parse(await readBody(req));
      const backup = String(body.backup || '');
      // 严格校验备份名：必须形如 历史备份_<slot>_<14位时间戳>，防止穿越到任意目录
      if (!/^历史备份_\d{1,3}_\d{14}$/.test(backup)) return sendJson(res, 400, { ok: false, error: '非法备份名' });
      const backupDir = path.join(SAVE_ROOT, backup);
      if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
        return sendJson(res, 404, { ok: false, error: '备份不存在' });
      }
      const slotDir = getSlotDir(slot);
      // 1) 当前槽文件先滚动到新备份（不丢当前进度）
      if (fs.existsSync(slotDir)) {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const roll = path.join(SAVE_ROOT, `历史备份_${slot}_${stamp}`);
        fs.mkdirSync(roll, { recursive: true });
        for (const f of fs.readdirSync(slotDir).filter((f) => f.endsWith('.ini') && isValidSaveName(f))) {
          fs.renameSync(path.join(slotDir, f), path.join(roll, f));
        }
      }
      // 2) 从所选备份还原到槽
      fs.mkdirSync(slotDir, { recursive: true });
      const restored = [];
      for (const f of fs.readdirSync(backupDir).filter((f) => f.endsWith('.ini') && isValidSaveName(f))) {
        fs.renameSync(path.join(backupDir, f), path.join(slotDir, f));
        restored.push(f);
      }
      return sendJson(res, 200, { ok: true, slot, restored, from: backup });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  sendJson(res, 404, { error: '未知接口' });
}

/* ------------------------------------------------------------
 * 启动
 * ---------------------------------------------------------- */
function start(port, tried) {
  const server = http.createServer((req, res) => {
    const path0 = req.url.split('?')[0];
    if (path0 === '/api/avatar') {
      handleApi(req, res).catch((e) => sendJson(res, 500, { error: e.message }));
    } else if (req.url.startsWith('/api/')) {
      handleApi(req, res).catch((e) => sendJson(res, 500, { error: e.message }));
    } else {
      serveStatic(req, res);
    }
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && tried < MAX_PORT_TRY) {
      start(port + 1, tried + 1);
    } else {
      console.error('服务器启动失败：', e.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    ensureSlotDir(DEFAULT_SLOT);
    migrateLegacySaves();
    console.log('================================================');
    console.log('  天玄修仙录 · 本地服务器已启动');
    console.log(`  游戏地址：http://127.0.0.1:${port}`);
    console.log(`  存档目录：${SAVE_ROOT}`);
    console.log('  关闭本窗口即停止游戏服务');
    console.log('================================================');
  });
}

// 支持通过 --port 指定端口（便于测试或避免冲突）
const PORT_ARG = (() => {
  const i = process.argv.indexOf('--port');
  if (i >= 0 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return BASE_PORT;
})();
start(PORT_ARG, 0);
