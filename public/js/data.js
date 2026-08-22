/**
 * data.js —— 静态设定数据模块
 * ============================================================
 * 内容全部取自《Ref修仙模拟器 · 完整游戏设定 V8.1.3》。
 * 本模块只提供「只读数据」，不含任何运行时逻辑。
 *
 * 【扩展点】新增种族/灵根/开局包/道韵/天命主线时，
 *   只需在对应数组中追加条目，systems.js 会自动识别，
 *   无需改动玩法代码。
 */

/* ---------------- 通用数值常量（单一真相源，避免魔法数字散落） ---------------- */
export const BAG_UPGRADE_BASE = 300;    // 储物袋首次扩容费（灵石）
export const BAG_UPGRADE_STEP = 250;    // 每级递增费
export const CAVE_UPGRADE_BASE = 300;   // 洞府每级升级费基数：(level+1)*BASE
export const BEAST_WINRATE = { '雷翅隼': 8, '九尾灵狐': 5, 'default': 3 }; // 灵兽助战胜率加成(%)

/* ---------------- 种族 ---------------- */
export const RACES = [
  { id: 'human', name: '人族', bonus: { 悟性: 5 }, desc: '悟性+5%。适应性最强，各大势力均有分布。' },
  { id: 'yao',   name: '妖族', bonus: { 根骨: 10 }, desc: '根骨+10%。修炼到一定境界可化形，妖域有天然优势。' },
  { id: 'ling',  name: '灵族', bonus: { 气运: 5 }, desc: '气运+5%。草木金石精粹化形，寿元绵长，族人稀少。' },
];

/* ---------------- 年龄段 ---------------- */
export const AGE_GROUPS = [
  { id: 'young',  name: '少年（16-25岁）', age: [16, 25], desc: 'NPC倾向宽容教导，拜师入宗等事件更易触发。', mods: { 事件亲和: 20 } },
  { id: 'prime',  name: '壮年（26-45岁）', age: [26, 45], desc: '初始修为略高，但「宗门新秀」类事件不可用。', mods: { 初始修为: 3 } },
  { id: 'middle', name: '中老年（46-60岁）', age: [46, 60], desc: '道心初始加成，根骨相关判定有衰减。', mods: { 道心: 8, 根骨: -5 } },
  { id: 'elder',  name: '老年（61-99岁）', age: [61, 80], desc: '初始道心与气运较高，寿元紧迫。', mods: { 道心: 15, 气运: 10, 寿元修正: -20 } },
];

/* ---------------- 灵根品级 ---------------- */
export const SPIRIT_ROOTS = [
  { id: 'fan',   name: '凡品',   speed: 0.8,  weight: 30, desc: '1-2系，纯度低。修炼速度-20%。' },
  { id: 'zhong', name: '中品',   speed: 1.0,  weight: 34, desc: '2-3系，纯度中。基准修炼速度。' },
  { id: 'shang', name: '上品',   speed: 1.2,  weight: 20, desc: '1-2系，纯度高。修炼速度+20%。' },
  { id: 'ji',    name: '极品',   speed: 1.5,  weight: 6,  desc: '单系天灵根。修炼速度+50%。' },
  { id: 'yi',    name: '异灵根', speed: 1.4,  weight: 8,  desc: '雷/冰/风/暗/光等异属性。修炼速度+40%，附带特殊效果。' },
  { id: 'fei',   name: '废灵根', speed: 0.5,  weight: 2,  desc: '五系俱全且纯度极低。修炼速度-50%，但天劫威力减半。' },
];
export const ROOT_ELEMENTS = ['金', '木', '水', '火', '土'];
export const ROOT_ELEMENTS_YI = ['雷', '冰', '风', '暗', '光'];

/* ---------------- 出生地（7大修真域） ---------------- */
export const REGIONS = [
  { id: 'zhongzhou', name: '中州圣城',   bonus: { 气运: 1 }, desc: '宗门林立，信息最密集，竞争最激烈。' },
  { id: 'donghuang', name: '东荒妖域',   bonus: { 根骨: 10 }, desc: '妖族祖地，炼体功法众多。' },
  { id: 'nanming',   name: '南明离火域', bonus: { 魅力: 1 }, desc: '炼器圣地，火系天堂，地下黑市发达。' },
  { id: 'xiji',      name: '西极玄冰域', bonus: { 悟性: 5 }, desc: '剑修圣地，阵法符箓传承悠久。' },
  { id: 'beiming',   name: '北冥瀚海',   bonus: { 商贾: 5 }, desc: '散修天堂，坊市密布，海外仙岛众多。' },
  { id: 'lingnan',   name: '岭南百越',   bonus: { 根骨: 5 }, desc: '奇虫异兽遍布，毒功驱兽发源地。' },
  { id: 'haiwai',    name: '海外仙岛',   bonus: { 气运: 5 }, desc: '散修联盟总部，上古遗府常现。' },
];

/* ---------------- 开局资产包（10选1，绑定天命主线） ---------------- */
export const START_PACKS = [
  { id: 1,  name: '天生道体', destiny: 'shengti', items: ['下品储物袋', '凡器长剑'], stones: 10, level: 1,  social: '恩师1人(好感40~60)',
    line: '【圣体之路】解开荒古圣体封印，成为万古战仙。' },
  { id: 2,  name: '坊市学徒', destiny: 'caitong', items: ['小型储物袋', '中品凡器'], stones: 50, level: 1, social: '坊市商贩数人(20~40)',
    line: '【财可通神】建立通天商会，以财力撬动修仙界。' },
  { id: 3,  name: '没落血脉', destiny: 'xuemai', items: ['苍梧族谱', '下品法器'], stones: 30, level: 1, social: '族人若干(好感10~30)',
    line: '【血脉复兴】解开家族诅咒，重振苍梧古族。' },
  { id: 4,  name: '遗孤散修', destiny: 'nijing', items: ['残破洞府(临时)', '下品法器'], stones: 15, level: 11, social: '散修旧识三五位(好感5~20)',
    line: '【逆境求生】以散修之身打破弱肉强食铁律。' },
  { id: 5,  name: '转世大能', destiny: 'zaizheng', items: ['凡人小屋', '凡器短剑'], stones: 5, level: 1, social: '无任何故交',
    line: '【再证大道】找回前世遗产，开辟超越前世的道途。' },
  { id: 6,  name: '佛道童子', destiny: 'hongchen', items: ['随身经卷数册', '青布僧袍'], stones: 8, level: 1, social: '师门旧识数人(好感30~50)',
    line: '【红尘问道】入世体悟众生百态。' },
  { id: 7,  name: '炼丹世家', destiny: 'dandao', items: ['丹炉一尊', '下品丹药十瓶'], stones: 80, level: 1, social: '丹道同行数家(好感20~35)',
    line: '【丹道至尊】炼制九转金丹。' },
  { id: 8,  name: '宗门杂役', destiny: 'zongmen', items: ['宗门杂役房一间', '旧法器'], stones: 10, level: 11, social: '父亲旧识二三人(好感20~40)',
    line: '【宗门逆袭】从杂役到圣子，改革腐朽体制。' },
  { id: 9,  name: '铸剑山庄', destiny: 'baibing', items: ['铸造工坊一间', '炼器炉一尊'], stones: 50, level: 1, social: '炼器同行三五家(好感10~25)',
    line: '【百兵之祖】锻造绝世神兵。' },
  { id: 10, name: '大器晚成', destiny: 'daqi', items: ['凡人小屋', '基础功法残卷'], stones: 3, level: 1, social: '同病相怜散修数人(好感15~30)',
    line: '【我命由我不由天】自创功法，撕碎废材标签。' },
];

