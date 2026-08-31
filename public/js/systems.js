/**
 * systems.js —— 玩法逻辑模块
 * ============================================================
 * 包含：角色创建 / 修为境界 / 斗法判定 / 命运骰子 / 天命主线
 *       NPC 道缘 / 天机简报 / 月度回合 / 商店 / 百艺 / 转世
 *
 * 本模块不直接操作 DOM，全部通过 state.js 的 bus 发事件，
 * 由 ui.js 监听渲染 —— 玩法与界面完全解耦。
 *
 * 【扩展点一览】
 *   - 炼丹深化（丹方、药材、火候）→ 见 extensions.js
 *   - 灵兽养成 / 宗门经营 / 洞府种田 → 见 extensions.js
 *   - 新增行动类型：在 generateCompass() 注册选项 + performAction() 注册处理
 *   - 新增天命奖励类型：applyDestinyReward()
 */

import {
  RACES, AGE_GROUPS, SPIRIT_ROOTS, ROOT_ELEMENTS, ROOT_ELEMENTS_YI,
  REGIONS, START_PACKS, DAO_YUNS, REALMS, BOTTLENECKS, DAO_BASES, DAO_BASE_EXP, getDaoBaseMilestoneBonus,
  TECHNIQUE_GRADES, TECHNIQUE_NAMES, ARTIFACT_LEVELS, ARTIFACT_NAMES,
  CAVE_LEVELS, CURRENCIES, ARTS, FATE_DICE, WIN_RATE_FEEDBACK, DIVINATION,
  DESTINY_LINES, NPC_SURNAMES, NPC_GIVEN, NPC_TRAITS, NPC_JOBS, NPC_SKILLS,
  DAOYUAN_LEVELS, FACTIONS, WORLD_EVENTS, BEASTS, RELATION_RULES, DEEP_NPC_EVENTS, COMMISSION_TASKS,
  SAVE_VERSION, GAME_START_YEAR, SAVE_CODE_CHARS, EQUIP_SLOTS, EQUIP_GRADES, rollEquipGrade, getEquipGradeByLevel, makeEquipName, getEquipGrade, MATERIAL_TYPES, PILL_GRADES, rollPillGrade, calcEquipPower, bagGradeOf, BAG_UPGRADE_BASE, BAG_UPGRADE_STEP, CAVE_UPGRADE_BASE, BEAST_WINRATE, BEAST_SKILL_EFFECTS,
  TITLES, TITLE_MAP, MYSTIC_DEPTH, AUCTION_RIVAL,
} from './data.js';
import { GameState, bus, Rng } from './state.js';
import { ensureLifeState, upgradeHerbSpring, HERB_SPRING_MAX, HERB_SPRING_COST_BASE, storeItem, canStore, craftRecipe, canCraft, relationIndex, relationBenefit, REGION_TRAVEL, REGION_MARKET, ART_RECIPES, startTravel, completeTravel, makeChronicle, gearPower, artifactPower, inventoryUsed, normalizeEquip, equipSlotName, bagNameByCapacity, growHerbs, omenMul, omenAdd, omenActive, refinePill, settleRefine, decayPillToxicity, beastLevelRange, beastPowerOfLevel, ALCHEMY_CATALYSTS } from './life.js';
import {
  ensureCodexState, discoverItem, activeSetBonuses, setBonusFlags, realmGuide, CODEX_ITEMS,
  rollPillQuality, applyPillToxicity, pillSideEffect, beastPowerBonus, ensureBeastState,
  canTameBeast, BEAST_TEMPLATES, ensureSectState, SECT_RANKS, SECT_TASKS, SECT_STIPEND, sectCultivateBonus, SECT_EXCHANGE,
  ensureAuctionState, AUCTION_ITEMS_POOL, availableMysticRealms, MYSTIC_REALMS, SPECIAL_EVENTS,
} from './codex.js';

/* ============================================================
 * 一、工具：境界 / 经验 / 战力
 * ========================================================== */
export function realmOf(level) {
  return REALMS.find((r) => level >= r.min && level <= r.max) || REALMS[0];
}
export function expNeed(level) {
  return realmOf(level).perExp;
}
export function realmLevelName(level) {
  const r = realmOf(level);
  return `${r.name}·第${level - r.min + 1}层`;
}
/** 战力 = 修为基础 + 灵根加成 + 装备战力 + 法宝战力 + 丹药临时 + 道韵 + 功法 + 灵兽 + 道基 + 套装 */
/** 套装共鸣战力封顶：防止多套装叠加使战力无上限膨胀，保持战力平衡。 */
const SET_POWER_CAP = 30;

/** 当前生效的临时战力增益（来自战力类丹药 buff）。
 *  state.buffs = { power, expireMonth }，expireMonth 为全局月序号 year*12+month；
 *  超过 expireMonth 即视为过期，返回 0（此前该字段恒为 0，是死字段）。 */
export function activeBuffPower(state) {
  const b = state.buffs;
  if (!b || !b.power) return 0;
  const cur = (state.world.year * 12) + state.world.month;
  return cur < b.expireMonth ? b.power : 0;
}
/** 临时战力增益剩余月数（过期返回 0），供战力拆解与英雄卡显示。 */
export function buffMonthsLeft(state) {
  const b = state.buffs;
  if (!b || !b.power) return 0;
  const cur = (state.world.year * 12) + state.world.month;
  return Math.max(0, b.expireMonth - cur);
}
/** 当前生效的「战前增益」胜率加成（法力丹：state.flags.nextBattleWin，战斗后清零），供英雄卡常驻显示。 */
export function activeNextBattleBuff(state) {
  return Number(state?.flags?.nextBattleWin || 0);
}
export function calcPower(state) {
  ensureLifeState(state);
  const p = state.player;
  const realmPower = p.level * 3;
  // 灵根加成：用 gradeId（id，如 shang）匹配；兼容旧档仅有 grade（名称）的情况，最后回退中品
  const rootRef = p.spiritRoot || {};
  const rootGrade = SPIRIT_ROOTS.find((g) => g.id === rootRef.gradeId)
    || SPIRIT_ROOTS.find((g) => g.name === rootRef.grade)
    || SPIRIT_ROOTS[1];
  const rootBonus = Math.round(p.level * (rootGrade.speed || 1) * 1.5);
  const eqPower = gearPower(state);
  const artifactPowerVal = artifactPower(state);
  const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);
  const techGrade = tech ? TECHNIQUE_GRADES.find((g) => g.name === tech.品级) : null;
  const techPower = tech ? Math.round((techGrade?.power || 1) * tech.等级 * 3) : 0;
  const beastPowerVal = beastPowerBonus(state);
  const setFlags = setBonusFlags(state);
  const setBonus = Math.min(setFlags.power || 0, SET_POWER_CAP);
  const daoYunPower = (p.daoYun?.level || 0) * 3;
  const pillPower = activeBuffPower(state);
  // 道基根基：每级 0.5 战力（向下取整），避免初始道基等级堆出过半总战力。
  const daoBasePower = Math.floor(totalDaoBaseLevel(state) * 0.5);
  const milestone = getDaoBaseMilestoneBonus(totalDaoBaseLevel(state));
  const daoBaseMul = milestone ? (1 + milestone.powerMul) : 1;
  const total = (realmPower + rootBonus + eqPower + artifactPowerVal + setArtifactBonus(state, setFlags) + techPower + beastPowerVal + daoYunPower + pillPower + daoBasePower + setBonus) * daoBaseMul;
  return Math.max(1, Math.round(total));
}

function totalDaoBaseLevel(state) {
  return Object.values(state.player.daoBase || {}).reduce((s, v) => s + (Number(v.level) || 0), 0);
}

/**
 * 套装「法宝战力额外 +N」（星辉共鸣 artifactPower）。
 * 文案写的是「法宝战力额外」，故仅在真正佩戴本命法宝时生效，空法宝栏不白送战力。
 * calcPower 与 powerBreakdown 共用本口径，避免两处漂移。
 */
export function setArtifactBonus(state, flags) {
  const setFlags = flags || setBonusFlags(state);
  const n = Number(setFlags.artifactPower || 0);
  if (!n) return 0;
  return state.equipment?.artifact ? n : 0;
}

/**
 * 战力构成拆解：与 calcPower 同口径，把每一项贡献单独列出，
 * 供「战力」面板展示与平衡核查（确认没有单项数值崩坏）。
 * 返回 { items:[{label,value,hint}], daoBaseMul, milestone, total }
 */
export function powerBreakdown(state) {
  ensureLifeState(state);
  const p = state.player;
  const realmPower = p.level * 3;
  const rootRef = p.spiritRoot || {};
  const rootGrade = SPIRIT_ROOTS.find((g) => g.id === rootRef.gradeId)
    || SPIRIT_ROOTS.find((g) => g.name === rootRef.grade)
    || SPIRIT_ROOTS[1];
  const rootBonus = Math.round(p.level * (rootGrade.speed || 1) * 1.5);
  const eqPower = gearPower(state);
  const artifactPowerVal = artifactPower(state);
  const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);
  const techGrade = tech ? TECHNIQUE_GRADES.find((g) => g.name === tech.品级) : null;
  const techPower = tech ? Math.round((techGrade?.power || 1) * tech.等级 * 3) : 0;
  const beastPowerVal = beastPowerBonus(state);
  const setFlags = setBonusFlags(state);
  const setBonus = Math.min(setFlags.power || 0, SET_POWER_CAP);
  const daoYunPower = (p.daoYun?.level || 0) * 3;
  const pillPower = activeBuffPower(state);
  // 道基根基：每级 0.5 战力（向下取整），避免初始道基等级堆出过半总战力。
  const daoBasePower = Math.floor(totalDaoBaseLevel(state) * 0.5);
  const milestone = getDaoBaseMilestoneBonus(totalDaoBaseLevel(state));
  const daoBaseMul = milestone ? (1 + milestone.powerMul) : 1;
  const items = [
    { label: '境界修为', value: realmPower, hint: `Lv.${p.level}` },
    { label: '灵根资质', value: rootBonus, hint: rootGrade.name },
    { label: '装备战力', value: eqPower, hint: '六部位之和' },
    { label: '法宝核心', value: artifactPowerVal + setArtifactBonus(state, setFlags), hint: setArtifactBonus(state, setFlags) > 0 ? `本命重器（含星辉套装 +${setArtifactBonus(state, setFlags)}）` : '本命重器' },
    { label: '功法加成', value: techPower, hint: tech ? `《${tech.名称}》` : '未主修' },
    { label: '灵兽助阵', value: beastPowerVal, hint: `${state.beasts?.slots?.length || 0} 只` },
    { label: '套装共鸣', value: setBonus, hint: setBonus > 0 ? '已激活' : '无' },
    { label: '先天道韵', value: daoYunPower, hint: p.daoYun?.name || '未觉醒' },
    { label: '丹药增益', value: pillPower, hint: pillPower ? ('临时·余' + buffMonthsLeft(state) + '月') : '无' },
    { label: '道基根基', value: daoBasePower, hint: `总 Lv.${totalDaoBaseLevel(state)}` },
  ];
  const totalRaw = items.reduce((s, it) => s + it.value, 0);
  const total = Math.max(1, Math.round(totalRaw * daoBaseMul));
  return { items, daoBaseMul, milestone: milestone ? milestone.name : null, total };
}

/**
 * 战力构成摘要：取 powerBreakdown 逐项拆解，格式化为单行纯文本，
 * 供英雄卡「战力」数值悬浮展示（信息透明，延续确定性预览主题）。
 * 例如「境界修为 123｜灵根资质 56｜… ‖ 合计 1234（×1.00）」。
 */
export function powerSummary(state) {
  const bd = powerBreakdown(state);
  const lines = bd.items.map((it) => `${it.label} ${it.value}`).join('｜');
  const mul = bd.daoBaseMul !== 1 ? `（×${bd.daoBaseMul.toFixed(2)}）` : '';
  const ms = bd.milestone ? ` · 道基里程碑「${bd.milestone}」` : '';
  return `${lines} ‖ 合计 ${bd.total}${mul}${ms}`;
}

export function refreshDerived(state) {
  ensureLifeState(state);
  state.player.realmName = realmOf(state.player.level).name;
  state.player.power = calcPower(state);
  state.player.lifespan = realmOf(state.player.level).life + (state.player.lifeBonus || 0);
  checkTitles(state); // 幂等：达成即授予封号
  // 临时战力增益到期清理：到期后将 buff 清零，避免 state.buffs 长期残留过期数值
  const _bf = state.buffs;
  if (_bf && _bf.power) {
    const _cur = (state.world.year * 12) + state.world.month;
    if (_cur >= _bf.expireMonth) { _bf.power = 0; _bf.expireMonth = 0; }
  }
}

/**
 * 装备强化（淬炼）预览：纯函数，不改动 state，确定性返回本次淬炼的消耗/成功率与
 * 「成功后」的等级与战力（供 UI 弹窗展示，帮玩家决策）。与 enhanceEquip 共用同一套公式，单一事实来源。
 * target: { where:'equip', slot } 或 { where:'stash', idx }
 * 返回 { ok, level, cost, rate, curPower, nextLevel, nextPower, gain, max? }
 */
export function enhancePreview(state, target) {
  ensureLifeState(state);
  const item = target.where === 'stash' ? state.equipment.stash[target.idx] : state.equipment[target.slot];
  if (!item || !item.名称 || item.名称 === '无') return { ok: false, logs: ['目标装备不存在。'] };
  const level = Number(item.等级) || 1;
  if (level >= 30) return { ok: false, max: true, level, logs: ['该装备已臻化境，无法继续淬炼。'] };
  let cost = 40 * (level + 1);
  // 道友之能·炼器师：法器保养与小修八折（relation>=3 的炼器师道友在旁，省下两成灵石）
  if (daoFriendJob(state, '炼器师')) cost = Math.round(cost * 0.8);
  const rate = Math.max(35, 88 - level * 2);
  const newLevel = level + 1;
  const grade = getEquipGrade(item.品阶) || getEquipGradeByLevel(newLevel);
  const updated = normalizeEquip({ ...item, 等级: newLevel, 品阶: grade?.id || item.品阶 }, item.部位);
  return { ok: true, level, cost, rate, curPower: item.战力, nextLevel: newLevel, nextPower: updated.战力, gain: updated.战力 - (item.战力 || 0) };
}

/**
 * 装备强化（淬炼）：消耗灵石提升装备等级 → 战力按 calcEquipPower 同步增长。
 * 失败仅损耗灵石、装备无损（友好设计，避免数值崩坏与挫败感）。
 * target: { where:'equip', slot } 或 { where:'stash', idx }
 * 返回 { ok, success, logs, cost, rate, newPower? }
 */
export function enhanceEquip(state, target) {
  ensureLifeState(state);
  const item = target.where === 'stash' ? state.equipment.stash[target.idx] : state.equipment[target.slot];
  if (!item || !item.名称 || item.名称 === '无') return { ok: false, logs: ['目标装备不存在。'] };
  const prev = enhancePreview(state, target);
  if (!prev.ok) return { ok: false, logs: prev.logs };
  const { cost, rate, level, nextLevel } = prev;
  if (!spendStones(state, cost)) return { ok: false, logs: [`灵石不足（需 ${cost}）。`] };
  const success = Rng.chance(rate / 100);
  const logs = [`你引动灵力淬炼「${item.名称}」（Lv.${level}），耗灵石 ${cost}。`];
  let newPower = null;
  if (success) {
    const grade = getEquipGrade(item.品阶) || getEquipGradeByLevel(nextLevel);
    const updated = normalizeEquip({ ...item, 等级: nextLevel, 品阶: grade?.id || item.品阶 }, item.部位);
    if (target.where === 'stash') state.equipment.stash[target.idx] = updated;
    else state.equipment[target.slot] = updated;
    newPower = updated.战力;
    logs.push(`✨ 淬炼成功！「${updated.名称}」升至 Lv.${updated.等级}，战力 ${item.战力} → ${updated.战力}。`);
  } else {
    logs.push('淬炼未成，灵力散去，装备未有寸进（材料已耗，装备无损）。');
  }
  refreshDerived(state);
  return { ok: true, success, logs, cost, rate, newPower };
}

/* ============================================================
 * 二·补、封号 / 称号系统
 * 玩家可收集多枚封号（TITLES），择一「佩戴」于仙途名号处。
 * 来源：destiny（天命终局）/ achievement（里程碑）/ event（隐藏奇遇）。
 * ========================================================== */
/** 确保玩家拥有 titles 数组与 activeTitle 字段（旧档/新档均可安全调用） */
export function ensureTitleState(state) {
  if (!state.player.titles) state.player.titles = [];
  if (state.player.activeTitle === undefined) state.player.activeTitle = '';
}

/** 授予封号（若未拥有）。返回是否「本次新获得」 */
export function awardTitle(state, id, logs) {
  ensureTitleState(state);
  if (!TITLE_MAP[id] || state.player.titles.includes(id)) return false;
  state.player.titles.push(id);
  if (!state.player.activeTitle) state.player.activeTitle = id; // 默认佩戴第一枚
  if (logs) logs.push(`🏅 获得封号「${TITLE_MAP[id].name}」！`);
  return true;
}

/** 切换佩戴的封号（必须是已拥有的） */
export function setActiveTitle(state, id) {
  ensureTitleState(state);
  if (id && !state.player.titles.includes(id)) return { ok: false, logs: ['你尚未获得该封号。'] };
  state.player.activeTitle = id || '';
  const name = id ? TITLE_MAP[id]?.name || id : '（无）';
  return { ok: true, logs: [`你佩戴了封号「${name}」。`] };
}

/** 成就/奇遇类封号的运行时判定（避免在静态数据里写逻辑） */
const TITLE_CHECKS = {
  chuji_fengmang: (s) => (s.player.power || 0) >= 1000,
  weizhen_yifang: (s) => (s.player.power || 0) >= 5000,
  tianxuan_jieke: (s) => (s.codex?.discovered?.length || 0) >= Math.ceil(CODEX_ITEMS.length * 0.5),
  wanwu_bochang: (s) => (s.codex?.discovered?.length || 0) >= CODEX_ITEMS.length,
  lingkuang_xingzhe: (s) => totalStones(s) >= 100000,
  daoji_yicheng: (s) => totalDaoBaseLevel(s) >= 200,
  xianyuan_qiren: (s) => (s.beasts?.slots || []).some((b) => b.id === 'phoenix'),
  guji_tanxun: (s) => (s.flags?.mysticDeepest || 0) >= MYSTIC_DEPTH.max,
};

/** 扫描并授予已达成的 achievement/event 类封号，返回本次新获得列表 */
export function checkTitles(state) {
  ensureTitleState(state);
  const newly = [];
  for (const t of TITLES) {
    if (t.source === 'destiny' || state.player.titles.includes(t.id)) continue;
    let ok = false;
    try { ok = TITLE_CHECKS[t.id] ? !!TITLE_CHECKS[t.id](state) : false; } catch { ok = false; }
    if (ok) { state.player.titles.push(t.id); if (!state.player.activeTitle) state.player.activeTitle = t.id; newly.push(t); }
  }
  return newly;
}

/** 佩称号视图（纯函数，不改动状态）：返回当前佩戴封号的展示信息，供英雄卡常驻行使用。 */
export function activeTitleView(state) {
  const id = state?.player?.activeTitle;
  if (!id) return { has: false, name: '', desc: '' };
  const t = TITLE_MAP[id] || TITLES.find((x) => x.id === id);
  if (!t) return { has: false, name: '', desc: '' };
  return { has: true, name: t.name, desc: t.desc };
}

/* ============================================================
 * 日志系统（操作/战斗/事件/天命/系统，持久化到 日志.ini）
 * ========================================================== */
export const LOG_TYPES = ['操作', '战斗', '事件', '天命', '系统', '异常', '警告'];
const LOG_CAP = 500; // 最多保留条数，超出裁剪最旧

/** 追加一条游戏日志。type 见 LOG_TYPES。
 *  健壮性：state 或 world 未就绪时也不抛错（异常路径上调用也能安全写入）。 */
export function addLog(state, type, text) {
  if (!state) return;
  if (!state.logs) state.logs = [];
  const w = state.world;
  const time = (w && w.year != null) ? `${w.year}年${(w.month ?? 0)}月` : '—';
  state.logs.push({ time, type, text });
  if (state.logs.length > LOG_CAP) state.logs.splice(0, state.logs.length - LOG_CAP);
}

/* ============================================================
 * 二、货币
 * ========================================================== */
/** 统一折算为「下品灵石」的最小单位处理 */
export function totalStones(state) {
  return CURRENCIES.reduce((sum, c, i) => sum + (state.currencies[c] || 0) * Math.pow(100, i), 0);
}
/** 按「总量（下品单位）± 变动」后重新分档：保证账面永远正确 */
function redistribute(state, totalUnits) {
  let rest = Math.max(0, Math.round(totalUnits));
  for (let i = CURRENCIES.length - 1; i >= 0; i--) {
    const unit = Math.pow(100, i);
    const c = Math.floor(rest / unit);
    state.currencies[CURRENCIES[i]] = c;
    rest -= c * unit;
  }
}
export function addStones(state, amount) {
  redistribute(state, totalStones(state) + Math.max(0, Math.round(amount)));
}
export function canAfford(state, amount) {
  return totalStones(state) >= amount;
}
export function spendStones(state, amount) {
  if (!canAfford(state, amount)) return false;
  redistribute(state, totalStones(state) - Math.round(amount));
  return true;
}
export function formatStones(state) {
  return CURRENCIES.map((c) => `${c.replace('灵石', '')}${state.currencies[c] || 0}`).join('｜');
}

/* ============================================================
 * 三、角色创建
 * ========================================================== */
