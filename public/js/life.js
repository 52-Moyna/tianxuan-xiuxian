import { ensureCodexState, discoverItem, ensureBeastState, ensureSectState, ensureAuctionState, setBonusFlags, rollPillQuality } from './codex.js';
import { EQUIP_SLOTS, EQUIP_GRADES, getEquipGradeByLevel, makeEquipName, rollEquipGrade, MATERIAL_TYPES, getDaoBaseMilestoneBonus, DAO_BASES, BAG_GRADES, bagGradeOf, calcEquipPower, BAG_UPGRADE_BASE, BAG_UPGRADE_STEP, CAVE_LEVELS, HERB_TYPES, HERB_GARDEN_MAX, PILL_RECIPES, CURRENCIES, REALMS, HERB_HYBRIDS, HERB_HYBRID_COST } from './data.js';
export { HERB_HYBRID_COST, HERB_HYBRIDS };


/**
 * life.js - 修仙生活系统
 *
 * 将地域、行囊、百艺、装备/法宝和道缘的长期规则集中管理。
 * 这里不操作 DOM，UI 只消费返回结果。
 */

export const REGION_TRAVEL = {
  zhongzhou: { neighbors: ['nanming', 'xiji', 'beiming'], cost: 80, months: 1, specialty: '消息与功法', flavor: '宗门车队与商旅往来不绝。', danger: 2, realmReq: 1 },
  donghuang: { neighbors: ['lingnan', 'haiwai'], cost: 120, months: 1, specialty: '妖兽材料', flavor: '荒野灵脉中常有妖兽出没。', danger: 4, realmReq: 3 },
  nanming: { neighbors: ['zhongzhou', 'lingnan'], cost: 100, months: 1, specialty: '炼器火材', flavor: '地火映红半边天，炼器师昼夜不息。', danger: 3, realmReq: 2 },
  xiji: { neighbors: ['zhongzhou', 'beiming'], cost: 100, months: 1, specialty: '符箓与阵材', flavor: '冰原遗迹露出古阵残痕。', danger: 3, realmReq: 3 },
  beiming: { neighbors: ['zhongzhou', 'xiji', 'haiwai'], cost: 140, months: 1, specialty: '海产灵材', flavor: '巨舟载着各地修士驶向外海。', danger: 3, realmReq: 4 },
  lingnan: { neighbors: ['donghuang', 'nanming'], cost: 90, months: 1, specialty: '灵植与毒材', flavor: '百越雨林里，灵植商人背着竹篓穿行。', danger: 4, realmReq: 2 },
  haiwai: { neighbors: ['donghuang', 'beiming'], cost: 180, months: 2, specialty: '遗府与奇珍', flavor: '海雾深处偶尔显出上古仙岛的轮廓。', danger: 5, realmReq: 5 },
};

/**
 * 地域危险度 → 妖兽等级区间（与玩家战力脱钩）。
 * realmReq(1-5) 映射为该地域基准境界的最小等级；danger(2-5) 作为等级上浮系数。
 * 返回确定性区间 [min, max]，便于测试断言且不引入随机。
 */
export function beastLevelRange(regionId, stronger = false) {
  const reg = REGION_TRAVEL[regionId] || REGION_TRAVEL.zhongzhou;
  const req = Math.min(5, Math.max(1, reg.realmReq || 1));
  const danger = Math.min(5, Math.max(2, reg.danger || 2));
  const realm = REALMS[req - 1] || REALMS[0];
  // 地域基准等级 = 该地域「要求境界」下限 + 危险度上浮；区间宽度随危险度增大，
  // 使低境界玩家撞上的多为同级偏上妖兽（可争胜负），高境界玩家回低危区则碾压。
  const base = realm.min + (danger - 1) * 8;
  const spread = danger * 4 + 2;
  let min = Math.max(1, base - spread);
  let max = Math.max(1, base + spread);
  if (stronger) { min += 8; max += 8; }
  max = Math.min(100, max);
  if (max < min) max = min;
  return { min, max };
}

/** 妖兽战力：由等级推导，与玩家 calcPower 同口径（每级约 4.5 战力，无装备/灵兽加成），
 *  仅叠加少量危险度微调，使高危区妖兽略凶悍而不失控。确定性，无随机。 */
export function beastPowerOfLevel(level, danger = 2) {
  const d = Math.min(5, Math.max(2, danger || 2));
  return Math.max(1, Math.round(level * 4.5) + (d - 2) * 8);
}

export const REGION_MARKET = {
  zhongzhou: [
    { name: '基础功法玉简', type: '功法', price: 180, desc: '凡品功法，适合初学者。', effect: { technique: '基础吐纳术' } },
    { name: '疗伤丹', type: '丹药', price: 40, desc: '清除 1 个月伤势。', effect: { heal: true } },
    { name: '制式护心甲', type: '装备', price: 160, level: 1, desc: '稳定防护，战力 +1。' },
    { name: '旅行凭证', type: '消耗品', price: 160, desc: '下次跨域旅行费用减半。', effect: { travel: 50 } },
  ],
  donghuang: [
    { name: '青风狼内丹', type: '材料', price: 45, desc: '妖兽内丹，炼丹主药。' },
    { name: '妖纹护腕', type: '装备', price: 220, level: 2, desc: '以妖纹强化筋骨，战力 +2。' },
    { name: '驭兽香', type: '消耗品', price: 70, desc: '提高下一次收服灵兽的成功率。', effect: { tame: 20 } },
  ],
  nanming: [
    { name: '赤铜精', type: '材料', price: 70, desc: '炼器辅材，火属性法器偏爱。' },
    { name: '火纹战衣', type: '装备', price: 260, level: 3, desc: '耐火护具，战力 +3。' },
    { name: '地火引', type: '消耗品', price: 90, desc: '百艺配方制作时额外产出 1 件（自动消耗）。', effect: { craft: 15 } },
  ],
  xiji: [
    { name: '冰魄符纸', type: '材料', price: 55, desc: '制符与阵法通用材料。' },
    { name: '破阵短剑', type: '装备', price: 300, level: 3, desc: '探索遗迹时更容易发现线索。' },
    { name: '低阶护身符', type: '消耗品', price: 110, desc: '下一次战斗失败时减轻损失。', effect: { ward: true } },
  ],
  beiming: [
    { name: '海灵珠', type: '材料', price: 80, desc: '炼丹、阵法与地图旅行均可使用。' },
    { name: '海兽皮甲', type: '装备', price: 280, level: 3, desc: '轻便耐久，战力 +3。' },
    { name: '远航凭证', type: '消耗品', price: 160, desc: '下次跨域旅行费用减半。', effect: { travel: 50 } },
  ],
  lingnan: [
    { name: '百越灵草', type: '材料', price: 45, desc: '炼丹主药，灵植师最喜欢的材料。' },
    { name: '百毒囊', type: '装备', price: 240, level: 2, desc: '探索妖兽巢穴时额外获得材料。' },
    { name: '驱虫粉', type: '消耗品', price: 35, desc: '降低雨林探索风险。', effect: { explore: 15 } },
  ],
  haiwai: [
    { name: '海上遗府残图', type: '线索', price: 260, desc: '集齐线索可开启一次遗府探索。' },
    { name: '星砂', type: '材料', price: 120, desc: '高阶炼器与法宝修复材料。' },
    { name: '海岛通行令', type: '消耗品', price: 220, desc: '降低海外遗府探索的费用。', effect: { relic: 20 } },
  ],
};