/* ---------------- 先天道韵（10选1） ---------------- */
export const DAO_YUNS = [
  { id: 'mingcha',  name: '明察秋毫', effect: '识破幻术、探索秘境类判定+20%', grow: '主动探索、破解阵法、鉴定灵物' },
  { id: 'weibu',    name: '未卜先知', effect: '危机预警、机缘感应类判定+20%', grow: '经历险境、验证直觉' },
  { id: 'qiqiao',   name: '七窍玲珑', effect: '社交破冰、辨识谎言类判定+20%', grow: '深度交谈、化解心结' },
  { id: 'daoyin',   name: '道音灌耳', effect: '论道说服、谈判交涉类判定+20%', grow: '公开讲道、收徒传法' },
  { id: 'guomu',    name: '过目不忘', effect: '快速学习、典籍引用类判定+20%', grow: '阅读典籍、抄录丹方' },
  { id: 'wuxing',   name: '五行亲和', effect: '环境适应、抵抗属性压制类判定+20%', grow: '极端环境修炼' },
  { id: 'panshi',   name: '磐石之志', effect: '抗压修炼、抵抗心魔类判定+20%', grow: '闭关苦修、拒绝诱惑' },
  { id: 'tianren',  name: '天人感应', effect: '顿悟突破、机缘降临类判定+20%', grow: '静坐冥思、观察天地' },
  { id: 'leili',    name: '雷厉风行', effect: '行动速度、任务执行类判定+20%', grow: '制定计划并执行、追踪目标' },
  { id: 'qihuo',    name: '奇货可居', effect: '交易谈判、价值判断类判定+20%', grow: '实际交易、鉴定灵物' },
];

/* ---------------- 修仙境界（100级） ----------------
 * perExp：每级所需修为；life：寿元上限；unlock：解锁能力 */
export const REALMS = [
  { name: '凡人境',   min: 1,  max: 10,  perExp: 35,   life: 100,  unlock: '基础战斗、使用凡器', rating: '凡尘' },
  { name: '炼气期',   min: 11, max: 20,  perExp: 110,  life: 150,  unlock: '神识外放、御器飞行(短距离)', rating: '初窥' },
  { name: '筑基期',   min: 21, max: 40,  perExp: 350,  life: 250,  unlock: '真火炼丹、真元护体、收徒', rating: '登堂' },
  { name: '金丹期',   min: 41, max: 60,  perExp: 650,  life: 500,  unlock: '丹火炼器、神识传音、势力创建', rating: '入室' },
  { name: '元婴期',   min: 61, max: 80,  perExp: 1000, life: 1000, unlock: '元婴离体、夺舍、分身术', rating: '宗师' },
  { name: '化神期',   min: 81, max: 95,  perExp: 1800, life: 3000, unlock: '法则领域、虚空挪移', rating: '尊者' },
  { name: '渡劫/大乘', min: 96, max: 100, perExp: 3000, life: 99999, unlock: '天劫感应、飞升资格', rating: '飞升' },
];

/* ---------------- 瓶颈与渡劫 ---------------- */
export const BOTTLENECKS = {
  10: { to: 11, name: '引气入体', tribulation: '无天劫，需在灵地温养', reward: '神识初开', fail: '灵根损伤(修为-1级)', baseRate: 75 },
  20: { to: 21, name: '筑基', tribulation: '小天劫（三道天雷）', reward: '寿元翻倍、御器飞行', fail: '修为倒退1级', baseRate: 60, item: '筑基丹' },
  40: { to: 41, name: '结丹', tribulation: '四九小天劫', reward: '寿元五百、可炼本命法宝', fail: '修为倒退2级', baseRate: 55, item: '结丹丹' },
  60: { to: 61, name: '丹破婴生', tribulation: '六九大天劫+域外天魔', reward: '寿元千年、可夺舍', fail: '修为倒退2级(险象环生)', baseRate: 50, item: '元婴丹' },
  80: { to: 81, name: '法则初悟', tribulation: '九九重劫+法则拷问', reward: '寿元三千、法则领域', fail: '肉身重创(修为-3级)', baseRate: 45, item: '化神丹' },
  95: { to: 96, name: '飞升之劫', tribulation: '天道亲自降劫', reward: '随时可飞升', fail: '魂飞魄散(触发轮回)', baseRate: 40, item: '九转金丹' },
};

/* ---------------- 道基 ---------------- */
export const DAO_BASES = [
  { id: 'wuxing', name: '悟性', desc: '功法领悟速度、自创法术成功率、破阵解禁效率', bonus: { power: 0.006, expRate: 0.004 } },
  { id: 'daoxin', name: '道心', desc: '抵抗心魔幻术威压、论道胜负、收服人心', bonus: { tribulation: 0.004, mental: 0.005 } },
  { id: 'gengu',  name: '根骨', desc: '灵力/气血上限、修炼速度、身体硬度和恢复力', bonus: { power: 0.008, expRate: 0.003 } },
  { id: 'qiyun',  name: '气运', desc: '机缘触发概率、NPC第一印象、名声远播速度', bonus: { luck: 0.005, loot: 0.004 } },
  { id: 'xuemai', name: '血脉', desc: '家族血统、特殊体质觉醒（极难提升）', bonus: { power: 0.01, lifespan: 0.003 } },
];
export const DAO_BASE_MILESTONES = [10, 30, 60, 90]; // 关键等级，触发额外增益
export function getDaoBaseMilestoneBonus(totalLevel) {
  // 道基总等级带来的全局加成
  if (totalLevel >= 200) return { name: '大道初成', powerMul: 0.15, expMul: 0.1 };
  if (totalLevel >= 150) return { name: '道胎稳固', powerMul: 0.10, expMul: 0.07 };
  if (totalLevel >= 100) return { name: '道基坚实', powerMul: 0.06, expMul: 0.04 };
  if (totalLevel >= 50)  return { name: '道基初凝', powerMul: 0.03, expMul: 0.02 };
  return null;
}

/* ---------------- 装备部位与品阶 ---------------- */
export const EQUIP_SLOTS = [
  { id: 'weapon',    name: '武器', icon: '⚔', desc: '主要战力来源' },
  { id: 'armor',     name: '衣服', icon: '👘', desc: '气血与防御' },
  { id: 'pants',     name: '裤子', icon: '🦵', desc: '身法与灵力' },
  { id: 'boots',      name: '鞋子', icon: '👢', desc: '速度与闪避' },
  { id: 'accessory', name: '戒指', icon: '💍', desc: '空间与特殊增益' },
  { id: 'artifact',  name: '法宝', icon: '✨', desc: '本命重器，战力核心' },
];
export const EQUIP_GRADES = [
  { id: 'fan',    name: '凡器', color: '#9aa4b2', powerMul: 1.0, expMul: 1.0,  weight: 40 },
  { id: 'faqi',   name: '法器', color: '#7fb69e', powerMul: 1.3, expMul: 1.05, weight: 28 },
  { id: 'lingqi', name: '灵器', color: '#6fa8dc', powerMul: 1.7, expMul: 1.10, weight: 18 },
  { id: 'fabao',  name: '法宝', color: '#c9a0dc', powerMul: 2.3, expMul: 1.15, weight: 9 },
  { id: 'lingbao', name: '灵宝', color: '#e8a87c', powerMul: 3.2, expMul: 1.25, weight: 4 },
  { id: 'xianqi', name: '仙器', color: '#d8b15a', powerMul: 5.0, expMul: 1.4,  weight: 1 },
];
// id→对象索引：避免各处散落 EQUIP_GRADES.find，O(1) 取色/取名
const EQUIP_GRADE_MAP = new Map(EQUIP_GRADES.map((g) => [g.id, g]));
export function getEquipGrade(id) { return id ? (EQUIP_GRADE_MAP.get(id) || null) : null; }
export const EQUIP_PREFIXES = {
  weapon:    ['凡器', '玄铁', '青锋', '赤炎', '雷霆', '噬魂', '斩仙'],
  armor:     ['布衣', '云纹', '玄甲', '金丝', '龙鳞', '不灭', '混元'],
  pants:     ['粗布', '疾风', '流云', '幻影', '踏虚', '乾坤', '无极'],
  boots:     ['草鞋', '轻羽', '踏风', '追光', '逐月', '逍遥', '凌霄'],
  accessory: ['铁戒', '铜戒', '银戒', '金戒', '玉戒', '空间戒', '太虚戒'],
  artifact:  ['残片', '灵珠', '宝印', '仙剑', '古钟', '神鼎', '造化'],
};
export function getEquipGradeByLevel(level) {
  if (level >= 80) return EQUIP_GRADES.find((g) => g.id === 'xianqi');
  if (level >= 60) return EQUIP_GRADES.find((g) => g.id === 'lingbao');
  if (level >= 40) return EQUIP_GRADES.find((g) => g.id === 'fabao');
  if (level >= 25) return EQUIP_GRADES.find((g) => g.id === 'lingqi');
  if (level >= 12) return EQUIP_GRADES.find((g) => g.id === 'faqi');
  return EQUIP_GRADES.find((g) => g.id === 'fan');
}