/** 掷灵根（创建时随机） */
export function rollSpiritRoot() {
  const grade = Rng.weighted(SPIRIT_ROOTS);
  let elements;
  if (grade.id === 'yi') {
    elements = [Rng.pick(ROOT_ELEMENTS_YI)];
  } else if (grade.id === 'ji') {
    elements = [Rng.pick(ROOT_ELEMENTS)];
  } else if (grade.id === 'fei') {
    elements = [...ROOT_ELEMENTS];
  } else {
    const count = grade.id === 'fan' ? Rng.int(1, 2) : grade.id === 'zhong' ? Rng.int(2, 3) : Rng.int(1, 2);
    const pool = [...ROOT_ELEMENTS];
    elements = [];
    while (elements.length < count && pool.length) {
      elements.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
  }
  return { grade: grade.name, gradeId: grade.id, elements, speed: grade.speed, desc: grade.desc };
}

/** 生成一位 NPC（不重复命名）。met=false 表示尚未结识，留作后续游历/道缘中逐步解锁。 */
function makeNpc(used, region, met = false, favor = null) {
  let name;
  do { name = Rng.pick(NPC_SURNAMES) + Rng.pick(NPC_GIVEN); } while (used.has(name));
  used.add(name);
  const level = Rng.weighted([
    { v: Rng.int(1, 10), weight: 40 }, { v: Rng.int(11, 20), weight: 30 },
    { v: Rng.int(21, 40), weight: 18 }, { v: Rng.int(41, 60), weight: 8 },
    { v: Rng.int(61, 80), weight: 4 },
  ]).v;
  const job = Rng.pick(NPC_JOBS);
  return {
    name, gender: Rng.pick(['男', '女']), race: Rng.pick(RACES).name,
    realm: realmLevelName(level), level, power: level + Rng.int(0, 20),
    trait: `${Rng.pick(NPC_TRAITS)}·${Rng.pick(NPC_TRAITS)}`,
    job, favor: favor == null ? Rng.int(5, 40) : favor, relation: 0, relationName: DAOYUAN_LEVELS[0],
    skill: '', lastMeet: 0, region, met,
  };
}

/**
 * 道缘（NPC）改为「开局少数故交 + 后续逐步结识」：
 *  - 开局仅生成 2~3 位已结识的故交（恩师/旧识，好感较高），met=true；
 *  - 其余数位（共约 10~14 位）先置于「未结识」状态（met=false），随游历/道缘/因缘事件逐位解锁。
 */
export function generateNpcs(region, initialCount = Rng.int(2, 3), total = Rng.int(11, 15)) {
  const used = new Set();
  const npcs = [];
  // 开局故交：好感偏高，视为已有渊源
  for (let i = 0; i < initialCount; i++) {
    npcs.push(makeNpc(used, region, true, Rng.int(25, 60)));
  }
  // 尚未结识的潜在道缘池
  while (npcs.length < total) npcs.push(makeNpc(used, region, false));
  return npcs;
}

/** 随机结识一位尚未结识的潜在道缘（仅 met===false 者）；返回被结识的 NPC，若无则返回 null */
export function revealNpc(state) {
  const pending = state.npcs.filter((n) => n.met === false);
  if (!pending.length) return null;
  const n = Rng.pick(pending);
  n.met = true;
  n.favor = Math.max(5, n.favor); // 初识好感保留一定底子
  return n;
}

/** 已结识的道缘（供罗盘/界面筛选）。met 字段缺失时（旧档兼容）视为已结识。 */
export function knownNpcs(state) {
  return state.npcs.filter((n) => n.met !== false);
}
/** 道缘是否已结识（缺省视为已结识，兼容旧档） */
export function isMet(npc) {
  return npc.met !== false;
}

/** 是否拥有某职业的「道友」（relation>=3）级道缘；返回该 NPC 或 null。
 *  供「道友之能」按职业触发专属效果（炼器师八折 / 剑修体修助拳 / 散修引荐）。 */
export function daoFriendJob(state, job) {
  return knownNpcs(state).find((n) => (n.relation || 0) >= 3 && n.job === job) || null;
}

/** 创建新游戏 */
export function createNewGame(opts) {
  const race = RACES.find((r) => r.id === opts.raceId);
  const ageGroup = AGE_GROUPS.find((a) => a.id === opts.ageId);
  const region = REGIONS.find((r) => r.id === opts.regionId);
  const pack = START_PACKS.find((p) => p.id === opts.packId);
  const yun = opts.yunId ? DAO_YUNS.find((d) => d.id === opts.yunId) : null;
  const root = opts.spiritRoot; // rollSpiritRoot() 的结果

  const daoBase = {};
  for (const b of DAO_BASES) {
    // 2026-08-19 平衡：初始道基从 3~10 收敛到 1~3，避免开局道基等级碾压境界修为。
    let lv = Rng.int(1, 3);
    if (race.bonus[b.name]) lv += race.bonus[b.name];
    if (region.bonus[b.name]) lv += region.bonus[b.name];
    if (ageGroup.mods[b.name]) lv += ageGroup.mods[b.name];
    daoBase[b.name] = { level: Math.max(1, lv), exp: 0 };
  }

  const level = (pack.level || 1) + (ageGroup.mods.初始修为 || 0);
  const startTechName = pack.id === 10 ? '基础功法残卷' : Rng.pick(TECHNIQUE_NAMES.fan);

  const state = {
    meta: { version: SAVE_VERSION, saveCode: Rng.saveCode(SAVE_CODE_CHARS) },
    player: {
      name: opts.name, gender: opts.gender, race: race.name,
      age: Rng.int(ageGroup.age[0], ageGroup.age[1]),
      region: region.name, regionId: region.id,
      packName: pack.name, title: '',
      daoTitle: '',       // 自定义道号（30字内）
      signature: '',      // 个性签名（30字内）
      spiritRoot: root,
      // 道韵（先天道韵）不在创建时选定，起步为「未觉醒」，于修行机缘中逐步觉醒
      daoYun: yun ? { id: yun.id, name: yun.name, level: 1, exp: 0 } : { id: 'none', name: '未觉醒', level: 1, exp: 0 },
      level, exp: 0, daoBase,
      lifespan: 100, power: 1, realmName: '凡人境', lifeBonus: ageGroup.mods.寿元修正 || 0,
      lifespanPillsTaken: 0, // 延寿丹：当前轮回一生至多服用 3 颗，超出则经脉难承（转世后随 newGame 归零）
      marrowPillsTaken: 0,   // 洗髓丹：当前轮回一生至多服用 2 颗（图鉴承诺），同样随转世归零
    },
    currencies: { 下品灵石: pack.stones, 中品灵石: 0, 上品灵石: 0, 极品灵石: 0, 灵晶: 0 },
    techniques: [{ 名称: startTechName, 品级: '凡品', 等级: 1, 经验: 0 }],
    mainTechnique: startTechName,
    arts: Object.fromEntries(ARTS.map((a) => [a, { level: 0, exp: 0 }])),
    items: pack.items.map((n) => ({ 名称: n, 类型: String(n).includes('储物袋') ? '容器' : '杂物', 数量: 1, 描述: String(n).includes('储物袋') ? '决定行囊容量，可在坊市或百艺中扩容。' : '开局资产' })),
    cave: { level: 0, name: CAVE_LEVELS[0].name, bonus: 0 },
    // 道缘：开局仅 2~3 位故交已结识，其余随修行机缘逐步解锁（#65）
    npcs: generateNpcs(region.name),
    destiny: {
      lineId: pack.destiny, lineName: DESTINY_LINES[pack.destiny].name,
      stage: 0, stageName: DESTINY_LINES[pack.destiny].stages[0].name,
      status: '待抉择', waitYears: 0, done: [], title: '',
    },
    world: {
      year: GAME_START_YEAR, month: 1, turns: 0, region: region.name, regionId: region.id, news: [],
      travel: { destination: '', remaining: 0 }, market: { stock: [], refreshTurn: -1 },
    },
    inventory: { capacity: 100, used: 0, bagName: '乾坤储物袋', upgrades: 0 },
    equipment: (() => {
      const eq = {};
      for (const s of EQUIP_SLOTS) eq[s.id] = null;
      eq.stash = [];
      if (pack.id === 1 || pack.id === 5) eq.weapon = normalizeEquip({ 名称: pack.id === 1 ? '凡器长剑' : '凡器短剑', 等级: 1, 类型: '装备', 描述: '开局普通武器。' }, 'weapon');
      else eq.armor = normalizeEquip({ 名称: '布衣', 等级: 0, 类型: '装备', 描述: '开局普通衣物。' }, 'armor');
      return eq;
    })(),
    flags: { focusMonths: 0, lastFocus: '', noGuideMonths: 0, wounded: 0, companion: '', companionMonths: 0 },
    buffs: { power: 0, expireMonth: 0 },
    chronicle: [],
    settings: { avatarPreset: 'sword' },
    logs: [],
  };
  // 开局资产中的储物袋不再只是文字：初始格子数统一 100 格（名称沿用容量分级命名）。
  for (const item of state.items) {
    if (String(item.名称).includes('储物袋')) {
      state.inventory.capacity = 100;
      state.inventory.bagName = bagNameByCapacity(100, '乾坤储物袋');
    }
  }
  // 修复：主修功法同时写入 player.mainTechnique（与全部读取点/UI「设为主修」一致），
  // 否则新游戏开局主修功法不会被功法加成与研读逻辑识别。
  state.player.mainTechnique = startTechName;
  ensureLifeState(state);
  refreshDerived(state);
  return state;
}

/* ============================================================
 * 四、修炼与突破
 * ========================================================== */
/** 修炼获得修为经验。返回 {gain, logs} */
export function cultivate(state, mode = 'normal') {
  const p = state.player;
  const tech = state.techniques.find((t) => t.名称 === p.mainTechnique);
  const grade = TECHNIQUE_GRADES.find((g) => g.name === (tech?.品级 || '凡品'));
  const base = mode === 'seclusion' ? Rng.int(30, 55) : Rng.int(15, 30);
  // 宗门修炼加成
  const sectBonus = sectCultivateBonus(state);
  // 丹毒影响修炼效率
  const toxic = Number(state.flags?.pillToxicity || 0);
  const toxicMul = toxic >= 85 ? 0.55 : toxic >= 60 ? 0.75 : toxic >= 35 ? 0.9 : 1;
  // 聚灵丹药力：未来若干月修炼效率提升（由 useItem 写入 flags.cultivateBoostMonths）
  const boostMul = (state.flags?.cultivateBoostMonths || 0) > 0 ? 1.15 : 1;
  const gain = Math.round(base * p.spiritRoot.speed * (1 + (state.cave.bonus || 0) + sectBonus) * grade.expMul * (1 + p.daoBase['根骨'].level / 200) * toxicMul * boostMul * omenMul(state, 'cultivate'));
  p.exp += gain;
  // 闭关连续次数（走火入魔触发条件）
  if (mode === 'seclusion') state.flags.seclusionStreak = (state.flags.seclusionStreak || 0) + 1;
  else state.flags.seclusionStreak = 0;

  const logs = [`你静心吐纳，修为+${gain}。`];
  // 功法经验
  if (tech && tech.等级 < grade.maxLv) {
    tech.经验 += gain;
    const need = tech.等级 * 20;
    if (tech.经验 >= need) {
      tech.经验 -= need; tech.等级 += 1;
      logs.push(`《${tech.名称}》突破至第${tech.等级}层！`);
    }
  }
  // 道基经验（修炼长根骨、道心）
  addDaoBaseExp(state, '根骨', Math.round(gain / 6), logs);
  if (mode === 'seclusion') addDaoBaseExp(state, '道心', Rng.int(5, 12), logs);
  // 道韵成长
  if (p.daoYun.id === 'panshi' && mode === 'seclusion') addDaoYunExp(state, Rng.int(8, 15), logs);
  if (p.daoYun.id === 'tianren') addDaoYunExp(state, Rng.int(3, 8), logs);

  const ups = tryLevelUp(state, logs);
  refreshDerived(state);
  return { gain, logs, levelUps: ups };
}

/** 修炼收益确定性预览（与 cultivate 同口径；基础取 Rng 区间中点，无 RNG 波动） */
export function cultivateGainPreview(state, mode = 'normal') {
  const p = state.player;
  const tech = state.techniques.find((t) => t.名称 === p.mainTechnique);
  const grade = TECHNIQUE_GRADES.find((g) => g.name === (tech?.品级 || '凡品'));
  const base = mode === 'seclusion' ? 42 : 22; // Rng.int(30,55)/Rng.int(15,30) 期望中点
  const sectBonus = sectCultivateBonus(state);
  const toxic = Number(state.flags?.pillToxicity || 0);
  const toxicMul = toxic >= 85 ? 0.55 : toxic >= 60 ? 0.75 : toxic >= 35 ? 0.9 : 1;
  const boostMul = (state.flags?.cultivateBoostMonths || 0) > 0 ? 1.15 : 1;
  const rootMul = p.spiritRoot.speed;
  const caveMul = 1 + (state.cave.bonus || 0) + sectBonus;
  const gradeMul = grade.expMul;
  const boneMul = 1 + p.daoBase['根骨'].level / 200;
  const omen = omenMul(state, 'cultivate');
  const gain = Math.round(base * rootMul * caveMul * gradeMul * boneMul * toxicMul * boostMul * omen);
  // 闭关走火入魔提示：真实机制为「连续闭关>=3月触发 qihuo 事件」（需 Lv.30+）；
  // 让累积风险对玩家可感知，且低等级不再虚报风险。
  let note;
  if (mode !== 'seclusion') note = '稳定·无风险';
  else if (p.level < 30) note = '闭关·稳定（Lv.30 后久闭有走火入魔风险）';
  else {
    const streak = state.flags?.seclusionStreak || 0;
    note = streak >= 2
      ? `闭关·连关${streak}月，再闭关将走火入魔（满3月必触发）`
      : '闭关·走火入魔风险（连续闭关积累）';
  }
  return {
    mode, base, rootMul, caveMul, sectBonus, gradeMul, boneMul, toxicMul, boostMul, omen, gain,
    note,
  };
}

/**
 * 研读功法（study）行动确定性收益预览（不改动 state）。
 * 主修功法经验固定 +40、临界则可能突破；悟性按真实区间 8~15 展示（不造假、无 RNG）。
 */
export function studyGainPreview(state) {
  const tech = state.techniques.find((t) => t.名称 === (state.player.mainTechnique || state.mainTechnique));
  if (!tech) return '尚未主修功法，研读仅得悟性';
  const g = TECHNIQUE_GRADES.find((x) => x.name === (tech.品级 || '凡品'));
  const maxLv = g ? g.maxLv : 99;
  if (tech.等级 >= maxLv) return `《${tech.名称}》已至${tech.品级}瓶颈，研读难有寸进（仅得悟性）`;
  const need = tech.等级 * 20;
  const after = tech.经验 + 40;
  const breakHint = after >= need ? `研读后将突破至第${tech.等级 + 1}层` : `距突破还差${need - after}经验`;
  return `研读《${tech.名称}》·功法经验+40（需${need}）｜${breakHint}｜悟性+（8~15）`;
}

/** 寿元危机预警（纯函数，不修改状态；供状态卡展示）。
 *  level: 'danger' 命悬一线（余寿≤8年）、'warn' 寿元将尽（≤20年）、'ok' 安康。
 *  hint 指向已实现的延寿途径：延寿丹(+20年)/冲击更高境界增寿/寿元耗尽转世。 */
export function lifespanWarning(state) {
  const p = state.player;
  const lifeLeft = Math.max(0, (p.lifespan || 0) - (p.age || 0));
  let level = 'ok', hint = '';
  if (lifeLeft <= 8) {
    level = 'danger';
    hint = '寿元将尽！可服「延寿丹」(+20年)、冲击更高境界增寿，或寿元耗尽后转世续道。';
  } else if (lifeLeft <= 20) {
    level = 'warn';
    hint = '寿元渐少，留意「延寿丹」（坊市/拍卖/宗门兑换所可得）以备不时之需。';
  }
  const cure = level !== 'ok' ? '延寿丹' : '';
  return { level, lifeLeft, hint, cure };
}

/** 丹毒危机预警（纯函数，不修改状态；供状态卡展示）。
 *  level: 'danger' 剧毒攻心(≥85)、'warn' 丹毒累积(≥60)、'ok' 清净。
 *  hint 提醒减服毒性丹药，必要时服「解毒丹」化解丹毒。 */
export function toxicityWarning(state) {
  const toxic = Number(state.flags?.pillToxicity || 0);
  let level = 'ok', hint = '', cure = '';
  if (toxic >= 85) {
    level = 'danger';
    hint = '丹毒攻心！再服毒丹将重创修为，可服「解毒丹」化解丹毒或暂停服丹。';
    cure = '解毒丹';
  } else if (toxic >= 60) {
    level = 'warn';
    hint = '丹毒累积偏多，服丹收益下降、风险升高，宜暂缓毒性丹药或服「解毒丹」化解。';
    cure = '解毒丹';
  }
  return { level, toxic, hint, cure };
}

/** 道基加经验（含升级） */
/** 闭关走火入魔风险预警（纯函数，不修改状态；供英雄卡常驻展示）。
 *  真实机制：Lv.30+ 连续闭关（state.flags.seclusionStreak）满 3 月必触发走火入魔（qihuo，渡劫大幅衰减、修为倒退）。
 *  此前该风险仅在「修炼」弹窗内可见、切走即丢失；现做常驻预警，让玩家随时知晓连关积累。
 *  level: 'danger' 连关≥2（再闭关即触发）、'warn' 连关≥1（风险积累）、'ok' 安全。 */
/** 伤势危机预警（纯函数，不修改状态；供危机横幅展示）。
 *  level: 'danger' 身负重伤(伤势≥3月，历练胜率-9%起、收益大降)、'warn' 带伤(≥1月)、'ok' 无伤。
 *  hint 指向「凝血丹」(清除全部伤势) 这一已实现途径，与危机横幅「服用」按钮闭环（寿元→延寿丹、丹毒→解毒丹同口径）。 */
export function woundWarning(state) {
  const wounds = Number(state.flags?.wounded || 0);
  let level = 'ok', hint = '', cure = '';
  if (wounds >= 3) {
    level = 'danger';
    hint = `身负重伤（伤势 ${wounds} 月）！历练胜率与收益大降，宜速服「凝血丹」痊愈。`;
    cure = '凝血丹';
  } else if (wounds >= 1) {
    level = 'warn';
    hint = `身负伤势（${wounds} 月），历练胜率略降，可服「凝血丹」立即痊愈或静养自愈。`;
    cure = '凝血丹';
  }
  return { level, wounds, hint, cure };
}

export function seclusionRiskWarning(state) {
  const p = state.player;
  const streak = Number(state.flags?.seclusionStreak || 0);
  if (p.level < 30 || streak < 1) return { level: 'ok', streak: 0, text: '' };
  if (streak >= 2) return { level: 'danger', streak, text: `连续闭关 ${streak} 月` };
  return { level: 'warn', streak, text: `连续闭关 ${streak} 月` };
}



/**
 * 储物袋容量使用情况（纯函数，不修改 state）。
 * 与危机预警（寿元/丹毒）同口径：ratio>=0.9 危险（满仓临界、再拾取物品将被静默丢弃）、
 * >=0.7 警告（容量偏紧）、否则 ok。
 * 此前储物袋满仓时 storeItem 会静默丢物（canStore 返回 false、return false），玩家仅在行囊面板可见容量、
 * 切走即不可知，易在满仓时「丢物品而不自知」；现供顶栏 chip 常驻展示，延续
 * 「跨标签页不可见状态常驻化」+「危机预警」主题。
 */
export function bagUsage(state) {
  const inv = state.inventory || {};
  const used = Number(inv.used || 0);
  const capacity = Number(inv.capacity || 100);
  const ringBonus = Number(inv.ringBonus || 0);
  const total = capacity + ringBonus;
  const ratio = total > 0 ? used / total : 0;
  const level = ratio >= 0.9 ? 'danger' : ratio >= 0.7 ? 'warn' : 'ok';
  return { used, capacity, ringBonus, total, ratio, level };
}

/**
 * 丹炉炼制进度（纯函数，不修改 state）。
 * 基于 state.cave.alchemy（「炼制中」队列）计算并行炉数、并行上限、最近一炉的剩余月数与危机等级。
 * 危机预警口径：本月末即出炉（minLeft<=0）→ danger（吸引注意，即将成丹）；1 月内出炉 → warn；否则 ok。
 * 此前丹炉炼制进度仅在「洞府·丹炉」面板可见，切走即不可知、易错过出炉时机；
 * 现供顶栏 chip 与英雄卡行常驻展示，延续「跨标签页不可见状态常驻化」+「危机预警」主题。
 * 无 RNG：剩余月数由 dueYear/dueMonth 与当前 world 年月确定性推算。
 */
export function alchemyStatus(state) {
  const w = state.world || { year: 1, month: 1 };
  const queue = (state.cave && Array.isArray(state.cave.alchemy)) ? state.cave.alchemy : [];
  const count = queue.length;
  const slots = Math.min(3, 1 + Math.floor((state.cave?.level || 0) / 2));
  if (count === 0) {
    return { count: 0, slots, minLeft: null, ready: false, level: 'ok', text: '' };
  }
  let minLeft = Infinity;
  for (const p of queue) {
    const left = (Number(p.dueYear || w.year) - w.year) * 12 + (Number(p.dueMonth || w.month) - w.month);
    if (left < minLeft) minLeft = left;
  }
  const ready = minLeft <= 0;            // 本月末结算即出炉（或已到期待结算）
  const level = ready ? 'danger' : (minLeft <= 1 ? 'warn' : 'ok');
  let text;
  if (ready) text = '本月末出炉';
  else if (minLeft === 1) text = '1 月后出炉';
  else text = `${minLeft} 月后出炉`;
  return { count, slots, minLeft, ready, level, text };
}

/** 炼丹催化材料持有状态：供丹炉面板在开炉前透明展示「持有数量 / 开炉自动消耗 / 提升成丹率」。
 *  此前玩家只在成丹率里看到「＋催化X」，无从得知自己持有多少、开炉会被自动消耗，
 *  现把催化材料可见化，落实「信息透明·确定性预览」主题（确定性、无 RNG）。 */
export function catalystStatus(state) {
  return Object.entries(ALCHEMY_CATALYSTS).map(([name, cfg]) => {
    const have = state.items.find((x) => x.名称 === name)?.数量 || 0;
    return { name, have, bonus: cfg.bonus, label: cfg.label, held: have >= 1 };
  });
}

/** 宗门贡献度状态：供英雄卡常驻行与顶栏 chip 展示（延续「跨标签页不可见状态常驻化」主题）。
 *  宗门贡献是真实进度资源（宗门秘境/宗门任务累积，宗门兑换所消费），此前仅在「宗门」面板可见，
 *  切走即不可知；现做可被英雄卡/顶栏常驻读取的纯函数（不改动状态、确定性、无 RNG）。
 *  @returns {{has:boolean, name:string, rank:number, rankName:string, contribution:number}} */
export function sectContribution(state) {
  const sect = state.sect;
  if (!sect || !sect.name) return { has: false, name: '', rank: 0, rankName: '', contribution: 0 };
  const rankName = (SECT_RANKS[sect.rank] && SECT_RANKS[sect.rank].name) || '';
  return { has: true, name: sect.name, rank: sect.rank || 0, rankName, contribution: sect.contribution || 0 };
}

/**
 * 本月行动状态（纯函数，不修改 state）。
 * 游戏采用「每月仅能推进有限行动」的闸门：state.flags.actedThisMonth 是按行动分类记载的布尔对象，
 * 罗盘内已有横幅，但切到其它标签页即不可见。此处提供统一查询，供顶栏常驻 chip 使用，
 * 延续「跨标签页不可见状态常驻化」主题（储物袋/丹炉/灵草/旅行/宗门贡献/危机预警…
 * 之后，补上「本月是否已行动」这一最后盲区）。
 * @returns {{acted:string[], count:number, done:boolean}}
 */
export function monthActionStatus(state) {
  const acted = (state && state.flags && state.flags.actedThisMonth) || {};
  const keys = Object.keys(acted).filter((k) => acted[k]);
  return { acted: keys, count: keys.length, done: keys.length > 0 };
}

export function addDaoBaseExp(state, name, amount, logs) {
  if (name === '悟性') amount = Math.round(amount * omenMul(state, 'insight'));
  const db = state.player.daoBase[name];
  if (!db || amount <= 0) return;
  db.exp += amount;
  const band = DAO_BASE_EXP.find((b) => db.level >= b.min && db.level <= b.max) || DAO_BASE_EXP[0];
  while (db.exp >= band.per && db.level < 100) {
    db.exp -= band.per; db.level += 1;
    logs?.push(`道基「${name}」提升至 ${db.level} 级！`);
  }
}
/** 道韵加经验（每级需 等级×100） */
export function addDaoYunExp(state, amount, logs) {
  amount = Math.round(amount * omenMul(state, 'insight'));
  const y = state.player.daoYun;
  y.exp += amount;
  const need = y.level * 100;
  if (y.exp >= need && y.level < 10) {
    y.exp -= need; y.level += 1;
    logs?.push(`先天道韵「${y.name}」升至 Lv.${y.level}！`);
  }
}

/** 修行机缘中是否触发道韵觉醒；未觉醒且概率命中时返回可选道韵列表，否则 null */
export function tryAwakenYun(state) {
  if (state.player.daoYun?.id !== 'none') return null;
  if (!Rng.chance(0.3)) return null;
  return DAO_YUNS;
}
/** 觉醒指定道韵（返回该道韵对象，失败返回 null） */
export function awakenYun(state, id) {
  const y = DAO_YUNS.find((d) => d.id === id);
  if (!y) return null;
  state.player.daoYun = { id: y.id, name: y.name, level: 1, exp: 0 };
  return y;
}

/** 连续升级判定（非瓶颈直接升，瓶颈处停下等待渡劫） */
function tryLevelUp(state, logs) {
  const p = state.player;
  let ups = 0;
  while (p.exp >= expNeed(p.level) && !BOTTLENECKS[p.level] && p.level < 100) {
    p.exp -= expNeed(p.level);
    p.level += 1; ups += 1;
  }
  if (p.level >= 100) { p.level = 100; p.exp = 0; }
  if (ups > 0) logs.push(`修为精进，连升 ${ups} 层！当前 ${realmLevelName(p.level)}。`);
  return ups;
}

/** 是否到达瓶颈且修为满溢 */
export function checkBottleneck(state) {
  const p = state.player;
  const bn = BOTTLENECKS[p.level];
  if (!bn) return null;
  if (p.exp < expNeed(p.level)) return null;
  return bn;
}

/**
 * 仙途目标：距下一大境界（渡劫瓶颈）还需多少修为、约多少月。
 * 纯函数、不改动 state；弥补「英雄卡仅显示当前层进度、跨层即清零」的信息盲区，
 * 给玩家一个长期可感知的成长目标。无 RNG，确定性可测。
 */
export function realmProgress(state) {
  const p = state.player;
  const lvl = p.level;
  const r = realmOf(lvl);
  const curNeed = expNeed(lvl);
  const expRatio = Math.max(0, Math.min(1, p.exp / curNeed));
  const atBottleneck = !!BOTTLENECKS[lvl];
  // 下一个渡劫瓶颈等级（按升序取首个 ≥ 当前等级的瓶颈）
  const bnLevels = Object.keys(BOTTLENECKS).map(Number).sort((a, b) => a - b);
  const nextBn = bnLevels.find((L) => L >= lvl);
  if (nextBn == null) {
    // 已臻大乘/飞升，再无更高瓶颈
    return { level: lvl, realmName: r.name, atBottleneck: false, expRatio, expCur: p.exp, expNeed: curNeed, nextRealm: null, expToBottleneck: 0, monthsEstimate: 0, pillName: null, pillHave: 0 };
  }
  const bn = BOTTLENECKS[nextBn];
  const nextRealm = realmOf(bn.to).name;
  const pillName = bn.item || null;
  const pillHave = pillName ? state.items.filter((i) => i.名称 === pillName).reduce((s, i) => s + (i.数量 || 0), 0) : 0;
  // 已站在瓶颈层：无需再攒修为，持对应渡劫丹即可冲击（expToBottleneck 计 0）
  if (atBottleneck) {
    return { level: lvl, realmName: r.name, atBottleneck: true, expRatio, expCur: p.exp, expNeed: curNeed, nextRealm, nextBn, expToBottleneck: 0, monthsEstimate: 0, pillName, pillHave };
  }
  // 累计从当前层到瓶颈层（不含瓶颈层）所需修为总量
  let need = Math.max(0, curNeed - p.exp); // 先填满当前层
  for (let L = lvl + 1; L < nextBn; L++) need += expNeed(L);
  const gain = cultivateGainPreview(state, 'normal').gain;
  const monthsEstimate = gain > 0 ? Math.ceil(need / gain) : 0;
  return { level: lvl, realmName: r.name, atBottleneck: false, expRatio, expCur: p.exp, expNeed: curNeed, nextRealm, nextBn, expToBottleneck: need, monthsEstimate, pillName, pillHave };
}

/** 渡劫突破。返回分波次结果供 UI 播放动画 */
/**
 * 渡劫战力参考系数：战力达到境界基准则小幅加成（封顶 +10%），明显落后则小幅减成（封底 -8%）。
 * 让「堆战力」（装备 / 灵兽 / 套装 / 道韵）对突破有意义，同时不喧宾夺主。
 * 与 attemptBreakthrough 共用，保证预览与结算同口径。
 */
function powerBreakthroughAdj(state) {
  const p = state.player;
  // 2026-08-19 平衡：随战力公式同步收敛基准（约每 10 级需多 30 战力）。
  const basePower = p.level * 3 + 20;
  const diff = calcPower(state) - basePower;
  return diff >= 0 ? Math.min(10, Math.floor(diff / 30)) : Math.max(-8, Math.ceil(diff / 30));
}

/**
 * 渡劫成功率预览（与 attemptBreakthrough 同口径，但不消耗道具/状态）。
 * 供 UI 在突破前展示成功率进度条，让玩家清楚风险。
 */
export function breakthroughRate(state) {
  const p = state.player;
  const bn = BOTTLENECKS[p.level];
  if (!bn) return null;
  let rate = bn.baseRate + p.daoBase['道心'].level / 4 + p.daoBase['气运'].level / 5;
  if (bn.item && state.items.some((i) => i.名称 === bn.item)) rate += 20;
  for (const i of state.items) {
    if (i.effect && typeof i.effect.tribulation === 'number') {
      const gradeMul = PILL_GRADES.find((g) => g.id === i.品阶)?.tribMul || 1;
      rate += Math.round(i.effect.tribulation * gradeMul);
    }
  }
  if (p.spiritRoot.gradeId === 'fei') rate += 15;
  if (p.daoYun.id === 'tianren') rate += 8;
  rate += Number(setBonusFlags(state).breakthrough || 0); // 星辉圆满（3件）：渡劫成功率 +10%
  if (state.flags.tiandaoBlessing) rate += state.flags.tiandaoBlessing;
  if (state.flags.tiandaoCurse) rate -= 15;
  rate += powerBreakthroughAdj(state); // 战力参考：堆战力可小幅提升成功率
  return Math.min(95, Math.max(5, Math.round(rate)));
}

export function attemptBreakthrough(state) {
  const p = state.player;
  const bn = BOTTLENECKS[p.level];
  if (!bn) return { success: false, logs: ['未到瓶颈。'], waves: [] };

  let rate = bn.baseRate + p.daoBase['道心'].level / 4 + p.daoBase['气运'].level / 5;
  // 专属渡劫丹（如筑基丹/结丹丹）加成：只消耗一颗（丹药会堆叠，之前会整堆扣除）
  const pill = bn.item && state.items.find((i) => i.名称 === bn.item);
  if (pill) {
    rate += 20;
    pill.数量 = (pill.数量 || 1) - 1;
    if (pill.数量 <= 0) state.items.splice(state.items.indexOf(pill), 1);
  }
  // 通用渡劫丹（按品阶加成，可叠加）
  for (const i of [...state.items]) {
    if (i.effect && typeof i.effect.tribulation === 'number') {
      const gradeMul = PILL_GRADES.find((g) => g.id === i.品阶)?.tribMul || 1;
      rate += Math.round(i.effect.tribulation * gradeMul);
      i.数量 -= 1;
      if (i.数量 <= 0) {
        const idx = state.items.indexOf(i);
        if (idx >= 0) state.items.splice(idx, 1);
      }
    }
  }
  if (p.spiritRoot.gradeId === 'fei') rate += 15; // 废灵根天劫威力减半
  if (p.daoYun.id === 'tianren') rate += 8;
  rate += Number(setBonusFlags(state).breakthrough || 0); // 星辉圆满（3件）：渡劫成功率 +10%（与 breakthroughRate 同口径）
  // 天道庇护/诅咒（机缘事件触发）
  if (state.flags.tiandaoBlessing) { rate += state.flags.tiandaoBlessing; state.flags.tiandaoBlessing = 0; }
  if (state.flags.tiandaoCurse) { rate -= 15; state.flags.tiandaoCurse = false; }
  rate += powerBreakthroughAdj(state); // 战力参考（与预览同口径）
  rate = Math.min(95, Math.max(5, Math.round(rate)));

  // 生成天劫波次（3~5波动画）
  const waveCount = p.level >= 60 ? 5 : p.level >= 20 ? 4 : 3;
  const success = Rng.chance(rate / 100);
  const waves = [];
  for (let i = 1; i <= waveCount; i++) {
    const pass = success ? true : i < waveCount ? Rng.chance(0.8) : false;
    waves.push({ index: i, name: `${['一', '二', '三', '四', '五'][i - 1]}九天雷`, pass });
    if (!pass) break;
  }

  const logs = [];
  if (success) {
    p.exp = 0; p.level += 1;
    state.flags.tribulationSuccess = true;
    logs.push(`✨ 渡劫成功！${bn.name}圆满，${bn.reward}。`);
    logs.push(`境界突破：${realmLevelName(p.level)}！`);
    addDaoBaseExp(state, '悟性', 30, logs);
    addDaoYunExp(state, 40, logs);
    bus.emit('destiny:check');
  } else {
    const back = p.level === 10 ? 1 : p.level === 20 ? 1 : p.level === 40 ? 2 : p.level === 60 ? 2 : p.level === 80 ? 3 : 0;
    if (p.level === 95) {
      logs.push('💀 飞升之劫失败，魂飞魄散……但一线真灵不灭，可入轮回转世。');
      p.exp = 0;
    } else {
      const nirvana = activeBeastSkillEffect(state, 'tribulationSave');
      if (nirvana) {
        const nBeast = state.beasts?.slots?.[state.beasts.activeIdx];
        logs.push(`🔥 出战灵兽「${nBeast?.name || '灵兽'}」涅槃残焰燃起，替你挡下天劫反噬，修为未损！`);
        p.exp = 0; // 仍清当前层经验，但境界不跌落
      } else {
        p.level = Math.max(1, p.level - back);
        p.exp = 0;
        logs.push(`⚡ 渡劫失败！${bn.fail}。修为跌落至 ${realmLevelName(p.level)}。`);
      }
    }
  }
  refreshDerived(state);
  addLog(state, '事件', `渡劫「${bn.name}」${success ? '成功' : '失败'}（成功率${rate}%）。`);
  return { success, rate, waves, logs, name: bn.name, tribulation: bn.tribulation };
}

/* ============================================================
 * 五、斗法系统
 * ========================================================== */
/** 掷命运骰子（含道韵/气运修正） */
export function rollFateDice(state) {
  const p = state.player;
  const dice = FATE_DICE.map((d) => ({ ...d, prob: d.prob }));
  if (p.daoYun.id === 'tianren') {
    dice.find((d) => d.id === 'tiancci').prob += 2;
    dice.find((d) => d.id === 'hongyun').prob += 2;
    dice.find((d) => d.id === 'tianyi').prob -= 2;
  }
  if (p.daoYun.id === 'weibu') {
    dice.find((d) => d.id === 'tianyi').prob -= 2;
    dice.find((d) => d.id === 'shiyun').prob -= 2;
  }
  if (p.daoBase['气运'].level >= 60) dice.find((d) => d.id === 'tiancci').prob += 1;
  if (p.daoBase['气运'].level >= 80) dice.find((d) => d.id === 'tiancci').prob += 1;
  return Rng.weighted(dice.map((d) => ({ ...d, weight: Math.max(1, d.prob) })));
}

/** 计算越级胜率（玩家修为低于敌方>5级时） */
export function calcWinRate(state, enemyPower, enemyLevel) {
  const p = state.player;
  const diff = enemyLevel - p.level;
  if (diff <= 5) {
    // 同级：战力高者胜；相同则博弈
    if (p.power >= enemyPower) return { rate: 95, sameLevel: true };
    return { rate: Math.max(35, 50 + (p.power - enemyPower) * 2), sameLevel: true };
  }
  const base = 20 + (p.power - enemyPower) * 1;
  return { rate: Math.min(95, Math.max(5, base)), sameLevel: false, base };
}

/** 胜率隐性反馈文案 */
export function winRateFeedback(rate) {
  const f = WIN_RATE_FEEDBACK.find((w) => rate >= w.min && rate <= w.max);
  return f ? f.text : '';
}

/**
 * 生成一个对手（妖兽或修士）。
 * 平衡改动（外出历练数值重铸）：妖兽强度由「地域危险度」决定，与玩家战力脱钩——
 * 低境界修士踏入高危地域（如海外仙岛）可能撞见远超自身的大妖，胜率极低；
 * 高境界修士回到低危地域（如中州）则可碾压。风险与收益匹配：危险区掉落更丰。
 * NPC/债主等非野兽对手仍保留原战力浮动逻辑，避免切磋/因果战崩坏。
 */
export function makeEnemy(state, opts = {}) {
  const p = state.player;
  if (opts.beast) {
    const regionId = state.world.regionId || 'zhongzhou';
    const { min, max } = beastLevelRange(regionId, opts.stronger);
    const lv = Math.max(1, Rng.int(min, max));
    const danger = (REGION_TRAVEL[regionId]?.danger) || 2;
    let power = beastPowerOfLevel(lv, danger);
    if (opts.stronger) power = Math.round(power * 1.15); // 秘境/护宝妖兽再上浮
    const pool = BEASTS.filter((b) => b.lv[0] <= lv + 15 && b.lv[1] >= lv - 15);
    const beast = Rng.pick(pool.length ? pool : BEASTS.slice(0, 2));
    return { name: beast.name, level: lv, power, beast: true, realm: realmLevelName(lv), danger, regionId };
  }
  // 非野兽对手（NPC/债主/拍卖对手等）：保留原战力浮动逻辑
  const lvBand = opts.stronger ? Rng.int(0, 10) : Rng.int(-3, 5);
  const lv = Math.max(1, p.level + lvBand);
  const ratio = opts.stronger ? Rng.float(0.9, 1.2) : Rng.float(0.78, 1.05);
  const power = Math.max(1, Math.round(p.power * ratio));
  const name = Rng.pick(NPC_SURNAMES) + Rng.pick(NPC_GIVEN);
  return { name, level: lv, power, beast: false, realm: realmLevelName(lv), trait: Rng.pick(NPC_TRAITS) };
}

/** 妖兽/历练战斗失败时的惩罚（伤势与是否丢灵石），确定性，便于测试与复用。 */
export function beastDefeatPenalty(danger, { ally = false, tactic = 'normal' } = {}) {
  const d = Math.min(5, Math.max(2, danger || 2));
  const dPen = Math.max(0, d - 2);
  let wounded = ally ? 1 : (tactic === 'defend' ? 1 : 2);
  wounded += dPen;
  const loseStones = d >= 4 ? 0.08 * (d - 3) : 0;
  return { wounded, loseStones };
}

/** 结算战斗。type 见 BATTLE_TYPES。返回完整战报 */
/** 出战灵兽的战斗胜率加成：星级越高加成越大（1★+2% → 5★+10%） */
export function activeBeastBonus(state) {
  const beasts = state?.beasts;
  if (!beasts || beasts.activeIdx == null || beasts.activeIdx < 0) return 0;
  const act = beasts.slots?.[beasts.activeIdx];
  if (!act) return 0;
  const star = act.star || 1;
  return 2 + (star - 1) * 2;
}

/** 出战灵兽的「伴生天赋」技能名（仅当前出战灵兽；无出战返回 null）。 */
export function activeBeastSkill(state) {
  const beasts = state?.beasts;
  if (!beasts || beasts.activeIdx == null || beasts.activeIdx < 0) return null;
  const act = beasts.slots?.[beasts.activeIdx];
  if (!act) return null;
  return act.skill || null;
}
/** 读取出战灵兽某天赋效果的数值（未装备/无该天赋返回 undefined）。 */
export function activeBeastSkillEffect(state, key) {
  const sk = activeBeastSkill(state);
  if (!sk) return undefined;
  const eff = BEAST_SKILL_EFFECTS[sk];
  return eff ? eff[key] : undefined;
}

/** 预估战斗最终胜率（纯函数，不修改任何状态，供战前展示）。
 *  与 resolveBattle 的加成口径保持一致，但不掷命运骰子（战前未知），也不触发胜负副作用。 */
export function previewBattle(state, enemy, type, tactic = 'normal', blessed = false) {
  const p = state.player;
  if (type === 'fled') return { rate: 0, finalRate: 0, sameLevel: true, breakdown: {} };
  const { rate, sameLevel } = calcWinRate(state, enemy.power, enemy.level);
  // 逐段累计并精确记录「实际施加」的增量（受 5~95 封顶影响，避免明细与总和对不上）
  let cur = rate;
  const bd = { base: Math.round(rate), ally: 0, beasts: 0, activeBeast: 0, toxic: 0, wound: 0, tactic: 0, blessed: 0, buff: 0 };
  const apply = (delta, key) => {
    const next = Math.min(95, Math.max(5, cur + delta));
    bd[key] += next - cur;
    cur = next;
  };
  if (state.flags.companionMonths > 0) apply(10, 'ally');
  // 道友之能·剑修/体修：仗义护持，道友级（relation>=3）即在战斗中助拳（确定性 +6，不掷运）
  if (daoFriendJob(state, '剑修') || daoFriendJob(state, '体修')) apply(6, 'ally');
  // 全体灵兽助阵
  if (state.beasts?.slots?.length) {
    const beastBonus = state.beasts.slots.reduce((s, b) => s + (BEAST_WINRATE[b.name] ?? BEAST_WINRATE.default), 0);
    apply(beastBonus, 'beasts');
  }
  // 出战灵兽：星级越高护主加成越大
  const actIdx = state.beasts?.activeIdx;
  if (actIdx != null && actIdx >= 0 && state.beasts.slots?.[actIdx]) {
    apply(activeBeastBonus(state), 'activeBeast');
    // 出战灵兽「伴生天赋」：风刃突袭先手 +5%；幻境迷心越级（敌方等级高于己方）额外 +8%
    const skill = activeBeastSkill(state);
    if (skill === '风刃突袭') apply(5, 'skill');
    else if (skill === '幻境迷心' && enemy && enemy.level > state.player.level) apply(8, 'skill');
  }
  // 丹毒 / 伤势 惩罚
  const toxic = Number(state.flags?.pillToxicity || 0);
  if (toxic >= 85) apply(-10, 'toxic');
  const wounds = state.flags?.wounded || 0;
  if (wounds > 0) apply(-Math.min(15, wounds * 3), 'wound');
  if (tactic === 'aggro') apply(8, 'tactic');
  else if (tactic === 'defend') apply(-5, 'tactic');
  if (blessed && totalStones(state) >= 50) apply(10, 'blessed');
  // 战前增益（法力丹等）：下次战斗胜率提升，预览同口径展示
  if (state.flags?.nextBattleWin) apply(state.flags.nextBattleWin, 'buff');
  return { rate: Math.round(rate), finalRate: Math.round(cur), sameLevel, breakdown: bd };
}



/**
 * 地域「典型遭遇胜率」预估（纯函数，不改动 state，供疆域图地域卡在玩家决定前往前展示）。
 * 取该地域妖兽等级区间的中点作为"典型遭遇"，复用 previewBattle 同口径加成，给出确定性预估
 * （不含命运骰子与胜负副作用）。实际遭遇等级在 [min,max] 内浮动，故仅作参考。
 */
export function regionEncounterRate(state, regionId) {
  const reg = REGION_TRAVEL[regionId] || REGION_TRAVEL.zhongzhou;
  const { min, max } = beastLevelRange(regionId, false);
  const lv = Math.max(1, Math.round((min + max) / 2)); // 典型遭遇等级（区间中点）
  const danger = Math.min(5, Math.max(2, reg.danger || 2));
  const power = beastPowerOfLevel(lv, danger);
  const enemy = { name: '妖兽', level: lv, power, beast: true, realm: realmLevelName(lv), danger, regionId };
  const pv = previewBattle(state, enemy, 'yaoshou', 'normal', false);
  return pv.finalRate;
}

/**
 * 秘境探索·护宝妖兽预估胜率（纯函数，不修改状态，供深度选择面板展示）。
 * 与 exploreMysticRealm 实际遭遇口径一致：护宝妖兽取 stronger 等级区间中点，
 * 深度 >=3 时按 1.2 倍等级 / 1.3 倍战力上浮；复用 previewBattle 同口径加成，确定性无 RNG。
 */
export function mysticBeastRate(state, depth = 1) {
  const regionId = state.world.regionId || 'zhongzhou';
  const reg = REGION_TRAVEL[regionId] || REGION_TRAVEL.zhongzhou;
  const { min, max } = beastLevelRange(regionId, true); // 护宝妖兽 stronger
  let lv = Math.max(1, Math.round((min + max) / 2));
  const danger = Math.min(5, Math.max(2, reg.danger || 2));
  let power = Math.round(beastPowerOfLevel(lv, danger) * 1.15); // 与 makeEnemy 的 stronger 上浮一致
  if (depth >= 3) { power = Math.round(power * 1.3); lv = Math.round(lv * 1.2); }
  const enemy = { name: '护宝妖兽', level: lv, power, beast: true, realm: realmLevelName(lv), danger, regionId };
  const pv = previewBattle(state, enemy, 'yaoshou', 'normal', false);
  return pv.finalRate;
}

export function resolveBattle(state, enemy, type, fled = false, tactic = 'normal', blessed = false) {
  const p = state.player;
  const logs = [];
  if (fled) {
    logs.push('你见势不妙，捏碎遁符脱离战场。');
    if (type === 'shengci' && Rng.chance(0.3)) {
      const lost = Math.round(totalStones(state) * 0.1);
      spendStones(state, lost);
      logs.push(`逃脱时被对方截下部分财物，损失灵石约${lost}。`);
    }
    addLog(state, '战斗', `遭遇「${enemy.name}」（${enemy.realm}），选择遁走。`);
    return { fled: true, logs };
  }

  const { rate, sameLevel } = calcWinRate(state, enemy.power, enemy.level);
  let dice = null, finalRate = rate;
  if (!sameLevel || p.power < enemy.power) {
    dice = rollFateDice(state);
    finalRate = Math.min(95, Math.max(5, rate + (sameLevel ? 0 : dice.mod)));
  }
  if (state.flags.companionMonths > 0 && !fled) {
    finalRate = Math.min(95, finalRate + 10);
    logs.push(`同行道友「${state.flags.companion}」从旁策应，胜率提高。`);
  }
  // 道友之能·剑修/体修：仗义护持，道友级（relation>=3）即在战斗中助拳（确定性 +6）
  const warFriend = !fled && (daoFriendJob(state, '剑修') || daoFriendJob(state, '体修'));
  if (warFriend) {
    finalRate = Math.min(95, finalRate + 6);
    logs.push(`道友「${warFriend.name}」仗义助拳，胜率提高。`);
  }
  // 灵兽战斗加成
  if (state.beasts?.slots?.length && !fled) {
    const beastBonus = state.beasts.slots.reduce((s, b) => s + (BEAST_WINRATE[b.name] ?? BEAST_WINRATE.default), 0);
    finalRate = Math.min(95, finalRate + beastBonus);
    logs.push(`灵兽${state.beasts.slots.map((b) => b.name).join('、')}助阵，胜率 +${beastBonus}%。`);
  }
  // 出战灵兽：主动指定的先锋额外护主加成，星级越高加成越大（升星在战斗中更有价值）
  if (state.beasts?.activeIdx != null && state.beasts.activeIdx >= 0 && state.beasts.slots[state.beasts.activeIdx] && !fled) {
    const act = state.beasts.slots[state.beasts.activeIdx];
    const star = act.star || 1;
    const ACTIVE_BEAST_BONUS = 2 + (star - 1) * 2; // 1★+2% → 5★+10%
    finalRate = Math.min(95, finalRate + ACTIVE_BEAST_BONUS);
    logs.push(`出战灵兽「${act.name}」（${star}★）冲锋在前，誓死护主，胜率 +${ACTIVE_BEAST_BONUS}%。`);
    // 出战灵兽「伴生天赋」：风刃突袭先手 +5%；幻境迷心越级额外 +8%
    if (act.skill === '风刃突袭') { finalRate = Math.min(95, finalRate + 5); logs.push(`「${act.name}」风刃突袭抢占先手，胜率 +5%。`); }
    else if (act.skill === '幻境迷心' && enemy.level > state.player.level) { finalRate = Math.min(95, finalRate + 8); logs.push(`「${act.name}」幻境迷心惑乱强敌，越级胜率 +8%。`); }
  }
  // 丹毒过高降低胜率
  const toxic = Number(state.flags?.pillToxicity || 0);
  if (toxic >= 85) { finalRate = Math.max(5, finalRate - 10); logs.push('丹毒深重，战力受限。'); }
  // 伤势降低胜率（每月伤势 -3%，最高 -15%）
  const wounds = state.flags?.wounded || 0;
  if (wounds > 0) { const woundPen = Math.min(15, wounds * 3); finalRate = Math.max(5, finalRate - woundPen); logs.push(`伤势未愈，胜率 -${woundPen}%。`); }
  // 战术倾向：强攻提胜率但败则重创，稳守降胜率但败则轻伤（寻常不变）
  const penaltyMul = tactic === 'aggro' ? 1.5 : tactic === 'defend' ? 0.5 : 1;
  if (tactic === 'aggro') { finalRate = Math.min(95, finalRate + 8); logs.push('强攻战术：全力搏杀，胜率 +8%，然败则重创。'); }
  else if (tactic === 'defend') { finalRate = Math.max(5, finalRate - 5); logs.push('稳守战术：步步为营，胜率 -5%，然败则轻伤。'); }
  // 天命加持：焚香燃灯，耗灵石换胜率（需足灵石，且非遁走）
  if (blessed && !fled) {
    const bCost = 50;
    if (totalStones(state) >= bCost) { spendStones(state, bCost); finalRate = Math.min(95, finalRate + 10); logs.push(`你燃灯焚香，邀得天命加持，胜率 +10%（耗灵石${bCost}）。`); }
    else logs.push('灵石不足，无力邀得天命加持。');
  }
  // 战前增益（法力丹等）：下次战斗胜率提升，战后清零（遁走则保留）
  if (state.flags?.nextBattleWin && !fled) {
    finalRate = Math.min(95, finalRate + state.flags.nextBattleWin);
    logs.push(`战前增益生效，胜率 +${state.flags.nextBattleWin}%。`);
    state.flags.nextBattleWin = 0;
  }
  // 道友援护：心腹/道侣级道友有概率临阵仗义相助（高关系层级方有此情义）
  let allyAided = false;
  const ally = state.npcs?.find((n) => (n.relation || 0) >= 4 && isMet(n));
  if (ally && !fled && Rng.chance(0.3)) {
    finalRate = Math.min(95, finalRate + 8);
    allyAided = true;
    logs.push(`道友「${ally.name}」感念旧情，仗义援手，胜率 +8%！`);
  }
  const finalWin = Rng.chance(finalRate / 100);
  if (finalWin) state.flags.kills = (state.flags.kills || 0) + 1;
  const report = { win: finalWin, rate: Math.round(rate), finalRate: Math.round(finalRate), dice, enemy, type, logs, loot: [] };

  if (finalWin) {
    const expGain = Math.round(expNeed(p.level) * (enemy.beast ? Rng.int(15, 35) : Rng.int(25, 50)) / 100);
    p.exp += expGain;
    logs.push(`🎉 你战胜了${enemy.beast ? '妖兽' : '修士'}「${enemy.name}」！修为+${expGain}。`);
    if (enemy.beast) {
      const drops = generateBeastDrops(state, enemy);
      for (const mat of drops) {
        if (storeItem(state, mat)) {
          report.loot.push(mat.名称);
          logs.push(`获得妖兽材料：${mat.名称} ×${mat.数量}。`);
        } else {
          logs.push(`储物袋已满，未能带走「${mat.名称}」。`);
        }
      }
    } else if (type === 'shengci' || type === 'ziwei') {
      const stones = Rng.int(20, 120) * Math.max(1, Math.round(enemy.level / 10));
      addStones(state, stones);
      report.loot.push(`灵石约${stones}`);
      logs.push(`缴获对方储物袋，灵石+${stones}。`);
      if (Rng.chance(0.4)) {
        const grade = Rng.pick(['ling', 'ling', 'di']);
        const tname = Rng.pick(TECHNIQUE_NAMES[grade]);
        state.techniques.push({ 名称: tname, 品级: TECHNIQUE_GRADES.find((g) => g.id === grade).name, 等级: 1, 经验: 0 });
        discoverItem(state, { 名称: tname, 类型: '功法' });
        report.loot.push(`《${tname}》玉简`);
        logs.push(`缴获功法玉简：《${tname}》！`);
      }
      if (Rng.chance(0.4)) {
        const slot = Rng.pick(['weapon', 'armor', 'boots', 'accessory']);
        const item = generateEquip(state, slot, Math.max(1, Math.round(enemy.level / 10)));
        state.equipment.stash.push(item);
        report.loot.push(`${item.名称}(${equipSlotName(slot)})`);
        logs.push(`缴获装备：${item.名称}（${getEquipGrade(item.品阶)?.name || item.品阶}，战力+${item.战力}）！`);
      }
    }
    addDaoBaseExp(state, '道心', Rng.int(3, 8), logs);
    const ups = tryLevelUp(state, logs);
    if (ups) logs.push(`战后感悟，修为进一步精进。`);
  } else {
    // 护符抵挡：非切磋失败且持有护符时，消耗一张护符抵消损失
    let wardKind = null;
    const relief = activeBeastSkillEffect(state, 'defeatRelief');
    if (type !== 'qiecuo') {
      const wFull = state.items.find((i) => i.名称 === '护身符');
      // 2026-08-30 修复：'兽皮护符'（百艺·御兽产出，描述承诺「战斗失败时减轻损失」）此前不在查找列表中，
      // 玩家耗 3 份妖兽皮毛制成却永不生效（死道具+假承诺），现纳入低阶护符体系。
      const wLow = state.items.find((i) => i.名称 === '低阶护身符' || i.名称 === '低阶符箓' || i.名称 === '简易阵旗' || i.名称 === '兽皮护符');
      const w = wFull || wLow;
      if (w) {
        wardKind = wFull ? 'ward' : 'wardLow';
        w.数量 -= 1;
        if (w.数量 <= 0) state.items.splice(state.items.indexOf(w), 1);
      }
    }
    // 失败惩罚（按文档「失败惩罚机制」简化实现）
    if (type === 'qiecuo') {
      logs.push('切磋落败，点到为止，并无实质损失。');
    } else if (enemy.beast || type === 'yaoshou') {
      // 危险度越高，失败惩罚越重（伤势更深、险地更可能被劫灵石）
      const danger = enemy.danger || (REGION_TRAVEL[state.world.regionId]?.danger) || 2;
      const pen = beastDefeatPenalty(danger, { ally: allyAided, tactic });
      logs.push('你重伤遁走，需休养数月（本月行动收益减半）。');
      if (wardKind !== 'ward' && !relief) {
        state.flags.wounded = pen.wounded;
      } else {
        logs.push(wardKind ? '护身符光华流转，替你挡去重伤，安然脱身。' : '铁背苍熊铁背护体，替你挡去重伤，安然脱身。');
      }
      if (pen.loseStones > 0) {
        if (!wardKind && !relief) {
          const lost = Math.round(totalStones(state) * pen.loseStones);
          if (lost > 0) { spendStones(state, lost); logs.push(`险地溃败，被劫去灵石约${lost}。`); }
        } else {
          logs.push(wardKind ? '护符护体，灵石分毫未失。' : '铁背护体，灵石分毫未失。');
        }
      }
    } else {
      const gap = (enemy.power - p.power) / Math.max(1, p.power);
      let back, loseRate;
      if (gap < 0.2) { back = Rng.int(1, 2); loseRate = 0.5; logs.push('对方念无深仇，手下留情。'); }
      else if (gap < 0.5) { back = Rng.int(2, 4); loseRate = 0.3; logs.push('你重伤落败，颜面大损。'); }
      else { back = Rng.int(5, 8); loseRate = 1; logs.push('你被对方碾压，险些丧命！'); }
      back = Math.max(1, Math.round(back * penaltyMul));
      loseRate = Math.min(1, loseRate * penaltyMul);
      if (allyAided) { back = Math.max(1, Math.round(back * 0.5)); loseRate = Math.min(1, loseRate * 0.5); }
      if (wardKind !== 'ward' && !relief) {
        p.level = Math.max(1, p.level - back);
        p.exp = 0;
      } else {
        logs.push(wardKind ? '护身符碎裂，替你稳住道基，修为未损。' : '铁背苍熊铁背护体，替你稳住道基，修为未损。');
      }
      if (!wardKind && !relief) {
        const lost = Math.round(totalStones(state) * loseRate * 0.5);
        spendStones(state, lost);
        logs.push(`修为倒退至 ${realmLevelName(p.level)}，损失灵石约${lost}。`);
      } else {
        logs.push(wardKind ? '护符护体，灵石分毫未失。' : '铁背护体，灵石分毫未失。');
      }
    }
    addDaoBaseExp(state, '道心', Rng.int(1, 4), logs); // 败中磨砺
  }
  refreshDerived(state);
  addLog(state, '战斗', `${report.win ? '战胜' : '败于'}「${enemy.name}」（${enemy.realm}）${dice ? `，命运骰子${dice.icon}${dice.name}` : ''}。`);
  makeChronicle(state, { type: '战斗', title: `斗法：${enemy.name}`, text: logs.join('') });
  return report;
}

/* ============================================================
 * 六、天命主线
 * ========================================================== */
export function destinyCurrent(state) {
  const line = DESTINY_LINES[state.destiny.lineId];
  return line.stages[state.destiny.stage] || null;
}
/** 当前阶段是否满足推进条件（修为达标） */
export function destinyAvailable(state) {
  const st = destinyCurrent(state);
  return st && state.player.level >= st.reqLv;
}

/**
 * 天命当前阶段奖励的确定性预览（用于罗盘「顺应天命」选项的收益展示）。
 * 不改变状态，仅展示真实将发放的奖励，帮助玩家决策。
 */
export function destinyRewardPreview(state) {
  const st = destinyCurrent(state);
  if (!st || !st.reward) return '主线奖励，推进世界故事';
  const r = st.reward;
  switch (r.type) {
    case '道基': return `奖励：${r.key}+${r.val}（道基）`;
    case '货币': return `奖励：下品灵石+${r.val}`;
    case '功法': {
      const g = TECHNIQUE_GRADES.find((x) => x.id === r.grade);
      return `奖励：功法《${r.name}》（${g ? g.name : r.grade}）`;
    }
    case '装备': return `奖励：${r.name}（战力法宝，入备用栏）`;
    case '称号': return `奖励：封号「${r.title}」`;
    default: return r.text || '主线奖励，推进世界故事';
  }
}
/** 推进天命主线一阶段 */
export function advanceDestiny(state) {
  const st = destinyCurrent(state);
  if (!st) return { logs: ['天命已尽，仙途无憾。'], finished: true };
  const logs = [`【天命·${state.destiny.lineName}】${st.plot}`];
  applyDestinyReward(state, st.reward, logs);
  state.destiny.done.push({ 阶段: st.name, 时间: `天玄历${state.world.year}年`, 奖励: st.reward.text });
  state.destiny.stage += 1;
  const next = destinyCurrent(state);
  if (next) {
    state.destiny.stageName = next.name;
    state.destiny.status = state.player.level >= next.reqLv ? '待抉择' : '进行中';
    state.destiny.waitYears = 0;
    logs.push(`天命进入新阶段：「${next.name}」（需修为 Lv.${next.reqLv}）。`);
  } else {
    state.destiny.stageName = '已圆满';
    state.destiny.status = '已完成';
    if (st.reward.title) {
      state.player.title = st.reward.title;
      state.destiny.title = st.reward.title;
    }
    logs.push(`🎊 天命主线【${state.destiny.lineName}】全部完成！`);
  }
  addLog(state, '天命', `【${state.destiny.lineName}】完成阶段「${st.name}」。${st.reward.text}`);
  return { logs, finished: !next };
}
function applyDestinyReward(state, reward, logs) {
  switch (reward.type) {
    case '道基': addDaoBaseExp(state, reward.key, reward.val * 80, logs); logs.push(`天命奖励：${reward.text}`); break;
    case '货币': addStones(state, reward.val); logs.push(`天命奖励：${reward.text}`); break;
    case '功法': {
      const g = TECHNIQUE_GRADES.find((x) => x.id === reward.grade);
      state.techniques.push({ 名称: reward.name, 品级: g.name, 等级: 1, 经验: 0 });
      discoverItem(state, { 名称: reward.name, 类型: '功法' });
      logs.push(`天命奖励：${reward.text}`);
      break;
    }
    case '装备': {
      const slot = reward.slot || (reward.lv >= 5 ? 'artifact' : 'weapon');
      const item = generateEquip(state, slot, reward.lv, reward.name);
      state.equipment.stash.push(item);
      logs.push(`天命奖励：${item.名称}（${getEquipGrade(item.品阶)?.name || item.品阶}，战力+${item.战力}）`);
      break;
    }
    case '称号': awardTitle(state, reward.title, logs); logs.push(`天命奖励：${reward.text}`); break;
    /* 【扩展点】新奖励类型（领域雏形/道统信物/本命法宝胚…）在此登记 */
    default: logs.push(`天命奖励：${reward.text}`);
  }
}

/* ============================================================
 * 七、天机简报与世界演化
 * ========================================================== */
export function generateNews(state) {
  const news = [];
  const count = Rng.int(3, 5);
  for (let i = 0; i < count; i++) {
    const f = Rng.pick(FACTIONS);
    const f2 = Rng.pick(FACTIONS.filter((x) => x !== f));
    const e = Rng.pick(WORLD_EVENTS);
    news.push(`【${f}】${e.replace('邻近势力', f2)}。`);
  }
  // 市场行情：结构化行情波动，与坊市售价联动
  const trendMats = ['妖兽内丹', '聚气丹', '灵草', '法器胚子', '符箓', '星砂', '百年灵芝', '海灵珠', '赤铜精', '凝血丹'];
  const trendTable = [
    { t: '大涨，一物难求', mul: 1.6, w: 10 },
    { t: '上涨两成', mul: 1.25, w: 22 },
    { t: '小幅上扬', mul: 1.1, w: 20 },
    { t: '持平', mul: 1.0, w: 20 },
    { t: '微降', mul: 0.85, w: 18 },
    { t: '大跌，无人问津', mul: 0.6, w: 10 },
  ];
  const marketTrend = {};
  const regionName = state.world.region || (REGIONS.find((r) => r.id === state.world.regionId)?.name) || '中州圣城';
  const trendCount = Rng.int(1, 2);
  const picked = [];
  for (let k = 0; k < trendCount; k++) {
    let mat = Rng.pick(trendMats);
    if (picked.includes(mat)) mat = Rng.pick(trendMats.filter((m) => !picked.includes(m))) || mat;
    picked.push(mat);
    const tr = Rng.weighted(trendTable.map((x) => ({ ...x, weight: x.w })));
    marketTrend[mat] = tr.mul;
    news.push(`【行情】${regionName}·${mat}价格${tr.t}。`);
  }
  state.world.marketTrend = marketTrend;
  state.world.news = news;
  return news;
}

/** 根据天机简报的行情，计算某物品的出售价格倍率（关键词命中最高偏离者） */
export function newsPriceMul(state, item) {
  const trend = state.world?.marketTrend;
  if (!trend || !item) return 1;
  let best = 1, bestDev = 0;
  for (const [k, mul] of Object.entries(trend)) {
    if (item.名称 && item.名称.includes(k)) {
      const dev = Math.abs(mul - 1);
      if (dev > bestDev) { best = mul; bestDev = dev; }
    }
  }
  return best;
}

/* ============================================================
 * 八、决策罗盘（每月 15 个选项位，按文档类别生成）
 * ========================================================== */
export function generateCompass(state) {
  const opts = [];
  const m = state.world.month;

  // —— 命途推进（1-3月固定出现） ——
  if (m >= 1 && m <= 3) {
    const st = destinyCurrent(state);
    if (st && destinyAvailable(state)) {
      opts.push({ icon: '🔴', tag: '天命', title: `【${state.destiny.lineName}·${st.name}】顺应天命`, desc: st.plot, action: { type: 'destiny' } });
      opts.push({ icon: '🙅', tag: '天命', title: '暂避天命，韬光养晦', desc: '今年暂不推进主线，天命静候来年。', action: { type: 'skipDestiny' } });
    } else if (st) {
      opts.push({ icon: '⏳', tag: '天命', title: `【${state.destiny.lineName}·${st.name}】时机未至`, desc: `需修为达到 Lv.${st.reqLv}（当前 Lv.${state.player.level}），继续积蓄实力。`, action: { type: 'cultivate' } });
    }
  }

  // —— 因缘际会（6-7月世界事件） ——
  if (m >= 6 && m <= 7) {
    opts.push({ icon: '🏟️', tag: '因缘', title: '宗门大比观礼', desc: '各宗新秀齐聚，观战可悟他山之石（悟性经验）。', action: { type: 'event', kind: 'watch' } });
    opts.push({ icon: '🏔️', tag: '因缘', title: '秘境出世！抢先探索', desc: '高风险高回报，可能遭遇护宝妖兽。', action: { type: 'event', kind: 'mystic' }, risk: true });
  }

  // —— 历练探索（显示当前地域危险度与建议境界，让玩家感知风险） ——
  const _regionId = state.world.regionId || 'zhongzhou';
  const _reg = REGION_TRAVEL[_regionId] || REGION_TRAVEL.zhongzhou;
  const _dangerHint = `危险度${_reg.danger}/5｜建议${realmLevelName(_reg.realmReq || 1)}`;
  opts.push({ icon: '🗡️', tag: '历练', title: '外出历练，猎杀妖兽', desc: `获取妖兽材料与修为经验。当前：${state.world.region}（${_dangerHint}）`, action: { type: 'explore', kind: 'hunt' } });
  opts.push({ icon: '🌄', tag: '历练', title: '游历四方，寻访机缘', desc: `随缘而遇，或有所获。当前：${state.world.region}（${_dangerHint}）`, action: { type: 'explore', kind: 'wander' } });

  // —— 道缘经营（仅对已结识之人推送拜访选项；未结识者通过游历/寻访逐步解锁） ——
  const known = knownNpcs(state);
  if (known.length) {
    const npc = Rng.pick(known);
    opts.push({ icon: '🍵', tag: '道缘', title: `拜访「${npc.name}」`, desc: `${npc.realm} · ${npc.job} · 好感${npc.favor}（${npc.relationName}）`, action: { type: 'social', target: npc.name } });
  }
  // 关系网始终可打开：其中会同时展示「已结识」与「未结识（待解锁）」
  opts.push({ icon: '📜', tag: '道缘', title: '经营关系网', desc: known.length ? '自由选择一位道缘对象往来。' : '你尚未结识同道，先在游历中寻访机缘吧。', action: { type: 'socialList' } });

  // —— 修仙百艺 ——
  opts.push({ icon: '⚗️', tag: '百艺', title: '研习修仙百艺', desc: '炼丹/炼器/制符…精进技艺并赚取灵石。', action: { type: 'art' } });

  // —— 坊市 / 地图 ——
  opts.push({ icon: '💰', tag: '坊市', title: `逛${state.world.region}坊市`, desc: '每个地域有独立特产、材料、装备和储物袋服务。', action: { type: 'market' } });
  opts.push({ icon: '🗺️', tag: '游历', title: '查看天玄地图，前往相邻地域', desc: '旅行会消耗灵石与月份；不同地域决定物产、坊市和机缘。', action: { type: 'map' } });

  // —— 闭关修持 ——
  opts.push({ icon: '🧘', tag: '闭关', title: '闭关苦修一月', desc: '心无旁骛，修炼收益大幅提升。', action: { type: 'cultivate', mode: 'seclusion' } });
  opts.push({ icon: '📖', tag: '闭关', title: '研读功法典籍', desc: '提升功法层数与悟性。', action: { type: 'study' } });

  // —— 突破（瓶颈时出现） ——
  const bn = checkBottleneck(state);
  if (bn) {
    opts.unshift({ icon: '⚡', tag: '突破', title: `冲击瓶颈：${bn.name}`, desc: `渡劫内容：${bn.tribulation}｜成功：${bn.reward}｜失败：${bn.fail}`, action: { type: 'breakthrough' }, risk: true });
  }

  // —— 洞府升级（灵石充裕时出现） ——
  if (state.cave.level < 8 && canAfford(state, (state.cave.level + 1) * CAVE_UPGRADE_BASE)) {
    opts.push({ icon: '🏠', tag: '经营', title: `升级洞府（${CAVE_LEVELS[state.cave.level + 1].name}）`, desc: `花费灵石${(state.cave.level + 1) * CAVE_UPGRADE_BASE}，修炼加成+${Math.round(CAVE_LEVELS[state.cave.level + 1].bonus * 100)}%。`, action: { type: 'upgradeCave' } });
  }

  // —— 引泉升级（灵石充裕且未达上限时出现） ——
  {
    const cur = state.cave?.springLevel || 0;
    if (cur < HERB_SPRING_MAX && canAfford(state, HERB_SPRING_COST_BASE * (cur + 1))) {
      opts.push({ icon: '💧', tag: '经营', title: `引泉升级（灵泉涌动 ${cur}→${cur + 1} 重）`, desc: `花费灵石${HERB_SPRING_COST_BASE * (cur + 1)}，灵草每月自然生长额外 +1 月（与洞府基础涌动叠加）。`, action: { type: 'upgradeHerbSpring' } });
    }
  }

  // 新增玩法选项（秘境/拍卖/灵兽/宗门/机缘）
  opts.push(...extraCompassOptions(state));

  // 给界面层提供"点进去前看得懂"的结果预览，具体判定仍在玩法系统内完成。
  return opts.map((o) => {
    if (o.action.type === 'cultivate') {
      const m = o.action.mode === 'seclusion' ? 'seclusion' : 'normal';
      const pv = cultivateGainPreview(state, m);
      const cavePct = Math.round((pv.caveMul - 1) * 100);
      const bonePct = Math.round((pv.boneMul - 1) * 100);
      const parts = [`基础${pv.base}`, `灵根×${pv.rootMul}`, `洞府/宗门+${cavePct}%`, `功法×${pv.gradeMul}`, `根骨+${bonePct}%`];
      if (pv.toxicMul !== 1) parts.push(`丹毒×${pv.toxicMul}`);
      if (pv.boostMul !== 1) parts.push(`聚灵×${pv.boostMul}`);
      parts.push(`运势×${pv.omen}`);
      return { ...o, preview: `预计修为 +${pv.gain}（${pv.note}）`, previewTitle: `修炼收益拆解：${parts.join(' ｜ ')} ≈ ${pv.gain}` };
    }
    if (o.action.type === 'explore') return { ...o, preview: '收益：材料、灵石或修为；可能进入斗法' };
    if (o.action.type === 'market') return { ...o, preview: '不会立刻结束本月，可购买、出售后再决定' };
    if (o.action.type === 'socialList' || o.action.type === 'social') return { ...o, preview: '收益：好感、道基或关系层级；切磋会进入斗法' };
    if (o.action.type === 'breakthrough') return { ...o, preview: '高风险：成功跨越瓶颈，失败会损失修为' };
    if (o.action.type === 'destiny') return { ...o, preview: destinyRewardPreview(state) };
    if (o.action.type === 'art') return { ...o, preview: '收益：技艺经验与灵石；可返回重新选择' };
    if (o.action.type === 'study') return { ...o, preview: studyGainPreview(state) };
    return { ...o, preview: '收益：推进本月状态与世界变化' };
  });
}

/* ============================================================
 * 九、月度行动结算
 * ========================================================== */
/* ============================================================
 * 八·五、游历四方事件池（丰富化，避免只有灵石/打斗）
 * ========================================================== */
function gainExp(state, amount, logs) {
  state.player.exp += amount;
  tryLevelUp(state, logs);
}

/** 游历事件：每个事件返回 { logs:[], battle? } */
export const WANDER_EVENTS = [
  {
    id: 'hermit', weight: 10, regionBoost: { zhongzhou: 1.6, xiji: 1.3 },
    run(state) {
      const logs = [];
      addDaoBaseExp(state, '悟性', Rng.int(15, 28), logs);
      addDaoBaseExp(state, '道心', Rng.int(8, 16), logs);
      const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);
      if (tech) { tech.经验 += 60; const need = tech.等级 * 20; if (tech.经验 >= need) { tech.经验 -= need; tech.等级 += 1; logs.push(`受隐士点拨，《${tech.名称}》悟至第${tech.等级}层！`); } else logs.push(`隐士与你论道半日，功法经验+60。`); }
      logs.push('山间茅棚里，一位白须隐士邀你对坐清谈，临别赠你一句偈语。');
      return { logs };
    },
  },
  {
    id: 'cave', weight: 9, regionBoost: { haiwai: 1.8, xiji: 1.4 },
    run(state) {
      const logs = [];
      const map = { 名称: '海上遗府残图', 类型: '线索', 数量: 1, 描述: '上古遗府的残片地图，集齐 3 张可开启一次遗府探索。', 价值: 120 };
      if (storeItem(state, map)) logs.push('你误入一处风化洞府，在石台夹层寻得「海上遗府残图」一张。');
      else logs.push('你寻得「海上遗府残图」，储物袋已满只能暂存怀中。');
      if (Rng.chance(0.5)) {
        const art = generateEquip(state, 'artifact', Rng.int(3, 6), Rng.pick(ARTIFACT_NAMES));
        state.equipment.stash.push(art);
        logs.push(`洞府深处躺着一具枯骨，腕间法宝「${art.名称}」（${getEquipGrade(art.品阶)?.name || art.品阶}，战力+${art.战力}）已被你取走。`);
      } else addStones(state, Rng.int(30, 120));
      return { logs };
    },
  },
  {
    id: 'spring', weight: 8, regionBoost: { beiming: 1.6, nanming: 1.2 },
    run(state) {
      const logs = [];
      const amt = Rng.int(60, 140) + state.player.level * 4;
      gainExp(state, amt, logs);
      logs.push(`你寻到一眼灵泉，掬水而饮，灵气充盈四肢百骸，修为+${amt}。`);
      addDaoBaseExp(state, '道心', Rng.int(6, 14), logs);
      if (state.player.daoYun.id === 'weibu') addDaoYunExp(state, Rng.int(5, 12), logs);
      return { logs };
    },
  },
  {
    id: 'refugee', weight: 8, regionBoost: { zhongzhou: 1.2 },
    run(state) {
      const logs = [];
      const gift = Rng.pick(['海灵珠', '冰魄符纸', '星砂', '赤铜精']);
      const it = { 名称: gift, 类型: '材料', 数量: 1, 描述: '落难修士感激你所赠丹药，回礼的疗伤奇物。', 价值: 70 };
      if (storeItem(state, it)) logs.push(`你以丹药救助一名重伤散修，对方赠你「${gift}」聊表谢意。`);
      else logs.push(`你救助的散修欲赠你「${gift}」，储物袋已满只好婉拒。`);
      addDaoBaseExp(state, '气运', Rng.int(6, 14), logs);
      logs.push('医者仁心，这一桩善缘或许日后另有回响。');
      return { logs };
    },
  },
  {
    id: 'battlefield', weight: 8, regionBoost: { donghuang: 1.5, xiji: 1.4 },
    run(state) {
      const logs = [];
      if (Rng.chance(0.6)) {
        const eq = generateEquip(state, Rng.pick(['weapon', 'armor', 'boots']), Rng.int(2, 5), null);
        state.equipment.stash.push(eq);
        logs.push(`上古战场废墟中，你拾得一柄残破兵刃，稍加祭炼成「${eq.名称}」（${getEquipGrade(eq.品阶)?.name || eq.品阶}，战力+${eq.战力}）。`);
      } else {
        const f = Rng.int(40, 160); addStones(state, f);
        logs.push(`你在断戟残甲间翻找，得零散灵石约${f}枚。`);
      }
      addDaoBaseExp(state, '道心', Rng.int(4, 10), logs);
      return { logs };
    },
  },
  {
    id: 'treasure', weight: 9, regionBoost: { lingnan: 1.8, donghuang: 1.3 },
    run(state) {
      const logs = [];
      const herb = Rng.pick(['百年灵芝', '凝血草', '聚灵花', '火精枣', '玉髓芝']);
      const it = { 名称: herb, 类型: '材料', 数量: Rng.int(1, 2), 描述: '深山灵植，可炼丹亦可售于坊市。', 价值: 60 };
      if (storeItem(state, it)) logs.push(`你循着药香拨开荆棘，采得灵植「${herb}」。`);
      else logs.push(`你采得「${herb}」，储物袋已满只得就地移栽。`);
      if (Rng.chance(0.3)) {
        const rare = { 名称: '天材地宝·月华露', 类型: '材料', 数量: 1, 描述: '月华凝露，炼丹圣物，价值连城。', 价值: 160 };
        if (storeItem(state, rare)) logs.push('草丛中竟藏着一滴泛着月华的露珠——「月华露」！');
      }
      return { logs };
    },
  },
  {
    id: 'village', weight: 7, regionBoost: { lingnan: 1.3 },
    run(state) {
      const logs = [];
      const pill = { 名称: '疗伤丹', 类型: '丹药', 数量: Rng.int(1, 2), effect: { heal: true }, 描述: '清除 1 个月伤势。', 价值: 40 };
      if (storeItem(state, pill)) logs.push('途经凡人村落，你施法驱散了蔓延的瘴气，村老硬塞给你几枚「疗伤丹」。');
      else logs.push('村老欲赠你「疗伤丹」，储物袋已满只得谢绝。');
      addDaoBaseExp(state, '气运', Rng.int(5, 12), logs);
      logs.push('行医积德，心宽体健，此乃修行之基。');
      return { logs };
    },
  },
  {
    id: 'cub', weight: 6, regionBoost: { donghuang: 1.8 },
    run(state) {
      const logs = [];
      const r = tameBeast(state, { name: '灵狐幼崽', power: 3 + Math.round(state.player.level / 4), minLevel: 1, desc: '一只通灵的小狐，尚显娇弱却极有灵性。' });
      logs.push(...r.logs);
      if (!r.ok) {
        const mat = { 名称: '青风狼内丹', 类型: '材料', 数量: 1, 描述: '妖兽内丹，炼丹主药。', 价值: 45 };
        if (storeItem(state, mat)) logs.push('幼崽虽未收服，你仍拾得一枚「青风狼内丹」留作纪念。');
        addDaoBaseExp(state, '气运', Rng.int(3, 8), logs);
      }
      return { logs };
    },
  },
  {
    id: 'caravan', weight: 8, regionBoost: { zhongzhou: 1.5, beiming: 1.4 },
    run(state) {
      const logs = [];
      const goods = Rng.pick([
        { 名称: '聚气丹', 类型: '丹药', 数量: 2, effect: { exp: 90 }, 描述: '服用后修为 +90。', 价值: 80 },
        { 名称: '地火引', 类型: '消耗品', 数量: 1, effect: { craft: 15 }, 描述: '百艺配方制作时额外产出 1 件（自动消耗）。', 价值: 90 },
        { 名称: '驭兽香', 类型: '消耗品', 数量: 1, effect: { tame: 20 }, 描述: '提高下一次收服灵兽成功率。', 价值: 70 },
      ]);
      if (storeItem(state, goods)) logs.push(`路遇一支商队，你以公道价淘得「${goods.名称}」。`);
      else logs.push(`商队有「${goods.名称}」出售，储物袋已满只得作罢。`);
      return { logs };
    },
  },
  {
    id: 'stele', weight: 7, regionBoost: { xiji: 1.4 },
    run(state) {
      const logs = [];
      const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);
      if (tech) { tech.经验 += 80; const need = tech.等级 * 20; if (tech.经验 >= need) { tech.经验 -= need; tech.等级 += 1; logs.push(`残碑功法暗合你所学，《${tech.名称}》突破至第${tech.等级}层！`); } else logs.push('你临摹残碑上的古法符文，功法经验+80。'); }
      addDaoBaseExp(state, '悟性', Rng.int(8, 18), logs);
      logs.push('荒野中立着半截残碑，苔痕之下隐约有功法真意流转。');
      return { logs };
    },
  },
  {
    id: 'vein', weight: 8, regionBoost: { nanming: 1.3 },
    run(state) {
      const logs = [];
      const f = Rng.int(50, 220) * Math.max(1, Math.round(state.player.level / 6));
      addStones(state, f);
      logs.push(`你探入一处灵脉地穴，掘得零散灵石约${f}枚。`);
      if (state.player.daoYun.id === 'weibu') addDaoYunExp(state, Rng.int(4, 10), logs);
      return { logs };
    },
  },
  {
    id: 'blackmarket', weight: 6, regionBoost: { nanming: 1.6, haiwai: 1.3 },
    run(state) {
      const logs = [];
      const item = Rng.pick([
        { 名称: '聚灵阵旗', 类型: '消耗品', 数量: 1, effect: { cultivateBoostMonths: 1 }, 描述: '下次修炼效率提升（+15%，持续1月）。', 价值: 180 },
        { 名称: '低阶护身符', 类型: '消耗品', 数量: 1, effect: { ward: true }, 描述: '下一次战斗失败时减轻损失。', 价值: 110 },
        { 名称: '远航凭证', 类型: '消耗品', 数量: 1, effect: { travel: 50 }, 描述: '下次跨域旅行费用减半。', 价值: 160 },
      ]);
      if (storeItem(state, item)) logs.push(`暗巷里的黑市摊主向你兜售「${item.名称}」，价码倒也实在。`);
      else logs.push(`黑市有「${item.名称}」可买，储物袋已满只好离去。`);
      return { logs };
    },
  },
  {
    id: 'xianyuan', weight: 4, regionBoost: { haiwai: 2.2 },
    run(state) {
      const logs = [];
      const xian = { 名称: '仙缘·太初之气', 类型: '材料', 数量: 1, 描述: '传说中的仙缘之物，可遇不可求。', 价值: 300 };
      if (storeItem(state, xian)) logs.push('雾散处一座仙岛虚影浮现，岛上飘来一缕「太初之气」，被你纳入玉瓶！');
      else logs.push('仙岛虚影送来「太初之气」，储物袋已满只能望气兴叹。');
      addDaoBaseExp(state, '气运', Rng.int(15, 30), logs);
      addDaoBaseExp(state, '悟性', Rng.int(10, 20), logs);
      if (state.player.daoYun.id === 'mingcha') addDaoYunExp(state, Rng.int(12, 22), logs);
      return { logs };
    },
  },
  {
    id: 'cache', weight: 7,
    run(state) {
      const logs = [];
      const eq = generateEquip(state, Rng.pick(['accessory', 'pants', 'weapon']), Rng.int(2, 5), null);
      state.equipment.stash.push(eq);
      const f = Rng.int(20, 90);
      addStones(state, f);
      logs.push(`林间一具前辈遗骸旁，你取走「${eq.名称}」（${getEquipGrade(eq.品阶)?.name || eq.品阶}，战力+${eq.战力}）与灵石${f}枚，合十致意后将其安葬。`);
      return { logs };
    },
  },
  {
    id: 'relic_frag', weight: 5, regionBoost: { xiji: 1.3, nanming: 1.2 },
    run(state) {
      const logs = [];
      const frag = { 名称: '残片法宝', 类型: '材料', 数量: 1, 描述: '法宝残片，可在百艺·炼器「残片修复」中重铸为可用法宝（需辅以星砂）。', 价值: 60 };
      if (storeItem(state, frag)) logs.push('残垣断壁间，你拾得一截「法宝残片」，虽失灵性，仍可熔炼重铸。');
      else logs.push('废墟中似有「法宝残片」，储物袋已满只得作罢。');
      return { logs };
    },
  },
  {
    id: 'plain', weight: 9,
    run(state) {
      const logs = [];
      addDaoBaseExp(state, '道心', Rng.int(3, 8), logs);
      logs.push('本月游历平淡无奇，但也览尽山川，心情舒畅，道心微长。');
      return { logs };
    },
  },
];

