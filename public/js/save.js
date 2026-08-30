/**
 * save.js —— 存档模块（客户端侧）
 * ============================================================
 * 职责：
 *   - 把运行时状态「序列化」为按类别拆分的明文 INI 文件结构
 *   - 通过本地服务器 API 读写本程序目录下的存档
 *   - 存档文件全部中文命名、明文可读、可手动编辑：
 *       个人信息.ini / 货币.ini / 属性.ini / 功法.ini / 技艺.ini
 *       道具.ini / 装备.ini / 洞府.ini / 道缘.ini / 天命.ini / 世界.ini / 元数据.ini
 *
 * 【扩展点】新增数据类别时：
 *   1. 在 SAVE_FILES 中登记文件名
 *   2. 在 serialize/deserialize 中补一段映射
 *   3. 服务器端无需任何改动（文件名白名单支持中文）
 */

import { ensureLifeState } from './life.js';
import { ensureCodexState, SECT_RANKS, CODEX_ITEMS } from './codex.js';

/* 存档文件名清单（新增类别在此登记） */
export const SAVE_FILES = [
  '元数据.ini', '个人信息.ini', '货币.ini', '属性.ini', '功法.ini', '技艺.ini',
  '道具.ini', '装备.ini', '洞府.ini', '道缘.ini', '天命.ini', '世界.ini', '日志.ini', '仙途纪事.ini', '设置.ini',
  '图鉴.ini', '灵兽.ini', '宗门.ini',
];