// 各部位每级基础战力（全局唯一基准，图鉴/装备/商店共用，避免描述与实际不符）
// 2026-08-19 平衡：基础战力整体收敛约 50%，抑制开局数值膨胀。
export const EQUIP_POWER_BASE = { weapon: 4, armor: 2, pants: 2, boots: 2, accessory: 1, artifact: 6 };

// 装备实际战力 = 基础 × 等级 × 品阶倍率。所有模块统一调用，保证图鉴描述与真实战力一致。
export function calcEquipPower(slot, level, grade) {
  const base = EQUIP_POWER_BASE[slot] || 4;
  return Math.round(base * level * (grade?.powerMul || 1));
}

export function rollEquipGrade(level, luckMod = 0) {
  const pool = EQUIP_GRADES.map((g) => ({ ...g, w: g.weight * (1 + luckMod) }));
  const total = pool.reduce((s, g) => s + g.w, 0);
  let r = Math.random() * total;
  for (const g of pool) { r -= g.w; if (r <= 0) return g; }
  return pool[pool.length - 1];
}
export function makeEquipName(slot, grade) {
  const idx = Math.min(EQUIP_GRADES.length - 1, EQUIP_GRADES.findIndex((g) => g.id === grade.id));
  const prefix = EQUIP_PREFIXES[slot]?.[idx] || grade.name;
  const slotName = EQUIP_SLOTS.find((s) => s.id === slot)?.name || '装备';
  return `${prefix}${slotName}`;
}

/* ---------------- 丹药品阶 ---------------- */
export const PILL_GRADES = [
  { id: 'fan',    name: '凡品', mult: 0.8,  priceMul: 0.6,  tribMul: 0.7, weight: 40, desc: '药效平平，杂质较多。' },
  { id: 'zhong',  name: '中品', mult: 1.0,  priceMul: 1.0,  tribMul: 1.0, weight: 34, desc: '标准药效。' },
  { id: 'shang',  name: '上品', mult: 1.25, priceMul: 1.6,  tribMul: 1.4, weight: 18, desc: '药力精纯。' },
  { id: 'ji',     name: '极品', mult: 1.6,  priceMul: 2.8,  tribMul: 1.9, weight: 7,  desc: '丹纹清晰，杂质极少。' },
  { id: 'sheng',  name: '圣品', mult: 2.2,  priceMul: 5.0,  tribMul: 2.5, weight: 1,  desc: '夺天地造化。' },
];
export function rollPillGrade(luckMod = 0) {
  const pool = PILL_GRADES.map((g) => ({ ...g, w: g.weight * (1 + luckMod) }));
  const total = pool.reduce((s, g) => s + g.w, 0);
  let r = Math.random() * total;
  for (const g of pool) { r -= g.w; if (r <= 0) return g; }
  return pool[pool.length - 1];
}

/* ---------------- 材料掉落 ---------------- */
export const MATERIAL_TYPES = [
  { id: 'yaodan',   name: '妖丹',  type: '材料', desc: '妖兽精华内丹（旧称），可出售。', value: 80 },
  { id: 'lingcao',  name: '灵草',  type: '材料', desc: '炼丹常见材料。', value: 25 },
  { id: 'kuangshi', name: '矿石',  type: '材料', desc: '炼器材料。', value: 35 },
  { id: 'shougu',   name: '兽骨',  type: '材料', desc: '炼器或入药。', value: 20 },
  { id: 'pimao',    name: '皮毛',  type: '材料', desc: '可制防具或符箓。', value: 18 },
  { id: 'xianyuan', name: '仙缘',  type: '材料', desc: '罕见机缘之物，可于罗盘「仙缘兑换」换得道途助益。', value: 300 },
];

/* ---------------- 道基 ---------------- */
/** 道基每级所需经验（按等级区间） */
export const DAO_BASE_EXP = [
  { min: 1, max: 20, per: 80 }, { min: 21, max: 40, per: 200 }, { min: 41, max: 60, per: 400 },
  { min: 61, max: 80, per: 700 }, { min: 81, max: 95, per: 1200 }, { min: 96, max: 100, per: 2000 },
];

/* ---------------- 功法品级 ---------------- */
export const TECHNIQUE_GRADES = [
  { id: 'fan',  name: '凡品', maxLv: 30,  power: 0.8, expMul: 1.0,  color: '#9aa4b2' },
  { id: 'ling', name: '灵品', maxLv: 50,  power: 1.0, expMul: 1.1,  color: '#7fb69e' },
  { id: 'di',   name: '地品', maxLv: 70,  power: 1.2, expMul: 1.25, color: '#6fa8dc' },
  { id: 'tian', name: '天品', maxLv: 90,  power: 1.5, expMul: 1.4,  color: '#c9a0dc' },
  { id: 'xian', name: '仙品', maxLv: 100, power: 2.0, expMul: 1.6,  color: '#e6c97a' },
];
export const TECHNIQUE_NAMES = {
  fan:  ['基础吐纳术', '引气诀', '莽牛劲', '养生功'],
  ling: ['长春功', '青元剑诀', '玄水真法', '烈焰心经', '厚土诀'],
  di:   ['紫霄雷典', '太阴寒螭功', '大日焚天录', '万木长春经'],
  tian: ['星辰锻体术', '太虚剑经', '九天玄女诀', '吞天魔功'],
  xian: ['周天星斗战体', '太上忘情录', '混沌开天经'],
};

/* ---------------- 法宝等级（0~10） ---------------- */
export const ARTIFACT_LEVELS = [
  '凡器', '下品法器', '中品法器', '上品法器', '极品法器',
  '下品法宝', '中品法宝', '上品法宝', '极品法宝', '通天灵宝', '先天至宝',
];
export const ARTIFACT_NAMES = ['青锋剑', '玄铁重剑', '流光梭', '紫电锤', '寒冰绫', '烈阳环', '摄魂铃', '山河扇', '斩龙刀', '乾坤鼎'];

/* ---------------- 洞府等级（0~8） ---------------- */
export const CAVE_LEVELS = [
  { name: '凡人客栈', bonus: 0 }, { name: '散修洞府', bonus: 0.05 }, { name: '小型洞府', bonus: 0.10 },
  { name: '中型洞府', bonus: 0.15 }, { name: '大型洞府', bonus: 0.20 }, { name: '福地', bonus: 0.30 },
  { name: '洞天', bonus: 0.40 }, { name: '圣地道场', bonus: 0.50 }, { name: '小世界', bonus: 0.80 },
];

/* ---------------- 储物袋品级 ---------------- */
export const BAG_GRADES = [
  { id: 'fan',    name: '凡品',   prefix: '布囊',     capacity: 100, color: '#9aa4b2', desc: '粗布缝制的储物袋，勉强够用。' },
  { id: 'liang',  name: '良品',   prefix: '皮囊',     capacity: 160, color: '#74b39c', desc: '灵兽皮鞣制，经久耐用，空间尚可。' },
  { id: 'shang',  name: '上品',   prefix: '玉囊',     capacity: 240, color: '#6fa8dc', desc: '以灵玉为衬里，内蕴乾坤，容量可观。' },
  { id: 'jipin',  name: '极品',   prefix: '乾坤',     capacity: 360, color: '#d8b15a', desc: '上古炼器宗师手作，内藏独立小空间，珍稀异常。' },
];
/** 根据容量返回对应的品级对象（向下取最近一级） */
export function bagGradeOf(capacity) {
  return [...BAG_GRADES].reverse().find((g) => capacity >= g.capacity) || BAG_GRADES[0];
}

/* ---------------- 货币 ---------------- */
export const CURRENCIES = ['下品灵石', '中品灵石', '上品灵石', '极品灵石', '灵晶'];
export const CURRENCY_RATE = 100; // 相邻层级 1:100

/* ---------------- 修仙百艺 ---------------- */
export const ARTS = ['炼丹', '炼器', '制符', '阵法', '灵植', '御兽'];

