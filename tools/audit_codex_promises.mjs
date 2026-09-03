/**
 * 图鉴「承诺兑现」审计（只读扫描，不写入任何文件）
 * ------------------------------------------------------------
 * 图鉴 source 字段是对玩家的承诺：照着去刷，就该刷得到。
 * 本脚本按途径关键词把 source 拆开，逐条对照真实数据结构验证，
 * 打印「承诺了但查无实据」的清单，供人工复核。
 *
 * 判定规则集中在 tools/codex_pools.mjs（与测试共用同一份，避免假绿灯）。
 * 用法：node tools/audit_codex_promises.mjs
 */
import { buildPools, findBrokenPromises, ABSTRACT_CATEGORIES } from './codex_pools.mjs';

const { POOLS, CODEX_ITEMS } = await buildPools();

// 装备/法宝/功法是「品级抽象条目」，默认跳过；加 --all 可连同它们一起看（误报会很多）
const skip = process.argv.includes('--all') ? [] : ABSTRACT_CATEGORIES;
const broken = findBrokenPromises(POOLS, CODEX_ITEMS, { skipCategories: skip });

console.log('=== 图鉴「承诺了但数据表里查无实据」===');
if (!broken.length) console.log('（无）');
for (const b of broken) {
  console.log(`- [${b.category}] ${b.name}(${b.id || '无id'}) ｜ 声称「${b.claim}」｜ source：${b.source}`);
}
const uniq = new Set(broken.map((b) => b.name)).size;
console.log(`\n合计 ${CODEX_ITEMS.length} 条图鉴，命中 ${broken.length} 条可疑承诺（涉及 ${uniq} 个条目）。`);
if (skip.length) console.log(`已跳过抽象分类：${skip.join('、')}（它们的真实掉落名带随机前缀，加 --all 可查看）`);
console.log('注意：本脚本是只读摸底，命中项必须人工复核后再动手 —— 池名与图鉴名不同名会造成误判。');