/** 海域（可享海行套装加成的地域）：海外仙岛与北冥瀚海 */
export const SEA_REGIONS = ['haiwai', 'beiming'];

/**
 * 海行无阻（2件）：海外事件收益倍率（seaBonus）。仅在海域游历时生效。
 * @returns {number} 1 表示无加成，1.3 表示收益 +30%
 */
export function seaEventBonusMul(flags, regionId) {
  const f = flags || {};
  if (!SEA_REGIONS.includes(regionId)) return 1;
  return 1 + Number(f.seaBonus || 0);
}

/**
 * 海行圆满（3件）：海上奇遇权重倍率（seaChance）。
 * 在海域中把「风化洞府（遗府残图）」与「仙缘使者」两类奇遇的抽取权重翻倍，
 * 兑现文案「可触发海上奇遇，有概率发现遗府入口」。
 */
export function seaEventWeightMul(flags, eventId, regionId) {
  const f = flags || {};
  if (!f.seaChance) return 1;
  if (!SEA_REGIONS.includes(regionId)) return 1;
  return (eventId === 'cave' || eventId === 'xianyuan') ? 2 : 1;
}

/** 按区域加权抽取一个游历事件并执行 */
export function resolveWanderEvent(state) {
  const regionId = state.world.regionId || 'zhongzhou';
  // 驱虫粉（岭南百越坊市可购，effect.explore）：持有则消耗 1 份，本次游历风险降低（消除死道具）。
  // 仅岭南百越雨林生效（其余地域本就少毒虫），确定性、无 RNG，测试无 flaky。
  let bugPowderApplied = false;
  if (regionId === 'lingnan') {
    const bugIdx = state.items.findIndex((i) => i.名称 === '驱虫粉');
    if (bugIdx >= 0) {
      const bug = state.items[bugIdx];
      bug.数量 -= 1;
      if (bug.数量 <= 0) state.items.splice(bugIdx, 1);
      bugPowderApplied = true;
    }
  }
  const seaFlags = setBonusFlags(state);
  const stonesBefore = totalStones(state);
  const weighted = WANDER_EVENTS.map((e) => {
    let w = e.weight;
    const boost = e.regionBoost && e.regionBoost[regionId];
    if (boost) w *= boost;
    w *= seaEventWeightMul(seaFlags, e.id, regionId); // 海行圆满（3件）：海域中更易触发海上奇遇 / 遗府入口
    // 驱虫粉生效时，所有游历事件权重整体抬升（更易触发机缘/采集，稀释负面遭遇）
    if (bugPowderApplied) w *= 1.25;
    return { ...e, weight: w };
  });
  const ev = Rng.weighted(weighted);
  let res;
  try { res = ev.run(state) || { logs: [] }; } catch (err) { res = { logs: ['游历途中发生了一点意外，但你安然归来。'] }; }
  if (bugPowderApplied) {
    res.logs = res.logs || [];
    res.logs.unshift('你撒出「驱虫粉」，雨林毒虫退散，此行更添安稳（消耗驱虫粉×1）。');
  }
  // 海行无阻（2件）：海外事件收益 +30% —— 按本次事件净增灵石补发，确定性、不改事件内部实现
  const seaMul = seaEventBonusMul(seaFlags, regionId);
  if (seaMul > 1) {
    const gained = totalStones(state) - stonesBefore;
    if (gained > 0) {
      const extra = Math.round(gained * (seaMul - 1));
      if (extra > 0) {
        addStones(state, extra);
        res.logs = res.logs || [];
        res.logs.push(`海行套装护持，海路收益更丰：灵石额外 +${extra}。`);
      }
    }
  }
  return res;
}