/* ---------------- 灵草园（洞府生产） ---------------- */
/** 可种植的灵草：grow=成熟所需月数，yield=收获产物，seedCost=播种灵石，desc=说明 */
export const HERB_TYPES = [
  { id: 'lingcao',  name: '凝露灵草', grow: 3,  seedCost: 30,  yield: { 名称: '凝露草', 类型: '材料', 数量: 2, 描述: '灵草园产出的基础灵草，炼丹常用。', 价值: 40 }, desc: '三月可收，炼丹主药。' },
  { id: 'huoqing',  name: '火精枣树', grow: 5,  seedCost: 60,  yield: { 名称: '火精枣', 类型: '材料', 数量: 2, 描述: '火属性灵植，炼器与炼丹皆宜。', 价值: 50 }, desc: '五月结实，火属灵材。' },
  { id: 'yushu',   name: '玉髓芝',   grow: 7,  seedCost: 120, yield: { 名称: '玉髓芝', 类型: '材料', 数量: 1, 描述: '上品灵植，炼制高阶丹药的关键辅药。', 价值: 120 }, desc: '七月方成，珍稀辅药。' },
  { id: 'yuehua',   name: '月华露藤', grow: 10, seedCost: 240, yield: { 名称: '天材地宝·月华露', 类型: '材料', 数量: 1, 描述: '月华凝露，炼丹圣物，价值连城。', 价值: 300 }, desc: '十月凝露，可遇丹圣物。' },
];
export const HERB_GARDEN_MAX = 4; // 灵草园最大同时种植数

/* ---------------- 灵草杂交（洞府灵草园进阶玩法） ----------------
 * 将两种不同基础灵草产物杂交，凝成一种奇珍灵材（order-independent，不分先后）。
 * 杂交消耗灵石，确定性无 RNG；产物为图鉴收集目标 + 高价可售灵材。 */
export const HERB_HYBRID_COST = 50; // 单次杂交消耗灵石
export const HERB_HYBRIDS = [
  { a: '凝露草', b: '火精枣', out: { 名称: '凝火奇实', 类型: '材料', 数量: 1, 描述: '凝露与火精交融所结奇实，灵气内蕴，炼器炼丹皆宜。', 价值: 160 } },
  { a: '玉髓芝', b: '天材地宝·月华露', out: { 名称: '玉华灵髓', 类型: '材料', 数量: 1, 描述: '玉髓与月华同炼的灵髓，温润如玉，高阶丹药圣料。', 价值: 320 } },
  { a: '凝露草', b: '天材地宝·月华露', out: { 名称: '露华玉液', 类型: '材料', 数量: 1, 描述: '凝露承月华而成的玉液，可解百毒、助悟道。', 价值: 260 } },
  { a: '火精枣', b: '玉髓芝', out: { 名称: '炎玉灵枣', 类型: '材料', 数量: 1, 描述: '火精与玉髓相济的灵枣，温补根基、淬炼筋骨。', 价值: 200 } },
];

/* ---------------- 丹炉丹方（洞府炼丹玩法） ----------------
 * 经「洞府·丹炉」面板炼制，耗时 months 月（随游戏月度推进出炉）。
 * 字段：
 *   id/name/icon/tier(1~9品)   基础信息
 *   need:{材料名:数量}         炼制所需材料（取自储物袋「材料」）
 *   stoneCost                  开炉所需下品灵石（折下品，分层扣减）
 *   months                     炼制耗时（月）
 *   baseRate                   基础成丹率（0~100，叠加洞府丹炉加成）
 *   effect                     服用效果（useItem 即时生效：exp/heal/wuxing/daoBase/cultivateBoostMonths/tribulation）
 *   toxicity                   服用累加的丹毒（超过阈值降修炼效率/战力，随月自然衰减）
 *   breakthrough               若为瓶颈专属丹（如筑基丹），按名称被 attemptBreakthrough 消耗并 +20% 成功率
 *   output                     产物丹药图鉴元数据（名称/类型/价值/描述），名称与 CODE_ITEMS 丹药条目对应以解锁图鉴
 * 解锁链见 life.js isRecipeUnlocked：基础丹默认解锁，其余经境界/百艺(炼丹)/宗门贡献逐步解锁。 */
export const PILL_RECIPES = {
  聚气丹: { id: '聚气丹', name: '聚气丹', icon: '🔵', tier: 3, need: { '百越灵草': 2, '海灵珠': 1 }, stoneCost: 20, months: 1, baseRate: 92, effect: { exp: 90 }, toxicity: 8, output: { name: '聚气丹', type: '丹药', value: 80, desc: '聚拢灵气，服用后修为 +90。' } },
  凝血丹: { id: '凝血丹', name: '凝血丹', icon: '🩸', tier: 3, need: { '百年灵芝': 1, '青风狼内丹': 1 }, stoneCost: 25, months: 1, baseRate: 90, effect: { heal: true }, toxicity: 0, output: { name: '凝血丹', type: '丹药', value: 90, desc: '凝气止血，服用后清除全部伤势。' } },
  聚灵丹: { id: '聚灵丹', name: '聚灵丹', icon: '🟢', tier: 4, need: { '凝露草': 3, '海灵珠': 1 }, stoneCost: 40, months: 1, baseRate: 85, effect: { exp: 200, cultivateBoostMonths: 2 }, toxicity: 6, output: { name: '聚灵丹', type: '丹药', value: 120, desc: '灵力充盈，服用后修为 +200，未来 2 月修炼效率提升。' } },
  凝神丹: { id: '凝神丹', name: '凝神丹', icon: '🟣', tier: 5, need: { '凝露草': 2, '火精枣': 2 }, stoneCost: 50, months: 2, baseRate: 82, effect: { wuxing: 120 }, toxicity: 10, output: { name: '凝神丹', type: '丹药', value: 150, desc: '凝神静气，服用后悟性经验 +120。' } },
  筑基丹: { id: '筑基丹', name: '筑基丹', icon: '🟠', tier: 5, need: { '百年灵芝': 2, '玉髓芝': 1 }, stoneCost: 60, months: 2, baseRate: 80, effect: { exp: 150 }, toxicity: 3, breakthrough: true, output: { name: '筑基丹', type: '丹药', value: 200, desc: '夯实道基，筑基渡劫成功率 +20%（对应瓶颈时自动消耗）。' } },
  洗髓丹: { id: '洗髓丹', name: '洗髓丹', icon: '🔶', tier: 6, need: { '玉髓芝': 2, '天材地宝·月华露': 1 }, stoneCost: 120, months: 3, baseRate: 72, effect: { daoBase: { keys: ['根骨', '道心'], min: 5, max: 10 } }, toxicity: 20, output: { name: '洗髓丹', type: '丹药', value: 320, desc: '洗髓伐毛，服用后随机提升一项道基 5~10 级。' } },
  渡劫丹: { id: '渡劫丹', name: '渡劫丹', icon: '⚪', tier: 7, need: { '天材地宝·月华露': 2, '星砂': 1 }, stoneCost: 200, months: 4, baseRate: 68, effect: { tribulation: 15, exp: 60 }, toxicity: 5, output: { name: '渡劫丹', type: '丹药', value: 500, desc: '护持神魂，渡劫时服用成功率 +15%（按品阶加成）。' } },
  凝火丹: { id: '凝火丹', name: '凝火丹', icon: '🔥', tier: 6, need: { '凝火奇实': 1, '凝露草': 2 }, stoneCost: 80, months: 2, baseRate: 78, effect: { exp: 320, cultivateBoostMonths: 1 }, toxicity: 12, output: { name: '凝火丹', type: '丹药', value: 260, desc: '凝火奇实炼就的火属灵丹，服用后修为 +320，未来 1 月修炼效率提升。' } },
  炎玉丹: { id: '炎玉丹', name: '炎玉丹', icon: '🟤', tier: 6, need: { '炎玉灵枣': 1, '火精枣': 2 }, stoneCost: 80, months: 2, baseRate: 78, effect: { daoBase: { keys: ['根骨', '道心'], min: 4, max: 8 } }, toxicity: 16, output: { name: '炎玉丹', type: '丹药', value: 300, desc: '炎玉灵枣温补根基，服用后随机提升一项道基 4~8 级。' } },
  玉华丹: { id: '玉华丹', name: '玉华丹', icon: '🟡', tier: 7, need: { '玉华灵髓': 1, '玉髓芝': 1 }, stoneCost: 120, months: 3, baseRate: 74, effect: { daoBase: { keys: ['悟性', '气运'], min: 5, max: 10 } }, toxicity: 18, output: { name: '玉华丹', type: '丹药', value: 360, desc: '玉华灵髓凝练的圣丹，服用后随机提升一项道基 5~10 级。' } },
  露华丹: { id: '露华丹', name: '露华丹', icon: '💧', tier: 8, need: { '露华玉液': 1, '天材地宝·月华露': 1 }, stoneCost: 160, months: 3, baseRate: 70, effect: { heal: true, wuxing: 200 }, toxicity: 8, output: { name: '露华丹', type: '丹药', value: 420, desc: '露华玉液所化玉丹，服用后伤势尽去、悟性经验 +200。' } },
};
/** 丹方解锁门槛说明（供 UI 提示） */
export const PILL_UNLOCK_HINT = {
  聚气丹: '入门丹方，初始即解锁。',
  凝血丹: '入门丹方，初始即解锁。',
  聚灵丹: '炼气期（11级）或炼丹百艺入门后解锁。',
  凝神丹: '筑基期（21级）或炼丹百艺小成后解锁。',
  筑基丹: '筑基期（20级）或加入宗门后解锁。',
  洗髓丹: '金丹期（40级）、宗门内门（rank2）或累计炼丹 15 炉解锁。',
  渡劫丹: '元婴期（60级）或宗门核心（rank3）解锁。',
  凝火丹: '筑基期（21级）或炼丹百艺小成（Lv.2）解锁，需凝火奇实（灵草杂交）。',
  炎玉丹: '金丹期（40级）、宗门内门（rank2）或累计炼丹 15 炉解锁，需炎玉灵枣（灵草杂交）。',
  玉华丹: '金丹期（40级）或宗门核心（rank3）解锁，需玉华灵髓（灵草杂交）。',
  露华丹: '元婴期（60级）或宗门核心（rank3）解锁，需露华玉液（灵草杂交）。',
};