/* ---------------- 序列化：state -> { 文件名: ini对象 } ---------------- */
export function serialize(state) {
  ensureLifeState(state);
  const codex = ensureCodexState(state);
  const p = state.player;
  return {
    '元数据.ini': {
      存档信息: {
        版本: state.meta.version,
        道果码: state.meta.saveCode,
        保存时间: new Date().toLocaleString('zh-CN'),
        设定版本: 'V8.1.3',
      },
    },
    '个人信息.ini': {
      基本信息: {
        姓名: p.name, 性别: p.gender, 种族: p.race,
        骨龄: p.age, 出生地: p.region, 开局包: p.packName,
        道号: p.title || '暂无',
        自定义道号: p.daoTitle || '',
        个性签名: p.signature || '',
        封号列表: (p.titles || []).join('、') || '无',
        佩戴封号: p.activeTitle || '',
      },
      灵根资质: {
        品级: p.spiritRoot.grade, 品级ID: p.spiritRoot.gradeId || '',
        系别: p.spiritRoot.elements.join('、'),
        修炼速度: p.spiritRoot.speed,
      },
      先天道韵: {
        名称: p.daoYun.name, 道韵ID: p.daoYun.id || '',
        等级: p.daoYun.level, 经验: p.daoYun.exp,
      },
    },
    '货币.ini': {
      灵石: { ...state.currencies },
      说明: { 兑换比例: '相邻层级 1:100（100下品=1中品，依此类推）' },
    },
    '属性.ini': {
      修为: {
        等级: p.level, 经验: p.exp, 境界: p.realmName,
        战力: p.power, 寿元上限: p.lifespan, 寿元修正: p.lifeBonus || 0,
        // 珍贵丹药一生服用次数：必须随档持久化，否则存读档即可绕过「延寿丹3颗/洗髓丹2颗」上限
        延寿丹已服: p.lifespanPillsTaken || 0, 洗髓丹已服: p.marrowPillsTaken || 0,
      },
      道基: Object.fromEntries(
        Object.entries(p.daoBase).map(([k, v]) => [k, `${v.level}级(经验${v.exp})`]),
      ),
      道基明细: Object.fromEntries(
        Object.entries(p.daoBase).map(([k, v]) => [k, { 等级: v.level, 经验: v.exp }]),
      ),
    },
    '功法.ini': {
      主修: { 当前主修: p.mainTechnique || '无' },
      功法列表: Object.fromEntries(
        state.techniques.map((t, i) => [`功法${String(i + 1).padStart(2, '0')}`, t]),
      ),
    },
    '技艺.ini': {
      修仙百艺: Object.fromEntries(
        Object.entries(state.arts).map(([k, v]) => [k, `${v.level}级(经验${v.exp})`]),
      ),
      明细: Object.fromEntries(
        Object.entries(state.arts).map(([k, v]) => [k, { 等级: v.level, 经验: v.exp }]),
      ),
    },
    '道具.ini': {
      储物袋信息: { 名称: state.inventory.bagName, 容量格: state.inventory.capacity, 已用格: state.inventory.used, 扩容次数: state.inventory.upgrades },
      储物袋: Object.fromEntries(
        state.items.map((it, i) => [`物品${String(i + 1).padStart(2, '0')}`, { ...it, 名称: it.名称 || it.name, 类型: it.类型 || it.type, 数量: it.数量 || it.quantity || 1, 描述: it.描述 || it.desc || '' }]),
      ),
    },
    '装备.ini': {
      说明: { 装备: '常规战斗用品，获取途径较多', 法宝: '稀有机缘之物，威力按等级双倍计入战力' },
      // 现代六部位结构（weapon/armor/pants/boots/accessory/artifact）+ 备用栏
      // 旧版 当前装备/当前法宝/装备栏/法宝栏 不再写入，由 deserialize + migrateEquipment 兼容老存档
      当前武器: state.equipment.weapon || { 名称: '无', 等级: 0 },
      当前衣服: state.equipment.armor || { 名称: '无', 等级: 0 },
      当前裤子: state.equipment.pants || { 名称: '无', 等级: 0 },
      当前鞋子: state.equipment.boots || { 名称: '无', 等级: 0 },
      当前饰品: state.equipment.accessory || { 名称: '无', 等级: 0 },
      当前法宝: state.equipment.artifact || { 名称: '无', 等级: 0 },
      备用装备: Object.fromEntries(
        (state.equipment.stash || []).map((a, i) => [`备用${i + 1}`, a]),
      ),
    },
    '洞府.ini': {
      洞府: { 等级: state.cave.level, 名称: state.cave.name, 修炼加成: state.cave.bonus },
      灵草园: Object.fromEntries((state.cave.garden || []).map((h, i) => [`灵草${i + 1}`, h])),
    },
    '道缘.ini': {
      关系网: Object.fromEntries(
        state.npcs.map((n, i) => [`${n.name}`, {
          性别: n.gender, 种族: n.race, 境界: n.realm, 战力: n.power,
          性格: n.trait, 身份: n.job, 好感: n.favor, 关系序号: n.relation || 0, 层级: n.relationName,
          道友之能: n.skill || '未解锁', 最近往来: n.lastMeet, 等级: n.level || 1, 地域: n.region || state.world.region,
        }]),
      ),
    },
    '天命.ini': {
      主线: {
        天命主线: state.destiny.lineName, 主线ID: state.destiny.lineId,
        当前阶段: state.destiny.stageName,
        阶段序号: state.destiny.stage, 状态: state.destiny.status,
        已等待: `${state.destiny.waitYears}年`, 天命封号: state.destiny.title || '未定',
      },
      历程: Object.fromEntries(
        state.destiny.done.map((d, i) => [`阶段${i + 1}`, d]),
      ),
    },
    '世界.ini': {
      时间: { 天玄历年: state.world.year, 月: state.world.month, 总回合: state.world.turns },
      位置: { 所在修真域: state.world.region, 地域ID: state.world.regionId },
      旅行: state.world.travel,
      坊市: state.world.market,
      演化: { 近期动态: state.world.news.slice(0, 8) },
    },
    '日志.ini': {
      说明: { 格式: '每条=时间|类型|内容（倒序追加，最新在最后）' },
      日志: Object.fromEntries(
        (state.logs || []).map((l, i) => [String(i + 1).padStart(3, '0'), `[${l.time}|${l.type}] ${l.text}`]),
      ),
      日志明细: Object.fromEntries(
        (state.logs || []).map((l, i) => [String(i + 1).padStart(3, '0'), l]),
      ),
    },
    '仙途纪事.ini': {
      说明: { 用途: '记录真实发生的战斗、道缘、百艺、旅行与主线故事' },
      纪事: Object.fromEntries((state.chronicle || []).map((x, i) => [`纪事${String(i + 1).padStart(3, '0')}`, x])),
      成就: Object.fromEntries((state.achievements || []).map((a, i) => [`成就${String(i + 1).padStart(3, '0')}`, a])),
    },
    '设置.ini': {
      游戏设置: {
        autoSave: state.settings.autoSave !== false,
        animations: state.settings.animations !== false,
        clickFx: state.settings.clickFx !== false,
        textSize: state.settings.textSize || 'normal',
        windowSize: state.settings.windowSize || 'normal',
        avatarPreset: state.settings.avatarPreset || '',
      },
      标记状态: {
        丹毒: state.flags?.pillToxicity || 0,
        连续闭关: state.flags?.seclusionStreak || 0,
        击杀数: state.flags?.kills || 0,
        天道庇护: state.flags?.tiandaoBlessing || 0,
        天道诅咒: state.flags?.tiandaoCurse || false,
        伤势: state.flags?.wounded || 0,
        道侣: state.flags?.companion || '',
        同行月数: state.flags?.companionMonths || 0,
        秘境最深: state.flags?.mysticDeepest || 0,
        丹药增益: state.buffs?.power || 0,
        增益到期月: state.buffs?.expireMonth || 0,
        炼丹总数: state.flags?.refinedPills || 0,
        曾疗伤: state.flags?.curedWounds || false,
        曾渡劫: state.flags?.tribulationSuccess || false,
        聚灵余月: state.flags?.cultivateBoostMonths || 0,
        战前增益: state.flags?.nextBattleWin || 0,
        天机运势: state.flags?.omen || null,
      },
    },
    '图鉴.ini': {
      说明: { 用途: '记录已发现的物品，未发现的物品在图鉴中显示为未知' },
      统计: { 已发现: codex.seenCount, 总数: CODEX_ITEMS.length },
      已发现: Object.fromEntries((codex.discovered || []).map((k, i) => [`条目${String(i + 1).padStart(3, '0')}`, k])),
      发现次数: codex.counts || {},
    },
    '灵兽.ini': {
      灵兽栏: { 最大格数: state.beasts?.maxSlots || 1, 已收服: state.beasts?.tamedCount || 0, 出战: state.beasts?.activeIdx ?? -1 },
      灵兽列表: Object.fromEntries((state.beasts?.slots || []).map((b, i) => [`灵兽${i + 1}`, b])),
    },
    '宗门.ini': {
      宗门信息: { 名称: state.sect?.name || '无', 职级: state.sect?.rank || 0, 贡献: state.sect?.contribution || 0, 待领俸禄: state.sect?.stipend || 0, 上次领取年: state.sect?.claimedYear || 0, 上次领取月: state.sect?.claimedMonth || 0 },
      职级名: { 当前: state.sect?.name ? (SECT_RANKS[state.sect?.rank || 0]?.name || '散修') : '散修' },
    },
  };
}