/**
 * 观星卜算·星盘点评（确定性，状态感知）。
 * 依据玩家当前处境给出一句具体可执行的修行建议，不依赖 RNG，故测试无 flaky。
 * @param {object} state
 * @returns {string}
 */
export function divinationFortune(state) {
  const p = state.player || {};
  const w = state.world || {};
  const garden = (state.cave && Array.isArray(state.cave.garden)) ? state.cave.garden : [];
  const tox = Number(state.flags?.pillToxicity || 0);
  if (typeof p.lifespan === 'number' && typeof p.age === 'number' && p.lifespan - p.age <= 15) {
    return '命星黯淡，寿元将尽——速寻延寿仙丹或冲击大境界，方可逆转乾象。';
  }
  if (tox >= 30) {
    return '丹毒如附骨之疽，星盘示警：宜停炉服丹以化毒，莫贪速成而损道基。';
  }
  const ripe = garden.filter((h) => h.progress >= h.grow).length;
  if (ripe > 0) {
    return `洞府灵草 ${ripe} 株已熟，星辉指引：择晴日采收，方得药性全盛。`;
  }
  const growing = garden.filter((h) => h.progress < h.grow).length;
  if (growing > 0) {
    return '灵田尚需滋养，星盘显象：可引灵泉浇灌，促其早结灵果。';
  }
  if (totalStones(state) < 200) {
    return '财库星光微弱，宜远游历练或入市易货，积攒修行资粮。';
  }
  const y = p.daoYun;
  if (y && y.id !== 'none' && y.level < 10 && y.exp >= y.level * 100 * 0.8) {
    return '道韵将圆满，星象昭昭：闭关静修可一举破关，慎勿外骛。';
  }
  const pool = DIVINATION.fortunes;
  return pool[w.year % pool.length];
}