/* ---------------- 封号 / 称号系统 ----------------
 * 玩家可收集多枚封号，并择一「佩戴」于仙途名号处。
 * 来源分三类：天命终局（destiny）、里程碑成就（achievement）、隐藏奇遇（event）。
 * check 为运行时判定（在 systems.checkTitles 中调用），避免与成就、天命奖励耦合。 */
export const TITLES = [
  { id: 'tongtian_caishen', name: '通天财神', desc: '财可通神天命终局所得，富甲一方。', source: 'destiny' },
  { id: 'cangwu_laozu', name: '苍梧老祖', desc: '血脉复兴天命终局所得，古族守护者。', source: 'destiny' },
  { id: 'xiaoyao_sansheng', name: '逍遥散圣', desc: '逆境求生天命终局所得，万代散修之祖。', source: 'destiny' },
  { id: 'lunhui_daozhu', name: '轮回道主', desc: '再证大道天命终局所得，两世因果了断。', source: 'destiny' },
  { id: 'hongchen_shengseng', name: '红尘圣僧', desc: '红尘问道天命终局所得，普度众生。', source: 'destiny' },
  { id: 'jiuzhuan_dansheng', name: '九转丹圣', desc: '丹道至尊天命终局所得，丹道魁首。', source: 'destiny' },
  { id: 'taixu_shengzi', name: '太虚圣子', desc: '宗门逆袭天命终局所得，万古宗师。', source: 'destiny' },
  { id: 'baibing_zhi_zu', name: '百兵之祖', desc: '百兵之祖天命终局所得，神兵之主。', source: 'destiny' },
  { id: 'niming_daozu', name: '逆命道祖', desc: '我命由我不由天天命终局所得，以废灵根飞升。', source: 'destiny' },
  { id: 'xinghui_zhanxian', name: '星辉战仙', desc: '圣体之路天命终局所得，万古战仙。', source: 'destiny' },
  { id: 'chuji_fengmang', name: '初露锋芒', desc: '战力突破 1000 时获得，崭露头角。', source: 'achievement' },
  { id: 'weizhen_yifang', name: '威震一方', desc: '战力突破 5000 时获得，名动修真界。', source: 'achievement' },
  { id: 'tianxuan_jieke', name: '图鉴捷客', desc: '发现半数物品图鉴时获得，博物洽闻。', source: 'achievement' },
  { id: 'wanwu_bochang', name: '万物博长', desc: '发现全部物品图鉴时获得，通达万物。', source: 'achievement' },
  { id: 'lingkuang_xingzhe', name: '灵矿行者', desc: '累计获得 100000 灵石时获得，腰缠万贯。', source: 'achievement' },
  { id: 'daoji_yicheng', name: '道基已成', desc: '道基总等级突破 200 时获得，大道初成。', source: 'achievement' },
  { id: 'xianyuan_qiren', name: '仙缘奇人', desc: '收服传说幼凰时获得，浴火重生。', source: 'event' },
  { id: 'guji_tanxun', name: '古迹探寻', desc: '集齐秘境探索深度满层时获得，秘境行家。', source: 'event' },
];
// 便于按 id 取封号
export const TITLE_MAP = Object.fromEntries(TITLES.map((t) => [t.id, t]));

/* ---------------- 秘境分层探索 ----------------
 * 每次进入秘境可选择探索深度（1~3层）：越深，灵石/材料/法宝概率与数量越高，
 * 但妖兽遭遇概率与强度随之递增；第 3 层视为「秘境深处」，有概率触发隐藏奇遇。 */
export const MYSTIC_DEPTH = {
  max: 3,
  levels: [
    { depth: 1, name: '外围', stoneMul: 1.0, matMul: 1.0, artMul: 1.0, beastAdd: 0.0, hiddenChance: 0.0 },
    { depth: 2, name: '内围', stoneMul: 1.6, matMul: 1.4, artMul: 1.3, beastAdd: 0.12, hiddenChance: 0.08 },
    { depth: 3, name: '深处', stoneMul: 2.4, matMul: 1.8, artMul: 1.6, beastAdd: 0.25, hiddenChance: 0.18 },
  ],
  /** 按 depth 返回配置，越界回退到 1 层 */
  of(depth) {
    const d = Math.min(this.max, Math.max(1, Number(depth) || 1));
    return this.levels[d - 1] || this.levels[0];
  },
};

/* ---------------- 拍卖对手（rival bidders） ---------------- */
// 对手出价激进程度与预算上限（按起拍价倍数），营造竞价博弈感
export const AUCTION_RIVAL = {
  // 竞拍者随机姓名池（姓+名），报价时随机署名
  surnames: ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '林', '苏', '顾', '沈', '韩', '杨', '叶', '楚'],
  givens: ['恒', '清璇', '破天', '无涯', '灵珊', '铁心', '问天', '雪见', '苍松', '红袖', '孤鸿', '白石', '惊鸿', '采薇', '镇岳', '流云'],
  // 每个拍品的对手预算（起拍价倍数），越高越难拍到
  budgetMul: [2.0, 3.5, 5.0, 8.0],
  // 对手反超加价幅度（占当前价比例）
  raiseRatio: [0.05, 0.12, 0.2],
  // 一口价（buyout）倍数：达此价对手放弃
  buyoutMul: 3.0,
  // 流拍：无人出价且对手未参与时触发
};

/* ---------------- 命运骰子（越级战斗） ---------------- */
export const FATE_DICE = [
  { id: 'tiancci',  icon: '⚡', name: '天赐良机', prob: 8,  mod: 25,  desc: '对手关键时刻真气逆行，露出致命破绽！' },
  { id: 'hongyun',  icon: '🌟', name: '鸿运当头', prob: 12, mod: 15,  desc: '脑海中闪过精妙破解之法，运势在你这边。' },
  { id: 'xiaoyuan', icon: '🍀', name: '小有机缘', prob: 20, mod: 8,   desc: '一阵风沙迷了对方眼睛，抢得先手。' },
  { id: 'zhonggui', icon: '⚖️', name: '中规中矩', prob: 20, mod: 0,   desc: '一切如常，胜败全凭真本事。' },
  { id: 'bozhe',    icon: '🌫️', name: '小有波折', prob: 20, mod: -8,  desc: '脚下踏空，身形微滞，节奏被打乱。' },
  { id: 'shiyun',   icon: '💨', name: '时运不济', prob: 12, mod: -15, desc: '对方突然祭出秘宝，打乱全盘计划。' },
  { id: 'tianyi',   icon: '💀', name: '天意弄人', prob: 8,  mod: -25, desc: '最强一击被天然克制，灵力反噬！' },
];