/* 判断「装备.ini」里读出的对象是否为真实装备（过滤掉 {名称:'无'} 占位与空段 {}） */
function pickEquip(v) {
  return (v && v.名称 && v.名称 !== '无' && v.名称 !== '赤手空拳') ? v : null;
}

/* ---------------- 反序列化：ini对象 -> state ---------------- */
export function deserialize(files) {
  if (!files || !files['个人信息.ini']) return null;
  const get = (f, sec) => (files[f] && files[f][sec]) || {};
  const base = get('个人信息.ini', '基本信息');
  const root = get('个人信息.ini', '灵根资质');
  const yun = get('个人信息.ini', '先天道韵');
  const xiu = get('属性.ini', '修为');
  const daoDetail = get('属性.ini', '道基明细');
  const meta = get('元数据.ini', '存档信息');

  const tianming = get('天命.ini', '主线');
  const caveRaw = get('洞府.ini', '洞府');
  const state = {
    meta: {
      version: meta.版本 || '1.0.0',
      saveCode: meta.道果码 || '----',
    },
    player: {
      name: base.姓名, gender: base.性别, race: base.种族,
      age: Number(base.骨龄) || 16, region: base.出生地,
      packName: base.开局包,       title: base.道号 === '暂无' ? '' : base.道号,
      daoTitle: base.自定义道号 || '',
      signature: base.个性签名 || '',
      titles: (base.封号列表 && base.封号列表 !== '无') ? String(base.封号列表).split('、').filter(Boolean) : [],
      activeTitle: base.佩戴封号 || '',
      spiritRoot: {
        grade: root.品级, gradeId: root.品级ID || '',
        elements: String(root.系别 || '').split('、').filter(Boolean),
        speed: Number(root.修炼速度) || 1,
      },
      daoYun: { name: yun.名称, id: yun.道韵ID || '', level: Number(yun.等级) || 1, exp: Number(yun.经验) || 0 },
      level: Number(xiu.等级) || 1,
      exp: Number(xiu.经验) || 0,
      realmName: xiu.境界 || '凡人境',
      power: Number(xiu.战力) || 1,
      lifespan: Number(xiu.寿元上限) || 100,
      lifeBonus: Number(xiu.寿元修正) || 0,
      lifespanPillsTaken: Number(xiu.延寿丹已服) || 0,
      marrowPillsTaken: Number(xiu.洗髓丹已服) || 0,
      daoBase: {},
    },
    currencies: { ...get('货币.ini', '灵石') },
    techniques: [],
    mainTechnique: get('功法.ini', '主修').当前主修 || null,
    arts: {},
    items: [],
    equipment: {
      // 现代六部位直接还原；旧版存档（仅写 当前装备/当前法宝）通过 fallback 兼容
      weapon: pickEquip(get('装备.ini', '当前武器')) || pickEquip(get('装备.ini', '当前装备')),
      armor: pickEquip(get('装备.ini', '当前衣服')),
      pants: pickEquip(get('装备.ini', '当前裤子')),
      boots: pickEquip(get('装备.ini', '当前鞋子')),
      accessory: pickEquip(get('装备.ini', '当前饰品')),
      artifact: pickEquip(get('装备.ini', '当前法宝')),
      stash: Object.values(get('装备.ini', '备用装备') || {}).filter(Boolean),
    },
    inventory: {
      capacity: Number(get('道具.ini', '储物袋信息').容量格) || 100,
      used: Number(get('道具.ini', '储物袋信息').已用格) || 0,
      upgrades: Number(get('道具.ini', '储物袋信息').扩容次数) || 0,
      bagName: get('道具.ini', '储物袋信息').名称 || '下品储物袋',
    },
    cave: {
      level: Number(caveRaw.等级) || 0,
      name: caveRaw.名称 || '凡人客栈',
      bonus: Number(caveRaw.修炼加成) || 0,
      garden: Object.values(get('洞府.ini', '灵草园')).filter(Boolean),
    },
    npcs: [],
    destiny: {
      lineId: tianming.主线ID || '',
      lineName: tianming.天命主线 || '',
      stageName: tianming.当前阶段 || '',
      status: tianming.状态 || '待抉择',
      title: (tianming.天命封号 && tianming.天命封号 !== '未定') ? tianming.天命封号 : '',
      stage: Number(tianming.阶段序号) || 0,
      waitYears: Number(String(tianming.已等待 || '0').replace('年', '')) || 0,
      done: Object.values(get('天命.ini', '历程')),
    },
    world: {
      year: Number(get('世界.ini', '时间').天玄历年) || 1000,
      month: Number(get('世界.ini', '时间').月) || 1,
      turns: Number(get('世界.ini', '时间').总回合) || 0,
      region: get('世界.ini', '位置').所在修真域,
      regionId: get('世界.ini', '位置').地域ID || '',
      travel: get('世界.ini', '旅行'),
      market: get('世界.ini', '坊市'),
      news: get('世界.ini', '演化').近期动态 || [],
    },
    flags: { focusMonths: 0, lastFocus: '', noGuideMonths: 0, wounded: 0, companion: '', companionMonths: 0 },
    buffs: { power: Number(get('设置.ini', '标记状态').丹药增益) || 0, expireMonth: Number(get('设置.ini', '标记状态').增益到期月) || 0 },
    chronicle: [],
    settings: { ...get('设置.ini', '游戏设置') },
    logs: [],
  };
  // 日志还原（优先读结构化的「日志明细」，兼容手改后的「日志」文本行）
  const logDetail = get('日志.ini', '日志明细');
  const logEntries = Object.keys(logDetail).sort().map((k) => logDetail[k]);
  state.logs = logEntries
    .map((l) => (l && typeof l === 'object' && l.text ? { time: String(l.time || ''), type: String(l.type || '系统'), text: String(l.text) } : null))
    .filter(Boolean);
  state.player.mainTechnique = state.mainTechnique;
  ensureLifeState(state);

  // 道基
  for (const [k, v] of Object.entries(daoDetail)) {
    state.player.daoBase[k] = { level: Number(v.等级) || 1, exp: Number(v.经验) || 0 };
  }
  // 功法 / 技艺 / 道具 / 法宝 / NPC：遍历 json 行还原
  for (const v of Object.values(get('功法.ini', '功法列表'))) state.techniques.push(v);
  for (const [k, v] of Object.entries(get('技艺.ini', '明细'))) {
    state.arts[k] = { level: Number(v.等级) || 0, exp: Number(v.经验) || 0 };
  }
  for (const v of Object.values(get('道具.ini', '储物袋'))) state.items.push({ ...v, 名称: v.名称 || v.name, 类型: v.类型 || v.type || '杂物', 数量: Number(v.数量 || v.quantity) || 1, 描述: v.描述 || v.desc || '' });
  // 旧版 装备栏/法宝栏 兼容：并入备用栏
  for (const v of Object.values(get('装备.ini', '装备栏'))) state.equipment.stash.push(v);
  for (const v of Object.values(get('装备.ini', '法宝栏'))) state.equipment.stash.push(v);
  const chronicle = get('仙途纪事.ini', '纪事');
  state.chronicle = Object.values(chronicle).filter((x) => x && typeof x === 'object');
  state.achievements = Object.values(get('仙途纪事.ini', '成就') || {}).filter((x) => x && x.id);
  for (const [name, v] of Object.entries(get('道缘.ini', '关系网'))) {
    state.npcs.push({
      name, gender: v.性别, race: v.种族, realm: v.境界, power: Number(v.战力) || 1,
      trait: v.性格, job: v.身份, favor: Number(v.好感) || 0,
      relation: Number(v.关系序号) || 0,
      relationName: v.层级, skill: v.道友之能 === '未解锁' ? '' : v.道友之能,
      lastMeet: Number(v.最近往来) || 0, level: Number(v.等级) || 1, region: v.地域 || state.world.region,
    });
  }
  // 还原图鉴
  const codexDiscovered = Object.values(get('图鉴.ini', '已发现'));
  const codexCounts = get('图鉴.ini', '发现次数');
  state.codex = {
    discovered: codexDiscovered.filter(Boolean),
    seenCount: Number(get('图鉴.ini', '统计').已发现) || codexDiscovered.length,
    counts: codexCounts || {},
  };
  // 还原灵兽
  state.beasts = {
    slots: Object.values(get('灵兽.ini', '灵兽列表')).filter(Boolean),
    maxSlots: Number(get('灵兽.ini', '灵兽栏').最大格数) || 1,
    tamedCount: Number(get('灵兽.ini', '灵兽栏').已收服) || 0,
    activeIdx: Number(get('灵兽.ini', '灵兽栏').出战 ?? -1),
  };
  // 还原宗门
  const sectInfo = get('宗门.ini', '宗门信息');
  state.sect = {
    name: sectInfo.名称 === '无' ? '' : sectInfo.名称,
    rank: Number(sectInfo.职级) || 0,
    contribution: Number(sectInfo.贡献) || 0,
    stipend: Number(sectInfo.待领俸禄) || 0,
    claimedYear: Number(sectInfo.上次领取年) || 0,
    claimedMonth: Number(sectInfo.上次领取月) || 0,
  };
  // 还原标记状态（丹毒等）
  const flagsRaw = get('设置.ini', '标记状态');
  state.flags = {
    ...state.flags,
    pillToxicity: Number(flagsRaw.丹毒) || 0,
    seclusionStreak: Number(flagsRaw.连续闭关) || 0,
    kills: Number(flagsRaw.击杀数) || 0,
    tiandaoBlessing: Number(flagsRaw.天道庇护) || 0,
    tiandaoCurse: flagsRaw.天道诅咒 === true || flagsRaw.天道诅咒 === 'true',
    wounded: Number(flagsRaw.伤势) || 0,
    companion: flagsRaw.道侣 || '',
    companionMonths: Number(flagsRaw.同行月数) || 0,
    mysticDeepest: Number(flagsRaw.秘境最深) || 0,
    refinedPills: Number(flagsRaw.炼丹总数) || 0,
    curedWounds: flagsRaw.曾疗伤 === true || flagsRaw.曾疗伤 === 'true',
    tribulationSuccess: flagsRaw.曾渡劫 === true || flagsRaw.曾渡劫 === 'true',
    cultivateBoostMonths: Number(flagsRaw.聚灵余月) || 0,
    nextBattleWin: Number(flagsRaw.战前增益) || 0,
    // 天机运势：随档持久化，否则存读档后有效运势静默消失（修炼/悟性/交易倍率失效）
    omen: (flagsRaw.天机运势 && typeof flagsRaw.天机运势 === 'object') ? flagsRaw.天机运势 : null,
  };
  ensureLifeState(state);
  return state;
}