/** 执行罗盘行动。返回 { logs, battle? , breakthrough? } */
export function performAction(state, option, extra = {}) {
  const a = option.action;
  const logs = [];
  let battle = null, breakthrough = null;
  addLog(state, '操作', `本月行动：${option.title}`);

  switch (a.type) {
    case 'cultivate': {
      const r = cultivate(state, a.mode || 'normal');
      logs.push(...r.logs);
      break;
    }
    case 'study': {
      const tech = state.techniques.find((t) => t.名称 === state.player.mainTechnique);
      const g = TECHNIQUE_GRADES.find((x) => x.name === (tech?.品级 || '凡品'));
      if (tech && tech.等级 < g.maxLv) {
        tech.经验 += 40;
        const need = tech.等级 * 20;
        if (tech.经验 >= need) { tech.经验 -= need; tech.等级 += 1; logs.push(`《${tech.名称}》悟至第${tech.等级}层！`); }
        else logs.push(`你研读《${tech.名称}》，功法经验+40。`);
      } else logs.push('功法已至当前瓶颈，难以寸进。');
      addDaoBaseExp(state, '悟性', Rng.int(8, 15), logs);
      if (state.player.daoYun.id === 'guomu') addDaoYunExp(state, Rng.int(8, 15), logs);
      break;
    }
    case 'explore': {
      if (a.kind === 'hunt') {
        battle = { enemy: makeEnemy(state, { beast: true }), type: 'yaoshou', intro: '历练途中，一头妖兽拦住了你的去路！' };
      } else {
        // 游历四方：从丰富事件池抽取，小概率仍会惊起妖兽
        const res = resolveWanderEvent(state);
        logs.push(...(res.logs || []));
        if (res.battle) battle = res.battle;
        else if (Rng.chance(0.12)) {
          battle = { enemy: makeEnemy(state, { beast: true }), type: 'yaoshou', intro: '游历途中惊起一头妖兽，只得拔剑应战！' };
        }
        // 游历亦可能邂逅新的道缘之人（#65 逐步结识）
        if (Rng.chance(0.35)) {
          const met = revealNpc(state);
          if (met) { logs.push(`游历途中，你结识了${met.race}${met.job}「${met.name}」，从此多了一段道缘。`); addLog(state, '事件', `于游历中结识「${met.name}」。`); }
        }
      }
      const r = cultivate(state, 'normal'); // 历练附带少量修炼
      logs.push(`历练之余修行不辍，修为+${r.gain}。`);
      break;
    }
    case 'event': {
      if (a.kind === 'watch') {
        addDaoBaseExp(state, '悟性', Rng.int(15, 30), logs);
        logs.push('你观摩宗门大比，各家功法招式尽收眼底，悟性大涨。');
      } else if (a.kind === 'mystic') {
        if (Rng.chance(0.5)) {
          battle = { enemy: makeEnemy(state, { beast: true, stronger: true }), type: 'yaoshou', intro: '秘境深处，护宝妖兽猛然苏醒！' };
        } else {
          const found = Rng.int(100, 400);
          addStones(state, found);
          const art = generateEquip(state, 'artifact', Rng.int(5, 7), Rng.pick(ARTIFACT_NAMES));
          state.equipment.stash.push(art);
          logs.push(`秘境探索大有所获！灵石+${found}，拾得稀有法宝「${art.名称}」（${getEquipGrade(art.品阶)?.name || art.品阶}，战力+${art.战力}）。`);
          if (state.player.daoYun.id === 'mingcha') addDaoYunExp(state, Rng.int(10, 18), logs);
        }
      }
      break;
    }
    case 'destiny': {
      const r = advanceDestiny(state);
      logs.push(...r.logs);
      break;
    }
    case 'skipDestiny': {
      state.destiny.status = '已等待';
      state.destiny.waitYears += 0; // 年份在跨年时累计
      logs.push('你选择了暂避天命。天命不催人，静待来年。');
      const r = cultivate(state, 'normal');
      logs.push(...r.logs);
      break;
    }
    case 'breakthrough': {
      breakthrough = attemptBreakthrough(state);
      logs.push(...breakthrough.logs);
      break;
    }
    case 'upgradeCave': {
      const cost = (state.cave.level + 1) * CAVE_UPGRADE_BASE;
      if (spendStones(state, cost)) {
        state.cave.level += 1;
        state.cave.name = CAVE_LEVELS[state.cave.level].name;
        state.cave.bonus = CAVE_LEVELS[state.cave.level].bonus;
        logs.push(`洞府升级成功！现为「${state.cave.name}」，修炼加成+${Math.round(state.cave.bonus * 100)}%。`);
      } else logs.push('灵石不足，升级作罢。');
      break;
    }
    case 'upgradeHerbSpring': {
      const r = upgradeHerbSpring(state);
      logs.push(...r.logs);
      break;
    }
    case 'social': {
      const npc = state.npcs.find((n) => n.name === a.target);
      if (npc) logs.push(...interactNpc(state, npc, 'chat'));
      else {
        // 罗盘推送的拜访对象可能来自尚未结识的潜在道缘：本次往来即视为初识（#65）
        const pending = state.npcs.find((n) => n.name === a.target && !n.met);
        if (pending) {
          pending.met = true;
          logs.push(`你主动寻访，与${pending.race}${pending.job}「${pending.name}」初识，开启一段新的道缘。`);
          addLog(state, '事件', `主动结识「${pending.name}」。`);
          logs.push(...interactNpc(state, pending, 'chat'));
        }
      }
      break;
    }
    case 'mystic': {
      const r = exploreMysticRealm(state, a.realmId, extra.depth || 1);
      logs.push(...r.logs);
      if (r.battle) battle = r.battle;
      if (r.hiddenEvent) { /* 深处隐藏奇遇，由 UI 接管 */ extra.hiddenEvent = r.hiddenEvent; }
      break;
    }
    case 'sectRealm': {
      const r = exploreSectRealm(state, extra.depth || 1);
      logs.push(...r.logs);
      break;
    }
    case 'specialEvent': {
      const evt = SPECIAL_EVENTS.find((e) => e.id === a.eventId);
      if (evt) {
        const r = resolveSpecialEvent(state, evt, 0);
        logs.push(...r.logs);
        if (r.battle) battle = r.battle;
      }
      break;
    }
    case 'divination': {
      const cost = DIVINATION.cost;
      if (!spendStones(state, cost)) { logs.push('灵石不足，无法请动星盘。'); break; }
      state.flags = state.flags || {};
      // 先结算当月确定性收益，再置运势，避免自身当月收益被运势二次放大
      addDaoYunExp(state, DIVINATION.daoYun, logs);
      addDaoBaseExp(state, '悟性', DIVINATION.wuxing, logs);
      const fortune = divinationFortune(state);
      const omen = Rng.pick(DIVINATION.omens);
      const w = state.world;
      let ey = w.year, em = w.month + 1;
      if (em > 12) { em = 1; ey += 1; }
      state.flags.omen = { kind: omen.id, icon: omen.icon, label: omen.label, desc: omen.desc, mul: omen.mul || 1, add: omen.add || 0, expireYear: ey, expireMonth: em };
      logs.push(`你布下星盘，夜观天象。${fortune}`);
      logs.push(`星辉入体，道韵经验+${DIVINATION.daoYun}，悟性经验+${DIVINATION.wuxing}。`);
      logs.push(`天机流照，下月得「${omen.icon}${omen.label}」运势：${omen.desc}（生效至 ${ey}年${em}月）。`);
      break;
    }
    case 'refinePill': {
      const r = refinePill(state, option.recipeId, option);
      (r.logs || []).forEach((l) => logs.push(l));
      break;
    }
    case 'taichuXianyuan': {
      // 仙缘·太初之气：兑换绝世机缘（确定性收益，无 RNG、无战斗风险）
      const held = state.items.filter((i) => i.名称 === '仙缘·太初之气');
      const cnt = held.reduce((s, i) => s + (i.数量 || 1), 0);
      if (cnt < 1) { logs.push('你手中尚无「仙缘·太初之气」，无缘兑换。'); break; }
      const it = held[0];
      it.数量 -= 1;
      if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      gainExp(state, 2000, logs);
      addDaoYunExp(state, 40, logs);
      addDaoBaseExp(state, '悟性', 25, logs);
      addStones(state, 800);
      // 赠天品功法《太虚剑经》；已持有则改赠灵石
      if (!state.techniques.some((t) => t.名称 === '太虚剑经')) {
        state.techniques.push({ 名称: '太虚剑经', 品级: '天品', 等级: 1, 经验: 0 });
        logs.push('🌟 仙缘使者颔首，赠你天品功法《太虚剑经》一部，剑意可震慑低阶妖兽。');
      } else {
        addStones(state, 1200);
        logs.push('🌟 仙缘使者见你已通《太虚剑经》，改赠下品灵石 1200 以助道途。');
      }
      logs.push('✨ 太初仙缘加身，修为+2000、道韵+40、悟性+25、下品灵石+800。一段绝世机缘就此圆满。');
      break;
    }
    case 'xianyuanExchange': {
      // 仙缘：于罗盘「仙缘兑换」换得道途助益（确定性收益，无 RNG、无风险）
      const held = state.items.filter((i) => i.名称 === '仙缘');
      const cnt = held.reduce((s, i) => s + (i.数量 || 1), 0);
      if (cnt < 1) { logs.push('你手中尚无「仙缘」，无缘兑换。'); break; }
      const it = held[0];
      it.数量 -= 1;
      if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      gainExp(state, 200, logs);
      addDaoYunExp(state, 15, logs);
      addDaoBaseExp(state, '悟性', 20, logs);
      addStones(state, 300);
      logs.push('✨ 仙缘加身，修为+200、道韵+15、悟性+20、下品灵石+300。一段寻常机缘就此落定。');
      break;
    }
    /* market / art / socialList / auction / tameBeast / sectTask 由 UI 打开子界面处理，不在此处结算 */
    default:
      logs.push('本月你按照自己的心意行动，岁月静好。');
  }
  refreshDerived(state);
  return { logs, battle, breakthrough };
}

/* ============================================================
 * 十、NPC 道缘互动
 * ========================================================== */
/* ---------------- 道友委托（支线闭环） ----------------
 * 道友级（relation>=3）NPC 可按其职业托付一份「交付类委托」：交付指定材料即获确定性奖励。
 * 完成后进入冷却，防止无限刷取，使委托成为持续但克制的长期玩法。*/
export const COMMISSION_COOLDOWN = 3;

// 护身类道具（败北时自动消耗一件替你挡灾）：用于英雄卡常驻展示
// 名称与 resolveBattle 的 wardKind 判定保持一致（高阶护身符挡重伤+护灵石，其余挡重伤）
export const WARD_ITEM_NAMES = ['护身符', '低阶护身符', '低阶符箓', '简易阵旗', '兽皮护符'];
export function wardItems(state) {
  return (state.items || []).filter((x) => WARD_ITEM_NAMES.includes(x.名称));
}

function countItem(state, name) {
  return (state.items || []).filter((x) => x.名称 === name).reduce((s, x) => s + (Number(x.数量) || 1), 0);
}

function removeItemByName(state, name, n) {
  let left = n;
  for (const it of state.items) {
    if (left <= 0) break;
    if (it.名称 === name) {
      const take = Math.min(left, Number(it.数量) || 1);
      it.数量 -= take; left -= take;
    }
  }
  state.items = state.items.filter((x) => (Number(x.数量) || 0) > 0);
  state.inventory.used = inventoryUsed(state);
}

export function commissionInfo(state, npc) {
  const task = COMMISSION_TASKS[npc.job] || COMMISSION_TASKS['散修'];
  const onCd = npc.commissionCd != null && npc.commissionCd > state.world.turns;
  const available = (npc.relation || 0) >= 3 && !onCd;
  const have = available ? countItem(state, task.item) : 0;
  return { task, available, have, need: task.need, cdRemaining: onCd ? (npc.commissionCd - state.world.turns) : 0 };
}

/**
 * 道友委托回赠奖励的确定性预览文案（与 applyCommissionReward 同口径，无 RNG）。
 * 委托是「投资型决策」，玩家此前只见所需材料、不知回赠内容，属信息盲区；
 * 现补确定性预览，延续「信息透明·确定性预览」主题。
 */
export function commissionRewardPreview(task) {
  const r = task && task.reward;
  if (!r) return '无';
  if (r.type === 'stones') return `灵石 +${r.amount}`;
  if (r.type === 'item') return `${r.名称} ×${r.数量 || 1}`;
  if (r.type === 'equip') {
    const slotName = EQUIP_SLOTS.find((s) => s.id === r.slot)?.name || '装备';
    return `随机${slotName}（Lv.${r.level}）`;
  }
  if (r.type === 'exp') return `${r.base} 道基经验 +${r.amount}`;
  return '未知回赠';
}

function applyCommissionReward(state, task, npc, logs) {
  const r = task.reward;
  if (r.type === 'stones') {
    addStones(state, r.amount);
    logs.push(`「${npc.name}」如约相酬，灵石+${r.amount}。`);
  } else if (r.type === 'item') {
    const it = { ...r }; delete it.type;
    if (storeItem(state, it)) {
      logs.push(`「${npc.name}」收下${task.item}，回赠${r.名称}x${r.数量 || 1}，已收入储物袋。`);
      discoverItem(state, { 名称: r.名称, 类型: r.类型 });
    } else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
  } else if (r.type === 'equip') {
    const eq = generateEquip(state, r.slot, r.level);
    state.equipment.stash.push(eq);
    logs.push(`「${npc.name}」回赠${eq.名称}（${getEquipGrade(eq.品阶)?.name || eq.品阶}，战力+${eq.战力}）！`);
  } else if (r.type === 'exp') {
    addDaoBaseExp(state, r.base, r.amount, logs);
    logs.push(`一番奔走，你对「${r.base}」之道颇有所得。`);
  }
}

export function interactNpc(state, npc, kind) {
  ensureLifeState(state);
  const logs = [];
  const p = state.player;
  switch (kind) {
    case 'chat': {
      const gain = Rng.int(5, 15);
      npc.favor = Math.min(100, npc.favor + gain);
      npc.lastMeet = state.world.turns;
      logs.push(`你与「${npc.name}」煮茶论道，相谈甚欢。好感+${gain}（当前${npc.favor}）。`);
      if (p.daoYun.id === 'qiqiao') addDaoYunExp(state, Rng.int(5, 12), logs);
      break;
    }
    case 'gift': {
      const cost = 50;
      if (!spendStones(state, cost)) { logs.push('灵石不足，送礼作罢。'); break; }
      const gain = Rng.int(10, 20);
      npc.favor = Math.min(100, npc.favor + gain);
      npc.lastMeet = state.world.turns;
      logs.push(`你备厚礼登门拜访「${npc.name}」，对方喜笑颜开。好感+${gain}。`);
      break;
    }
    case 'lundao': {
      const npcLv = npc.level || 10;
      const win = Rng.chance(Math.min(0.9, Math.max(0.2, 0.5 + (p.daoBase['悟性'].level - npcLv) / 50)));
      if (win) {
        npc.favor = Math.min(100, npc.favor + 12);
        addDaoBaseExp(state, '悟性', Rng.int(10, 20), logs);
        logs.push(`你与「${npc.name}」论道三日，技高一筹！对方心服口服，好感+12。`);
        if (p.daoYun.id === 'daoyin') addDaoYunExp(state, Rng.int(8, 15), logs);
      } else {
        npc.favor = Math.min(100, npc.favor + 5);
        addDaoBaseExp(state, '悟性', Rng.int(5, 10), logs);
        logs.push(`论道惜败于「${npc.name}」，但也受益匪浅。好感+5。`);
      }
      npc.lastMeet = state.world.turns;
      break;
    }
    case 'invite': {
      if ((npc.relation || 0) < 3) { logs.push('关系尚未达到「道友」，对方婉拒了同行邀约。'); break; }
      npc.lastMeet = state.world.turns;
      state.flags.companion = npc.name;
      logs.push(`「${npc.name}」答应与你同行三个月。历练战斗时对方会提供援助。`);
      state.flags.companionMonths = 3;
      break;
    }
    case 'qiecuo': {
      // 切磋对手（道友）战力跟随玩家综合战力浮动，避免后期切磋必胜、失去意义
      const ratio = Rng.float(0.9, 1.15);
      const enemyPower = Math.max(1, Math.round(state.player.power * ratio));
      return { battle: { enemy: { name: npc.name, level: npc.level || state.player.level, power: enemyPower, realm: npc.realm }, type: 'qiecuo', intro: `你与「${npc.name}」相约切磋，点到为止。`, npcName: npc.name }, logs };
    }
    case 'deep': {
      // 深度互动：需达「道友」（relation>=3）。职业专属支线 + 更高好感收益
      if ((npc.relation || 0) < 3) {
        logs.push(`与「${npc.name}」尚不够熟稔，难于深谈（需达「道友」）。`);
        break;
      }
      const gain = Rng.int(18, 30);
      npc.favor = Math.min(100, npc.favor + gain);
      npc.lastMeet = state.world.turns;
      npc.mood = '推心';
      logs.push(`你与「${npc.name}」秉烛夜话，剖白道途心迹。好感+${gain}（当前${npc.favor}）。`);
      const ev = DEEP_NPC_EVENTS[npc.job] || DEEP_NPC_EVENTS['散修'];
      logs.push(`【${npc.name}的心事】${ev.text}`);
      // 六成概率触发专属馈赠
      if (Rng.chance(0.6)) {
        const r = ev.reward;
        if (r.type === 'stones') {
          const s = Rng.int(r.min, r.max); addStones(state, s);
          logs.push(`「${npc.name}」以私藏相济，灵石+${s}。`);
        } else if (r.type === 'item') {
          const it = { ...r }; delete it.type;
          if (storeItem(state, it)) {
            logs.push(`「${npc.name}」赠你${r.名称}×${r.数量 || 1}，已收入储物袋。`);
            discoverItem(state, { 名称: r.名称, 类型: r.类型 });
          } else logs.push(`储物袋已满，「${npc.name}」所赠${r.名称}未能带走。`);
        } else if (r.type === 'equip') {
          const eq = generateEquip(state, r.slot, r.level);
          state.equipment.stash.push(eq);
          logs.push(`「${npc.name}」赠你${eq.名称}（${getEquipGrade(eq.品阶)?.name || eq.品阶}，战力+${eq.战力}）！`);
        } else if (r.type === 'exp') {
          addDaoBaseExp(state, r.base, Rng.int(r.min, r.max), logs);
          logs.push(`一番深谈，你对「${r.base}」之道颇有所得。`);
        }
      } else {
        logs.push(`今夜只叙旧，未及馈赠，亦觉心意相通。`);
      }
      break;
    }
    case 'commission': {
      if ((npc.relation || 0) < 3) {
        logs.push(`与「${npc.name}」尚不够熟稔，对方无意相托委托。`);
        break;
      }
      const ctask = COMMISSION_TASKS[npc.job] || COMMISSION_TASKS['散修'];
      if (npc.commissionCd != null && npc.commissionCd > state.world.turns) {
        logs.push(`「${npc.name}」的委托尚在筹措中（还需 ${npc.commissionCd - state.world.turns} 个月方可再托）。`);
        break;
      }
      const have = countItem(state, ctask.item);
      if (have < ctask.need) {
        logs.push(`「${npc.name}」托你寻${ctask.need}份「${ctask.item}」，你手中仅有${have}份，暂难交差。`);
        break;
      }
      removeItemByName(state, ctask.item, ctask.need);
      npc.lastMeet = state.world.turns;
      npc.mood = '托付';
      applyCommissionReward(state, ctask, npc, logs);
      npc.commissionCd = state.world.turns + COMMISSION_COOLDOWN;
      logs.push(`你向「${npc.name}」交付了${ctask.need}份「${ctask.item}」，了结一桩委托。`);
      break;
    }
  }
  // 关系层级晋升

  npc.meetCount = (npc.meetCount || 0) + 1;
  npc.mood = kind === 'gift' ? '欣喜' : kind === 'lundao' ? '振奋' : '亲近';
  const lv = relationIndex(npc.favor);
  if (lv > (npc.relation || 0)) {
    npc.relation = lv; npc.relationName = DAOYUAN_LEVELS[lv];
    const benefit = relationBenefit(npc.favor);
    logs.push(`你与「${npc.name}」的关系晋升为「${npc.relationName}」：${benefit.benefit}`);
    if (lv >= 3 && !npc.skill) {
      npc.skill = NPC_SKILLS[npc.job] || NPC_SKILLS['散修'];
      logs.push(`解锁道友之能：${npc.skill}`);
    }
  }
  if (npc.relation >= 3 && kind !== 'qiecuo' && Rng.chance(0.25)) {
    const gift = { 名称: `${npc.name}的回礼`, 类型: '材料', 数量: 1, 描述: `${npc.job}赠予的地域材料。` };
    if (storeItem(state, gift)) logs.push(`「${npc.name}」回赠一份材料，已收入储物袋。`);
  }
  addLog(state, '操作', `与「${npc.name}」往来（${kind === 'chat' ? '叙旧' : kind === 'gift' ? '送礼' : '论道'}），好感${npc.favor}。`);
  makeChronicle(state, { type: '道缘', title: `与${npc.name}往来`, text: logs.join('') });
  return logs;
}

/* ============================================================
 * 十一、坊市（买/卖）
 * ========================================================== */
/** 生成本月货架（分类更丰富：丹药含品阶、装备细分六部位、材料/消耗/功法/服务） */
export function shopStock(state) {
  ensureLifeState(state);
  if (state.world.market.refreshTurn === state.world.turns && state.world.market.stock.length) return state.world.market.stock;
  const lv = state.player.level;
  const regional = REGION_MARKET[state.world.regionId] || REGION_MARKET.zhongzhou;
  const stock = [];
  // —— 丹药（区分品阶）——
  stock.push({ 名称: '聚气丹', 类型: '丹药', 品阶: 'zhong', 价格: 35, 价值: 30, 描述: '服用后修为+80。', effect: { exp: 80 } });
  stock.push({ 名称: '凝血丹', 类型: '丹药', 品阶: 'zhong', 价格: 45, 价值: 40, 描述: '清除全部伤势。', effect: { heal: true } });
  const tribGrade = rollPillGrade(state.player.daoBase['气运'].level / 40);
  const tribBonus = Math.round(15 * tribGrade.tribMul);
  stock.push({ 名称: '渡劫丹', 类型: '丹药', 品阶: tribGrade.id, 价格: Math.round(220 * tribGrade.priceMul), 价值: Math.round(180 * tribGrade.priceMul), 描述: `渡劫时服用，成功率+${tribBonus}%（${tribGrade.name}）。`, effect: { tribulation: 15 } });
  // 各瓶颈专属丹药（按当前境界解锁）
  const tribPills = [
    { min: 15, max: 25, 名称: '筑基丹', 描述: '筑基渡劫专属，成功率+20%。' },
    { min: 35, max: 45, 名称: '结丹丹', 描述: '结丹渡劫专属，成功率+20%。' },
    { min: 55, max: 65, 名称: '元婴丹', 描述: '丹破婴生专属，成功率+20%。' },
    { min: 75, max: 85, 名称: '化神丹', 描述: '法则初悟专属，成功率+20%。' },
    { min: 90, max: 99, 名称: '九转金丹', 描述: '飞升之劫专属，成功率+20%。' },
  ];
  for (const tp of tribPills) {
    if (lv >= tp.min && lv <= tp.max) stock.push({ 名称: tp.名称, 类型: '丹药', 品阶: 'shang', 价格: 800, 价值: 700, 描述: tp.描述, breakthrough: true, effect: { exp: 150 } });
  }
  // —— 区域特产 ——
  // 区域特产：装备类商品同样锁定生成对象（展示即所得），并保留原风味描述；其余类型原样入列。
  regional.forEach((g) => {
    if (g.type === '装备') {
      const slot = g.slot || guessEquipSlot({ 名称: g.name, 类型: '装备' });
      const item = generateEquip(state, slot, g.level || 1);
      stock.push({ 名称: g.name, 类型: '装备', 部位: slot, 等级: g.level || 1, 品阶: item.品阶, 价格: g.price, 价值: Math.round(g.price * 0.7), 描述: g.desc, effect: {}, _equip: item });
    } else {
      stock.push({ 名称: g.name, 类型: g.type, 价格: g.price, 价值: Math.round(g.price * 0.7), 等级: g.level, 部位: g.slot, 描述: g.desc, effect: g.effect });
    }
  });
  // —— 装备细分（六部位各一件，可于行囊装备）——
  // 关键修复：此前货架展示的「战力」由随机生成得到，但购买时 buyItem 又重新随机生成一件，
  // 导致「看到的战力」与「买到的」不一致（买亏却不自知）。现改为生成即锁定：把生成的装备
  // 对象存入 _equip，购买时直接发放这一件（展示即所得）；并供货架渲染「与当前同部位对比」徽标。
  const gearLv = Math.min(5, Math.max(1, Math.round(lv / 12)));
  const gearGrade = getEquipGradeByLevel(gearLv);
  for (const slot of EQUIP_SLOTS) {
    const item = generateEquip(state, slot.id, gearLv);
    stock.push({ 名称: item.名称, 类型: '装备', 部位: slot.id, 等级: gearLv, 品阶: item.品阶, 价格: gearLv * gearLv * 130 + 40, 价值: Math.round((gearLv * gearLv * 130 + 40) * 0.7), 描述: item.描述, effect: {}, _equip: item });
  }
  if (Rng.chance(0.5)) {
    const art = generateEquip(state, 'artifact', gearLv + 1, Rng.pick(ARTIFACT_NAMES));
    stock.push({ 名称: art.名称, 类型: '法宝', 部位: 'artifact', 等级: gearLv + 1, 品阶: art.品阶, 价格: Math.round(art.战力 * 40), 价值: Math.round(art.战力 * 28), 描述: `法宝（${EQUIP_GRADES.find((g) => g.id === art.品阶)?.name}），战力+${art.战力}。`, effect: {}, _equip: art });
  }
  // —— 功法 ——
  const grade = lv < 20 ? 'ling' : lv < 45 ? 'di' : 'tian';
  const gi = TECHNIQUE_GRADES.find((x) => x.id === grade);
  stock.push({ 名称: Rng.pick(TECHNIQUE_NAMES[grade]), 类型: '功法', 品级: gi.name, 价格: { 灵品: 200, 地品: 1200, 天品: 6000 }[gi.name], 价值: Math.round({ 灵品: 200, 地品: 1200, 天品: 6000 }[gi.name] * 0.7), 描述: `${gi.name}功法玉简，可直接修炼。` });
  // —— 服务 ——
  (() => {
    const nextCap = (state.inventory.capacity || 100) + 20;
    const nextGrade = bagGradeOf(nextCap);
    const curGrade = bagGradeOf(state.inventory.capacity || 100);
    const gradeHint = nextGrade.id !== curGrade.id ? `（进阶为${nextGrade.name}）` : '';
    stock.push({ 名称: '储物袋扩容契', 类型: '服务', 价格: BAG_UPGRADE_BASE + (state.inventory.upgrades || 0) * BAG_UPGRADE_STEP, 价值: 0, 描述: `购买后行囊容量+20格，${nextCap}格。${gradeHint}`, effect: { bagUpgrade: 20 } });
  })();
  // 扩容储物袋：可购回行囊、服用即拓展容量 +20 格（与「储物袋扩容契」服务同效，便于囤积备用）
  stock.push({ 名称: '扩容储物袋', 类型: '道具', 价格: BAG_UPGRADE_BASE + (state.inventory.upgrades || 0) * BAG_UPGRADE_STEP, 价值: Math.round(BAG_UPGRADE_BASE * 0.6), 描述: '服用后行囊容量 +20 格（与坊市扩容契同效，可囤积备用）。', effect: { bag: 20 } });
  state.world.market = { stock, refreshTurn: state.world.turns };
  return stock;
}
export function buyItem(state, goods) {
  ensureLifeState(state);
  if (goods.类型 !== '服务' && !['装备', '功法'].includes(goods.类型)) {
    const probe = { 名称: goods.名称, 类型: goods.类型, 数量: 1, 描述: goods.描述, effect: goods.effect };
    if (!storeItem({ ...state, items: [...state.items], inventory: { ...state.inventory } }, probe)) return '储物袋空间不足，交易未成。';
  }
  if (!spendStones(state, goods.价格)) return '灵石不足，交易未成。';
  if (goods.类型 === '服务' && goods.effect?.bagUpgrade) {
    state.inventory.capacity += goods.effect.bagUpgrade;
    state.inventory.upgrades += 1;
    state.inventory.bagName = bagNameByCapacity(state.inventory.capacity, '乾坤储物袋');
  } else if (goods.类型 === '装备') {
    // 优先发放货架锁定的那一件（展示即所得）；无 _equip 时回退原随机生成（兼容兑换所/其它来源）
    const item = goods._equip || generateEquip(state, goods.部位 || guessEquipSlot({ 名称: goods.名称, 类型: '装备' }), goods.等级 || 1, goods.名称);
    state.equipment.stash.push(item);
  } else if (goods.类型 === '法宝') {
    const item = goods._equip || generateEquip(state, 'artifact', goods.等级 || 1, goods.名称);
    state.equipment.stash.push(item);
  } else if (goods.类型 === '功法') {
    // 2026-08-23：功法玉简若声明了 effect.technique，则按声明授予具体功法（如「基础功法玉简」→「基础吐纳术」），
    // 避免把玉简名本身当功法写入、且品级缺失导致战力兜底。无声明则沿用玉简名与货架品级。
    const tname = goods.effect?.technique || goods.名称;
    const tgrade = goods.品级 || '凡品';
    state.techniques.push({ 名称: tname, 品级: tgrade, 等级: 1, 经验: 0 });
    discoverItem(state, { 名称: tname, 类型: '功法' });
  } else {
    storeItem(state, { 名称: goods.名称, 类型: goods.类型, 数量: 1, 描述: goods.描述, effect: goods.effect });
  }
  if (state.player.daoYun.id === 'qihuo') addDaoYunExp(state, Rng.int(4, 8));
  refreshDerived(state);
  addLog(state, '操作', `坊市购入「${goods.名称}」，花费灵石${goods.价格}。`);
  makeChronicle(state, { type: '坊市', title: '坊市交易', text: `在${state.world.region}购入「${goods.名称}」，花费灵石${goods.价格}。` });
  return goods.类型 === '服务' ? `储物袋扩容完成，现有 ${state.inventory.capacity} 格。` : `购得「${goods.名称}」，花费灵石${goods.价格}。`;
}
/** 坊市/兑换所购买时，装备/法宝与「当前同部位已装备」的战力对比（纯函数、不改动状态）。
 *  用于货架渲染智能徽标：🆕 新装备位 / 🟢 更强 / ⚪ 略逊当前 / ➖ 持平，帮助玩家判断是否有效提升，
 *  避免「随机重roll」导致的买亏而不自知。无 _equip 时回退用货架展示的 战力 字段。 */