/* ---------------- 观星卜算（占卜玩法） ----------------
 * 玩家可于决策罗盘「天机」行动请动星盘：消耗灵石，获得确定性道韵/悟性经验，
 * 并得一则天机提示。fortunes 仅决定提示文本，不影响数值收益，故测试无 flaky。 */
export const DIVINATION = {
  cost: 60,          // 请动星盘所需灵石（折下品）
  daoYun: 14,        // 固定获得的道韵经验
  wuxing: 10,        // 固定获得的悟性经验
  fortunes: [
    '紫微星明，主贵人将至，宜结交同道。',
    '贪狼暗动，机缘藏于险地，秘境或有奇遇。',
    '文曲流转，悟道之时将至，研读功法事半功倍。',
    '破军临垣，宜静不宜动，本月当稳守根基。',
    '太阴垂照，灵植逢春，洞府灵草生长更盛。',
    '廉贞化禄，商道小吉，坊市交易或可获利。',
  ],
  /* 天机运势：卜算后获得一则「下月运势」，为下月某类行动附加确定性加成。
   * 仅决定加成类型与数值（RNG 只决定抽到哪条，不影响数值，故测试无 flaky）。 */
  omens: [
    { id: 'cultivate', icon: '📿', label: '道韵加持', desc: '下月修炼所得修为 +18%', mul: 1.18 },
    { id: 'garden',   icon: '🌿', label: '灵田润泽', desc: '下月灵草自然生长额外 +1 月', add: 1 },
    { id: 'trade',    icon: '💰', label: '商道亨通', desc: '下月坊市售货所得灵石 +20%', mul: 1.20 },
    { id: 'insight',  icon: '🔆', label: '悟性洞明', desc: '下月悟性/道韵经验 +25%', mul: 1.25 },
  ],
};

/* ---------------- 胜率隐性反馈 ---------------- */
export const WIN_RATE_FEEDBACK = [
  { min: 5,  max: 20,  text: '对方的气息碾压而来，你连呼吸都变得困难……若非天降奇迹，此战恐怕……' },
  { min: 21, max: 35,  text: '对方气息浩瀚如海，巨大灵压几乎让你难以呼吸。这一战，凶多吉少。' },
  { min: 36, max: 50,  text: '对手修为远胜于你，但你握紧法宝，心中升起不屈战意。或许，并非全无机会。' },
  { min: 51, max: 65,  text: '境界有差，但法宝犀利、功法霸道，赢面似乎不小。' },
  { min: 66, max: 80,  text: '对方灵力虚浮根基不稳。你眼中寒光一闪，此战十拿九稳。' },
  { min: 81, max: 95,  text: '几乎感觉不到压力。对手所有破绽在你眼中一览无余。' },
];

/* ---------------- 战斗性质 ---------------- */
export const BATTLE_TYPES = {
  qiecuo:  { name: '切磋较技', win: '声望+少量道韵经验', lose: '无实质惩罚' },
  shengci: { name: '生死仇杀', win: '击杀掉落全部', lose: '装备丢失或修为倒退' },
  yaoshou: { name: '妖兽战斗', win: '妖兽材料+修为经验', lose: '伤势休养1~3月' },
  ziwei:   { name: '自卫反击', win: '击杀掉落全部', lose: '无惩罚' },
};

/* ---------------- 十条天命主线 ----------------
 * stages：阶段数组。reqLv：触发所需修为等级。
 * 【扩展点】reward 目前支持 type: 功法/装备/道基/货币/称号，
 *   可在 systems.js 的 applyDestinyReward 中登记新类型。 */
