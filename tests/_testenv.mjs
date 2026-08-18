/**
 * _testenv.mjs —— 测试公共环境（可移植）
 * ============================================================
 * 从 process.execPath 推导 node 可执行文件与托管 node_modules 位置，
 * 杜绝硬编码绝对路径（如 C:/Users/...），使测试脚本随运行环境自适应。
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 运行中的 node 可执行文件（始终等于当前进程，天然可移植） */
export const NODE_BIN = process.execPath;

/** 解析托管 node_modules（jsdom 等开发依赖的安装处）。
 *  规则：process.execPath 形如 .../binaries/node/versions/<v>/node[.exe]，
 *  jsdom 安装在 .../binaries/node/workspace/node_modules。
 *  从该结构推导，适配任意盘符/安装目录；无法匹配时回退到相邻 node_modules。 */
export function managedNodeModules() {
  const exe = process.execPath.replace(/\\/g, '/');
  const m = exe.match(/(.*\/binaries\/node\/)versions\//);
  if (m) return m[1] + 'workspace/node_modules';
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');
}

/** 以 CJS require 加载 jsdom（最稳，避免动态 import 的 interop 时序问题） */
export function loadJsdom() {
  const require = createRequire(import.meta.url);
  return require(join(managedNodeModules(), 'jsdom', 'lib', 'api.js'));
}