export function marketCompare(state, goods) {
  if (!goods || (goods.类型 !== '装备' && goods.类型 !== '法宝')) return null;
  const slot = goods.类型 === '法宝' ? 'artifact' : (goods.部位 || guessEquipSlot({ 名称: goods.名称, 类型: '装备' }));
  const cur = state.equipment ? state.equipment[slot] : null;
  const curPow = cur ? (Number(cur.战力) || 0) : 0;
  const newPow = Number(goods.战力) || (goods._equip ? Number(goods._equip.战力) || 0 : 0);
  if (!cur) return { cls: 'new', tag: '🆕', text: '新装备位' };
  const diff = newPow - curPow;
  if (diff > 0) return { cls: 'up', tag: '🟢', text: `战力+${diff}（更强）` };
  if (diff < 0) return { cls: 'down', tag: '⚪', text: `战力${-diff}（略逊当前）` };
  return { cls: 'flat', tag: '➖', text: '持平' };
}

export function sellItem(state, idx) {
  ensureLifeState(state);
  const it = state.items[idx];
  if (!it) return '物品不存在。';
  if (it.类型 === '容器') return '当前储物袋正在使用，不能直接出售。';
  const regionalBonus = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(it.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;
  const newsMul = newsPriceMul(state, it);
  const base = it.价值 || (it.类型 === '材料' ? 35 : 15);
  const price = Math.max(1, Math.round(base * (it.数量 || 1) * regionalBonus * newsMul * Rng.float(0.92, 1.08) * omenMul(state, 'trade')));
  addStones(state, price);
  state.items.splice(idx, 1);
  ensureLifeState(state);
  const fluct = newsMul > 1 ? '（行情看涨，价格上扬）' : newsMul < 1 ? '（行情低迷，价格走低）' : '';
  addLog(state, '操作', `坊市售出「${it.名称}」，得灵石${price}。${fluct}`);
  return `售出「${it.名称}」，得灵石${price}。${fluct}`;
}
/** 批量出售：卖出所有满足 predicate 的可售物品（传 null/省略则出售全部非容器物品）。
 *  复用单件计价逻辑，从后往前删除避免索引偏移。返回 {count, stones, names}。 */
export function sellItems(state, predicate) {
  ensureLifeState(state);
  const targets = state.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.类型 !== '容器' && (!predicate || predicate(it)));
  if (!targets.length) return { count: 0, stones: 0, names: [] };
  let stones = 0;
  const names = [];
  // 从后往前删，避免 splice 引起的索引偏移
  for (const { i } of targets.slice().reverse()) {
    const it = state.items[i];
    if (!it) continue;
    const regionalBonus = (REGION_TRAVEL[state.world.regionId]?.specialty || '').includes(it.类型 === '材料' ? '材料' : '奇珍') ? 1.25 : 1;
    const newsMul = newsPriceMul(state, it);
    const base = it.价值 || (it.类型 === '材料' ? 35 : 15);
    const price = Math.max(1, Math.round(base * (it.数量 || 1) * regionalBonus * newsMul * Rng.float(0.92, 1.08) * omenMul(state, 'trade')));
    addStones(state, price);
    stones += price;
    names.push(it.名称);
    state.items.splice(i, 1);
  }
  ensureLifeState(state);
  addLog(state, '操作', `坊市批量售出 ${targets.length} 件物品，共得灵石${stones}。`);
  return { count: targets.length, stones, names };
}
/** 使用丹药（含丹毒系统） */
export function useItem(state, idx) {
  const it = state.items[idx];
  if (!it) return null;
  const logs = [];
  const isEquip = it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝';
  if (isEquip) {
    const equipData = it._equip || it;
    const slot = equipData.部位 || guessEquipSlot(it);
    const old = state.equipment[slot];
    const putOn = {
      名称: equipData.名称 || it.名称,
      品阶: equipData.品阶 || (typeof it.品阶 === 'string' ? it.品阶 : null),
      等级: equipData.等级 || it.等级 || 1,
      战力: equipData.战力 || it.战力 || 0,
      描述: equipData.描述 || it.描述 || '',
      类型: equipData.类型 || it.类型 || '装备',
      部位: slot,
    };
    state.equipment[slot] = putOn;
    if (old) {
      // 2026-08-19 修复：替换已有装备时，旧装备进入「备用」栏（stash），新装备从行囊移除。
      // 避免行囊格子被旧装备覆盖、导致备用/行囊来回堆叠的混乱与潜在复制感。
      if ((state.equipment.stash || []).length >= STASH_CAPACITY) {
        logs.push('备用栏已满，无法换装。请先清理备用装备。');
        return logs;
      }
      state.equipment.stash.push(old);
      state.items.splice(idx, 1);
      logs.push(`换装：${old.名称} 已放入备用栏。`);
    } else {
      state.items.splice(idx, 1);
    }
    discoverItem(state, putOn);
    refreshDerived(state);
    recalcRingCapacity(state);
    return logs.length ? logs : ['装备已更换。'];
  }
  if (!it.effect) return null;
  const setFlags = setBonusFlags(state);
  // 瓶颈专属丹（筑基丹等）与渡劫丹：留待突破 / 渡劫时由 attemptBreakthrough 自动消耗，不可直接服用
  if (it.breakthrough || (it.effect && typeof it.effect.tribulation === 'number')) {
    const kind = it.breakthrough ? '瓶颈专属丹' : '渡劫丹';
    return [`「${it.名称}」为${kind}，需在冲击瓶颈 / 渡劫时自动消耗，不宜直接服用（留于储物袋即可）。`];
  }
  // 地火引：百艺助燃剂，制作时自动消耗，不可直接服用（避免白扣）
  if (it.名称 === '地火引') {
    return ['「地火引」为百艺助燃剂，需在百艺制作时自动消耗，不宜直接服用（留于储物袋即可）。'];
  }
  if (it.effect.exp) {
    let expGain = it.effect.exp;
    // 丹药品质影响（物品带 quality 字段时按品质乘算）
    if (it.quality && it.quality.mult) expGain = Math.round(expGain * it.quality.mult);
    state.player.exp += expGain;
    logs.push(`你服下「${it.名称}」${it.quality ? `（${it.quality.grade}）` : ''}，修为+${expGain}。`);
    tryLevelUp(state, logs);
  }
  if (it.effect.heal) {
    state.flags.wounded = 0;
    state.flags.curedWounds = true;
    logs.push('伤势尽去，龙精虎猛。');
  }
  // 悟性经验（凝神丹等）
  if (it.effect.wuxing) {
    addDaoBaseExp(state, '悟性', it.effect.wuxing, logs);
    logs.push(`神思清明，悟性经验+${it.effect.wuxing}。`);
  }
  // 洗髓伐毛：随机提升一项道基（洗髓丹 / 炎玉丹 / 玉华丹）
  // 图鉴承诺「洗髓丹一生最多服用 2 颗」：仅对洗髓丹按当前轮回计数，满 2 则药力无从着落，
  // 本次服用失效（不消耗、不加道基），与延寿丹同口径；炎玉丹/玉华丹不受此限。
  if (it.effect.daoBase) {
    if (it.名称 === '洗髓丹') {
      const mTaken = state.player.marrowPillsTaken || 0;
      if (mTaken >= 2) {
        return [`「洗髓丹」一生至多可服 2 颗，你已服满（${mTaken} 颗），骨髓再难重塑，此丹暂难生效（留于储物袋即可）。`];
      }
      state.player.marrowPillsTaken = mTaken + 1;
    }
    const kb = it.effect.daoBase;
    const key = kb.keys[Rng.int(0, kb.keys.length - 1)];
    const amt = Rng.int(kb.min, kb.max);
    if (state.player.daoBase[key]) {
      state.player.daoBase[key].level += amt;
      logs.push(`洗髓伐毛，「${key}」道基 +${amt} 级。`);
    }
  }
  // 聚灵丹药力：未来若干月修炼效率提升
  if (it.effect.cultivateBoostMonths) {
    const m = it.effect.cultivateBoostMonths;
    state.flags.cultivateBoostMonths = Math.max(state.flags.cultivateBoostMonths || 0, m);
    logs.push(`灵力充盈，未来 ${m} 月修炼效率提升。`);
  }
  // 临时战力增益：服用后未来若干月战力临时提升（state.buffs.power），过期自动失效。
  // 此前该字段在 calcPower 中恒为 0（死字段），现接入真实丹药效果（如狂战丹），
  // 让「丹药增益」战力拆解项与英雄卡不再恒显「无」。
  if (it.effect.power) {
    const months = it.effect.powerMonths || 1;
    const cur = state.world.year * 12 + state.world.month;
    state.buffs = state.buffs || { power: 0, expireMonth: 0 };
    state.buffs.power = Math.max(state.buffs.power || 0, it.effect.power);
    state.buffs.expireMonth = Math.max(state.buffs.expireMonth || 0, cur + months);
    logs.push(`药力激荡，未来 ${months} 月战力临时 +${it.effect.power}。`);
  }
  // 延寿：提升寿元上限（延寿丹）——叠加持久加成 lifeBonus，避免被 refreshDerived 重算覆盖。
  // 图鉴承诺「一生最多服用 3 颗」：对延寿丹按当前轮回计数，满 3 则经脉难承、本次服用失效（不消耗、不累加）。
  if (it.effect.lifespan) {
    if (it.名称 === '延寿丹') {
      const taken = state.player.lifespanPillsTaken || 0;
      if (taken >= 3) {
        return [`「延寿丹」一生至多可服 3 颗，你已服满（${taken} 颗），经脉难承更多药力，此丹暂难生效（留于储物袋即可）。`];
      }
      state.player.lifespanPillsTaken = taken + 1;
    }
    const yrs = it.effect.lifespan;
    state.player.lifeBonus = (state.player.lifeBonus || 0) + yrs;
    refreshDerived(state);
    logs.push(`服之延寿，寿元上限 +${yrs} 年（现 ${state.player.lifespan} 岁）。`);
  }
  // 灵兽契约：服用拓宽灵兽栏（上限 +1，至多 6 栏）
  if (it.effect.beastSlot) {
    state.beasts = state.beasts || { slots: [], maxSlots: 1, tamedCount: 0 };
    const cap = 6;
    if (state.beasts.maxSlots >= cap) logs.push(`灵兽栏已至上限（${cap} 栏），契约暂存。`);
    else { state.beasts.maxSlots += 1; logs.push(`契约生效，灵兽栏上限提升至 ${state.beasts.maxSlots} 栏。`); }
  }
  // 扩容储物袋：服用直接拓展行囊容量（容量 +N 格），与坊市「储物袋扩容契」服务并行的另一种扩容途径
  if (it.effect.bag) {
    const add = Number(it.effect.bag) || 20;
    state.inventory.capacity += add;
    state.inventory.upgrades = (state.inventory.upgrades || 0) + 1;
    state.inventory.bagName = bagNameByCapacity(state.inventory.capacity, '乾坤储物袋');
    logs.push(`施法展开「${it.名称}」，行囊容量 +${add} 格（现 ${state.inventory.capacity} 格）。`);
  }
  // 解毒丹：服用降低丹毒（与 codex 承诺「丹毒 -30」一致），是丹毒危机唯一主动恢复途径
  if (it.effect.detox) {
    const cur = Number(state.flags?.pillToxicity || 0);
    const after = Math.max(0, cur - it.effect.detox);
    state.flags.pillToxicity = after;
    logs.push(`服下「${it.名称}」，丹毒 ${cur} → ${after}（－${cur - after}）。`);
  }
  // 法力丹：服用后下次战斗胜率提升（战斗后失效，由 resolveBattle 在战后清零）
  if (it.effect.battleBuff) {
    state.flags.nextBattleWin = (Number(state.flags?.nextBattleWin) || 0) + it.effect.battleBuff;
    logs.push(`服下「${it.名称}」，下次战斗胜率 +${it.effect.battleBuff}%（战斗后失效）。`);
  }
  // 丹毒累加
  const codexItem = it._codexToxicity !== undefined ? it : null;
  const toxicity = (typeof it.toxicity === 'number') ? it.toxicity : (codexItem?.toxicity || 0);
  if (toxicity !== 0) {
    const side = applyPillToxicity(state, toxicity, setFlags);
    if (side) logs.push(`⚠️ ${side.text}`);
  }
  it.数量 -= 1;
  if (it.数量 <= 0) state.items.splice(idx, 1);
  refreshDerived(state);
  return logs;
}
/** 物品使用预览（纯函数，确定性，不消耗/不修改 state）。
 *  【为何存在】此前行囊面板仅对 effect.exp / effect.heal 显示「使用」按钮，
 *  而 useItem 实际支持 exp/heal/wuxing/daoBase/cultivateBoostMonths/power/lifespan/beastSlot，
 *  导致凝神丹(wuxing)、洗髓丹·炎玉丹·玉华丹(daoBase)、狂战丹(power)、延寿丹(lifespan)、
 *  灵兽契约(beastSlot)、聚灵阵旗(cultivateBoostMonths) 等物品在行囊中无按钮可点 —— 玩家
 *  炼制/拍得后完全无法服用。本函数与 useItem 能力一一对齐，作为行囊按钮的唯一判定口径。
 *  返回 { mode, label, text }：
 *    mode='equip' 可穿戴 / 'use' 可主动服用 / 'auto' 特定时机自动消耗 / 'none' 无可用效果
 *    text 为服用前的确定性效果说明（与 useItem 同口径，含丹毒代价）。 */
export function itemUsePreview(state, it) {
  const none = { mode: 'none', label: '', text: '' };
  if (!it) return none;
  if (it._equip || it.部位 || it.类型 === '装备' || it.类型 === '法宝') {
    const src = it._equip || it;
    const pw = Number(src.战力) || Number(it.战力) || 0;
    return { mode: 'equip', label: '装备', text: pw ? `穿戴后战力 +${pw}` : '穿戴至对应部位' };
  }
  const eff = it.effect;
  if (!eff) return none;
  // 自动消耗类：主动服用会白扣或无效，故不给按钮，改以说明标记告知时机
  if (it.breakthrough) return { mode: 'auto', label: '', text: '瓶颈专属丹：冲击对应瓶颈时自动消耗（成功率 +20%）' };
  if (typeof eff.tribulation === 'number') return { mode: 'auto', label: '', text: `渡劫丹：渡劫时自动消耗（成功率 +${eff.tribulation}%，按品阶加成）` };
  if (it.名称 === '地火引') return { mode: 'auto', label: '', text: '百艺助燃剂：百艺制作时自动消耗' };
  if (eff.ward) return { mode: 'auto', label: '',
    text: it.名称 === '护身符'
      ? '高阶护身道具：战斗败北时自动消耗一件，挡去重伤与修为倒退，并护住灵石'
      : '低阶护身道具：战斗败北时自动消耗一件，护住灵石分毫未失（重伤仍会承受）' };
  if (typeof eff.tame === 'number') return { mode: 'auto', label: '', text: `驯兽口粮：收服灵兽时自动投喂（成功率 +${eff.tame}%）` };
  const parts = [];
  if (eff.exp) {
    const mult = (it.quality && it.quality.mult) ? it.quality.mult : 1;
    const gain = Math.round(eff.exp * mult);
    parts.push(mult !== 1 ? `修为 +${gain}（${it.quality.grade} ×${mult}）` : `修为 +${gain}`);
  }
  if (eff.heal) parts.push('伤势尽去');
  if (eff.wuxing) parts.push(`悟性经验 +${eff.wuxing}`);
  if (eff.daoBase) {
    const kb = eff.daoBase || {};
    const base = `随机提升「${(kb.keys || []).join('/')}」之一 +${kb.min}~${kb.max} 级`;
    if (it.名称 === '洗髓丹') {
      const mTaken = (state && state.player && state.player.marrowPillsTaken) || 0;
      parts.push(mTaken >= 2
        ? `${base}（一生限 2 颗，已服满 ${mTaken}/2，此丹暂难生效）`
        : `${base}（一生限 2 颗，已服 ${mTaken}/2）`);
    } else parts.push(base);
  }
  if (eff.cultivateBoostMonths) parts.push(`未来 ${eff.cultivateBoostMonths} 月修炼效率 +15%`);
  if (eff.power) parts.push(`战力临时 +${eff.power}（持续 ${eff.powerMonths || 1} 月）`);
  if (eff.lifespan) {
    if (it.名称 === '延寿丹') {
      const taken = (state && state.player && state.player.lifespanPillsTaken) || 0;
      parts.push(taken >= 3
        ? `寿元上限 +${eff.lifespan} 年（一生限 3 颗，已服满 ${taken}/3，此丹暂难生效）`
        : `寿元上限 +${eff.lifespan} 年（一生限 3 颗，已服 ${taken}/3）`);
    } else parts.push(`寿元上限 +${eff.lifespan} 年`);
  }
  if (eff.beastSlot) {
    const cur = (state && state.beasts && state.beasts.maxSlots) || 1;
    parts.push(cur >= 6 ? `灵兽栏上限 +1（已达上限 ${cur}/6，服用无效）` : `灵兽栏上限 +1（现 ${cur}/6 栏）`);
  }
  if (eff.bag) parts.push(`行囊容量 +${eff.bag} 格`);
  if (eff.detox) parts.push(`丹毒 -${eff.detox}`);
  if (eff.battleBuff) parts.push(`下次战斗胜率 +${eff.battleBuff}%`);
  if (!parts.length) return none;
  const tox = (typeof it.toxicity === 'number') ? it.toxicity : 0;
  if (tox > 0) parts.push(`丹毒 +${tox}`);
  return { mode: 'use', label: it.类型 === '丹药' ? '服用' : '使用', text: parts.join('，') };
}
/** 重新计算已穿戴戒指（空间戒）带来的储物袋加成，写入 inventory.ringBonus。
 *  优先读装备的 capBonus 字段，旧档/名称匹配兜底，避免容量漂移。 */
export function recalcRingCapacity(state) {
  ensureLifeState(state);
  let bonus = 0;
  const eq = state.equipment || {};
  for (const slot of ['weapon', 'armor', 'pants', 'boots', 'accessory', 'artifact']) {
    const it = eq[slot];
    if (!it) continue;
    if (it.capBonus) bonus += Number(it.capBonus) || 0;
    else if (it.部位 === 'accessory' && /空间戒/.test(it.名称 || '')) bonus += 30;
  }
  state.inventory.ringBonus = bonus;
}

/** 装备普通装备或稀有法宝，两套槽位互不混用。 */
export function equipItem(state, stashIdx) {
  ensureLifeState(state);
  const item = state.equipment.stash[stashIdx];
  if (!item) return false;
  const slot = item.部位;
  const old = state.equipment[slot];
  state.equipment[slot] = item;
  state.equipment.stash.splice(stashIdx, 1);
  if (old) {
    // 2026-08-19：从备用装备到已装备时，若该部位已有装备，替换下来的回到备用栏。
    // 这里容量一定有一格空位（因为刚移出一件），无需额外检查。
    state.equipment.stash.push(old);
  }
  discoverItem(state, item);
  refreshDerived(state);
  recalcRingCapacity(state);
  return true;
}

const STASH_CAPACITY = 20; // 备用装备栏上限，防止反复换装无限堆叠

export function unequipItem(state, slot) {
  ensureLifeState(state);
  const item = state.equipment[slot];
  if (!item) return false;
  if ((state.equipment.stash || []).length >= STASH_CAPACITY) return false;
  state.equipment.stash.push(item);
  state.equipment[slot] = null;
  refreshDerived(state);
  recalcRingCapacity(state);
  return true;
}

/** 将备用装备放回行囊（若行囊有空间） */
export function stashToBag(state, stashIdx) {
  ensureLifeState(state);
  const stash = state.equipment.stash || [];
  if (stashIdx < 0 || stashIdx >= stash.length) return false;
  const item = stash[stashIdx];
  if (!item) return false;
  const isEquip = (item.类型 === '装备' || item.类型 === '法宝');
  const bagItem = { 名称: item.名称, 类型: item.类型 || '装备', 数量: 1, 描述: item.描述, 品阶: item.品阶, 等级: item.等级, 战力: item.战力 };
  if (isEquip) bagItem._equip = { 名称: item.名称, 品阶: item.品阶, 等级: item.等级, 战力: item.战力, 描述: item.描述, 类型: item.类型 || '装备' };
  if (!storeItem(state, bagItem)) return false; // 行囊满
  stash.splice(stashIdx, 1);
  refreshDerived(state);
  recalcRingCapacity(state);
  return true;
}

// 兼容旧调用名
export function equipGear(state, slotIdx) { return equipItem(state, slotIdx); }
export function equipArtifact(state, slotIdx) { return equipItem(state, slotIdx); }

/**
 * 妖纹套装战利品加成口径（纯函数，供测试与掉落结算共用）。
 * beastLoot：妖兽类战利品数量 +20%（妖纹护体·2件）
 * beastFind：妖域探索更易发现珍稀材料——「仙缘」掉落概率上限翻倍（妖纹大成·3件）
 */
export function beastLootMul(state, flags) {
  const setFlags = flags || setBonusFlags(state);
  return 1 + Number(setFlags.beastLoot || 0);
}

/** 珍稀材料（仙缘）掉落概率：妖纹大成后上限由 15% 提至 30%，且随等级增长更快 */
export function rareMaterialChance(state, level, flags) {
  const setFlags = flags || setBonusFlags(state);
  const lv = Math.max(1, Number(level) || 1);
  return setFlags.beastFind ? Math.min(0.3, lv / 100) : Math.min(0.15, lv / 200);
}

export function generateBeastDrops(state, enemy) {
  ensureLifeState(state);
  const drops = [];
  const lv = enemy.level || 1;
  const setFlags = setBonusFlags(state);
  const lootMul = beastLootMul(state, setFlags);
  // 危险度倍率：越凶险的地域，妖兽材料数量与价值越高（风险收益匹配）
  const danger = enemy.danger || (REGION_TRAVEL[state.world.regionId]?.danger) || 2;
  const dangerMul = 1 + (danger - 2) * 0.2; // d2→1.0, d3→1.2, d4→1.4, d5→1.6
  // 必掉内丹
  drops.push({ 名称: `${enemy.name}内丹`, 类型: '材料', 数量: 1, 描述: '妖兽精华，可炼丹、炼器或出售。', 价值: Math.round(Math.max(20, lv * 8) * dangerMul) });
  // 按妖兽等级概率掉额外材料
  const pool = [
    { tpl: MATERIAL_TYPES.find((m) => m.id === 'lingcao'), chance: 0.5 },
    { tpl: MATERIAL_TYPES.find((m) => m.id === 'shougu'), chance: 0.4 },
    { tpl: MATERIAL_TYPES.find((m) => m.id === 'pimao'), chance: 0.35 },
    { tpl: MATERIAL_TYPES.find((m) => m.id === 'kuangshi'), chance: 0.25 },
    { tpl: MATERIAL_TYPES.find((m) => m.id === 'xianyuan'), chance: rareMaterialChance(state, lv, setFlags), rare: true },
  ];
  for (const { tpl, chance, rare } of pool) {
    // 妖纹护体（2件）：妖兽战利品期望数量 +20% —— 同时抬升掉落概率与件数；
    // 珍稀「仙缘」概率已由 rareMaterialChance 单独处理，不再二次抬升，避免叠加过强。
    const finalChance = rare ? chance : Math.min(0.95, chance * lootMul);
    if (tpl && Rng.chance(finalChance)) {
      const qty = Math.max(1, Math.round(Rng.int(1, Math.max(2, Math.floor(lv / 15) + 1)) * dangerMul * lootMul));
      // 矿石为基础材料，按通用名掉落（与灵脉石饰配方、图鉴对齐）；其余兽材保留「妖兽」前缀
      const dropName = tpl.id === 'kuangshi' ? '矿石' : (tpl.id === 'xianyuan' ? '仙缘' : `妖兽${tpl.name}`);
      drops.push({ 名称: dropName, 类型: tpl.type, 数量: qty, 描述: tpl.desc, 价值: Math.round(tpl.value * (1 + lv / 50) * dangerMul) });
    }
  }
  // 低概率掉装备/法宝胚
  if (Rng.chance(0.15 + Math.min(0.15, lv / 200))) {
    const slot = Rng.pick(['weapon', 'armor', 'boots', 'accessory']);
    const item = generateEquip(state, slot, Math.max(1, Math.round((lv / 12) * dangerMul)));
    drops.push({ 名称: item.名称, 类型: '装备', 数量: 1, 描述: item.描述, 效果: { equipSlot: slot, equipLevel: item.等级 }, 价值: item.价值, _equip: item });
  }
  return drops;
}

export function generateEquip(state, slot, levelHint, fixedName) {
  ensureLifeState(state);
  const level = Math.max(1, Number(levelHint) || 1);
  const luck = 1 + ((state.player.daoBase?.气运?.level || 0) / 200);
  const grade = rollEquipGrade(level, luck - 1);
  const name = fixedName || makeEquipName(slot, grade);
  const power = calcEquipPower(slot, level, grade);
  const isSpaceRing = slot === 'accessory' && /空间戒/.test(name); // 空间戒指自带储物加成
  return {
    名称: name, 类型: '装备', 部位: slot, 品阶: grade.id, 等级: level, 战力: power,
    ...(isSpaceRing ? { capBonus: 30 } : {}),
    描述: `${grade.name}${EQUIP_SLOTS.find((s) => s.id === slot)?.name || '装备'}，战力+${power}。`,
    效果: {}, 价值: Math.max(10, Math.round(power * 12 * grade.priceMul)),
  };
}