export const DESTINY_LINES = {
  shengti: { name: '圣体之路', pack: '天生道体', stages: [
    { name: '圣体初醒', reqLv: 1,  plot: '你偶感体内沉睡的荒古圣体微微发烫，似有封印松动之象。', reward: { type: '道基', key: '根骨', val: 5, text: '圣体血脉滋养，根骨+5' } },
    { name: '星辰锻体', reqLv: 11, plot: '夜空星辰垂落一缕星辉，你悟得炼气功法《星辰锻体术》。', reward: { type: '功法', name: '星辰锻体术', grade: 'tian', text: '获得天品功法《星辰锻体术》' } },
    { name: '圣体初劫', reqLv: 21, plot: '圣体引来天妒，渡劫之后星辉凝甲，护你周身。', reward: { type: '装备', name: '星辉战甲', lv: 3, text: '获得上品法器「星辉战甲」' } },
    { name: '不灭战体', reqLv: 41, plot: '金丹一成，圣体小成，万法难伤。', reward: { type: '道基', key: '根骨', val: 15, text: '不灭战体，根骨+15' } },
    { name: '因果清算', reqLv: 61, plot: '昔日封印你圣体之人现身，因果已至清算之时。', reward: { type: '货币', val: 5000, text: '缴获敌藏，下品灵石+5000' } },
    { name: '星空试炼', reqLv: 81, plot: '踏入星门，接受万古战仙的终极试炼。', reward: { type: '称号', text: '获得封号「星辉战仙」', title: '星辉战仙' } },
  ]},
  caitong: { name: '财可通神', pack: '坊市学徒', stages: [
    { name: '第一桶金', reqLv: 1,  plot: '你在坊市低买高卖，赚得了修仙路上的第一桶金。', reward: { type: '货币', val: 200, text: '下品灵石+200' } },
    { name: '商会雏形', reqLv: 11, plot: '小小摊位已成铺面，「灵石护盾」的神通也随商道感悟而生。', reward: { type: '道基', key: '气运', val: 8, text: '商道昌隆，气运+8' } },
    { name: '垄断之路', reqLv: 21, plot: '你的商会吞并数家同行，玲珑商体悄然觉醒。', reward: { type: '道基', key: '悟性', val: 10, text: '玲珑商体，悟性+10' } },
    { name: '金钱道义', reqLv: 41, plot: '一笔染血的生意摆在面前，金钱与道义，你如何抉择？', reward: { type: '货币', val: 2000, text: '下品灵石+2000' } },
    { name: '富可敌国', reqLv: 61, plot: '通天商会名震天玄，财可通神，诚不我欺。', reward: { type: '货币', val: 20000, text: '下品灵石+20000' } },
    { name: '永恒财神', reqLv: 81, plot: '散尽家财可换一线飞升天机，或留世做那永恒财神。', reward: { type: '称号', text: '获得封号「通天财神」', title: '通天财神' } },
  ]},
  xuemai: { name: '血脉复兴', pack: '没落血脉', stages: [
    { name: '族比扬名', reqLv: 1,  plot: '家族族比之上，你一鸣惊人，长老们重新审视这脉没落的血统。', reward: { type: '道基', key: '血脉', val: 5, text: '血脉微鸣，血脉+5' } },
    { name: '诅咒溯源', reqLv: 11, plot: '你循着族谱残页，触到了苍梧古族诅咒的一角真相。', reward: { type: '道基', key: '血脉', val: 10, text: '血脉共鸣，血脉+10' } },
    { name: '古血觉醒', reqLv: 21, plot: '苍梧古血觉醒！修炼速度大涨，木系功法事半功倍。', reward: { type: '功法', name: '万木长春经', grade: 'di', text: '获得地品功法《万木长春经》' } },
    { name: '复仇和解', reqLv: 41, plot: '当年下咒的仇家登门，是血债血偿，还是一笑泯恩仇？', reward: { type: '道基', key: '道心', val: 12, text: '心结得解，道心+12' } },
    { name: '重建圣地', reqLv: 61, plot: '苍梧圣地遗址重现天日，万木为之朝拜。', reward: { type: '货币', val: 8000, text: '圣地遗藏，下品灵石+8000' } },
    { name: '飞升寻祖', reqLv: 81, plot: '血脉尽头，是飞升寻祖，还是永世守护这片苍梧大地？', reward: { type: '称号', text: '获得封号「苍梧老祖」', title: '苍梧老祖' } },
  ]},
  nijing: { name: '逆境求生', pack: '遗孤散修', stages: [
    { name: '师父遗泽', reqLv: 1,  plot: '整理师父遗物时，你发现了一枚藏着遗训的玉简。', reward: { type: '功法', name: '长春功', grade: 'ling', text: '获得灵品功法《长春功》' } },
    { name: '散修尊严', reqLv: 11, plot: '坊市恶霸欺压散修，你挺身而出，困兽之斗的意志就此凝成。', reward: { type: '道基', key: '道心', val: 8, text: '困兽之斗，道心+8' } },
    { name: '逍遥觉醒', reqLv: 21, plot: '天地为家，逍遥自在，逍遥体于风餐露宿中觉醒。', reward: { type: '道基', key: '根骨', val: 10, text: '逍遥体，根骨+10' } },
    { name: '散修逆袭', reqLv: 41, plot: '宗门天骄当众折辱散修，你登台挑战，一战惊天下。', reward: { type: '装备', name: '流光梭', lv: 4, text: '获得极品法器「流光梭」' } },
    { name: '天下无派', reqLv: 61, plot: '散修联盟奉你为盟主，天下散修终于有了立足之地。', reward: { type: '货币', val: 10000, text: '联盟供奉，下品灵石+10000' } },
    { name: '散修之祖', reqLv: 81, plot: '独自飞升，还是留世做那万代散修之祖？', reward: { type: '称号', text: '获得封号「逍遥散圣」', title: '逍遥散圣' } },
  ]},
  zaizheng: { name: '再证大道', pack: '转世大能', stages: [
    { name: '魔功诱惑', reqLv: 1,  plot: '梦中前世记忆翻涌，一部魔功的诱惑悄然浮现。', reward: { type: '道基', key: '道心', val: 5, text: '守住本心，道心+5' } },
    { name: '前世遗产', reqLv: 11, plot: '你循着记忆找到了前世洞府，前世威压残存其中。', reward: { type: '货币', val: 1000, text: '前世遗藏，下品灵石+1000' } },
    { name: '轮回觉醒', reqLv: 21, plot: '轮回体觉醒，两世记忆交融，道途豁然开朗。', reward: { type: '功法', name: '太阴寒螭功', grade: 'di', text: '获得地品功法《太阴寒螭功》' } },
    { name: '斩断因果', reqLv: 41, plot: '前世仇家寻上门来，这一世，由你斩断因果。', reward: { type: '道基', key: '悟性', val: 12, text: '两世智慧，悟性+12' } },
    { name: '超越前世', reqLv: 61, plot: '你的修为终于超越了前世的巅峰。', reward: { type: '装备', name: '乾坤鼎', lv: 6, text: '获得中品法宝「乾坤鼎」' } },
    { name: '守护轮回', reqLv: 81, plot: '飞升了结两世因果，或留在人间守护轮回秩序？', reward: { type: '称号', text: '获得封号「轮回道主」', title: '轮回道主' } },
  ]},
  hongchen: { name: '红尘问道', pack: '佛道童子', stages: [
    { name: '入世首课', reqLv: 1,  plot: '师父让你下山化缘三日，红尘第一课，从一碗百家饭开始。', reward: { type: '道基', key: '道心', val: 5, text: '初悟红尘，道心+5' } },
    { name: '身份抉择', reqLv: 11, plot: '佛门清净与道门逍遥之间，你做出了自己的选择。', reward: { type: '功法', name: '青元剑诀', grade: 'ling', text: '获得灵品功法《青元剑诀》' } },
    { name: '功德金身', reqLv: 21, plot: '行善积德，功德之光凝成护体金身。', reward: { type: '道基', key: '气运', val: 10, text: '功德加身，气运+10' } },
    { name: '立教传法', reqLv: 41, plot: '你开坛讲法，座下听道者云集。', reward: { type: '道基', key: '悟性', val: 12, text: '讲道悟法，悟性+12' } },
    { name: '大道之争', reqLv: 61, plot: '佛道两家论道于须弥之巅，你代表一脉出战。', reward: { type: '货币', val: 9000, text: '香火供奉，下品灵石+9000' } },
    { name: '普度众生', reqLv: 81, plot: '飞升极乐，还是留世普度众生？', reward: { type: '称号', text: '获得封号「红尘圣僧」', title: '红尘圣僧' } },
  ]},
  dandao: { name: '丹道至尊', pack: '炼丹世家', stages: [
    { name: '父亲试炼', reqLv: 1,  plot: '父亲留下一炉未成的丹药，考验你的丹道天赋。', reward: { type: '道基', key: '悟性', val: 5, text: '丹道初悟，悟性+5' } },
    { name: '丹盟挑战', reqLv: 11, plot: '丹盟考核之上，你一炉三丹，技惊四座。', reward: { type: '功法', name: '烈焰心经', grade: 'ling', text: '获得灵品功法《烈焰心经》' } },
    { name: '丹灵觉醒', reqLv: 21, plot: '丹灵体觉醒，丹火随心而动。', reward: { type: '道基', key: '根骨', val: 10, text: '丹火淬体，根骨+10' } },
    { name: '丹道至尊', reqLv: 41, plot: '你的丹药一丹难求，丹道至尊之名不胫而走。', reward: { type: '货币', val: 6000, text: '丹药大卖，下品灵石+6000' } },
    { name: '九转金丹', reqLv: 61, plot: '九转金丹的丹方终于集齐，开炉之日，天地异象。', reward: { type: '装备', name: '乾坤鼎', lv: 6, text: '获得中品法宝「乾坤鼎」' } },
    { name: '金丹留世', reqLv: 81, plot: '服下九转金丹即刻飞升，或将其留给后人？', reward: { type: '称号', text: '获得封号「九转丹圣」', title: '九转丹圣' } },
  ]},
  zongmen: { name: '宗门逆袭', pack: '宗门杂役', stages: [
    { name: '黑玉之谜', reqLv: 1,  plot: '杂役房的黑玉残片夜夜发烫，似藏着宗门的秘密。', reward: { type: '道基', key: '悟性', val: 5, text: '黑玉启智，悟性+5' } },
    { name: '外门大比', reqLv: 11, plot: '外门大比，你以杂役之身连克强敌，逆境爆发。', reward: { type: '功法', name: '玄水真法', grade: 'ling', text: '获得灵品功法《玄水真法》' } },
    { name: '铁面判官', reqLv: 21, plot: '执掌刑罚堂，铁面无私，宗门风气为之一清。', reward: { type: '道基', key: '道心', val: 10, text: '铁面丹心，道心+10' } },
    { name: '宗门政变', reqLv: 41, plot: '腐朽的长老会与少壮派剑拔弩张，你必须选边。', reward: { type: '货币', val: 5000, text: '宗门重赏，下品灵石+5000' } },
    { name: '道统之争', reqLv: 61, plot: '圣子之位近在咫尺，道统之争不可避免。', reward: { type: '装备', name: '山河扇', lv: 5, text: '获得下品法宝「山河扇」' } },
    { name: '万古宗师', reqLv: 81, plot: '飞升追寻秩序本源，或留下做那万古宗师？', reward: { type: '称号', text: '获得封号「太虚圣子」', title: '太虚圣子' } },
  ]},
  baibing: { name: '百兵之祖', pack: '铸剑山庄', stages: [
    { name: '神火之秘', reqLv: 1,  plot: '山庄地火脉异动，一缕神火的秘密被你撞破。', reward: { type: '道基', key: '根骨', val: 5, text: '神火锻体，根骨+5' } },
    { name: '家族存亡', reqLv: 11, plot: '强敌觊觎神火，山庄存亡系于你一身。', reward: { type: '功法', name: '大日焚天录', grade: 'di', text: '获得地品功法《大日焚天录》' } },
    { name: '兵主觉醒', reqLv: 21, plot: '兵主之体觉醒，天下神兵与你共鸣。', reward: { type: '装备', name: '紫电锤', lv: 4, text: '获得极品法器「紫电锤」' } },
    { name: '神兵出世', reqLv: 41, plot: '你亲手锻造的绝世神兵出世，引动天雷贺礼。', reward: { type: '装备', name: '斩龙刀', lv: 6, text: '获得中品法宝「斩龙刀」' } },
    { name: '神兵择主', reqLv: 61, plot: '神兵有灵，各方大能上门求剑，择主风波四起。', reward: { type: '货币', val: 15000, text: '铸兵酬金，下品灵石+15000' } },
    { name: '百兵之祖', reqLv: 81, plot: '携神兵飞升，或将神兵留作镇族之宝？', reward: { type: '称号', text: '获得封号「百兵之祖」', title: '百兵之祖' } },
  ]},
  daqi: { name: '我命由我不由天', pack: '大器晚成', stages: [
    { name: '筑基骗局', reqLv: 1,  plot: '有人向你兜售「筑基神丹」，是骗局还是机缘？', reward: { type: '道基', key: '悟性', val: 5, text: '识破虚妄，悟性+5' } },
    { name: '自创功法', reqLv: 11, plot: '无人看好你，你偏要自创功法，走出自己的路。', reward: { type: '功法', name: '厚土诀', grade: 'ling', text: '获得灵品功法《厚土诀》' } },
    { name: '混沌觉醒', reqLv: 21, plot: '废灵根竟是未醒的混沌体！五行归一，大道可期。', reward: { type: '道基', key: '根骨', val: 12, text: '混沌体觉醒，根骨+12' } },
    { name: '废材联盟', reqLv: 41, plot: '天下「废材」齐聚，你成了他们的旗帜。', reward: { type: '货币', val: 5000, text: '联盟供奉，下品灵石+5000' } },
    { name: '大道至简', reqLv: 61, plot: '繁华落尽，大道至简，你的功法返璞归真。', reward: { type: '道基', key: '悟性', val: 15, text: '大彻大悟，悟性+15' } },
    { name: '废材圣地', reqLv: 81, plot: '以废灵根之身飞升，还是建立一座废材圣地？', reward: { type: '称号', text: '获得封号「逆命道祖」', title: '逆命道祖' } },
  ]},
};