export const ART_RECIPES = {
  炼丹: [
    { id: '聚气丹', name: '聚气丹', need: { '百越灵草': 1, '海灵珠': 1 }, output: { name: '聚气丹', type: '丹药', quantity: 2, effect: { exp: 90 }, desc: '服用后修为 +90。' }, value: 80 },
    { id: '凝血丹', name: '凝血丹', need: { '百年灵芝': 1, '青风狼内丹': 1 }, output: { name: '凝血丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除伤势。' }, value: 90 },
    // 兽材闭环：妖兽灵草 → 凝元丹（exp）；妖兽兽骨 → 兽骨续命丹（heal）
    { id: 'ningyuan', name: '凝元丹', need: { '妖兽灵草': 2 }, output: { name: '凝元丹', type: '丹药', quantity: 1, effect: { exp: 100 }, desc: '服用后修为 +100。' }, value: 110 },
    { id: 'shougu_dan', name: '兽骨续命丹', need: { '妖兽兽骨': 2 }, output: { name: '兽骨续命丹', type: '丹药', quantity: 1, effect: { heal: true }, desc: '服用后清除全部伤势。' }, value: 90 },
  ],
  炼器: [
    { id: '护心甲', name: '护心甲', need: { '赤铜精': 2, '铁背苍熊内丹': 1 }, output: { name: '护心甲', type: '装备', quantity: 1, level: 3, desc: '稳定防护装备，战力 +3。' }, value: 260 },
    { id: '星纹剑', name: '星纹剑', need: { '赤铜精': 1, '星砂': 1 }, output: { name: '星纹剑', type: '装备', quantity: 1, level: 4, desc: '精炼武器，战力 +4。' }, value: 420 },
    // 宗门灵脉晶真实消费点：将「宗门灵脉晶」（宗门秘境产出）作为炼器材料，使其成为可用灵材而非死道具
    { id: 'lingmai_shi', name: '灵脉石饰', need: { '宗门灵脉晶': 1, '矿石': 2 }, output: { name: '灵脉石饰', type: '装备', quantity: 1, level: 5, 部位: 'accessory', desc: '宗门秘境灵脉凝琢的石饰，温养元神，战力 +5。' }, value: 220 },
    { id: 'free', name: '自由锻造', need: { '赤铜精': 1 }, output: { type: '装备', quantity: 1, level: 3, desc: '自选部位锻造一件装备，战力随品阶浮动。' }, value: 200 },
    // 残片修复：法宝残片（游历/秘境战利品）+ 星砂 → 重铸为可用灵珠法宝，消除「残片法宝」死道具与“待修复成长”假承诺
    { id: 'repair_canpian', name: '残片修复', need: { '残片法宝': 1, '星砂': 1 }, output: { name: '灵珠法宝', type: '法宝', quantity: 1, level: 3, desc: '由法宝残片重铸而成的灵珠法宝（法器）。' }, value: 220 },
  ],
  制符: [
    { id: '护身符', name: '护身符', need: { '冰魄符纸': 1, '海灵珠': 1 }, output: { name: '护身符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '战斗失败时减轻损失。' }, value: 100 },
    // 兽材闭环：妖兽皮毛 → 兽皮护符（ward），落实图鉴"可制防具或符箓"
    { id: 'pelt_talisman', name: '兽皮护符', need: { '妖兽皮毛': 3 }, output: { name: '兽皮护符', type: '消耗品', quantity: 2, effect: { ward: true }, desc: '以妖兽皮毛揉制的护符，战斗失败时减轻损失。' }, value: 120 },
  ],
  阵法: [
    { id: '聚灵阵旗', name: '聚灵阵旗', need: { '冰魄符纸': 2, '星砂': 1 }, output: { name: '聚灵阵旗', type: '消耗品', quantity: 1, effect: { cultivateBoostMonths: 1 }, desc: '下次修炼效率提升（+15%，持续1月）。' }, value: 180 },
  ],
  灵植: [
    { id: '百年灵芝', name: '百年灵芝', need: { '百越灵草': 2 }, output: { name: '百年灵芝', type: '材料', quantity: 1, desc: '炼丹主药，也可在坊市出售。' }, value: 100 },
  ],
  御兽: [
    { id: '驯兽口粮', name: '驯兽口粮', need: { '青风狼内丹': 1, '百越灵草': 1 }, output: { name: '驯兽口粮', type: '消耗品', quantity: 2, effect: { tame: 15 }, desc: '提高下一次收服灵兽成功率。' }, value: 120 },
  ],
};

export const RELATION_BENEFITS = [
  { min: 0, name: '陌路', benefit: '只能查看基本资料。', color: 'dim' },
  { min: 1, name: '一面之缘', benefit: '可煮茶，偶尔触发路遇事件。', color: 'gray' },
  { min: 40, name: '熟识', benefit: '可论道；该 NPC 的专长开始影响事件。', color: 'jade' },
  { min: 60, name: '道友', benefit: '每月有机会获得援助或情报，可邀请同行。', color: 'gold' },
  { min: 80, name: '心腹/道侣', benefit: '解锁专属事件、稳定月度协助与特殊结局。', color: 'red' },
];

const REGION_NAMES = {
  zhongzhou: '中州圣城', donghuang: '东荒妖域', nanming: '南明离火域',
  xiji: '西极玄冰域', beiming: '北冥瀚海', lingnan: '岭南百越', haiwai: '海外仙岛',
};


function isRealEquipment(item) {
  return item && typeof item === 'object' && item.名称 && item.名称 !== '无' && item.名称 !== '赤手空拳';
}

function isArtifact(item) {
  return isRealEquipment(item) && (item.类型 === '法宝' || Number(item.等级) >= 5 || String(item.描述 || '').includes('法宝'));
}

/** 把旧版 gear/artifact/gearSlots/artifactSlots 迁移到新版多部位结构 */
function migrateEquipment(eq) {
  const slots = {};
  for (const s of EQUIP_SLOTS) slots[s.id] = null;
  // 保留已有备用装备（ensureLifeState 会在每次操作时重建 equipment，必须不丢失 stash）
  slots.stash = Array.isArray(eq.stash) ? eq.stash.slice() : [];

  // 1) 优先保留「现代格式」各部位已装备道具（equip 后写入 weapon/armor/...）
  for (const s of EQUIP_SLOTS) {
    if (isRealEquipment(eq[s.id])) slots[s.id] = normalizeEquip(eq[s.id], s.id);
  }

  // 2) 旧版主装备（仅在对应部位为空时填充，兼容老存档）
  const legacyMain = isRealEquipment(eq.main) ? eq.main : null;
  const oldGear = isRealEquipment(eq.gear) ? eq.gear : (legacyMain && !isArtifact(legacyMain) ? legacyMain : null);
  const oldArtifact = isRealEquipment(eq.artifact) ? eq.artifact : (legacyMain && isArtifact(legacyMain) ? legacyMain : null);

  if (oldGear && !slots.weapon) slots.weapon = normalizeEquip(oldGear, 'weapon');
  if (oldArtifact && !slots.artifact) slots.artifact = normalizeEquip(oldArtifact, 'artifact');

  // 旧版备用槽
  const legacySlots = Array.isArray(eq.slots) ? eq.slots.filter(isRealEquipment) : [];
  const oldGearSlots = Array.isArray(eq.gearSlots) ? eq.gearSlots : legacySlots.filter((x) => !isArtifact(x));
  const oldArtifactSlots = Array.isArray(eq.artifactSlots) ? eq.artifactSlots : legacySlots.filter(isArtifact);
  for (const it of [...oldGearSlots.filter((x) => !isArtifact(x)), ...oldArtifactSlots, ...oldGearSlots.filter(isArtifact)]) {
    if (!isRealEquipment(it)) continue;
    const slot = guessEquipSlot(it);
    if (!slots[slot]) slots[slot] = normalizeEquip(it, slot);
    else slots.stash.push(normalizeEquip(it, slot));
  }
  return slots;
}

function guessEquipSlot(item) {
  if (item.类型 === '法宝' || isArtifact(item)) return 'artifact';
  const name = String(item.名称 || '');
  if (/剑|刀|枪|锤|梭|环|铃|扇/.test(name)) return 'weapon';
  if (/甲|衣|袍|铠/.test(name)) return 'armor';
  if (/靴|鞋|履/.test(name)) return 'boots';
  if (/裤|裙/.test(name)) return 'pants';
  if (/佩|符|珠|牌|坠|戒|戒指|空间/.test(name)) return 'accessory';
  return 'weapon';
}

/** 标准化装备字段，缺失的补全 */
export function normalizeEquip(item, slot) {
  if (!item || typeof item !== 'object') return null;
  const level = Number(item.等级) || Number(item.level) || 1;
  const grade = item.品阶 ? EQUIP_GRADES.find((g) => g.id === item.品阶 || g.name === item.品阶) : getEquipGradeByLevel(level);
  const finalSlot = item.部位 || slot || guessEquipSlot(item);
  const name = item.名称 || makeEquipName(finalSlot, grade);
  const power = calcEquipPower(finalSlot, level, grade);
  return {
    名称: name, 部位: finalSlot, 品阶: grade.id, 等级: level, 战力: power,
    描述: item.描述 || `${grade.name}${EQUIP_SLOTS.find((s) => s.id === finalSlot)?.name || '装备'}，战力+${power}。`,
    效果: item.效果 || {}, 价值: item.价值 || Math.max(10, Math.round(power * 15 * (grade?.priceMul || 1))),
  };
}

export function equipSlotName(slot) {
  return EQUIP_SLOTS.find((s) => s.id === slot)?.name || slot;
}

export function equippedItems(state) {
  ensureLifeState(state);
  // 不含 artifact：法宝战力由 artifactPower() 单独计入，避免 calcPower 重复计算（法宝超额翻倍）
  return Object.entries(state.equipment).filter(([k, v]) => k !== 'stash' && k !== 'artifact' && isRealEquipment(v));
}

export function totalEquipPower(state) {
  return equippedItems(state).reduce((s, [, v]) => s + (Number(v.战力) || 0), 0);
}

export function ensureLifeState(state) {
  if (!state.world) state.world = { year: 1000, month: 1, turns: 0, region: '中州圣城', regionId: 'zhongzhou', news: [] };
  if (!state.cave) state.cave = { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0 };
  state.cave.garden = Array.isArray(state.cave.garden) ? state.cave.garden : [];
  const regionName = String(state.world.region || '中州圣城');
  const found = Object.entries(REGION_NAMES).find(([id, name]) => id === state.world.regionId || name === regionName || regionName.includes(name));
  state.world.regionId = found?.[0] || 'zhongzhou';
  state.world.region = REGION_NAMES[state.world.regionId] || regionName;
  state.world.travel = state.world.travel || { destination: '', remaining: 0 };
  state.world.marketTrend = state.world.marketTrend || {};
  state.world.market = state.world.market || { stock: [], refreshTurn: -1 };
  state.inventory = state.inventory || { capacity: 100, used: 0, bagName: '乾坤储物袋', upgrades: 0 };
  state.inventory.ringBonus = Number(state.inventory.ringBonus) || 0; // 戒指（空间戒）带来的储物加成
  state.inventory.capacity = Number(state.inventory.capacity) || 100;
  state.inventory.upgrades = Math.max(0, Number(state.inventory.upgrades) || 0);
  state.equipment = migrateEquipment(state.equipment || {});
  state.chronicle = Array.isArray(state.chronicle) ? state.chronicle : [];
  state.settings = { animations: true, autoSave: true, textSize: 'normal', ...state.settings };
  // 道基明细归一化：旧档 daoBase 可能缺键，缺失则按默认补齐，避免后续按 '根骨'/'道心'/'气运' 等取值崩溃
  state.player = state.player || {};
  state.player.daoBase = state.player.daoBase || {};
  for (const b of DAO_BASES) if (!state.player.daoBase[b.name]) state.player.daoBase[b.name] = { level: 1, exp: 0 };
  // 封号系统状态标准化（旧档若无 titles 字段，初始化为空）
  if (!Array.isArray(state.player.titles)) state.player.titles = [];
  if (state.player.activeTitle === undefined) state.player.activeTitle = '';
  state.inventory.used = inventoryUsed(state);
  // 新玩法状态标准化（灵兽/宗门/拍卖/图鉴/丹毒）
  ensureBeastState(state);
  ensureSectState(state);
  ensureAuctionState(state);
  ensureCodexState(state);
  state.flags = state.flags || {};
  if (state.flags.omen && typeof state.flags.omen !== 'object') state.flags.omen = null;
  state.flags.pillToxicity = Math.max(0, Number(state.flags.pillToxicity) || 0);
  state.flags.seclusionStreak = Math.max(0, Number(state.flags.seclusionStreak) || 0);
  state.flags.kills = Math.max(0, Number(state.flags.kills) || 0);
  if (typeof state.flags.refinedPills !== 'number') state.flags.refinedPills = 0;
  if (typeof state.flags.cultivateBoostMonths !== 'number') state.flags.cultivateBoostMonths = 0;
  ensureAlchemyState(state);
  for (const npc of state.npcs || []) {
    npc.level = Number(npc.level) || Number(String(npc.realm || '').match(/(\d+)/)?.[1]) || 1;
    npc.relation = Number.isFinite(Number(npc.relation)) ? Number(npc.relation) : relationIndex(npc.favor || 0);
    npc.region = npc.region || state.world.region;
    npc.meetCount = Number(npc.meetCount) || 0;
    npc.mood = npc.mood || '平静';
  }
  return state;
}

export function relationIndex(favor) {
  const f = Number(favor) || 0;
  if (f >= 80) return 4;
  if (f >= 60) return 3;
  if (f >= 40) return 2;
  if (f > 0) return 1;
  return 0;
}

export function relationBenefit(favor) {
  const idx = relationIndex(favor);
  return RELATION_BENEFITS[idx];
}

export function inventoryUsed(state) {
  return (state.items || []).reduce((sum, item) => {
    if (item.类型 === '容器') return sum;
    const quantity = Math.max(1, Number(item.数量) || 1);
    return sum + itemSpace(item) * quantity;
  }, 0);
}

export function itemSpace(item) {
  return Math.max(1, Number(item.slots) || (item.类型 === '装备' || item.类型 === '法宝' ? 2 : 1));
}

export function canStore(state, item) {
  const quantity = Math.max(1, Number(item.数量) || 1);
  return inventoryUsed(state) + itemSpace(item) * quantity <= state.inventory.capacity + (state.inventory.ringBonus || 0);
}

export function storeItem(state, item) {
  ensureLifeState(state);
  if (!canStore(state, item)) return false;
  const itemSig = `${item.名称} ${JSON.stringify(item.effect || {})}`;
  const same = state.items.find((x) => `${x.名称} ${JSON.stringify(x.effect || {})}` === itemSig);
  if (same && item.类型 !== '装备' && item.类型 !== '法宝') same.数量 = (same.数量 || 1) + (item.数量 || 1);
  else state.items.push({ ...item, 数量: item.数量 || 1, slots: itemSpace(item) });
  state.inventory.used = inventoryUsed(state);
  discoverItem(state, item);
  return true;
}

/** 整理行囊：按类型稳定排序，并合并非装备/法宝的同类堆叠（storeItem 已即时合并，
 *  此处作为安全兜底 + 排序，使同类物品聚拢、装备/法宝保持独立）。返回整理后物品件数。 */
export function organizeBag(state) {
  ensureLifeState(state);
  const TYPE_ORDER = { '装备': 0, '法宝': 1, '丹药': 2, '道具': 3, '消耗品': 4, '材料': 5, '杂物': 6, '容器': 7 };
  const resolveType = (it) => (it._equip ? '装备' : (it.类型 || '杂物'));
  const merged = [];
  const bySig = new Map();
  const sigOf = (it) => `${it.名称} ${JSON.stringify(it.effect || {})}`;
  for (const it of state.items) {
    const stackable = it.类型 !== '装备' && it.类型 !== '法宝' && !it._equip;
    if (stackable) {
      const sig = sigOf(it);
      const same = bySig.get(sig);
      if (same) { same.数量 = (same.数量 || 1) + (it.数量 || 1); continue; }
      const copy = { ...it, 数量: it.数量 || 1 };
      merged.push(copy);
      bySig.set(sig, copy);
    } else {
      merged.push({ ...it, 数量: it.数量 || 1 });
    }
  }
  merged.sort((a, b) => {
    const ta = TYPE_ORDER[resolveType(a)] ?? 99;
    const tb = TYPE_ORDER[resolveType(b)] ?? 99;
    if (ta !== tb) return ta - tb;
    return String(a.名称).localeCompare(String(b.名称), 'zh');
  });
  state.items = merged;
  state.inventory.used = inventoryUsed(state);
  return merged.length;
}

export function upgradeBag(state, method = 'storage') {
  ensureLifeState(state);
  const costs = { storage: BAG_UPGRADE_BASE, craft: 0, destiny: 0 };
  if (method === 'storage') {
    const cost = costs.storage + state.inventory.upgrades * BAG_UPGRADE_STEP;
    if (!state.currencies || !spendStoneLike(state, cost)) return { ok: false, text: `需要灵石${cost}。` };
    state.inventory.capacity += 20;
    state.inventory.upgrades += 1;
    state.inventory.bagName = bagNameByCapacity(state.inventory.capacity, '乾坤储物袋');
    return { ok: true, text: `储物袋扩容成功，容量变为 ${state.inventory.capacity} 格。` };
  }
  if (method === 'craft') {
    state.inventory.capacity += 15;
    state.inventory.upgrades += 1;
    state.inventory.bagName = bagNameByCapacity(state.inventory.capacity, '百艺缝制的储物袋');
    return { ok: true, text: `你用百艺缝制储物袋，容量变为 ${state.inventory.capacity} 格。` };
  }
  return { ok: false, text: '尚未找到对应的扩容机缘。' };
}

/** 按容量分级命名（与坊市扩容共用，避免开局 100 格还叫「下品储物袋」） */
export function bagNameByCapacity(capacity, fallback = '储物袋') {
  const grade = bagGradeOf(capacity);
  return `${grade.prefix}${grade.name}储物袋`;
}
/** 返回当前容量对应的品级对象（供 UI 渲染标签） */
export function bagGradeInfo(state) {
  const cap = (state.inventory?.capacity || 100) + (state.inventory?.ringBonus || 0);
  return bagGradeOf(cap);
}

function spendStoneLike(state, amount) {
  const total = state.currencies['下品灵石'] || 0;
  if (total < amount) return false;
  state.currencies['下品灵石'] = total - amount;
  return true;
}

export function canCraft(state, recipe) {
  return Object.entries(recipe.need).every(([name, count]) => (state.items.find((x) => x.名称 === name)?.数量 || 0) >= count);
}

export function craftRecipe(state, recipe) {
  const output = {
    名称: recipe.output.名称 || recipe.output.name,
    类型: recipe.output.类型 || recipe.output.type || '杂物',
    数量: recipe.output.数量 || recipe.output.quantity || 1,
    描述: recipe.output.描述 || recipe.output.desc || '',
    等级: recipe.output.等级 || recipe.output.level,
    effect: recipe.output.effect,
  };
  if (!canCraft(state, recipe)) return { ok: false, logs: ['材料不足，无法开工。'] };
  if (!canStore(state, output)) return { ok: false, logs: ['储物袋空间不足，请先出售或扩容。'] };
  for (const [name, count] of Object.entries(recipe.need)) {
    const item = state.items.find((x) => x.名称 === name);
    item.数量 -= count;
    if (item.数量 <= 0) state.items.splice(state.items.indexOf(item), 1);
  }
  storeItem(state, output);
  state.inventory.used = inventoryUsed(state);
  return { ok: true, logs: [`百艺制成「${output.名称}」×${output.数量}。`, `获得实际产物：${output.描述}`] };
}

export function gearPower(state) {
  return totalEquipPower(state);
}

export function artifactPower(state) {
  return Number(state.equipment.artifact?.战力 || 0);
}

export function travelOptions(state) {
  ensureLifeState(state);
  const current = REGION_TRAVEL[state.world.regionId] || REGION_TRAVEL.zhongzhou;
  return current.neighbors.map((id) => ({ id, ...REGION_TRAVEL[id] })).filter(Boolean);
}

export function startTravel(state, regionId) {
  ensureLifeState(state);
  const target = REGION_TRAVEL[regionId];
  if (!target || regionId === state.world.regionId) return { ok: false, text: '你已经在这里。' };
  const current = REGION_TRAVEL[state.world.regionId] || REGION_TRAVEL.zhongzhou;
  if (!current.neighbors.includes(regionId)) return { ok: false, text: '此地暂无直达路线，需先到相邻地域。' };
  if (state.world.travel?.destination) return { ok: false, text: '你已在旅途中，不能重复规划路线。' };
  // 跨域旅行凭证：持有时本次路费减半（单张消耗），使「远航凭证/旅行凭证」成为真实可用道具
  let cost = target.cost;
  const voucher = state.items.find((i) => i.effect && i.effect.travel);
  let usedVoucher = null;
  if (voucher) {
    cost = Math.max(0, Math.round(target.cost * (1 - (voucher.effect.travel || 0) / 100)));
    usedVoucher = voucher;
  }
  if (!spendStoneLike(state, cost)) return { ok: false, text: `路费不足，需要下品灵石${cost}。` };
  if (usedVoucher) {
    usedVoucher.数量 -= 1;
    if (usedVoucher.数量 <= 0) state.items.splice(state.items.indexOf(usedVoucher), 1);
  }
  state.world.travel = { destination: regionId, remaining: target.months };
  const name = REGION_NAMES[regionId] || regionId;
  const tail = usedVoucher ? `（使用「${usedVoucher.名称}」，路费减半）` : '';
  return { ok: true, text: `你踏上前往${name}的路途，预计${target.months}个月抵达。${tail}`, months: target.months };
}

export function completeTravel(state, regionNames = {}) {
  ensureLifeState(state);
  const trip = state.world.travel;
  if (!trip?.destination || trip.remaining > 0) return null;
  const id = trip.destination;
  state.world.regionId = id;
  state.world.region = regionNames[id] || id;
  state.world.travel = { destination: '', remaining: 0 };
  return `你抵达${state.world.region}。当地特产：${REGION_TRAVEL[id]?.specialty || '未知奇珍'}。`;
}

export function makeChronicle(state, entry) {
  ensureLifeState(state);
  state.chronicle.push({ time: `${state.world.year}年${state.world.month}月`, title: entry.title, text: entry.text, type: entry.type || '事件' });
  if (state.chronicle.length > 80) state.chronicle.splice(0, state.chronicle.length - 80);
}

/* ============================================================
 * 灵草园（洞府生产玩法）
 * ========================================================== */
/**
 * 灵田品质：随洞府等级提升，收获灵草的品质与产量随之提高（确定性，无 RNG）。
 * 等级映射：下品(0-1) → 中品(2-3) → 上品(4-5) → 极品(6-7) → 仙品(8)。
 */
export function herbQuality(state) {
  const lv = state.cave?.level || 0;
  if (lv >= 8) return { tier: '仙品', mul: 2.5, label: '仙品' };
  if (lv >= 6) return { tier: '极品', mul: 2.0, label: '极品' };
  if (lv >= 4) return { tier: '上品', mul: 1.5, label: '上品' };
  if (lv >= 2) return { tier: '中品', mul: 1.25, label: '中品' };
  return { tier: '下品', mul: 1.0, label: '下品' };
}

/** 灵草园容量：基础 4 株，洞府每升 1 级 +1 株（至多 +4，即上限 8 株） */
export function gardenCapacity(state) {
  return HERB_GARDEN_MAX + Math.min(state.cave?.level || 0, 4);
}

/** 播种一株灵草（消耗灵石，占用一格） */
export function plantHerb(state, herbId) {
  ensureLifeState(state);
  const def = HERB_TYPES.find((h) => h.id === herbId);
  if (!def) return { ok: false, logs: ['未知灵草。'] };
  if (state.cave.garden.length >= gardenCapacity(state)) return { ok: false, logs: [`灵草园已满（最多 ${gardenCapacity(state)} 株），请先收获。`] };
  if (!spendStoneLike(state, def.seedCost)) return { ok: false, logs: [`灵石不足（需 ${def.seedCost}）。`] };
  state.cave.garden.push({ id: def.id, name: def.name, progress: 0, grow: def.grow, planted: `${state.world.year}年${state.world.month}月`, irrigatedThisMonth: 0, irrigated: 0 });
  // 播种即解锁对应灵草图鉴条目（玩家可感知的收集反馈）
  discoverItem(state, { 名称: def.name, 类型: '灵草' });
  return { ok: true, logs: [`你在洞府灵田播下「${def.name}」，约 ${def.grow} 个月后可收获。`, `耗灵石 ${def.seedCost}。`] };
}

/** 收获一株已成熟的灵草 → 产出材料入袋 */
export function harvestHerb(state, idx) {
  ensureLifeState(state);
  const h = state.cave.garden[idx];
  if (!h) return { ok: false, logs: ['灵草不存在。'] };
  if (h.progress < h.grow) return { ok: false, logs: [`「${h.name}」尚未成熟（${h.progress}/${h.grow} 月）。`] };
  const def = HERB_TYPES.find((d) => d.id === h.id);
  if (!def) return { ok: false, logs: ['未知灵草种子，无法收获。'] };
  state.cave.garden.splice(idx, 1);
  if (def.yield) {
    const q = herbQuality(state);
    const baseQty = def.yield.数量 || 1;
    const qualityQty = Math.max(1, Math.round(baseQty * q.mul));
    const irriBonus = Math.min(h.irrigated || 0, HERB_IRRIGATE_YIELD_CAP);
    const qty = qualityQty + irriBonus;
    storeItem(state, { ...def.yield, 数量: qty });
    const qualityExtra = qualityQty - baseQty;
    const tagParts = [];
    if (q.tier !== '下品') tagParts.push(`${q.tier}灵田·+${qualityExtra}`);
    if (irriBonus > 0) tagParts.push(`灵泉浸润·+${irriBonus}`);
    const tag = tagParts.length ? `（${tagParts.join('，')}）` : '';
    const notes = [];
    if (q.tier !== '下品') notes.push(`洞府灵气滋养，灵草品质达「${q.tier}」，产量提升。`);
    if (irriBonus > 0) notes.push(`灵泉反复浸润，灵草肥硕，额外多收 ${irriBonus} 份。`);
    if (!notes.length) notes.push('灵田灵气平淡，产出寻常。');
    return { ok: true, logs: [`你采得「${def.yield.名称}」×${qty}${tag}，已收入储物袋。`, ...notes] };
  }
  return { ok: true, logs: [`「${h.name}」已收获，但灵种异变，未见产出。`] };
}

/**
 * 灵草园「一键收获」：批量收获所有已成熟灵草（progress>=grow）。
 * 按成熟株索引降序处理（splice 不影响更低索引），结果确定性无 RNG。
 * 返回 { ok, count, logs }。
 */
export function harvestAllHerbs(state) {
  ensureLifeState(state);
  const garden = state.cave.garden || [];
  const matureIdx = [];
  for (let i = 0; i < garden.length; i++) {
    const h = garden[i];
    if (h && h.progress >= h.grow) matureIdx.push(i);
  }
  if (!matureIdx.length) return { ok: false, count: 0, logs: ['灵草园中没有已成熟的灵草。'] };
  const logs = [];
  let count = 0;
  for (const idx of matureIdx.sort((a, b) => b - a)) {
    const r = harvestHerb(state, idx);
    if (r.ok) count++;
    logs.push(...(r.logs || []));
  }
  return { ok: count > 0, count, logs };
}

/** 月度生长：所有灵草进度 +1（于 settleMonth 调用）；同时重置本月浇灌额度 */
export function growHerbs(state) {
  ensureLifeState(state);
  const spring = herbSpringBonus(state);
  for (const h of state.cave.garden) {
    if (h.progress < h.grow) h.progress += 1 + omenAdd(state, 'garden') + spring;
    h.irrigatedThisMonth = 0;
  }
}

/** 灵泉浇灌花费（下品灵石），使一株未熟灵草加速生长 +1 月 */
export const HERB_IRRIGATE_COST = 15;
/** 单株每月可浇灌次数上限：防止用灵石无限瞬间催熟，保留「时间」维度 */
export const HERB_IRRIGATE_CAP_PER_MONTH = 2;
/** 灵泉涌动阈值：洞府达到此等级（Lv.5+），灵泉自然涌动，灵草每月额外 +1 自然生长（基础加成） */
export const HERB_SPRING_LEVEL = 5;
/** 灵泉可成长上限：玩家可耗灵石引泉，使灵泉涌动额外叠加（每重 +1 月生长） */
export const HERB_SPRING_MAX = 3;
/** 引泉升级费用基数：第 k 重费用 = HERB_SPRING_COST_BASE × k（k 从 1 起） */
export const HERB_SPRING_COST_BASE = 400;
/** 单株累计浸润可转化为收获产量加成的上限：防止付费无限堆产，保留平衡 */
export const HERB_IRRIGATE_YIELD_CAP = 3;
/** 炼丹催化材料：开炉时若持有，自动消耗 1 份以提升成丹率（确定性、无 RNG）。
 *  来源：道友深谈（灵植师赠「年份灵草」、炼丹师赠「私藏丹方·残卷」）与道友委托酬谢。
 *  此前这两样材料无真实消费点=死道具；现接入炼丹成为可感知的催化助力，
 *  落实其图鉴描述中的「炼丹上品 / 研习可助炼丹」承诺。 */
export const ALCHEMY_CATALYSTS = {
  '年份灵草': { bonus: 8, label: '年份灵草催化' },
  '私藏丹方·残卷': { bonus: 15, label: '丹方心得催化' },
};
/**
 * 灵泉自然加成：洞府灵泉涌动后，每株灵草月度自然生长额外 +1（确定性，无 RNG）。
 * 与浇灌（付费单次 +1）互补：高等级洞府的灵草园收获更快，是洞府长线投资的回报之一。
 */
export function herbSpringBonus(state) {
  // 基础加成（洞府>=Lv.5 自动涌动）叠加可成长的引泉重数，确定性、无 RNG。
  const base = (state.cave?.level || 0) >= HERB_SPRING_LEVEL ? 1 : 0;
  const grown = state.cave?.springLevel || 0;
  return base + grown;
}

/**
 * 引泉升级：消耗下品灵石，提升灵泉涌动重数（每重灵草月生长额外 +1）。
 * 与洞府等级的基础加成叠加，提供灵草园长线投资回报，确定性、无 RNG。
 */
export function upgradeHerbSpring(state) {
  ensureLifeState(state);
  const cur = state.cave?.springLevel || 0;
  if (cur >= HERB_SPRING_MAX) {
    return { ok: false, logs: [`灵泉已臻「${HERB_SPRING_MAX}重涌动」之境，无需再引。`] };
  }
  const cost = HERB_SPRING_COST_BASE * (cur + 1);
  if ((state.currencies?.['下品灵石'] || 0) < cost) {
    return { ok: false, logs: [`引泉需 ${cost} 下品灵石，灵石不足。`] };
  }
  state.currencies['下品灵石'] -= cost;
  state.cave.springLevel = cur + 1;
  return {
    ok: true,
    cost,
    logs: [`你引动地脉灵泉，灵泉涌动升至 ${state.cave.springLevel} 重！灵草每月自然生长额外 +${state.cave.springLevel} 月（基础涌动另计）。`],
  };
}

/* ============================================================
 * 天机运势（观星卜算所得，下月生效，跨月由 systems.nextMonth 过期清理）
 * 仅提供读取辅助，不依赖 systems，避免循环引用（systems 反过来依赖 life）。
 * ========================================================== */
/** 当前是否处于有效运势期内（按到期年月判定，已过期返回 false） */
export function omenActive(state) {
  const o = state.flags?.omen;
  if (!o) return false;
  const w = state.world;
  return w.year < o.expireYear || (w.year === o.expireYear && w.month <= o.expireMonth);
}
/** 乘数类运势（如修炼/商道/悟性），未激活或非本类返回 1 */
export function omenMul(state, kind) {
  const o = state.flags?.omen;
  if (o && omenActive(state) && o.kind === kind) return o.mul || 1;
  return 1;
}
/** 加数类运势（如灵草额外生长），未激活或非本类返回 0 */
export function omenAdd(state, kind) {
  const o = state.flags?.omen;
  if (o && omenActive(state) && o.kind === kind) return o.add || 0;
  return 0;
}
/**
 * 灵泉浇灌：花费灵石使一株尚未成熟的灵草生长 +1 月（最多催熟至成熟）。
 * 给玩家用灵石换取「加速收获」的主动权，与月度自然生长（growHerbs）互补。
 */
export function irrigateHerb(state, idx) {
  ensureLifeState(state);
  const h = state.cave.garden[idx];
  if (!h) return { ok: false, logs: ['灵草不存在。'] };
  if (h.progress >= h.grow) return { ok: false, logs: [`「${h.name}」已成熟，无需浇灌。`] };
  if ((h.irrigatedThisMonth || 0) >= HERB_IRRIGATE_CAP_PER_MONTH) return { ok: false, logs: [`「${h.name}」本月浇灌已达上限（${HERB_IRRIGATE_CAP_PER_MONTH} 次），静待自然生长吧。`] };
  if (!spendStoneLike(state, HERB_IRRIGATE_COST)) return { ok: false, logs: [`灵石不足（需 ${HERB_IRRIGATE_COST}）。`] };
  h.progress = Math.min(h.grow, h.progress + 1);
  h.irrigatedThisMonth = (h.irrigatedThisMonth || 0) + 1;
  h.irrigated = (h.irrigated || 0) + 1;
  const mature = h.progress >= h.grow;
  return { ok: true, logs: [`你引灵泉浇灌「${h.name}」，灵草生长 +1 月（${h.progress}/${h.grow} 月）${mature ? '，现已可收获！' : ''}。`, `耗灵石 ${HERB_IRRIGATE_COST}（本月已浇灌 ${h.irrigatedThisMonth}/${HERB_IRRIGATE_CAP_PER_MONTH} 次）。`] };
}

/* ============================================================
 * 灵草杂交（洞府灵草园进阶玩法）
 * ----------------------------------------------------------
 * 将两种不同基础灵草产物杂交，凝成一种奇珍灵材。确定性、无 RNG。
 * 与 storeItem/discoverItem 协作：产物自动入袋并解锁图鉴。
 * ========================================================== */
/** 按（排序后的）两种灵草产物名查找杂交配方，顺序无关 */
export function findHerbHybrid(a, b) {
  const key = [a, b].sort().join('+');
  return HERB_HYBRIDS.find((h) => [h.a, h.b].sort().join('+') === key) || null;
}

/**
 * 灵草杂交：消耗两种不同灵草产物各 1 份 + 灵石，凝成奇珍灵材。
 * 产物经 storeItem 入袋（内含 discoverItem 解锁图鉴）。确定性、无 RNG。
 */
export function crossbreedHerbs(state, aName, bName) {
  ensureLifeState(state);
  if (!aName || !bName || aName === bName) return { ok: false, logs: ['需选择两种不同的灵草产物进行杂交。'] };
  const def = findHerbHybrid(aName, bName);
  if (!def) return { ok: false, logs: [`「${aName}」与「${bName}」无法杂交出灵材。`] };
  const itemA = state.items.find((x) => x.名称 === aName);
  const itemB = state.items.find((x) => x.名称 === bName);
  if (!itemA || (itemA.数量 || 0) < 1 || !itemB || (itemB.数量 || 0) < 1) {
    return { ok: false, logs: [`灵草产物不足：需要「${aName}」与「${bName}」各 1 份。`] };
  }
  if (!spendStoneLike(state, HERB_HYBRID_COST)) return { ok: false, logs: [`灵石不足（需 ${HERB_HYBRID_COST}）。`] };
  itemA.数量 -= 1; if (itemA.数量 <= 0) state.items.splice(state.items.indexOf(itemA), 1);
  itemB.数量 -= 1; if (itemB.数量 <= 0) state.items.splice(state.items.indexOf(itemB), 1);
  storeItem(state, { ...def.out });
  state.inventory.used = inventoryUsed(state);
  return { ok: true, logs: [`你将「${aName}」与「${bName}」杂交，凝成奇珍灵材「${def.out.名称}」×1。`, `耗灵石 ${HERB_HYBRID_COST}。`] };
}

/* ============================================================
 * 丹炉炼丹系统（洞府玩法）
 * ----------------------------------------------------------
 * 设计要点：
 *   - 分层灵石扣减：复用 CURRENCIES 的 1:100 折算，与 systems.totalStones
 *     口径完全一致（故断言可走 S.totalStones）。此处独立实现是为避免
 *     life ↔ systems 循环依赖（systems 才是引用 life 的一方）。
 *   - 跨月结算：settleRefine 于 systems.nextMonth 调用，按 dueYear/dueMonth
 *     出炉；成功率 = baseRate + 洞府丹炉加成（CAVE_LEVELS.bonus）。
 *   - 丹毒：服用丹药时由 systems.useItem 通过 codex.applyPillToxicity 累加，
 *     此处提供月度自然衰减 decayPillToxicity。
 * ========================================================== */

/** 分层货币折算（下品灵石最小单位），与 systems.totalStones 同口径 */
function alchemyTotalStones(state) {
  return CURRENCIES.reduce((s, c, i) => s + (state.currencies?.[c] || 0) * Math.pow(100, i), 0);
}
function alchemyRedistribute(state, total) {
  let rest = Math.max(0, Math.round(total));
  for (let i = CURRENCIES.length - 1; i >= 0; i--) {
    const unit = Math.pow(100, i);
    const c = Math.floor(rest / unit);
    state.currencies[CURRENCIES[i]] = c;
    rest -= c * unit;
  }
}
function alchemyCanAfford(state, amt) { return alchemyTotalStones(state) >= amt; }
function alchemySpendStones(state, amt) {
  if (!alchemyCanAfford(state, amt)) return false;
  alchemyRedistribute(state, alchemyTotalStones(state) - Math.round(amt));
  return true;
}
function alchemyAddStones(state, amt) {
  alchemyRedistribute(state, alchemyTotalStones(state) + Math.max(0, Math.round(amt)));
}

/** 初始化丹炉状态（丹炉并行炼制队列 + 统计） */
export function ensureAlchemyState(state) {
  state.cave = state.cave || { level: 0, name: CAVE_LEVELS[0].name, bonus: 0, springLevel: 0 };
  state.cave.alchemy = Array.isArray(state.cave.alchemy) ? state.cave.alchemy : [];
  state.flags = state.flags || {};
  if (typeof state.flags.refinedPills !== 'number') state.flags.refinedPills = 0;
  return state.cave.alchemy;
}

/** 丹炉并行炼制上限：基础 1，洞府每升 2 级 +1（最高 3 炉） */
export function alchemySlots(state) {
  return Math.min(3, 1 + Math.floor((state.cave?.level || 0) / 2));
}

/** 丹方解锁判定（不凭空给，经境界/百艺/宗门贡献解锁） */
export function isRecipeUnlocked(state, recipeId) {
  const lvl = state.player?.level || 1;
  const sectRank = state.sect?.rank || 0;
  const artLv = state.arts?.炼丹?.level || 0;
  switch (recipeId) {
    case '聚气丹':
    case '凝血丹': return true;
    case '聚灵丹': return lvl >= 11 || artLv >= 1;
    case '凝神丹': return lvl >= 21 || artLv >= 2;
    case '筑基丹': return lvl >= 20 || sectRank >= 1;
    case '洗髓丹': return lvl >= 40 || sectRank >= 2 || (state.flags?.refinedPills || 0) >= 15;
    case '渡劫丹': return lvl >= 60 || sectRank >= 3;
    case '凝火丹': return lvl >= 21 || artLv >= 2;
    case '炎玉丹': return lvl >= 40 || sectRank >= 2 || (state.flags?.refinedPills || 0) >= 15;
    case '玉华丹': return lvl >= 40 || sectRank >= 3;
    case '露华丹': return lvl >= 60 || sectRank >= 3;
    default: return false;
  }
}

/**
 * 开炉成丹率预览（与 settleRefine 同口径，但不消耗材料/状态）。
 * 返回 { baseRate, caveBonus, catalystBonus, rate }，供丹炉面板在开炉前展示真实期望成丹率，
 * 让玩家看清洞府丹炉加成与催化材料加成，做出更明智的投入决策（确定性、无 RNG）。
 */
export function refineRate(state, recipeId) {
  const r = PILL_RECIPES[recipeId];
  if (!r) return null;
  const baseRate = r.baseRate;
  const caveBonus = Math.round((state.cave?.bonus || 0) * 30);
  let catalystBonus = 0;
  for (const [cname, cfg] of Object.entries(ALCHEMY_CATALYSTS)) {
    const it = state.items.find((x) => x.名称 === cname);
    if (it && it.数量 >= 1) catalystBonus += cfg.bonus;
  }
  const rate = Math.min(98, baseRate + caveBonus + catalystBonus);
  return { baseRate, caveBonus, catalystBonus, rate };
}

/** 开炉炼制：校验解锁/材料/灵石 → 扣材料与灵石 → 写入「炼制中」队列 */
export function refinePill(state, recipeId, opts = {}) {
  ensureLifeState(state);
  ensureAlchemyState(state);
  const r = PILL_RECIPES[recipeId];
  if (!r) return { ok: false, logs: ['未知丹方。'] };
  if (!isRecipeUnlocked(state, recipeId)) return { ok: false, logs: [`「${r.name}」丹方尚未解锁（需提升境界 / 炼丹百艺 / 宗门贡献）。`] };
  if (state.cave.alchemy.length >= alchemySlots(state)) return { ok: false, logs: [`丹炉已满（最多同时炼制 ${alchemySlots(state)} 炉），请待其出炉。`] };
  // 材料校验
  for (const [name, count] of Object.entries(r.need)) {
    if ((state.items.find((x) => x.名称 === name)?.数量 || 0) < count) {
      return { ok: false, logs: [`材料不足：「${name}」需要 ${count} 份。`] };
    }
  }
  // 灵石校验（分层）
  if (r.stoneCost && !alchemyCanAfford(state, r.stoneCost)) return { ok: false, logs: [`灵石不足（需 ${r.stoneCost} 下品灵石）。`] };
  // 扣材料
  for (const [name, count] of Object.entries(r.need)) {
    const it = state.items.find((x) => x.名称 === name);
    it.数量 -= count;
    if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
  }
  // 扣灵石（分层）
  if (r.stoneCost) alchemySpendStones(state, r.stoneCost);
  // 炼丹催化：自动消耗持有的催化材料，提升本次成丹率（确定性、无 RNG）
  let catalystBonus = 0;
  const usedCatalysts = [];
  for (const [cname, cfg] of Object.entries(ALCHEMY_CATALYSTS)) {
    const it = state.items.find((x) => x.名称 === cname);
    if (it && it.数量 >= 1) {
      it.数量 -= 1;
      if (it.数量 <= 0) state.items.splice(state.items.indexOf(it), 1);
      catalystBonus += cfg.bonus;
      usedCatalysts.push(cname);
    }
  }
  // 写入炼制中（到期年月）
  const w = state.world;
  let dy = w.year, dm = w.month + (r.months || 1);
  while (dm > 12) { dm -= 12; dy += 1; }
  state.cave.alchemy.push({ recipeId, name: r.name, dueYear: dy, dueMonth: dm, startedYear: w.year, startedMonth: w.month, catalystBonus, usedCatalysts });
  state.inventory.used = inventoryUsed(state);
  const catNote = catalystBonus ? `，催化加成 +${catalystBonus}%（${usedCatalysts.join('、')}）` : '';
  return { ok: true, logs: [`你点燃丹炉，开始炼制「${r.name}」（${r.months} 月后出炉，基础成丹率 ${r.baseRate}%${catNote}）。`, `耗灵石 ${r.stoneCost || 0}。`] };
}

/** 丹药品阶名 → PILL_GRADES id（供渡劫丹在瓶颈按品阶加成） */
function qualityGradeId(q) {
  if (!q) return 'fan';
  switch (q.grade) {
    case '良品': return 'zhong';
    case '上品': return 'shang';
    case '极品': return 'ji';
    case '废品': return 'fan';
    default: return 'fan'; // 凡品
  }
}

/**
 * 跨月结算丹炉：出炉到期丹药（成丹入袋 / 废丹退部分材料与灵石）。
 * force: 仅测试用——'success' 强制全部成丹、'fail' 强制全部废丹，并忽略到期日直接结算全部在炉丹。
 */
export function settleRefine(state, logs = [], force) {
  ensureLifeState(state);
  ensureAlchemyState(state);
  const w = state.world;
  const queue = state.cave.alchemy.slice();
  for (const p of queue) {
    const r = PILL_RECIPES[p.recipeId];
    if (!r) { removeFromAlchemy(state, p); continue; }
    const due = (p.dueYear < w.year) || (p.dueYear === w.year && p.dueMonth <= w.month);
    if (!due && !force) continue; // 未到出炉月且非强制
    state.flags.refinedPills = (state.flags.refinedPills || 0) + 1;
    const caveBonus = Math.round((state.cave?.bonus || 0) * 30); // 洞府丹炉加成（最高约 +24）
    const rate = Math.min(98, r.baseRate + caveBonus + (p.catalystBonus || 0));
    let success;
    if (force === 'success') success = true;
    else if (force === 'fail') success = false;
    else success = Math.random() * 100 < rate;
    if (success) {
      const q = rollPillQuality(state.arts?.炼丹?.level || 0, setBonusFlags(state));
      const out = {
        名称: r.name, 类型: '丹药', 数量: 1,
        描述: r.output?.desc || r.desc || `${r.name}：丹炉炼制所得。`,
        toxicity: r.toxicity,
        breakthrough: r.breakthrough || false,
        quality: { grade: q.grade, mult: q.mult },
        品阶: qualityGradeId(q),
        effect: r.effect,
        value: r.output?.value || 80,
      };
      const stored = storeItem(state, out);
      if (stored) logs.push(`🔥 开炉！「${r.name}」炼成（${q.grade}），已收入储物袋。`);
      else logs.push(`🔥 「${r.name}」炼成，但储物袋已满，丹药散逸。`);
    } else {
      // 废丹：退还约半数材料（可逆惩罚）+ 少量灵石
      logs.push(`💨 「${r.name}」炼制失败，化为废丹。`);
      for (const [name, count] of Object.entries(r.need)) {
        const refund = Math.floor(count / 2);
        if (refund > 0) storeItem(state, { 名称: name, 类型: '材料', 数量: refund, 描述: '废丹回收的残余材料。', 价值: 10 });
      }
      if (r.stoneCost) alchemyAddStones(state, Math.floor(r.stoneCost * 0.3));
    }
    removeFromAlchemy(state, p);
  }
  state.inventory.used = inventoryUsed(state);
  return logs;
}

function removeFromAlchemy(state, p) {
  const idx = state.cave.alchemy.indexOf(p);
  if (idx >= 0) state.cave.alchemy.splice(idx, 1);
}

/** 丹毒月度自然衰减（服用累加，随月消解） */
export function decayPillToxicity(state, amount = 8) {
  ensureLifeState(state);
  if (state.flags && state.flags.pillToxicity > 0) {
    state.flags.pillToxicity = Math.max(0, state.flags.pillToxicity - amount);
  }
}