export function guessEquipSlot(item) {
  if (item.类型 === '法宝') return 'artifact';
  const name = String(item.名称 || '');
  if (/剑|刀|枪|锤|梭|环|铃|扇/.test(name)) return 'weapon';
  if (/甲|衣|袍|铠/.test(name)) return 'armor';
  if (/靴|鞋|履/.test(name)) return 'boots';
  if (/裤|裙/.test(name)) return 'pants';
  if (/佩|符|珠|牌|坠|戒/.test(name)) return 'accessory';
  return 'weapon';
}

/* ============================================================
 * 十二、修仙百艺
 * ========================================================== */
export function practiceArt(state, artName, recipeId = '', slotOverride, batch = 1) {
  ensureLifeState(state);
  const art = state.arts[artName];
  if (!art) return ['未知技艺。'];
  const logs = [];
  const recipes = ART_RECIPES[artName] || [];
  const recipe = recipes.find((r) => r.id === recipeId) || recipes[0];
  const setFlags = setBonusFlags(state);
  if (recipe) {
    // 炼器·自由锻造：玩家自选部位，按所选槽位生成真实可装备的装备
    if (artName === '炼器' && slotOverride && recipe.id === 'free') {
      const lvl = Number(recipe.output.等级) || 3;
      const equip = generateEquip(state, slotOverride, lvl);
      const item = { 名称: equip.名称, 类型: '装备', 数量: 1, 描述: equip.描述, _equip: equip, 价值: equip.价值 };
      if (!canStore(state, item)) return ['储物袋空间不足，请先出售或扩容。'];
      for (const [name, count] of Object.entries(recipe.need)) {
        const it = state.items.find((x) => x.名称 === name);
        if (!it) return ['材料不足，无法开工。'];
        it.数量 -= count; if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      }
      storeItem(state, item);
      state.inventory.used = inventoryUsed(state);
      const slotName = EQUIP_SLOTS.find((s) => s.id === slotOverride)?.name || '装备';
      logs.push(`你凝火锻2器，自由锻造出「${equip.名称}」（${slotName}，战力+${equip.战力}）。`);
    } else if (artName === '炼器' && recipe.id === 'repair_canpian') {
      // 残片修复：法宝残片（游历/秘境战利品）+ 星砂 → 重铸为可用灵珠法宝（确定性，无 RNG）
      const repairedName = '灵珠法宝';
      const artPower = calcEquipPower('artifact', 3, getEquipGrade('faqi'));
      const artItem = {
        名称: repairedName, 类型: '法宝', 数量: 1,
        描述: `法宝残片重铸而成的「${repairedName}」（法器），战力+${artPower}。`,
        _equip: { 名称: repairedName, 类型: '法宝', 部位: 'artifact', 品阶: '法器', 等级: 3, 战力: artPower, 描述: `法宝残片重铸而成的「${repairedName}」（法器），战力+${artPower}。` },
        价值: 200,
      };
      if (!canStore(state, artItem)) return ['储物袋空间不足，请先出售或扩容。'];
      for (const [nm, cnt] of Object.entries(recipe.need)) {
        const it = state.items.find((x) => x.名称 === nm);
        if (!it) return ['材料不足，无法开工。'];
        it.数量 -= cnt; if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      }
      storeItem(state, artItem);
      state.inventory.used = inventoryUsed(state);
      logs.push(`你将「残片法宝」投入地火，辅以「星砂」熔炼重铸，一枚「${repairedName}」（法器，战力+${artPower}）焕发新生！`);
    } else {
      // 套装加成：炼器/炼丹时品质和经验提升
      const expMul = setFlags.craftExp ? (1 + setFlags.craftExp) : 1;
      const craft = craftRecipeWithQuality(state, recipe, art.level, setFlags, batch, true);
      logs.push(...craft.logs);
      if (!craft.ok) {
        const expGain = Math.round(Rng.int(5, 10) * expMul);
        art.exp += expGain;
        logs.push(`虽然未能制成产物，但你整理工具、复盘技法，经验+${expGain}。`);
        return logs;
      }
    }
  }
  const expGain = Rng.int(18, 35) * Math.min(Math.max(1, Math.floor(batch || 1)), 5);
  art.exp += expGain;
  const need = (art.level + 1) * 50;
  if (art.exp >= need && art.level < 100) {
    art.exp -= need; art.level += 1;
    logs.push(`技艺「${artName}」晋升至 ${art.level} 级，新配方品质与成功率提高。`);
  } else {
    logs.push(`「${artName}」经验+${expGain}；等级越高，产物数量与售价越高。`);
  }
  addLog(state, '操作', `百艺「${artName}」制作${recipe ? `「${recipe.name}」` : '练习品'}。`);
  makeChronicle(state, { type: '百艺', title: `${artName}小成`, text: logs.join('') });
  return logs;
}

/** 带品质判定的炼制函数（丹药带 quality，地火套装减丹毒）。mul>=1 时按批量结算材料与产出。 */
function craftRecipeWithQuality(state, recipe, artLevel, setFlags, mul = 1, fireGuide = false) {
  mul = Math.max(1, Math.floor(mul || 1));
  const baseQty = recipe.output.数量 || recipe.output.quantity || 1;
  const output = {
    名称: recipe.output.名称 || recipe.output.name,
    类型: recipe.output.类型 || recipe.output.type || '杂物',
    数量: baseQty * mul,
    描述: recipe.output.描述 || recipe.output.desc || '',
    等级: recipe.output.等级 || recipe.output.level,
    effect: recipe.output.effect,
  };
  // 丹药赋予品质（批量只判定一次品质，单颗丹毒不变）
  if (output.类型 === '丹药') {
    const quality = rollPillQuality(artLevel, setFlags);
    output.quality = quality;
    output.描述 = `${output.描述}（${quality.grade}）`;
    // 极品丹药丹毒减半（修复：此前未读取配方原始丹毒，极品恒为 0）
    if (quality.grade === '极品') output.toxicity = Math.floor((recipe.output.toxicity || 0) / 2);
  }
  // 批量校验材料（mul 倍）
  for (const [name, count] of Object.entries(recipe.need)) {
    const needTotal = count * mul;
    const item = state.items.find((x) => x.名称 === name);
    if (!item || item.数量 < needTotal) return { ok: false, logs: ['材料不足，无法开工。'] };
  }
  // 地火引：百艺配方制作时若持有则自动消耗 1 张，本次产量 +1（落实"提高品质"承诺，消除死道具）
  let usedFireGuide = false;
  if (fireGuide) {
    const fgIdx = state.items.findIndex((x) => x.名称 === '地火引');
    if (fgIdx >= 0) {
      const fg = state.items[fgIdx];
      fg.数量 -= 1;
      if (fg.数量 <= 0) state.items.splice(fgIdx, 1);
      usedFireGuide = true;
      output.数量 += 1;
    }
  }
  if (!canStore(state, output)) return { ok: false, logs: ['储物袋空间不足，请先出售或扩容。'] };
  for (const [name, count] of Object.entries(recipe.need)) {
    const needTotal = count * mul;
    const item = state.items.find((x) => x.名称 === name);
    item.数量 -= needTotal;
    if (item.数量 <= 0) state.items.splice(state.items.indexOf(item), 1);
  }
  storeItem(state, output);
  state.inventory.used = inventoryUsed(state);
  const fireGuideLog = usedFireGuide ? '🔥 借助地火引，火候更足，额外制得 1 件。' : '';
  return { ok: true, logs: [`百艺制成「${output.名称}」×${output.数量}${output.quality ? `（${output.quality.grade}）` : ''}。`, `获得实际产物：${output.描述}`, fireGuideLog].filter(Boolean) };
}

/* ============================================================
 * 十三、回合推进（月末结算 -> 下月）
 * ========================================================== */
export function nextMonth(state) {
  const w = state.world;
  const logs = [];
  w.turns += 1;
  w.month += 1;
  if (w.month > 12) {
    w.month = 1; w.year += 1;
    state.player.age += 1;
    logs.push(`🎂 岁月流转，你的骨龄增至 ${state.player.age} 岁。`);
    addLog(state, '系统', `进入天玄历${w.year}年，骨龄${state.player.age}岁。`);
    // 天命等待年数
    if (state.destiny.status === '已等待' || state.destiny.status === '待抉择') {
      state.destiny.waitYears += 1;
    }
    // 寿元检查
    if (state.player.age >= state.player.lifespan) {
      return { logs, dead: true };
    }
    if (state.player.lifespan - state.player.age <= 10) {
      logs.push('⏳ 寿元将尽！请尽快突破境界或寻觅延寿丹药。');
    }
  }
  ensureLifeState(state);
  // 天机运势过期清理（卜算所得，仅生效至 expireMonth，跨月自动失效）
  if (state.flags?.omen && !omenActive(state)) state.flags.omen = null;
  // 灵草园每月生长
  growHerbs(state);
  // 丹炉跨月结算（成丹入袋 / 废丹退材料灵石）+ 丹毒自然衰减
  settleRefine(state, logs);
  decayPillToxicity(state);
  // 每月重置「本月已进行的轻量行动」（闭关/研读/拜访），允许返回选择后再做主行动
  state.flags.actedThisMonth = {};
  // 地图旅行推进
  if (state.world.travel?.destination) {
    state.world.travel.remaining = Math.max(0, state.world.travel.remaining - 1);
    if (state.world.travel.remaining === 0) {
      const regionNames = Object.fromEntries(REGIONS.map((r) => [r.id, r.name]));
      const arrived = completeTravel(state, regionNames);
      if (arrived) {
        logs.push(arrived);
        addLog(state, '事件', arrived);
        makeChronicle(state, { type: '地图', title: '抵达新地域', text: arrived });
      }
    } else {
      logs.push(`旅途继续，距离目的地还有${state.world.travel.remaining}个月。`);
    }
  }
  if (state.flags.companionMonths > 0) {
    state.flags.companionMonths -= 1;
    if (state.flags.companionMonths === 0) {
      logs.push(`同行约定结束，「${state.flags.companion}」与你暂别。`);
      state.flags.companion = '';
    }
  }
  // 伤势恢复
  if (state.flags.wounded > 0) {
    state.flags.wounded -= 1;
    if (state.flags.wounded === 0) logs.push('伤势痊愈。');
  }
  // 聚灵丹药力（修炼效率加成）月度衰减
  if (state.flags.cultivateBoostMonths > 0) {
    state.flags.cultivateBoostMonths -= 1;
    if (state.flags.cultivateBoostMonths === 0) logs.push('聚灵丹的药力消退，修炼效率恢复如常。');
  }
  // NPC 关系衰减（久不联系，仅已结识者）
  for (const npc of knownNpcs(state)) {
    if (npc.relation > 0 && w.turns - (npc.lastMeet || 0) >= RELATION_RULES.favorDecayMonths) {
      npc.favor = Math.max(0, npc.favor - Rng.int(1, 3));
    }
  }
  // 道友之能：每月自动生效（简化：道友每月赠礼，仅已结识者）
  for (const npc of knownNpcs(state)) {
    if (npc.relation >= 3 && npc.skill && Rng.chance(0.5)) {
      if (npc.skill.includes('灵材')) {
        const gift = { 名称: '道友赠礼·灵材包', 类型: '材料', 数量: 1, 描述: `${npc.name}所赠` };
        if (storeItem(state, gift)) logs.push(`道友「${npc.name}」赠来一份灵材，已收入储物袋。`);
        else logs.push(`道友「${npc.name}」赠来灵材，但储物袋已满，暂未收下。`);
      } else if (npc.skill.includes('产业')) {
        addStones(state, 30); logs.push(`道友「${npc.name}」打理产业，分红+30灵石。`);
      } else if (npc.skill.includes('风声')) {
        logs.push(`道友「${npc.name}」捎来一条秘闻：${Rng.pick(WORLD_EVENTS)}。`);
      } else if (npc.skill.includes('手作')) {
        if (npc.job === '符师') {
          const gift = { 名称: '低阶符箓', 类型: '消耗品', 数量: 1, 描述: `${npc.name}所赠符箓，败北时替你挡灾。`, 价值: 50, effect: { ward: true } };
          if (storeItem(state, gift)) logs.push(`道友「${npc.name}」敬赠一张低阶符箓，已收入储物袋。`);
          else logs.push(`道友「${npc.name}」赠来符箓，但储物袋已满，暂未收下。`);
        } else { // 阵师
          const gift = { 名称: '简易阵旗', 类型: '消耗品', 数量: 1, 描述: `${npc.name}所赠阵旗，战场布成临时护阵，败北时挡灾。`, 价值: 70, effect: { ward: true } };
          if (storeItem(state, gift)) logs.push(`道友「${npc.name}」赠你一面简易阵旗，已收入储物袋。`);
          else logs.push(`道友「${npc.name}」赠来阵旗，但储物袋已满，暂未收下。`);
        }
      }
    }
  }
  // 道友之能·散修：引荐延誉，每半年（turns 为 6 的倍数）引荐一位尚未结识的高人
  if (state.world.turns % 6 === 0) {
    const matchmaker = daoFriendJob(state, '散修');
    if (matchmaker) {
      const pend = state.npcs.find((n) => n.met === false);
      if (pend) {
        pend.met = true; pend.relation = 0; pend.relationName = '陌路';
        logs.push(`道友「${matchmaker.name}」（散修）引荐，你结识了${pend.race || ''}${pend.job || ''}「${pend.name}」，多了一段道缘。`);
        addLog(state, '事件', `经「${matchmaker.name}」引荐，结识「${pend.name}」。`);
      }
    }
  }
  generateNews(state);
  // 宗门俸禄：每月按职级累积待领灵石（rank0 散修不发放）
  if (state.sect?.name && state.sect.rank >= 1) {
    const pay = SECT_STIPEND[Math.min(state.sect.rank, SECT_STIPEND.length - 1)] || 0;
    if (pay > 0) {
      state.sect.stipend = (state.sect.stipend || 0) + pay;
    }
  }
  return { logs, dead: false };
}

/** 领取宗门俸禄：把累积的待领灵石一次性发放到储物（下品灵石）。 */
export function claimSectStipend(state) {
  ensureLifeState(state);
  ensureSectState(state);
  if (!state.sect.name) return { ok: false, logs: ['你尚未加入任何宗门，无处领取俸禄。'] };
  if (state.sect.rank < 1) return { ok: false, logs: ['散修无宗门俸禄可领。'] };
  const amount = state.sect.stipend || 0;
  if (amount <= 0) return { ok: false, logs: ['暂无功禄可领，下月再来。'] };
  state.currencies['下品灵石'] = (state.currencies['下品灵石'] || 0) + amount;
  state.sect.stipend = 0;
  state.sect.claimedYear = state.world.year;
  state.sect.claimedMonth = state.world.month;
  addLog(state, '操作', `领取宗门俸禄，下品灵石+${amount}。`);
  return { ok: true, amount, logs: [`🏯 你从宗门库房领得本月俸禄，下品灵石 +${amount}。`] };
}

/* ============================================================
 * 十四、转世轮回（文档第十八章）
 * ========================================================== */
/** 宗门兑换所：以宗门贡献兑换资源（确定性，无 RNG）。 */
export function sectExchange(state, itemId) {
  ensureLifeState(state);
  ensureSectState(state);
  if (!state.sect.name) return { ok: false, logs: ['你尚未加入任何宗门，无处兑换。'] };
  const ex = SECT_EXCHANGE.find((e) => e.id === itemId);
  if (!ex) return { ok: false, logs: ['宗门兑换所无此物资。'] };
  if (state.sect.contribution < ex.cost) {
    return { ok: false, logs: [`宗门贡献不足，需 ${ex.cost}（当前 ${state.sect.contribution}）。`] };
  }
  state.sect.contribution -= ex.cost;
  const logs = [`🏯 你于宗门兑换所换取「${ex.name}」，消耗贡献 ${ex.cost}。`];
  if (ex.type === 'stones') {
    addStones(state, ex.amount);
    logs.push(`获得下品灵石 +${ex.amount}。`);
  } else if (ex.type === 'pill') {
    const it = { 名称: ex.item, 类型: '丹药', 数量: ex.qty || 1, 描述: ex.desc, effect: ex.effect, toxicity: ex.toxicity };
    if (storeItem(state, it)) logs.push(`获得丹药：${ex.item} ×${ex.qty || 1}。`);
  }
  addLog(state, '操作', `宗门兑换所兑换「${ex.name}」，贡献-${ex.cost}。`);
  refreshDerived(state);
  return { ok: true, logs };
}

/** 轮回转世：计算可继承的遗产（纯函数，只读 state，不修改）。 */
function computeInherit(state) {
  return {
    stones: Math.floor(totalStones(state) * 0.5),
    daoBase: Object.fromEntries(Object.entries(state.player.daoBase).map(([k, v]) => [k, Math.floor(v.level * 0.3)])),
    yunExp: Math.floor(state.player.daoYun.exp * 0.2),
    tech: state.techniques.find((t) => t.名称 === state.player.mainTechnique),
    heirs: state.npcs.filter((n) => n.favor >= 80).slice(0, 2).map((n) => n.name),
  };
}

export function reincarnate(state, full) {
  if (full) return null; // 完全重开：由 UI 走新建流程
  // 轮回转世：继承部分遗产
  return computeInherit(state);
}

/** 转世继承预览：纯函数，返回玩家转世后将继承的具体内容（确定性、无 RNG），供 UI 确认前展示。 */
export function reincarnatePreview(state) {
  const inh = computeInherit(state);
  const total = totalStones(state);
  const daoList = Object.entries(inh.daoBase).map(([k, add]) => {
    const cur = (state.player.daoBase[k] && state.player.daoBase[k].level) || 0;
    return { name: k, cur, add, next: cur + add };
  });
  return {
    stones: inh.stones,
    totalStones: total,
    daoList,
    yunExp: inh.yunExp,
    techName: inh.tech ? inh.tech.名称 : '（无主修功法）',
    heirs: inh.heirs,
  };
}

/* ============================================================
 * 十五、灵兽系统（与战斗、采集、旅行联动）
 * ========================================================== */