/* ---------------- NPC 生成素材 ---------------- */
export const NPC_SURNAMES = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '林', '苏', '顾', '沈', '韩', '杨', '叶', '楚', '秦', '燕', '司徒', '欧阳'];
export const NPC_GIVEN = ['恒', '清璇', '破天', '无涯', '灵珊', '铁心', '问天', '雪见', '苍松', '红袖', '孤鸿', '白石', '惊鸿', '采薇', '镇岳', '流云', '青冥', '小环', '厉风', '明河'];
export const NPC_TRAITS = ['豪爽', '谨慎', '狡黠', '清冷', '热心', '孤傲', '圆滑', '木讷', '狠厉', '慈悲'];
export const NPC_JOBS = ['散修', '坊市商贩', '炼丹师', '炼器师', '符师', '阵师', '剑修', '体修', '包打听', '灵植师'];
export const NPC_SKILLS = {
  '炼丹师': '灵材援济型：每月赠送一份炼丹辅料或灵草',
  '灵植师': '灵材援济型：每月赠送一份灵草',
  '炼器师': '炼器支援型：法器保养与小修八折',
  '坊市商贩': '产业打理型：名下店铺月利+15%',
  '包打听': '风声通达型：每月提供一条本地情报',
  '符师': '手作敬献型：每月敬赠一张低阶符箓',
  '阵师': '手作敬献型：每月敬赠一面阵旗',
  '剑修': '仗义护持型：遇麻烦时可求其出面助拳',
  '体修': '仗义护持型：遇麻烦时可求其出面助拳',
  '散修': '引荐延誉型：每半年引荐一位本地高人',
};
export const DAOYUAN_LEVELS = ['陌路', '一面之缘', '熟识', '道友', '心腹/道侣'];

/* ---------------- 道缘深度互动：职业专属支线（需达「道友」解锁「深谈」） ----------------
 * reward 仅描述，由 systems.interactNpc 按 type 应用，避免 data↔systems 循环依赖。
 *   stones: 灵石区间      item: 直接赠送物品      equip: 赠送对应部位装备（level=品级基准）
 *   exp: 道基经验（base=道基名）   daoYun: 先天道韵经验区间 */
export const DEEP_NPC_EVENTS = {
  '散修': { text: '对方叹散修飘零、无依无靠，与你细说当年卡在瓶颈、险些道消的往事，临别塞来些许盘缠。', reward: { type: 'stones', min: 50, max: 150 } },
  '坊市商贩': { text: '对方抱怨行情起伏、赊账难收，却悄悄塞给你一张自家铺子的折扣契，言「他日照顾生意」。', reward: { type: 'stones', min: 30, max: 80 } },
  '炼丹师': { text: '对方将一炉私藏丹方心得相授，又赠你几味难寻的炼丹辅料，嘱咐「莫要外传」。', reward: { type: 'item', 名称: '私藏丹方·残卷', 类型: '材料', 数量: 1, 描述: '炼丹师相赠的丹方心得，研习可助炼丹。', 价值: 120 } },
  '炼器师': { text: '对方拉你入炉火熊熊的工坊，将一柄保养妥帖的法器胚赠你，说「好钢当赠识剑人」。', reward: { type: 'equip', slot: 'weapon', level: 6 } },
  '符师': { text: '对方展露满匣符箓，挑了几张低阶符相赠，笑言「防身足矣，莫逞强」。', reward: { type: 'item', 名称: '低阶护身符', 类型: '消耗品', 数量: 2, 描述: '符师相赠的护身符，危难时或可挡灾。', 价值: 50 } },
  '阵师': { text: '对方邀你观其布阵，临行赠你一面阵旗，道「此旗可临时成小小护阵」。', reward: { type: 'item', 名称: '简易阵旗', 类型: '材料', 数量: 1, 描述: '阵师相赠的阵旗，布置可成临时护阵。', 价值: 70 } },
  '剑修': { text: '对方拔剑起舞，于月下论一式剑意，你恍有所悟，剑心通透几分。', reward: { type: 'exp', base: '悟性', min: 10, max: 20 } },
  '体修': { text: '对方裸身扛鼎，与你论炼体之苦乐，你受其气血磅礴所感，根骨隐隐坚实。', reward: { type: 'exp', base: '根骨', min: 10, max: 20 } },
  '包打听': { text: '对方压低声音，透出一条未公开的秘闻——某地似有古修坐化洞府现世。', reward: { type: 'exp', base: '气运', min: 8, max: 16 } },
  '灵植师': { text: '对方引你入灵田，赠你几株年份不浅的灵草，言「灵植最讲缘分」。', reward: { type: 'item', 名称: '年份灵草', 类型: '材料', 数量: 2, 描述: '灵植师相赠的灵草，炼丹上品。', 价值: 60 } },
};

/* ---------------- 势力素材（天机简报用） ---------------- */
export const FACTIONS = ['太虚宗', '玄阴殿', '血煞门', '丹盟', '天剑宗', '大商皇朝', '妖皇殿', '散修联盟', '器盟', '万兽谷'];
export const WORLD_EVENTS = [
  '在边境因灵脉之争发生小规模斗法',
  '宣布本月丹药价格下调一成',
  '有长老闭关十年近日出关，据说已摸到瓶颈',
  '在东荒扩张势力，吞并两个小宗门',
  '门下弟子在秘境中获得上古传承，实力大涨',
  '与邻近势力结为盟好，互通有无',
  '发布悬赏，缉拿一名魔道修士',
  '发现疑似上古洞府的禁制，正在召集人手',
];

/* ---------------- 妖兽素材 ---------------- */
export const BEASTS = [
  { name: '青风狼', lv: [3, 8] }, { name: '赤焰虎', lv: [12, 18] }, { name: '玄冰蟒', lv: [15, 25] },
  { name: '铁背苍熊', lv: [22, 35] }, { name: '紫电雕', lv: [30, 45] }, { name: '九尾灵狐', lv: [42, 58] },
  { name: '深海龙鲸', lv: [55, 75] }, { name: '上古遗种·狰', lv: [70, 90] },
];

/* ---------------- 道缘层级门槛 ---------------- */
export const RELATION_RULES = {
  favorDecayMonths: 6,   // 久不联系开始衰减
  levelUp: [0, 1, 40, 60, 80], // 陌路→一面之缘→熟识→道友→心腹 的好感门槛
};

/* ---------------- 杂项 ---------------- */
export const SAVE_VERSION = '1.3.0';
export const GAME_START_YEAR = 1000; // 天玄历起始年
export const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
/** 存档码字符集（去除 0/O、1/I/L 等易混淆字符） */
export const SAVE_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