/* ---------------- 服务器 API ---------------- */
// 当前存档槽（由标题页/多存档选择决定，默认 1）
let CURRENT_SLOT = '1';
export function setSaveSlot(slot) {
  CURRENT_SLOT = String(slot || '1');
  try { window.localStorage.setItem('tianxuan-slot', CURRENT_SLOT); } catch {}
}
export function getSaveSlot() {
  try {
    const s = window.localStorage.getItem('tianxuan-slot');
    if (s) CURRENT_SLOT = s;
  } catch {}
  return CURRENT_SLOT;
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); if (j && j.error) detail = `：${j.error}`; } catch {}
    throw new Error(`服务器响应异常：${res.status}${detail}`);
  }
  return res.json();
}

export async function checkSaveExists(slot = CURRENT_SLOT) {
  try { return (await api(`/api/status?slot=${encodeURIComponent(slot)}`)).hasSave; }
  catch { return false; }
}

/** 列出所有存档槽及摘要 */
export async function listSlots() {
  try { return (await api('/api/slots')).slots || []; }
  catch { return []; }
}

/** 删除某存档槽 */
export async function deleteSlot(slot) {
  return (await api(`/api/delete-slot?slot=${encodeURIComponent(slot)}`, { method: 'POST' })).ok === true;
}