/** 尝试收服灵兽，消耗驭兽香或依赖御兽等级 */
export function tameBeast(state, beastTemplate, useIncense = false) {
  ensureLifeState(state);
  ensureBeastState(state);
  if (!canTameBeast(state)) return { ok: false, logs: ['灵兽栏已满，无法再收服新灵兽。'] };
  const beast = { ...beastTemplate, power: beastTemplate.power + Rng.int(-2, 4), tamed: true };
  // 先按当前状态算成功率（含自动投喂驯兽口粮），再消耗道具，保证数值与预览一致
  const rate = tameBeastRate(state, beastTemplate, useIncense);
  let usedFood = false;
  if (useIncense) {
    const idx = state.items.findIndex((i) => i.名称 === '驭兽香');
    if (idx >= 0) {
      state.items[idx].数量 -= 1;
      if (state.items[idx].数量 <= 0) state.items.splice(idx, 1);
    }
  }
  // 驯兽口粮（百艺御兽产出）：持有则自动投喂，提高收服成功率（落实图鉴/UI「可大幅提升收服概率」的承诺，消除死道具）
  const foodIdx = state.items.findIndex((i) => i.名称 === '驯兽口粮');
  if (foodIdx >= 0) {
    const food = state.items[foodIdx];
    food.数量 -= 1;
    if (food.数量 <= 0) state.items.splice(foodIdx, 1);
    usedFood = true;
  }
  const foodNote = usedFood ? '（已投喂驯兽口粮，收服概率提升）' : '';
  if (Rng.chance(rate / 100)) {
    state.beasts.slots.push(beast);
    state.beasts.tamedCount += 1;
    if (state.beasts.activeIdx < 0) state.beasts.activeIdx = state.beasts.slots.length - 1;
    // 收服成功赠予「灵兽契约」作为驯兽凭证（见证羁绊）；仅在缺失时补发，避免重复累积。
    if (!state.items.some((i) => i.名称 === '灵兽契约')) {
      const contract = { 名称: '灵兽契约', 类型: '道具', 数量: 1, 描述: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。', 价值: 0, effect: { beastSlot: 1 } };
      storeItem(state, contract);
      discoverItem(state, { 名称: '灵兽契约', 类型: '道具' });
    }
    discoverItem(state, { 名称: beast.name, 类型: '灵兽' });
    addLog(state, '事件', `成功收服灵兽「${beast.name}」，战力加成 +${beast.power}。`);
    makeChronicle(state, { type: '灵兽', title: `收服${beast.name}`, text: `你收服了${beast.name}，它将协助你战斗与采集。` });
    refreshDerived(state);
    return { ok: true, logs: [`你成功收服「${beast.name}」！${beast.desc} 战力 +${beast.power}。${foodNote}`] };
  }
  return { ok: false, logs: [`收服失败，「${beast.name}」挣脱了你的束缚，扬长而去。${foodNote}`] };
}

/** 灵兽收服成功率预览：纯函数，不消耗状态，与 tameBeast 同口径（确定性、无 RNG） */
export function tameBeastRate(state, beastTemplate, useIncense = false) {
  ensureLifeState(state);
  ensureBeastState(state);
  let rate = 30 + (state.arts['御兽']?.level || 0) * 2;
  if (useIncense && state.items.some((i) => i.名称 === '驭兽香')) rate += 20;
  const food = state.items.find((i) => i.名称 === '驯兽口粮');
  if (food) rate += (food.effect && typeof food.effect.tame === 'number') ? food.effect.tame : 15;
  if (state.player.level < beastTemplate.minLevel) rate -= 20;
  rate = Math.min(90, Math.max(10, rate));
  return rate;
}

/** 指定/取消出战灵兽（出战者在战斗中额外护主，提高胜率） */
export function setActiveBeast(state, idx) {
  ensureBeastState(state);
  if (idx === -1) { state.beasts.activeIdx = -1; return { ok: true, logs: ['你收回出战灵兽，交由山野修养。'] }; }
  if (idx < 0 || idx >= state.beasts.slots.length) return { ok: false, logs: ['无此灵兽。'] };
  const b = state.beasts.slots[idx];
  state.beasts.activeIdx = idx;
  return { ok: true, logs: [`你指定「${b.name}」为出战灵兽，它将冲锋在前。`] };
}

/** 释放灵兽 */
export function releaseBeast(state, idx) {
  ensureBeastState(state);
  const beast = state.beasts.slots[idx];
  if (!beast) return '无此灵兽。';
  state.beasts.slots.splice(idx, 1);
  // 维护出战索引：释放后若越界则收回
  if (state.beasts.activeIdx === idx) state.beasts.activeIdx = state.beasts.slots.length ? 0 : -1;
  else if (state.beasts.activeIdx > idx) state.beasts.activeIdx -= 1;
  refreshDerived(state);
  return `你解除了与「${beast.name}」的契约，它回归山野。`;
}

/** 灵兽升星：消耗下品灵石提升星级（最高 5 星），每星基础战力 +20%，强化战力与助阵。 */
export function upgradeBeast(state, idx) {
  ensureBeastState(state);
  const b = state.beasts.slots[idx];
  if (!b) return { ok: false, logs: ['无此灵兽。'] };
  const star = b.star || 1;
  if (star >= 5) return { ok: false, logs: [`「${b.name}」已达五星巅峰，无法继续升星。`] };
  const cost = 200 * star * star; // 一星→二星 200，二→三 800，三→四 1800，四→五 3200
  if ((state.currencies?.['下品灵石'] || 0) < cost) return { ok: false, logs: [`升星需 ${cost} 下品灵石，灵石不足。`] };
  state.currencies['下品灵石'] -= cost;
  b.star = star + 1;
  b.power = Math.round((b.power || 0) * 1.2);
  refreshDerived(state);
  return { ok: true, logs: [`「${b.name}」晋升至 ${b.star} 星！战力提升至 ${b.power}。`] };
}

/* ============================================================
 * 十六、宗门系统（与修炼、任务、资源联动）
 * ========================================================== */
/** 加入或创建宗门 */
export function joinSect(state, sectName) {
  ensureLifeState(state);
  ensureSectState(state);
  state.sect.name = sectName || `${state.player.name}之宗`;
  state.sect.rank = 1;
  state.sect.contribution = 0;
  addLog(state, '事件', `加入宗门「${state.sect.name}」，成为外门弟子。`);
  makeChronicle(state, { type: '宗门', title: '入宗', text: `你加入了「${state.sect.name}」。` });
  return `你加入了「${state.sect.name}」，成为外门弟子。修炼加成 +5%。`;
}

/** 完成宗门任务 */
export function doSectTask(state, taskId) {
  ensureLifeState(state);
  ensureSectState(state);
  if (!state.sect.name) return { logs: ['你尚未加入任何宗门。'] };
  const task = SECT_TASKS.find((t) => t.id === taskId);
  if (!task) return { logs: ['无此任务。'] };
  const logs = [`你接下宗门任务「${task.name}」：${task.desc}`];
  // 简化：直接结算
  if (task.id === 'subdue') {
    const enemy = makeEnemy(state, { stronger: true });
    const battle = resolveBattle(state, enemy, 'shengci');
    logs.push(...battle.logs);
  } else {
    logs.push(`任务完成，获得贡献 +${task.contribution}。`);
    addDaoBaseExp(state, '悟性', Rng.int(3, 8), logs);
  }
  state.sect.contribution += task.contribution;
  // 自动晋升：贡献达到更高职级门槛时逐级晋升（避免越级漏判）
  while (
    state.sect.rank < SECT_RANKS.length - 1 &&
    state.sect.contribution >= SECT_RANKS[state.sect.rank + 1].contribution
  ) {
    state.sect.rank += 1;
    logs.push(`🎉 贡献达标，晋升为「${SECT_RANKS[state.sect.rank].name}」！${SECT_RANKS[state.sect.rank].benefit}`);
    makeChronicle(state, { type: '宗门', title: '宗门晋升', text: `晋升为${SECT_RANKS[state.sect.rank].name}。` });
  }
  addLog(state, '操作', `完成宗门任务「${task.name}」，贡献+${task.contribution}。`);
  return { logs };
}

/**
 * 宗门任务奖励确定性预览（与 doSectTask 同口径，不消耗状态、无 RNG）。
 * - 常规任务：贡献 +X、悟性 +3~8（与 doSectTask 的 Rng.int(3,8) 一致）。
 * - 「降服试炼恶修」(subdue)：触发战斗，给出基于典型敌人力量的预估胜率。
 */
export function sectTaskPreview(state, taskId) {
  const task = SECT_TASKS.find((t) => t.id === taskId);
  if (!task) return null;
  const out = { id: task.id, name: task.name, desc: task.desc, contribution: task.contribution, wuxing: [3, 8], battle: null };
  if (task.id === 'subdue') {
    // 代表性试炼恶修：玩家境界 +5、战力约玩家 1.05 倍（对齐 makeEnemy 区间中点）
    const p = state.player;
    const enemy = { name: '宗门试炼恶修', level: Math.max(1, p.level + 5), power: Math.max(1, Math.round(p.power * 1.05)), beast: false };
    out.battle = previewBattle(state, enemy, 'shengci').rate;
  }
  return out;
}

/* ============================================================
 * 十七、拍卖会（竞价玩法）
 * ========================================================== */
/** 开启拍卖会（每年特定月份或机缘触发） */
export function openAuction(state) {
  ensureLifeState(state);
  ensureAuctionState(state);
  const count = Rng.int(3, 5);
  const items = [];
  for (let i = 0; i < count; i++) {
    const tpl = Rng.pick(AUCTION_ITEMS_POOL);
    const budgetIdx = Rng.int(0, AUCTION_RIVAL.budgetMul.length - 1);
    const buyout = Math.round(tpl.basePrice * AUCTION_RIVAL.buyoutMul * (0.8 + budgetIdx * 0.4));
    const rivalBudget = Math.round(tpl.basePrice * AUCTION_RIVAL.budgetMul[budgetIdx]);
    items.push({
      ...tpl,
      currentBid: tpl.basePrice, bidder: '起拍价',
      buyout, rivalBudget,
      rivalName: Rng.pick(AUCTION_RIVAL.surnames) + Rng.pick(AUCTION_RIVAL.givens),
    });
  }
  state.auction = { items, active: true, month: state.world.turns, bids: {} };
  return items;
}

/** 一口价直接拿下 */
export function buyoutAuction(state, itemIdx) {
  ensureAuctionState(state);
  if (!state.auction.active) return { ok: false, logs: ['拍卖会尚未开始。'] };
  const item = state.auction.items[itemIdx];
  if (!item) return { ok: false, logs: ['无此拍品。'] };
  const amount = item.buyout;
  if (!canAfford(state, amount)) return { ok: false, logs: [`灵石不足（一口价需 ${amount}）。`] };
  spendStones(state, amount);
  awardAuctionItem(state, item, amount);
  state.auction.items.splice(itemIdx, 1);
  return { ok: true, logs: [`💥 你以一口价 ${amount} 灵石拿下「${item.name}」，对手望尘莫及！`] };
}

/** 拍卖竞价（与对手展开竞价战；对手预算耗尽即落槌于你） */
export function placeBid(state, itemIdx, amount) {
  ensureAuctionState(state);
  if (!state.auction.active) return { ok: false, logs: ['拍卖会尚未开始。'] };
  const item = state.auction.items[itemIdx];
  if (!item) return { ok: false, logs: ['无此拍品。'] };
  amount = Math.floor(Number(amount) || 0);
  if (amount <= item.currentBid) return { ok: false, logs: [`出价需高于当前价 ${item.currentBid}。`] };
  if (!canAfford(state, amount)) return { ok: false, logs: ['灵石不足。'] };
  // 一口价：直接落槌
  if (amount >= item.buyout) return buyoutAuction(state, itemIdx);
  // 玩家出价成为当前最高
  item.currentBid = amount;
  item.bidder = '你';
  // 对手是否继续抬价（预算允许范围内）
  if (amount < item.rivalBudget) {
    const ratio = Rng.pick(AUCTION_RIVAL.raiseRatio);
    const raise = Math.max(10, Math.round(amount * ratio));
    const rivalBid = Math.min(item.rivalBudget, amount + raise);
    if (rivalBid > amount) {
      item.currentBid = rivalBid;
      item.bidder = item.rivalName;
      return { ok: false, logs: [`「${item.rivalName}」加价至 ${rivalBid} 灵石！你需出价更高才能拿下。`] };
    }
  }
  // 对手放弃 → 你以当前出价落槌
  spendStones(state, amount);
  awardAuctionItem(state, item, amount);
  state.auction.items.splice(itemIdx, 1);
  addLog(state, '操作', `拍卖会购得「${item.name}」，花费${amount}灵石。`);
  makeChronicle(state, { type: '拍卖', title: '拍卖成交', text: `以${amount}灵石拍得「${item.name}」。` });
  return { ok: true, logs: [`🎉 对手退出竞价！你以 ${amount} 灵石拍得「${item.name}」！`] };
}

/** 放弃某拍品（流拍，无消耗） */
export function withdrawAuctionItem(state, itemIdx) {
  ensureAuctionState(state);
  const item = state.auction.items[itemIdx];
  if (!item) return { ok: false, logs: ['无此拍品。'] };
  state.auction.items.splice(itemIdx, 1);
  return { ok: true, logs: [`你放弃了「${item.name}」，此物流拍。`] };
}

/** 拍卖成交后的统一发放（按类型生成对应物品） */
function awardAuctionItem(state, item, amount) {
  if (item.type === '装备') {
    const slot = guessEquipSlot({ 名称: item.name, 类型: '装备' });
    state.equipment.stash.push(generateEquip(state, slot, Rng.int(1, 4), item.name));
  } else if (item.type === '法宝') {
    state.equipment.stash.push(generateEquip(state, 'artifact', Rng.int(5, 7), item.name));
  } else if (item.type === '功法') {
    state.techniques.push({ 名称: item.name, 品级: item.rarity, 等级: 1, 经验: 0 });
    discoverItem(state, { 名称: item.name, 类型: '功法' });
  } else {
    const it = { 名称: item.name, 类型: item.type, 数量: 1, 描述: item.desc };
    if (item.effect) it.effect = item.effect;
    if (typeof item.toxicity === 'number') it.toxicity = item.toxicity;
    storeItem(state, it);
    discoverItem(state, item);
  }
  addLog(state, '操作', `拍卖会购得「${item.name}」，花费${amount}灵石。`);
}

/* ============================================================
 * 十八、秘境多层探索（与遗府残图、天命联动）
 * ========================================================== */
// 海上遗府（需残图秘境）进入需缴纳的护阵灵石；海岛通行令可减 20%（持久生效、不消耗）
const MYSTIC_REALM_ENTRY_FEE = 100;
/**
 * 宗门秘境收益确定性预览（与 exploreSectRealm 同口径，不消耗状态）。
 * 用于「深度选择」界面在进入前展示真实收益，辅助投资决策。
 */
export function sectRealmRewardPreview(state, depth = 1) {
  depth = Math.min(MYSTIC_DEPTH.max, Math.max(1, Number(depth) || 1));
  const dcfg = MYSTIC_DEPTH.of(depth);
  const contribution = Math.round(30 * dcfg.stoneMul);
  const stones = Math.round(80 * dcfg.stoneMul);
  const crystal = Math.max(1, Math.round(depth * dcfg.matMul));
  const pill = depth >= 2 ? Math.max(1, Math.round(dcfg.artMul)) : 0;
  return { contribution, stones, crystal, pill };
}

/**
 * 秘境探索收益区间预览（与 exploreMysticRealm 同口径，不消耗状态）。
 * 灵石/材料为区间估值（实际取区间随机数），法宝/妖兽为概率。
 */
export function mysticRealmRewardPreview(state, realmId, depth = 1) {
  const realm = MYSTIC_REALMS.find((r) => r.id === realmId);
  depth = Math.min(MYSTIC_DEPTH.max, Math.max(1, Number(depth) || 1));
  const dcfg = MYSTIC_DEPTH.of(depth);
  if (!realm) return null;
  const stoneMin = Math.round(realm.rewards.stones[ 0 ] * dcfg.stoneMul);
  const stoneMax = Math.round(realm.rewards.stones[ 1 ] * dcfg.stoneMul);
  const matMin = Math.max(1, Math.round(1 * dcfg.matMul));
  const matMax = Math.max(1, Math.round(3 * dcfg.matMul));
  const setFlags = setBonusFlags(state);
  const findBonus = setFlags.mysticFind || 0;
  const artChance = Math.min(100, Math.round((realm.rewards.artifactChance + findBonus) * dcfg.artMul * 100));
  const beastChance = Math.round(Math.min(0.92, realm.beastChance + dcfg.beastAdd) * 100);
  let fee = 0;
  if (realm.requiresMap) {
    const relicDiscount = state.items
      .filter((i) => i.effect && i.effect.relic)
      .reduce((mx, i) => Math.max(mx, i.effect.relic || 0), 0);
    fee = Math.max(0, Math.round(MYSTIC_REALM_ENTRY_FEE * (1 - relicDiscount / 100)));
  }
  return { stoneMin, stoneMax, matMin, matMax, artChance, beastChance, fee, requiresMap: !!realm.requiresMap, name: realm.name };
}

export function exploreMysticRealm(state, realmId, depth = 1) {
  ensureLifeState(state);
  const realm = MYSTIC_REALMS.find((r) => r.id === realmId);
  if (!realm) return { logs: ['无此秘境。'] };
  if (state.player.level < realm.minLevel) return { logs: [`修为不足，需达到 Lv.${realm.minLevel}。`] };
  depth = Math.min(MYSTIC_DEPTH.max, Math.max(1, Number(depth) || 1));
  const dcfg = MYSTIC_DEPTH.of(depth);
  const logs = [`你深入「${realm.name}·${dcfg.name}」：${realm.desc}`];
  // 遗府需要残图
  if (realm.requiresMap) {
    const maps = state.items.filter((i) => i.名称 === '海上遗府残图');
    const total = maps.reduce((s, i) => s + (i.数量 || 1), 0);
    if (total < 3) return { logs: [`需集齐 3 张「海上遗府残图」方可开启，当前 ${total} 张。`] };
    // 护阵灵石（海岛通行令可减 20%，持久生效、不消耗），先校验费用再consum残图
    const relicDiscount = state.items
      .filter((i) => i.effect && i.effect.relic)
      .reduce((mx, i) => Math.max(mx, i.effect.relic || 0), 0);
    const fee = Math.max(0, Math.round(MYSTIC_REALM_ENTRY_FEE * (1 - relicDiscount / 100)));
    if (fee > 0 && !spendStones(state, fee)) {
      return { logs: [`遗府护阵需缴纳灵石 ${fee}，当前灵石不足，无法进入。`] };
    }
    // 消耗 3 张残图
    let need = 3;
    for (const m of maps) {
      const consume = Math.min(need, m.数量 || 1);
      m.数量 -= consume;
      need -= consume;
      if (m.数量 <= 0) state.items.splice(state.items.indexOf(m), 1);
      if (need <= 0) break;
    }
    if (fee > 0) logs.push(`缴纳遗府护阵灵石 -${fee}${relicDiscount > 0 ? '（海岛通行令减费）' : ''}。`);
  }
  const setFlags = setBonusFlags(state);
  const findBonus = setFlags.mysticFind || 0;
  // 奖励结算（深度越高越丰厚）—— 先结算，再决定是否遭遇妖兽，保证深处收益严格更高
  const stones = Math.round(Rng.int(realm.rewards.stones[0], realm.rewards.stones[1]) * dcfg.stoneMul);
  addStones(state, stones);
  logs.push(`探索获得灵石 +${stones}（${dcfg.name}加成）。`);
  // 材料掉落
  if (realm.rewards.materials?.length) {
    const matName = Rng.pick(realm.rewards.materials);
    let matQty = Math.max(1, Math.round(Rng.int(1, 3) * dcfg.matMul));
    const gather = activeBeastSkillEffect(state, 'gather'); // 玄水护盾：出战灵兽助采集，灵材 +1
    if (gather) matQty += gather;
    const mat = { 名称: matName, 类型: '材料', 数量: matQty, 描述: '秘境所得' };
    if (storeItem(state, mat)) logs.push(`获得材料：${matName} ×${mat.数量}${gather ? '（玄水护盾相助，灵材丰盈）' : ''}。`);
  }
  // 法宝掉落（深度越高越易出高阶法宝）
  const artChance = (realm.rewards.artifactChance + findBonus) * dcfg.artMul;
  if (Rng.chance(artChance)) {
    const lvl = Rng.int(5, 8) + (depth - 1) * 2;
    const art = generateEquip(state, 'artifact', lvl, Rng.pick(ARTIFACT_NAMES));
    state.equipment.stash.push(art);
    discoverItem(state, art);
    logs.push(`✨ 拾得稀有法宝「${art.名称}」（${getEquipGrade(art.品阶)?.name || art.品阶}，战力+${art.战力}）！`);
  }
  // 记录最深探索层数（用于「古迹探寻」封号）
  if (depth >= (state.flags.mysticDeepest || 0)) {
    state.flags.mysticDeepest = depth;
    awardTitle(state, 'guji_tanxun');
  }
  // 妖兽遭遇（深度越高越危险，但奖励已结算，深处仍是稳赚）
  if (Rng.chance(Math.min(0.92, realm.beastChance + dcfg.beastAdd))) {
    const enemy = makeEnemy(state, { beast: true, stronger: true });
    // 深处妖兽更强
    if (depth >= 3) { enemy.power = Math.round(enemy.power * 1.3); enemy.level = Math.round(enemy.level * 1.2); }
    const battle = { enemy, type: 'yaoshou', intro: `「${realm.name}·${dcfg.name}」深处，护宝妖兽猛然苏醒！` };
    makeChronicle(state, { type: '秘境', title: `探索${realm.name}·${dcfg.name}`, text: logs.join('') });
    addLog(state, '事件', `探索秘境「${realm.name}·${dcfg.name}」：${logs.slice(1).join('')}`);
    refreshDerived(state);
    return { logs, battle };
  }
  // 深处隐藏奇遇：触发隐藏事件（如古籍/仙缘）
  if (depth >= 2 && Rng.chance(dcfg.hiddenChance)) {
    const hiddenEvt = checkSpecialEvent(state);
    if (hiddenEvt && hiddenEvt.id !== 'yinguo') {
      logs.push(`⚡ 你在${dcfg.name}发现一处隐秘洞窟，似乎另有玄机……`);
      makeChronicle(state, { type: '秘境', title: `探索${realm.name}·${dcfg.name}`, text: logs.join('') });
      addLog(state, '事件', `探索秘境「${realm.name}·${dcfg.name}」：${logs.slice(1).join('')}`);
      refreshDerived(state);
      return { logs, hiddenEvent: hiddenEvt };
    }
  }
  // 仙途纪事
  makeChronicle(state, { type: '秘境', title: `探索${realm.name}·${dcfg.name}`, text: logs.join('') });
  addLog(state, '事件', `探索秘境「${realm.name}·${dcfg.name}」：${logs.slice(1).join('')}`);
  refreshDerived(state);
  return { logs };
}

/* ============================================================
 * 十八·甲、宗门秘境（核心弟子及以上可进入，确定性收益，无妖兽风险）
 * ========================================================== */
/**
 * 潜修宗门秘境：核心弟子(rank>=3)及以上可进入本宗禁地，体悟传承获取
 * 宗门贡献与灵脉资源。完全确定性、无 RNG、无妖兽风险，作为稳定资源来源。
 * @param {object} state
 * @param {number} depth 1..MYSTIC_DEPTH.max
 * @returns {{ ok:boolean, logs:string[] }}
 */
export function exploreSectRealm(state, depth = 1) {
  ensureLifeState(state);
  if (!state.sect?.name) return { ok: false, logs: ['你尚未加入任何宗门，无处进入宗门秘境。'] };
  if ((state.sect.rank || 0) < 3) {
    return { ok: false, logs: [`需核心弟子及以上方可进入宗门秘境（当前职级：${SECT_RANKS[state.sect.rank]?.name || '散修'}）。`] };
  }
  depth = Math.min(MYSTIC_DEPTH.max, Math.max(1, Number(depth) || 1));
  const dcfg = MYSTIC_DEPTH.of(depth);
  const logs = [`你步入「宗门秘境·${dcfg.name}」，灵脉环绕，宗门先辈留下的洞天福地静候你的体悟……`];
  // 体悟传承：宗门贡献（确定性，按深度缩放）
  const gain = Math.round(30 * dcfg.stoneMul);
  state.sect.contribution += gain;
  logs.push(`体悟宗门传承，宗门贡献 +${gain}。`);
  // 采得灵脉矿髓：下品灵石（确定性）
  const stones = Math.round(80 * dcfg.stoneMul);
  addStones(state, stones);
  logs.push(`采得灵脉矿髓，下品灵石 +${stones}。`);
  // 灵脉所凝材料（确定性，用量随深度 ×matMul 缩放，与罗盘面板承诺一致）
  const matCount = Math.max(1, Math.round(depth * dcfg.matMul));
  const mat = { 名称: '宗门灵脉晶', 类型: '材料', 数量: matCount, 描述: '宗门秘境灵脉所凝之晶，可充作炼器灵材。' };
  if (storeItem(state, mat)) logs.push(`获得材料：宗门灵脉晶 ×${mat.数量}。`);
  // 深处藏有宗门丹房旧藏（确定性，depth>=2 可得聚气丹，数量随深度 ×artMul 缩放）
  if (depth >= 2) {
    const pillCount = Math.max(1, Math.round(dcfg.artMul));
    const pill = { 名称: '聚气丹', 类型: '丹药', 数量: pillCount, effect: { exp: 90 }, toxicity: 8, 描述: '宗门丹房旧藏，服下修为 +90（连续服用生丹毒）。' };
    if (storeItem(state, pill)) logs.push(`于深处丹室寻得宗门旧藏：聚气丹 ×${pillCount}。`);
  }
  makeChronicle(state, { type: '宗门', title: `潜修宗门秘境·${dcfg.name}`, text: logs.join('') });
  addLog(state, '事件', `潜修宗门秘境·${dcfg.name}：${logs.slice(1).join('')}`);
  refreshDerived(state);
  return { ok: true, logs };
}

/* ============================================================
 * 十九、修仙机缘事件链（走火入魔、心魔、天道注视、因果债）
 * ========================================================== */
export function checkSpecialEvent(state) {
  ensureLifeState(state);
  for (const evt of SPECIAL_EVENTS) {
    if (state.player.level < evt.minLevel) continue;
    try {
      if (evt.trigger(state)) return evt;
    } catch { /* 忽略触发判定异常 */ }
  }
  return null;
}

/** 结算机缘事件选项 */
export function resolveSpecialEvent(state, evt, optionIdx) {
  ensureLifeState(state);
  const opt = evt.options[optionIdx];
  if (!opt) return { logs: ['无效选项。'] };
  const logs = [`【${evt.name}】${evt.desc}`];
  const p = state.player;
  switch (opt.effect) {
    case 'daoMind': {
      const success = Rng.chance(Math.min(0.8, 0.3 + p.daoBase['道心'].level / 100));
      if (success) { logs.push('你以坚定的道心化解危机，道心经验大增！'); addDaoBaseExp(state, '道心', Rng.int(15, 30), logs); }
      else { logs.push('道心不稳，走火入魔！修为跌落 3 层。'); p.level = Math.max(1, p.level - 3); p.exp = 0; }
      break;
    }
    case 'pill': {
      const idx = state.items.findIndex((i) => i.名称 === opt.needItem);
      if (idx >= 0) { state.items[idx].数量 -= 1; if (state.items[idx].数量 <= 0) state.items.splice(idx, 1); logs.push(`你服下「${opt.needItem}」，心神安宁，化险为夷。`); }
      else {
        logs.push('你没有所需丹药，只能硬扛……修为跌落 2 层。');
        p.level = Math.max(1, p.level - 2);
        p.exp = 0;
      }
      break;
    }
    case 'random':
      if (Rng.chance(0.5)) { logs.push('你任由真气游走，竟意外突破瓶颈！修为 +2 层。'); p.level += 2; }
      else { logs.push('真气暴走，修为跌落 4 层。'); p.level = Math.max(1, p.level - 4); p.exp = 0; }
      break;
    case 'daoYun':
      logs.push('你以先天道韵化解心魔，道韵经验大增！');
      addDaoYunExp(state, Rng.int(30, 50), logs);
      break;
    case 'companion':
      if (state.flags.companionMonths > 0) { logs.push(`道友「${state.flags.companion}」及时赶到，助你脱离幻境。`); }
      else { logs.push('无道友在侧，你独自苦撑，修为跌落 1 层。'); p.level = Math.max(1, p.level - 1); p.exp = 0; }
      break;
    case 'follow':
      logs.push('你顺应天道，获得天道庇护：下次渡劫成功率 +15%。');
      state.flags.tiandaoBlessing = (state.flags.tiandaoBlessing || 0) + 15;
      break;
    case 'defy':
      logs.push('你逆天而行！道心大涨，但天道降下惩罚：下次渡劫难度提高。');
      addDaoBaseExp(state, '道心', 40, logs);
      state.flags.tiandaoCurse = true;
      break;
    case 'apologize':
      if (spendStones(state, opt.cost || 200)) logs.push(`你赔礼道歉，花费灵石 ${opt.cost}，事了拂衣去。`);
      else { logs.push('灵石不足，对方大怒，强行开战！'); return { logs, battle: { enemy: makeEnemy(state, { stronger: true }), type: 'shengci', intro: '因果债主不愿罢休！' } }; }
      break;
    case 'battle':
      return { logs, battle: { enemy: makeEnemy(state, { stronger: true }), type: 'shengci', intro: '因果债主强行索战！' } };
    case 'relic': {
      const enemy = makeEnemy(state, { stronger: true });
      logs.push('你破禁取宝，禁制轰鸣，守护傀儡骤然杀出！');
      return { logs, battle: { enemy, type: 'shengci', intro: '遗宝守卫扑杀而来！' } };
    }
    case 'leave':
      logs.push('你判断福缘未到，悄然离去，却也避开了一场凶险。');
      break;
    case 'vein': {
      const stones = Rng.int(200, 600);
      addStones(state, stones);
      addDaoBaseExp(state, '悟性', Rng.int(5, 12), logs);
      logs.push(`你盘膝汲取灵脉，灵石 +${stones}，悟性经验大涨！`);
      break;
    }
    case 'veinDao': {
      addDaoBaseExp(state, '根骨', Rng.int(8, 16), logs);
      logs.push('你将灵脉之精引入道基，根骨愈发坚实！');
      break;
    }
    case 'flee':
      logs.push('你佯装不敌，遁走千里，却也折损了些许修为（跌落 2 层）。');
      p.level = Math.max(1, p.level - 2); p.exp = 0;
      break;
    case 'help': {
      const gift = Rng.chance(0.5) ? '灵石' : '丹药';
      if (gift === '灵石') { const s = Rng.int(50, 200); addStones(state, s); logs.push(`你救下散修，对方赠予灵石 ${s} 以报救命之恩。`); }
      else { state.items.push({ 名称: '凝血丹', 类型: '丹药', 数量: 1, 描述: '散修所赠' }); discoverItem(state, { 名称: '凝血丹', 类型: '丹药' }); logs.push('你救下散修，对方赠你一枚凝血丹疗伤。'); }
      addDaoBaseExp(state, '道心', Rng.int(3, 8), logs);
      break;
    }
    case 'ignore':
      logs.push('你冷眼离去。修仙界本就弱肉强食，只是心头略泛一丝凉意。');
      break;
    case 'fox':
      state.items.push({ 名称: '凝露草', 类型: '材料', 数量: Rng.int(2, 4), 描述: '白狐所赠灵草' });
      discoverItem(state, { 名称: '凝露草', 类型: '材料' });
      logs.push('白狐将衔来的灵草置于你掌心，化作一缕清风离去。灵草 +数株。');
      break;
    case 'foxLeave':
      logs.push('你将白狐放归山林，它回头望你一眼，消失在暮色中。');
      break;
    default:
      logs.push('事件平息。');
  }
  refreshDerived(state);
  makeChronicle(state, { type: '机缘', title: evt.name, text: logs.join('') });
  addLog(state, '事件', `机缘事件「${evt.name}」：${logs.slice(1).join('')}`);
  return { logs };
}

/* ============================================================
 * 二十、新增罗盘选项注册（灵兽/宗门/拍卖/秘境/机缘）
 * ========================================================== */
/** 返回本月可用的额外玩法选项，供 generateCompass 调用 */
export function extraCompassOptions(state) {
  ensureLifeState(state);
  const opts = [];
  // 秘境探索（达到等级后出现；列出全部已解锁秘境，玩家可逐一选择并定深度）
  const mystics = availableMysticRealms(state);
  for (const m of mystics) {
    const mapCount = state.items.filter((i) => i.名称 === '海上遗府残图').reduce((sum, i) => sum + (i.数量 || 1), 0);
    const needMap = m.requiresMap
      ? (mapCount >= 3 ? '（已集齐 3 张残图，可开启！）' : `（需集齐 3 张「海上遗府残图」开启，当前持有 ${mapCount} 张）`)
      : '';
    opts.push({ icon: '🏔️', tag: '秘境', title: `探索「${m.name}」`, desc: m.desc + needMap, action: { type: 'mystic', realmId: m.id }, risk: true, preview: '高风险高回报：材料、灵石、法宝；可能遭遇护宝妖兽' });
  }
  // 拍卖会（偶发）
  if (state.world.month === 9 || state.flags.auctionAvailable) {
    opts.push({ icon: '🔨', tag: '因缘', title: '参加修真拍卖会', desc: '各路修士齐聚竞价，可能淘到稀有之物。', action: { type: 'auction' }, preview: '需准备灵石，与 NPC 竞价拍品' });
  }
  // 灵兽收服（灵兽栏有空位即可前往；「灵兽契约」改为收服成功后的驯兽凭证，不再作为入口门槛，避免新玩家死锁）
  if (canTameBeast(state)) {
    opts.push({ icon: '🐺', tag: '灵兽', title: '前往灵兽栖息地', desc: '尝试收服一头灵兽，协助战斗与采集。', action: { type: 'tameBeast' }, preview: '御兽等级越高成功率越高；成功收服将获赠「灵兽契约」作为驯兽凭证' });
  }
  // 宗门任务（加入宗门后）
  if (state.sect?.name) {
    opts.push({ icon: '🏯', tag: '宗门', title: `执行宗门任务（${state.sect.name}）`, desc: `当前职级：${SECT_RANKS[state.sect.rank]?.name}，贡献 ${state.sect.contribution}。`, action: { type: 'sectTask' }, preview: '换取贡献、晋升职级、获得修炼加成' });
  }
  // 宗门秘境（核心弟子及以上可入）：确定性收益，无妖兽风险
  if ((state.sect?.rank || 0) >= 3) {
    opts.push({ icon: '🏞️', tag: '宗门', title: '潜修宗门秘境', desc: '宗门禁地，核心弟子及以上方可进入。体悟传承得宗门贡献，采灵脉矿髓与材料（无妖兽风险）。', action: { type: 'sectRealm' }, preview: '确定性收益：宗门贡献 + 下品灵石 + 材料（深处额外得聚气丹）' });
  }
  // 机缘事件（自动检测，有则出现）
  const special = checkSpecialEvent(state);
  if (special) {
    opts.unshift({ icon: '⚠️', tag: '机缘', title: special.name, desc: special.desc, action: { type: 'specialEvent', eventId: special.id }, risk: true, preview: '修仙路上的特殊考验，处置得当获益巨大' });
  }
  // 观星卜算（灵石充裕时出现）：请动星盘，得确定性道韵/悟性经验与一则天机提示
  if (canAfford(state, DIVINATION.cost)) {
    opts.push({ icon: '🔮', tag: '天机', title: '观星卜算', desc: `夜观天象，请动星盘（耗灵石 ${DIVINATION.cost}）。道韵经验+${DIVINATION.daoYun}，悟性经验+${DIVINATION.wuxing}，并得下月一则天机运势加成。`, action: { type: 'divination' }, preview: '收益：道韵/悟性经验 + 下月天机运势（修炼/灵草/商道/悟性四类之一）' });
  }
  // 太初仙缘（持有「仙缘·太初之气」时出现）：上古仙缘使者处兑换绝世机缘（确定性、无 RNG、无风险）
  const taichu = state.items.filter((i) => i.名称 === '仙缘·太初之气').reduce((sum, i) => sum + (i.数量 || 1), 0);
  if (taichu >= 1) {
    opts.push({ icon: '🌟', tag: '天机', title: '太初仙缘·兑换绝世机缘', desc: `持「仙缘·太初之气」×1，寻上古仙缘使者兑换一段绝世机缘：修为+2000、道韵+40、悟性+25、下品灵石+800，并获赠天品功法《太虚剑经》（已持有则改赠灵石）。当前持有 ${taichu} 份。`, action: { type: 'taichuXianyuan' }, preview: '收益：修为/道韵/悟性大涨 + 赠天品功法《太虚剑经》' });
  }
  // 仙缘兑换（持有「仙缘」时出现）：寻常机缘变现为道途助益（确定性、无 RNG、无风险）
  const xy = state.items.filter((i) => i.名称 === '仙缘').reduce((sum, i) => sum + (i.数量 || 1), 0);
  if (xy >= 1) {
    opts.push({ icon: '🍀', tag: '天机', title: '仙缘兑换·道途助益', desc: `持「仙缘」×1，于坊间奇人处兑换一段道途助益：修为+200、道韵+15、悟性+20、下品灵石+300。当前持有 ${xy} 份。`, action: { type: 'xianyuanExchange' }, preview: '收益：修为/道韵/悟性 + 下品灵石 300（确定性）' });
  }
  return opts;
}