/** 列出某槽的历史备份（名称 + 时间戳） */
export async function listBackups(slot) {
  try { return (await api(`/api/backups?slot=${encodeURIComponent(slot)}`)).backups || []; }
  catch { return []; }
}

/** 从指定历史备份还原（服务端会把当前进度先滚动备份，不丢进度） */
export async function restoreBackup(slot, backup) {
  try {
    return (await api(`/api/restore?slot=${encodeURIComponent(slot)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup }),
    })).ok === true;
  } catch { return false; }
}

/** 读取存档并还原为 state；无存档返回 null */
export async function loadGame(slot = CURRENT_SLOT) {
  const data = await api(`/api/load?slot=${encodeURIComponent(slot)}`);
  if (!data.hasSave) return null;
  return deserialize(data.files);
}

/** 保存游戏（全部类别文件整体重写） */
export async function saveGame(state, slot = CURRENT_SLOT) {
  const files = serialize(state);
  const result = await api(`/api/save?slot=${encodeURIComponent(slot)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  return result.ok === true;
}

/** 清空存档（转世重修 / 完全重开） */
export async function resetSave(slot = CURRENT_SLOT) {
  return (await api(`/api/reset?slot=${encodeURIComponent(slot)}`, { method: 'POST' })).ok === true;
}

/** 头像：返回一个带版本戳的 URL，避免浏览器缓存旧头像 */
export function avatarUrl(slot = CURRENT_SLOT, ts = 0) {
  return `/api/avatar?slot=${encodeURIComponent(slot)}&t=${ts || Date.now()}`;
}

/** 上传头像（File 对象），成功返回 { ok, ext } */
export async function uploadAvatar(file, slot = CURRENT_SLOT) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/avatar?slot=${encodeURIComponent(slot)}`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`上传失败：${res.status}`);
  return res.json();
}

/** 删除头像 */
export async function removeAvatar(slot = CURRENT_SLOT) {
  return (await api(`/api/avatar?slot=${encodeURIComponent(slot)}`, { method: 'DELETE' })).ok === true;
}
