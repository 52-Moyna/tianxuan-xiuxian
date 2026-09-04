/**
 * codex.js - 图鉴、境界说明与物品成长规则
 * ============================================================
 * 集中管理：
 *   - 七大境界详细说明（REALM_GUIDE）
 *   - 物品图鉴数据与发现记录（CODEX_ITEMS / ensureCodexState / discoverItem）
 *   - 套装效果与联动判定（SET_BONUSES / activeSetBonuses / setBonusFlags）
 *   - 丹药品质、丹毒与副作用（PILL_QUALITY / pillSideEffect / applyPillToxicity）
 *   - 灵兽、宗门、拍卖、秘境等新玩法的静态数据与判定函数
 * 玩法系统只调用这里的判定函数，不直接读取原始数组。
 */
import { EQUIP_GRADES, calcEquipPower, CURRENCIES, CURRENCY_RATE } from './data.js';
import { ensureLifeState } from './life.js';

/* ============================================================
 * 一、境界说明（与 data.js 的 REALS 互补：data.js 给数值，这里给文案）
 * ========================================================== */
export const REALM_GUIDE = [
  {
    min: 1, max: 10, name: '凡人境', life: 100,
    unlock: '基础战斗、使用凡器、学习凡品功法、出入凡间坊市',
    detail: '尚未引气入体，以体魄、武艺和凡器应对世间。这是绝大多数凡人一生的天花板，但也是仙途的起点。凡人境修士尚未真正踏足修真界，多在俗世磨砺心智与根骨。',
    bottleneck: '引气入体：修为满溢后寻找灵地温养，或服用聚气丹助益。',
    next: '炼气期',
  },
  {
    min: 11, max: 20, name: '炼气期', life: 150,
    unlock: '神识外放、御器短途飞行、初级符箓、收徒资格',
    detail: '灵气入体，开始真正踏入仙途。多数散修在此境界打磨根基，功法、灵根和道基的差异在此期被放大。炼气修士可御器短途飞行，但远行仍需车马舟船。',
    bottleneck: '筑基：准备筑基丹并提高道心、气运；筑基失败会跌落修为。',
    next: '筑基期',
  },
  {
    min: 21, max: 40, name: '筑基期', life: 250,
    unlock: '真火炼丹、真元护体、收徒、秘境外围、跨域旅行',
    detail: '道基初成，寿元与手段大幅提升，可以在修真界立足。筑基修士是各宗门的中坚力量，可炼制真火丹药、出入秘境外围。',
    bottleneck: '结丹：积累高阶材料，稳固道基与功法；需在金丹瓶颈前完成本命法宝或本命功法的雏形。',
    next: '金丹期',
  },
  {
    min: 41, max: 60, name: '金丹期', life: 500,
    unlock: '丹火炼器、神识传音、势力创建、秘境深处、本命法宝',
    detail: '一粒金丹吞入腹，从此我命不由天。可炼制本命法宝，开创小势力，是真正意义上的"修士"。金丹修士神识可传音千里，已是修真界一方人物。',
    bottleneck: '丹破婴生：需要稳定洞府、丹药和长期闭关；失败会金丹碎裂、跌落至筑基。',
    next: '元婴期',
  },
  {
    min: 61, max: 80, name: '元婴期', life: 1000,
    unlock: '元婴离体、分身术、远域旅行、高阶法宝、开宗立派',
    detail: '元婴可离体遨游，修士开始影响地域格局与宗门兴衰。元婴修士一怒，可灭一城；可开辟分身、远渡重洋、开宗立派。',
    bottleneck: '法则初悟：寻找个人道途，准备抗心魔手段；此阶段失败有走火入魔之险。',
    next: '化神期',
  },
  {
    min: 81, max: 95, name: '化神期', life: 3000,
    unlock: '法则领域、虚空挪移、天命终局事件、先天至宝共鸣',
    detail: '神念化神，举手投足皆可牵动天地法则。化神修士已是凡界顶峰，能开辟独立洞天，与天道意志直接交涉。天命终局事件多在此境界触发。',
    bottleneck: '飞升之劫：集齐法宝、道缘和天命遗产；此劫失败则魂飞魄散，仅余一线真灵可入轮回。',
    next: '渡劫/大乘',
  },
  {
    min: 96, max: 100, name: '渡劫/大乘', life: 99999,
    unlock: '飞升资格、终局选择、先天至宝共鸣、建立传承',
    detail: '已站在凡界尽头。飞升可踏入仙界，亦可留下建立自己的道统传承，庇护后人。此境界的每一次抉择都将影响整个凡界的格局。',
    bottleneck: '飞升：完成最终天命并承受天道考验；亦可选择留下，成为凡界守护者。',
    next: '仙界（飞升终局）',
  },
];

/* ============================================================
 * 二、物品图鉴（按分类组织，含来源、效果、稀有度）
 * ========================================================== */
export const ITEM_TYPES = ['装备', '法宝', '丹药', '道具', '材料', '容器', '线索', '功法', '灵兽', '灵草'];


/* 装备图鉴生成器 */
const EQUIP_SLOT_INFO = {
  weapon: { name: '武器', noun: '兵器' }, armor: { name: '衣服', noun: '衣甲' },
  pants: { name: '裤子', noun: '护腿' }, boots: { name: '鞋子', noun: '战靴' },
  accessory: { name: '戒指', noun: '指环' }, artifact: { name: '法宝', noun: '重宝' },
};
/* 各品阶「典型装备等级区间」——贴近玩家实际可获得的等级（真实掉落等级 ≈ 玩家等级/12），
 * 不再把玩家境界等级直接当作装备自身等级，避免单件装备战力被放大到上千（BT 传奇式崩坏）。
 * 设计原则：图鉴标注的战力必须与玩家手里真实装备的战力处于同一量级。 */
const GRADE_TYPICAL_LEVEL = {
  fan:    [1, 2],
  faqi:   [2, 3],
  lingqi: [3, 4],
  fabao:  [2, 4],
  lingbao:[4, 6],
  xianqi: [5, 8],
};
function buildEquipEffect(slot, gradeId, flavor, extra = '') {
  const info = EQUIP_SLOT_INFO[slot];
  const g = EQUIP_GRADES.find((x) => x.id === gradeId);
  const [lo, hi] = GRADE_TYPICAL_LEVEL[gradeId] || [1, 3];
  const pLo = calcEquipPower(slot, lo, g);
  const pHi = calcEquipPower(slot, hi, g);
  const rng = pLo === pHi ? String(pLo) : (pLo + '~' + pHi);
  const tail = extra ? '；' + extra : '';
  return '【' + info.name + '】' + g.name + info.noun + '，战力 ' + rng + '；' + flavor + tail + '。';
}
// [slot, gradeId, id, name, rarity, source, flavor, extra?]
const EQUIP_GRID = [
  // —— 武器（7品阶） ——
  ['weapon', 'fan', 'eq_wp_fan', '凡器武器', '凡器', '坊市、开局、战利品', '入门之选'],
  ['weapon', 'faqi', 'eq_wp_xuantie', '玄铁武器', '法器', '坊市、炼器', '坚韧可靠'],
  ['weapon', 'lingqi', 'eq_wp_qingfeng', '青锋武器', '灵器', '坊市、炼器、秘境', '锋利异常'],
  ['weapon', 'fabao', 'eq_wp_chiyan', '赤炎武器', '法宝', '炼器、秘境、拍卖', '附火属性'],
  ['weapon', 'lingbao', 'eq_wp_leiting', '雷霆武器', '灵宝', '秘境、天命、拍卖', '附雷属性'],
  ['weapon', 'lingbao', 'eq_wp_shihun', '噬魂武器', '灵宝', '天命、上古遗府', '可削弱敌人心神'],
  ['weapon', 'xianqi', 'eq_wp_zhanxian', '斩仙武器', '仙器', '飞升机缘、终局', '斩断一切'],
  // —— 衣服（7品阶） ——
  ['armor', 'fan', 'eq_ar_buyi', '布衣衣服', '凡器', '开局、坊市', '粗布衣衫，遮体保暖'],
  ['armor', 'faqi', 'eq_ar_yunwen', '云纹衣服', '法器', '坊市、战利品', '道袍，轻便舒适'],
  ['armor', 'lingqi', 'eq_ar_xuanjia', '玄甲衣服', '灵器', '坊市、炼器', '甲衣，防御坚实'],
  ['armor', 'fabao', 'eq_ar_jinsi', '金丝衣服', '法宝', '炼器、宗门', '锦袍，金丝编织'],
  ['armor', 'lingbao', 'eq_ar_longlin', '龙鳞衣服', '灵宝', '秘境、天命', '鳞甲，龙鳞加持'],
  ['armor', 'lingbao', 'eq_ar_bumie', '不灭衣服', '灵宝', '天命、传承', '宝甲，受损自修复'],
  ['armor', 'xianqi', 'eq_ar_hunyuan', '混元衣服', '仙器', '飞升机缘、终局', '道袍，混元一气'],
  // —— 裤子（7品阶） ——
  ['pants', 'fan', 'eq_pt_cubu', '粗布裤子', '凡器', '开局、坊市', '布裤，朴素下装'],
  ['pants', 'faqi', 'eq_pt_jifeng', '疾风裤子', '法器', '坊市、炼器', '劲装，身法加成'],
  ['pants', 'lingqi', 'eq_pt_liuyun', '流云裤子', '灵器', '坊市、炼器', '长裤，行动轻便'],
  ['pants', 'fabao', 'eq_pt_huanying', '幻影裤子', '法宝', '炼器、秘境', '神裤，残影随行'],
  ['pants', 'lingbao', 'eq_pt_taxu', '踏虚裤子', '灵宝', '秘境、天命', '宝裤，踏虚而行'],
  ['pants', 'lingbao', 'eq_pt_qiankun', '乾坤裤子', '灵宝', '天命、传承', '神裤，乾坤在握'],
  ['pants', 'xianqi', 'eq_pt_wuji', '无极裤子', '仙器', '飞升机缘、终局', '圣裤，无极无穷'],
  // —— 鞋子（7品阶） ——
  ['boots', 'fan', 'eq_bt_caoxie', '草鞋鞋子', '凡器', '开局、坊市', '草编履，轻巧赶路'],
  ['boots', 'faqi', 'eq_bt_qingyu', '轻羽鞋子', '法器', '坊市、炼器', '战靴，羽轻如燕'],
  ['boots', 'lingqi', 'eq_bt_tafeng', '踏风鞋子', '灵器', '坊市、炼器', '战靴，踏风而行'],
  ['boots', 'fabao', 'eq_bt_zhuiguang', '追光鞋子', '法宝', '炼器、西极玄冰域', '神靴，追光逐日'],
  ['boots', 'lingbao', 'eq_bt_zhuyue', '逐月鞋子', '灵宝', '秘境、拍卖', '宝靴，逐月星奔'],
  ['boots', 'lingbao', 'eq_bt_xiaoyao', '逍遥鞋子', '灵宝', '天命、传承', '仙履，逍遥天地'],
  ['boots', 'xianqi', 'eq_bt_lingxiao', '凌霄鞋子', '仙器', '飞升机缘、终局', '圣履，凌霄直上'],
  // —— 戒指（7品阶） ——
  ['accessory', 'fan', 'eq_ac_tiejie', '铁戒指', '凡器', '开局、坊市', '朴素耐用'],
  ['accessory', 'faqi', 'eq_ac_tongjie', '铜戒指', '法器', '坊市、道友回礼', '温润养神'],
  ['accessory', 'lingqi', 'eq_ac_yinjie', '银戒指', '灵器', '坊市、炼器', '灵力微增'],
  ['accessory', 'fabao', 'eq_ac_jinjie', '金戒指', '法宝', '炼器、岭南百越', '护佑随身'],
  ['accessory', 'lingbao', 'eq_ac_yujie', '玉戒指', '灵宝', '秘境、天命', '温养元神'],
  ['accessory', 'lingbao', 'eq_ac_kongjian', '空间戒指', '灵宝', '天命、秘境、拍卖会', '内含独立空间', '储物袋容量+30格'],
  ['accessory', 'xianqi', 'eq_ac_taixu_jie', '太虚戒', '仙器', '飞升机缘、终局', '太虚造化'],
  // —— 法宝（7品阶） ——
  ['artifact', 'fan', 'eq_af_canpian', '残片法宝', '凡器', '炼器、战利品（游历/秘境掉落）', '法宝残片，可在百艺·炼器「残片修复」（辅以星砂）重铸为可用灵珠法宝。'],
  ['artifact', 'faqi', 'eq_af_lingzhu_fa', '灵珠法宝', '法器', '炼器、坊市', '灵珠形态，可成长'],
  ['artifact', 'lingqi', 'eq_af_baoyin', '宝印法宝', '灵器', '炼器、秘境', '印信形态，威慑力强'],
  ['artifact', 'fabao', 'eq_af_xianjian', '仙剑法宝', '法宝', '秘境、天命', '剑形，攻伐利器'],
  ['artifact', 'lingbao', 'eq_af_guzhong', '古钟法宝', '灵宝', '秘境、传承', '钟形，震慑心神'],
  ['artifact', 'lingbao', 'eq_af_shending', '神鼎法宝', '灵宝', '天命、上古遗府', '鼎形，炼化万物'],
  ['artifact', 'xianqi', 'eq_af_zaohua', '造化法宝', '仙器', '飞升机缘、终局', '造化至宝，夺天地造化'],
  // —— 特殊命名法宝 ——
  ['artifact', 'fabao', 'artifact_qingfeng_sword', '青锋剑', '法宝', '秘境、拍卖会、特殊机缘', '可能获得战斗词条'],
  ['artifact', 'fabao', 'artifact_xuantie_heavy', '玄铁重剑', '法宝', '炼器、坊市', '攻击力强'],
  ['artifact', 'lingbao', 'artifact_liuguang', '流光梭', '灵宝', '秘境、西极玄冰域', '速度极快，战斗先手加成'],
  ['artifact', 'lingbao', 'artifact_dianchui', '紫电锤', '灵宝', '南明离火域、炼器', '附雷属性，群攻效果'],
  ['artifact', 'lingbao', 'artifact_hanbing', '寒冰绫', '灵宝', '西极玄冰域、秘境', '可冻结敌人，降低敌方速度'],
  ['artifact', 'lingbao', 'artifact_liyang', '烈阳环', '灵宝', '南明离火域、天命', '持续灼烧伤害'],
  ['artifact', 'lingbao', 'artifact_sheling', '摄魂铃', '灵宝', '岭南百越、秘境', '可扰乱敌人心神'],
  ['artifact', 'lingbao', 'artifact_shanhe', '山河扇', '灵宝', '中州圣城、拍卖会', '可施展防御法阵'],
  ['artifact', 'xianqi', 'artifact_zhanlong', '斩龙刀', '仙器', '天命终局、上古遗府', '对龙属妖兽伤害翻倍'],
  // —— 通用装备名（旧版兼容 + 商店固定名） ——
  ['weapon', 'fan', 'gear_iron_sword', '玄铁长剑', '普通', '坊市、历练战利品、炼器', '凡人至炼气期常用兵器'],
  ['armor', 'fan', 'gear_iron_armor', '制式护心甲', '普通', '中州坊市、宗门配发', '稳定防护，性价比高'],
  ['armor', 'fan', 'gear_cloud_robe', '云纹道袍', '普通', '坊市、战利品', '轻便舒适，炼气期常备'],
  ['accessory', 'fabao', 'gear_yao_wrist', '妖纹护腕', '稀有', '东荒妖域坊市、妖兽材料炼制', '以妖纹强化筋骨'],
  ['boots', 'fabao', 'gear_qingfeng_boots', '青风靴', '稀有', '东荒妖域坊市', '轻捷步战，妖纹套装组件'],
  ['armor', 'fabao', 'gear_yaowen_armor', '妖纹战铠', '稀有', '东荒妖域坊市、妖兽材料炼制', '妖纹铭刻甲片，妖纹套装组件'],
  ['armor', 'fabao', 'gear_fire_vest', '火纹战衣', '稀有', '南明离火域坊市、炼器', '耐火护具'],
  ['armor', 'fabao', 'gear_star_armor', '星辉战甲', '稀有', '天命、炼器、宗门大比', '金丹期后可精炼，星辉套装组件'],
  ['armor', 'fabao', 'gear_sea_leather', '海兽皮甲', '稀有', '北冥瀚海坊市', '轻便耐久，海行套装组件'],
  ['accessory', 'fabao', 'gear_poison_pouch', '百毒囊', '稀有', '岭南百越坊市', '探索妖兽巢穴时额外获得材料'],
  ['weapon', 'fabao', 'gear_break_sword', '破阵短剑', '稀有', '西极玄冰域坊市', '探索遗迹时更容易发现线索'],
  ['weapon', 'fabao', 'gear_star_sword', '星纹剑', '稀有', '百艺炼器（赤铜精+星砂）', '精炼武器，星辉共鸣材料'],
  ['accessory', 'fan', 'eq_ac_lingmai', '灵脉石饰', '凡器', '百艺炼器（宗门灵脉晶+矿石）', '宗门秘境灵脉凝琢，温养元神'],
  // —— 六部位细分（固定品质名） ——
  ['weapon', 'fan', 'eq_weapon_fan', '凡铁剑', '凡品', '坊市、历练战利品', '入门兵器'],
  ['weapon', 'faqi', 'eq_weapon_jing', '精钢剑', '中品', '坊市、炼器', '炼气期常用'],
  ['weapon', 'lingqi', 'eq_weapon_han', '寒霜剑', '上品', '北冥瀚海坊市、炼器', '附寒属性'],
  ['weapon', 'lingqi', 'eq_weapon_chi', '赤焰刀', '上品', '南明离火域坊市、炼器', '附火属性'],
  ['armor', 'fan', 'eq_armor_bu', '粗布衣', '凡品', '开局、坊市', '遮体保暖'],
  ['armor', 'faqi', 'eq_armor_hu', '制式护心甲', '中品', '中州坊市、宗门配发', '稳定防护'],
  ['armor', 'lingqi', 'eq_armor_yun', '云纹道袍', '上品', '坊市、战利品', '炼气期常备'],
  ['armor', 'fabao', 'eq_armor_xing', '星辉战甲', '稀有', '天命、炼器、宗门大比', '星辉套装组件'],
  ['pants', 'fan', 'eq_pants_fan', '凡布裤', '凡品', '坊市', '朴素下装'],
  ['pants', 'faqi', 'eq_pants_xuan', '玄铁护腿', '中品', '坊市、炼器', '护腿加固'],
  ['boots', 'fan', 'eq_boots_bu', '布鞋', '凡品', '坊市', '轻巧赶路'],
  ['boots', 'lingqi', 'eq_boots_ji', '疾风靴', '上品', '西极玄冰域坊市、炼器', '提升行动速度'],
  ['accessory', 'faqi', 'eq_acc_yu', '玉戒指', '中品', '坊市、道友回礼', '温润养神'],
  ['accessory', 'fabao', 'eq_acc_zhu', '辟邪戒', '稀有', '岭南百越坊市、秘境', '抵御心魔'],
  ['artifact', 'fabao', 'eq_artifact_ben', '本命法宝', '法宝', '金丹期凝聚、秘境、渡劫', '随修为成长'],
  // —— 开局/商店特殊装备 ——
  ['weapon', 'fan', 'gear_fanqi_shortsword', '凡器短剑', '凡品', '开局（转世大能）', '短柄兵器'],
  ['weapon', 'fan', 'gear_fanqi_sword', '凡器长剑', '凡品', '开局（天生道体）、坊市', '标准长剑'],
  ['weapon', 'faqi', 'gear_faqi_weapon', '下品法器', '法器', '开局（没落血脉/遗孤散修）、坊市', '法器阶武器'],
  ['weapon', 'faqi', 'gear_old_artifact', '旧法器', '法器', '开局（宗门杂役）', '陈旧法器，虽旧仍可用'],
  ['armor', 'faqi', 'gear_monk_robe', '青布僧袍', '法器', '开局（佛道童子）', '佛门服饰'],
  ['armor', 'faqi', 'gear_craft_armor', '护心甲', '法器', '百艺炼器（赤铜精+妖兽内丹）', '稳定防护装备'],
];
const EQUIP_CODEX = EQUIP_GRID.map(([slot, gradeId, id, name, rarity, source, flavor, extra]) => ({
  id, category: slot === 'artifact' ? '法宝' : '装备', name, rarity, source, slot, grade: gradeId,
  effect: buildEquipEffect(slot, gradeId, flavor, extra),
}));


/* ============================================================
 * 二、灵兽模板（必须在 CODEX_ITEMS 之前，因图鉴条目引用）
 * ========================================================== */
export const BEAST_TEMPLATES = [
  { id: 'wolf', name: '青风狼', element: '风', minLevel: 5, power: 8, skill: '风刃突袭', desc: '速度极快，战斗时提供先手加成。' },
  { id: 'bear', name: '铁背苍熊', element: '土', minLevel: 10, power: 12, skill: '铁背护主', desc: '防御型灵兽，降低战斗失败惩罚。' },
  { id: 'fox', name: '九尾灵狐', element: '幻', minLevel: 20, power: 18, skill: '幻境迷心', desc: '可迷惑敌人，提高越级战胜率。' },
  { id: 'eagle', name: '雷翅隼', element: '雷', minLevel: 30, power: 25, skill: '雷击俯冲', desc: '攻击型灵兽，战斗胜率 +8%。' },
  { id: 'turtle', name: '玄水龟', element: '水', minLevel: 15, power: 10, skill: '玄水护盾', desc: '采集型灵兽，提高灵材获取。' },
  { id: 'phoenix', name: '幼凰', element: '火', minLevel: 50, power: 40, skill: '涅槃残焰', desc: '极稀有，渡劫失败时可保住一次修为。' },
];

/** 灵兽「可寻访门槛」等级（纯函数）：比推荐等级低 10 级就可前往，只是成功率低。
 *  【为何抽成函数】此前收服界面按 `minLevel - 10` 过滤、图鉴却写「minLevel 级后可遇」，
 *  同一件事两处口径，必有一处骗人 —— 玩家 10 级就能去收服九尾灵狐（推荐 20 级），
 *  图鉴却说要 20 级，白白劝退；反过来写松了又害玩家白跑。现图鉴与界面共用此函数。 */
export function beastGateLevel(b) {
  return Math.max(1, (Number(b?.minLevel) || 1) - 10);
}
/** 当前等级下可寻访的灵兽清单（纯函数）：与收服界面、图鉴文案同口径。 */
export function beastCandidates(level) {
  return BEAST_TEMPLATES.filter((b) => (Number(level) || 1) >= beastGateLevel(b));
}

/* ============================================================
 * 三、图鉴物品数据
 * ========================================================== */
export const CODEX_ITEMS = [
  // ================================================================
    // ================================================================
  // 一、装备（由 EQUIP_CODEX 公式生成，战力描述与 calcEquipPower 一致）
  // ================================================================
  ...EQUIP_CODEX,
  { id: 'artifact_qiankun_ding', category: '法宝', name: '乾坤鼎', rarity: '高阶法宝', source: '天命、丹道终局、上古遗府', effect: '炼丹、炼器和高阶材料转化效率提升。' },
// 二、丹药（含瓶颈专属丹 + 商店丹）
  // ================================================================
  { id: 'pill_qi', category: '丹药', name: '聚气丹', rarity: '消耗品', source: '坊市、炼丹', effect: '服用后修为 +80；连续服用会产生丹毒。', toxicity: 8 },
  { id: 'pill_heal', category: '丹药', name: '凝血丹', rarity: '消耗品', source: '坊市、炼丹、道友回礼', effect: '立即清除全部伤势；无毒副作用。', toxicity: 0 },
  { id: 'pill_ningyuan', category: '丹药', name: '凝元丹', rarity: '消耗品', source: '百艺炼丹（妖兽灵草）', effect: '服用后修为 +100；连续服用会产生丹毒。', toxicity: 8 },
  { id: 'pill_shougu', category: '丹药', name: '兽骨续命丹', rarity: '消耗品', source: '百艺炼丹（妖兽兽骨）', effect: '立即清除全部伤势；无毒副作用。', toxicity: 0 },
  { id: 'pill_foundation', category: '丹药', name: '筑基丹', rarity: '关键丹药', source: '坊市、炼丹、天命', effect: '筑基渡劫成功率 +20%；仅在对应瓶颈消耗。', toxicity: 3 },
  // source 只写真实存在的产出路径：此前写的「秘境」在秘境奖励池中查无此物，玩家照图鉴去刷会白跑
  { id: 'pill_lifespan', category: '丹药', name: '延寿丹', rarity: '珍贵丹药', source: '丹炉炼制（金丹期以上，需露华玉液）、拍卖会', effect: '服用后寿元上限 +20 年；一生最多服用 3 颗。', toxicity: 15 },
  { id: 'pill_marrow', category: '丹药', name: '洗髓丹', rarity: '珍贵丹药', source: '炼丹（筑基期以上）、天命', effect: '服用后随机提升「根骨/道心」之一 5~10 级；一生最多服用 2 颗。', toxicity: 20 },
  { id: 'pill_breakthrough', category: '丹药', name: '破境丹', rarity: '关键丹药', source: '丹炉炼制（金丹期以上）', effect: '服用后立即获得大量修为经验，可能直接突破一级。', toxicity: 25 },
  { id: 'pill_mind', category: '丹药', name: '神识丹', rarity: '消耗品', source: '炼丹、坊市（元婴期以上）', effect: '服用后悟性经验增加；连续服用会产生丹毒。', toxicity: 10 },
  { id: 'pill_mana', category: '丹药', name: '法力丹', rarity: '消耗品', source: '炼丹、坊市', effect: '服用后下次战斗胜率 +5%；战斗后失效。', toxicity: 6 },
  { id: 'pill_detox', category: '丹药', name: '解毒丹', rarity: '消耗品', source: '炼丹、岭南百越坊市', effect: '服用后丹毒 -30；是连续嗑药的必备解药。', toxicity: -30 },
  { id: 'pill_tribulation', category: '丹药', name: '渡劫丹', rarity: '关键丹药', source: '坊市、炼丹', effect: '渡劫时服用，成功率 +15%；品质影响加成幅度。', toxicity: 5 },
  { id: 'pill_gather_spirit', category: '丹药', name: '聚灵丹', rarity: '消耗品', source: '丹炉炼制（炼气期 / 炼丹百艺）', effect: '服用后修为 +200，并令未来 2 月修炼效率提升；连续服用会产生丹毒。', toxicity: 6 },
  { id: 'pill_concentrate', category: '丹药', name: '凝神丹', rarity: '消耗品', source: '丹炉炼制（筑基期 / 炼丹百艺小成）', effect: '服用后悟性经验 +120；连续服用会产生丹毒。', toxicity: 10 },
  { id: 'pill_ninghuo', category: '丹药', name: '凝火丹', rarity: '高阶丹药', source: '丹炉炼制（需凝火奇实·灵草杂交）', effect: '服用后修为 +320，未来 1 月修炼效率提升；连续服用会产生丹毒。', toxicity: 12 },
  { id: 'pill_yanlu', category: '丹药', name: '炎玉丹', rarity: '高阶丹药', source: '丹炉炼制（需炎玉灵枣·灵草杂交）', effect: '服用后随机提升「根骨/道心」之一 4~8 级；连续服用会产生丹毒。', toxicity: 16 },
  { id: 'pill_yuhua', category: '丹药', name: '玉华丹', rarity: '圣品丹药', source: '丹炉炼制（需玉华灵髓·灵草杂交）', effect: '服用后随机提升「悟性/气运」之一 5~10 级；连续服用会产生丹毒。', toxicity: 18 },
  { id: 'pill_luhua', category: '丹药', name: '露华丹', rarity: '圣品丹药', source: '丹炉炼制（需露华玉液·灵草杂交）', effect: '服用后伤势尽去、悟性经验 +200；连续服用会产生丹毒。', toxicity: 8 },
  { id: 'pill_gold_core', category: '丹药', name: '结丹丹', rarity: '关键丹药', source: '坊市（35~45级）', effect: '结丹渡劫专属，成功率 +20%。', toxicity: 8 },
  { id: 'pill_nascent', category: '丹药', name: '元婴丹', rarity: '关键丹药', source: '坊市（55~65级）', effect: '丹破婴生专属，成功率 +20%。', toxicity: 12 },
  { id: 'pill_soul_form', category: '丹药', name: '化神丹', rarity: '关键丹药', source: '坊市（75~85级）', effect: '法则初悟专属，成功率 +20%。', toxicity: 18 },
  { id: 'pill_immortal', category: '丹药', name: '九转金丹', rarity: '关键丹药', source: '坊市（90~99级）', effect: '飞升之劫专属，成功率 +20%。', toxicity: 25 },
  { id: 'pill_heal_light', category: '丹药', name: '疗伤丹', rarity: '消耗品', source: '中州圣城坊市', effect: '清除 1 个月伤势；无毒副作用。', toxicity: 0 },
  { id: 'pill_starter', category: '丹药', name: '下品丹药十瓶', rarity: '消耗品', source: '开局（炼丹世家）', effect: '开局丹药 bundle，含多种基础丹药各若干。', toxicity: 3 },

  // ================================================================
  // 三、道具（消耗品 / 功能性物品）
  // ================================================================
  { id: 'item_ward', category: '道具', name: '护身符', rarity: '消耗品', source: '百艺制符；西极玄冰域坊市售「低阶护身符」', effect: '下一次战斗失败时减轻损失（修为不跌、灵石不减）。' },
  { id: 'item_pelt_talisman', category: '道具', name: '兽皮护符', rarity: '消耗品', source: '百艺制符（妖兽皮毛）', effect: '下一次战斗失败时减轻损失（修为不跌、灵石不减）。' },
  { id: 'item_flag', category: '道具', name: '聚灵阵旗', rarity: '消耗品', source: '百艺阵法、拍卖会', effect: '下次修炼效率提升（+15%，持续1月）。' },
  { id: 'item_tame_incense', category: '道具', name: '驭兽香', rarity: '消耗品', source: '东荒坊市、御兽百艺', effect: '提高下一次收服灵兽的成功率 +20%。' },
  { id: 'item_relic_map', category: '道具', name: '海上遗府残图', rarity: '线索', source: '海外坊市、游历、道缘', effect: '集齐 3 张残图后开启一次遗府探索，必得高阶法宝。' },
  { id: 'item_sea_pass', category: '道具', name: '海岛通行令', rarity: '消耗品', source: '北冥瀚海坊市', effect: '降低海外遗府探索的费用 20%。' },
  { id: 'item_beast_contract', category: '道具', name: '灵兽契约', rarity: '特殊道具', source: '收服灵兽后自动获赠；拍卖会亦有出售', effect: '服用可拓宽灵兽栏（上限 +1，至多 6 栏）；亦是收服灵兽后获赠的驯兽凭证，见证你与灵兽的羁绊。' },
  { id: 'item_travel_pass', category: '道具', name: '旅行凭证', rarity: '消耗品', source: '坊市、宗门任务奖励', effect: '下次跨域旅行费用减半。' },
  { id: 'item_ward_low', category: '道具', name: '低阶护身符', rarity: '消耗品', source: '西极玄冰域坊市', effect: '下一次战斗失败时减轻损失（效果弱于护身符）。' },
  { id: 'item_ward_talisman', category: '道具', name: '低阶符箓', rarity: '消耗品', source: '符师道友敬赠、百艺制符', effect: '下一次战斗失败时减轻损失（效果弱于护身符）。' },
  { id: 'item_simple_flag', category: '道具', name: '简易阵旗', rarity: '消耗品', source: '阵师道友敬赠、阵法百艺', effect: '战场布成临时护阵，下一次战斗失败时替你挡去重伤与失财。' },
  { id: 'item_bug_powder', category: '道具', name: '驱虫粉', rarity: '消耗品', source: '岭南百越坊市', effect: '降低雨林探索风险，防止毒虫侵扰。' },
  { id: 'item_tame_food', category: '道具', name: '驯兽口粮', rarity: '消耗品', source: '百艺御兽', effect: '提高下一次收服灵兽成功率 +15%；可用妖兽内丹+灵草炼制。' },
  { id: 'item_fire_guide', category: '道具', name: '地火引', rarity: '消耗品', source: '南明离火域坊市', effect: '百艺配方制作时额外产出 1 件（自动消耗）；地火套装组件。' },

  // ================================================================
  // 四、容器（储物袋系列）
  // ================================================================
  { id: 'item_bag', category: '容器', name: '扩容储物袋', rarity: '容器', source: '坊市（可购道具）、服用即生效', effect: '服用后行囊容量 +20 格，与坊市「储物袋扩容契」服务同效，可囤积备用，缓解满仓丢物之忧。' },
  { id: 'bag_small', category: '容器', name: '小型储物袋', rarity: '容器', source: '开局（坊市学徒）', effect: '初始容量容器，决定行囊格数。' },
  { id: 'bag_medium', category: '容器', name: '下品储物袋', rarity: '容器', source: '开局（天生道体、没落血脉）', effect: '中等容量容器，比小型储物袋更宽敞。' },

  // ================================================================
  // 五、材料（通用类型 + 区域特产 + 战利品）
  // ================================================================
  // 通用材料类型
  { id: 'mat_wolf_core', category: '材料', name: '青风狼内丹', rarity: '材料', source: '东荒妖兽战利品', effect: '炼丹主药，也可出售换灵石。' },
  { id: 'mat_copper', category: '材料', name: '赤铜精', rarity: '材料', source: '南明离火域坊市', effect: '炼器辅材，火属性法器偏爱；地火套装组件。' },
  { id: 'mat_ice_paper', category: '材料', name: '冰魄符纸', rarity: '材料', source: '西极玄冰域坊市', effect: '制符与阵法通用材料。' },
  { id: 'mat_sea_pearl', category: '材料', name: '海灵珠', rarity: '材料', source: '北冥瀚海坊市', effect: '炼丹、阵法与地图旅行均可使用；海行套装组件。' },
  { id: 'mat_herb', category: '材料', name: '百越灵草', rarity: '材料', source: '岭南百越坊市、采集', effect: '炼丹主药，灵植师最喜欢的材料。' },
  { id: 'mat_lingzhi', category: '材料', name: '百年灵芝', rarity: '材料', source: '百艺灵植、采集', effect: '炼丹主药，也可在坊市出售。' },
  { id: 'mat_star_sand', category: '材料', name: '星砂', rarity: '稀有材料', source: '海外仙岛坊市', effect: '高阶炼器与法宝修复材料；星辉套装组件。' },
  { id: 'mat_fire_guide', category: '材料', name: '地火引', rarity: '消耗品', source: '南明离火域坊市', effect: '百艺配方制作时额外产出 1 件（自动消耗）；地火套装组件。' },
  { id: 'mat_voyage_pass', category: '材料', name: '远航凭证', rarity: '消耗品', source: '北冥瀚海坊市', effect: '下次跨域旅行费用减半；海行套装组件。' },
  // 材料大类（妖兽掉落通用名）
  { id: 'mat_yaodan', category: '材料', name: '妖丹', rarity: '材料', source: '妖兽战利品（各妖兽掉落专属内丹，如青风狼内丹；通用妖丹为旧称，现已不再掉落）', effect: '妖兽精华内丹，可出售。' },
  { id: 'mat_kuangshi', category: '材料', name: '矿石', rarity: '材料', source: '妖兽战利品（概率）、百艺炼器消耗', effect: '炼器基础材料，可用于灵脉石饰等配方。' },
  { id: 'mat_xianyuan', category: '材料', name: '仙缘', rarity: '稀有材料', source: '高阶妖兽战利品（极低概率）', effect: '罕见机缘之物，可于罗盘「仙缘兑换」换得道途助益：修为+200、道韵+15、悟性+20、下品灵石+300。' },
  { id: 'mat_xianyuan_taichu', category: '材料', name: '仙缘·太初之气', rarity: '传说材料', source: '海外游历·仙岛奇遇（海外机缘概率更高，极稀有）', effect: '传说中的仙界之气，可遇不可求。持此物者可于罗盘「太初仙缘」处寻上古仙缘使者兑换绝世机缘：修为+2000、道韵+40、悟性+25、下品灵石+800，并赠天品功法《太虚剑经》。价值连城。' },
  { id: 'mat_year_herb', category: '材料', name: '年份灵草', rarity: '稀有材料', source: '道友深谈（灵植师）、道友委托酬谢', effect: '灵植师精心培育的年份灵草，灵气醇厚，炼丹上品。开炉炼丹时若持有可自动催化，成丹率 +8%。' },
  { id: 'mat_danfang_scroll', category: '材料', name: '私藏丹方·残卷', rarity: '稀有材料', source: '道友深谈（炼丹师）', effect: '炼丹师相赠的丹方心得残卷，研习可助炼丹。开炉炼丹时若持有可自动催化，成丹率 +15%。' },
  // 妖兽材料子类（generateBeastDrops 动态名）
  { id: 'mat_beast_lingcao', category: '材料', name: '妖兽灵草', rarity: '材料', source: '妖兽战利品', effect: '妖兽携带的灵草，品质参差不齐。' },
  { id: 'mat_beast_shougu', category: '材料', name: '妖兽兽骨', rarity: '材料', source: '妖兽战利品', effect: '妖兽骨骼，坚硬程度因妖兽等级而异。' },
  { id: 'mat_beast_pimao', category: '材料', name: '妖兽皮毛', rarity: '材料', source: '妖兽战利品', effect: '妖兽外皮，可制防具或符箓。' },

  // ================================================================
  // 六、开局资产（非装备/非丹药的起始物品）
  // ================================================================
  { id: 'start_cave_temp', category: '道具', name: '残破洞府(临时)', rarity: '杂物', source: '开局（遗孤散修）', effect: '临时居所凭证，无实际加成；仅为背景设定。' },
  { id: 'start_house', category: '道具', name: '凡人小屋', rarity: '杂物', source: '开局（转世大能/大器晚成）', effect: '凡人住所，无修炼加成；仅为背景设定。' },
  { id: 'start_sutra', category: '道具', name: '随身经卷数册', rarity: '杂物', source: '开局（佛道童子）', effect: '佛门经卷集合，可为修行提供参考。' },
  { id: 'start_furnace', category: '道具', name: '丹炉一尊', rarity: '杂物', source: '开局（炼丹世家）', effect: '炼丹器具，开启炼丹百艺的基础工具。' },
  { id: 'start_workshop', category: '道具', name: '铸造工坊一间', rarity: '杂物', source: '开局（铸剑山庄）', effect: '炼器工坊，开启炼器百艺的基础设施。' },
  { id: 'start_forge', category: '道具', name: '炼器炉一尊', rarity: '杂物', source: '开局（铸剑山庄）', effect: '炼器炉鼎，提升炼器成功率和品质。' },
  { id: 'start_room', category: '道具', name: '宗门杂役房一间', rarity: '杂物', source: '开局（宗门杂役）', effect: '宗门分配的简陋住所，无特殊加成。' },
  { id: 'start_manual', category: '道具', name: '基础功法残卷', rarity: '杂物', source: '开局（大器晚成）', effect: '残缺功法手册，需修补后方可修炼。' },
  { id: 'start_genealogy', category: '道具', name: '苍梧族谱', rarity: '线索', source: '开局（没落血脉）', effect: '苍梧古族族谱，记载家族兴衰史；血脉复兴天命的关键道具。' },

  // ================================================================
  // 七、服务/特殊
  // ================================================================
  { id: 'service_bag_upgrade', category: '道具', name: '储物袋扩容契', rarity: '服务', source: '坊市服务', effect: '购买后行囊容量 +20 格；可重复购买。' },
  { id: 'tech_scroll_basic', category: '道具', name: '基础功法玉简', rarity: '功法', source: '中州圣城坊市', effect: '凡品功法玉简，可直接修炼；适合初学者。' },

  // ================================================================
  // 八、功法（坊市出售 / 事件获得，按品级分类）
  // ================================================================
  { id: 'tech_fan_tuna', category: '功法', name: '基础吐纳术', rarity: '凡品', source: '开局（部分天命）、坊市', effect: '凡品功法，修为+80/月；入门吐纳，稳固根基。' },
  { id: 'tech_fan_qi', category: '功法', name: '引气诀', rarity: '凡品', source: '开局、坊市', effect: '凡品功法，引导灵气入体；修炼速度略快于基础吐纳术。' },
  { id: 'tech_fan_niu', category: '功法', name: '莽牛劲', rarity: '凡品', source: '坊市、东荒妖域', effect: '凡品功法，炼体为主；根骨成长+5%，近战防御提升。' },
  { id: 'tech_fan_health', category: '功法', name: '养生功', rarity: '凡品', source: '坊市、道缘', effect: '凡品功法，调理气血；伤势恢复速度+20%，寿元消耗-5%。' },
  { id: 'tech_ling_changchun', category: '功法', name: '长春功', rarity: '灵品', source: '中州圣城坊市', effect: '灵品功法，延年益寿；修为+120/月，寿元上限+10/级。' },
  { id: 'tech_ling_qingyuan', category: '功法', name: '青元剑诀', rarity: '灵品', source: '坊市、宗门', effect: '灵品剑法功法；战斗胜率+3%/级，剑类装备战力额外+5%。' },
  { id: 'tech_ling_xuanshui', category: '功法', name: '玄水真法', rarity: '灵品', source: '西极玄冰域坊市', effect: '灵品水系功法；冰属性伤害+4%/级，寒系秘境探索加成。' },
  { id: 'tech_ling_lieyan', category: '功法', name: '烈焰心经', rarity: '灵品', source: '南明离火域坊市', effect: '灵品火系功法；火属性伤害+4%/级，炼丹成功率+2%/级。' },
  { id: 'tech_ling_houtu', category: '功法', name: '厚土诀', rarity: '灵品', source: '岭南百越坊市', effect: '灵品土系功法；防御+3%/级，采集材料产量+10%。' },
  { id: 'tech_di_leixiao', category: '功法', name: '紫霄雷典', rarity: '地品', source: '坊市（35级+）、秘境', effect: '地品雷系功法；战斗先手率+5%/级，雷属性伤害显著。' },
  { id: 'tech_di_taiyin', category: '功法', name: '太阴寒螭功', rarity: '地品', source: '西极玄冰域、拍卖会', effect: '地品寒冰功法；冻结效果增强，敌人速度-3%/级。' },
  { id: 'tech_di_dari', category: '功法', name: '大日焚天录', rarity: '地品', source: '南明离火域、拍卖会', effect: '地品火焰功法；持续灼烧伤害，火抗+4%/级。' },
  { id: 'tech_di_wanmu', category: '功法', name: '万木长春经', rarity: '地品', source: '百艺灵植、秘境', effect: '地品木系功法；灵植培育效率+20%，毒抗+3%/级。' },
  { id: 'tech_tian_xingchen', category: '功法', name: '星辰锻体术', rarity: '天品', source: '坊市（45级+）、天命', effect: '天品炼体功法；根骨+2/级，战力+5/级，体质大幅强化。' },
  { id: 'tech_tian_taixu', category: '功法', name: '太虚剑经', rarity: '天品', source: '中州圣城、拍卖会', effect: '天品剑道功法；全武器战力+8/级，剑意可震慑低阶妖兽。' },
  { id: 'tech_tian_jiutian', category: '功法', name: '九天玄女诀', rarity: '天品', source: '天命、上古遗府', effect: '天品辅助功法；悟性+3/级，道心+2/级，突破成功率+3%。' },
  { id: 'tech_tian_tuntian', category: '功法', name: '吞天魔功', rarity: '天品', source: '秘境、特殊机缘', effect: '天品魔道功法；战斗掠夺灵石+15%，但道心成长-1/级（需权衡）。' },
  { id: 'tech_xian_zhoutian', category: '功法', name: '周天星斗战体', rarity: '仙品', source: '飞升机缘、终局', effect: '仙品炼体绝学；根骨+4/级，战力+12/级，肉身成圣之路。' },
  { id: 'tech_xian_taishang', category: '功法', name: '太上忘情录', rarity: '仙品', source: '飞升机缘、终局', effect: '仙品心境功法；道心+5/级，心魔免疫+30%，渡劫成功率+8%。' },
  { id: 'tech_xian_hundun', category: '功法', name: '混沌开天经', rarity: '仙品', source: '飞升之劫、终局', effect: '仙品至高功法；全属性成长+3/级，领悟法则雏形后战力翻倍。' },

  // ================================================================
  // 十、灵兽（由 BEAST_TEMPLATES 生成图鉴条目）
  // ================================================================
  ...BEAST_TEMPLATES.map((b) => ({
    id: `beast_${b.id}`, category: '灵兽', name: b.name,
    rarity: `${b.element}系·推荐 ${b.minLevel} 级`,
    // 收服入口唯一：罗盘「前往灵兽栖息地」（灵兽栏有空位即可前往，与地域/秘境无关）。
    // 此前按等级硬编码「东荒妖域 / 中州秘境 / 上古遗府、终局」三档，全都指错了路 ——
    // 秘境里的妖兽是敌人、不是可收服对象；幼凰被写成「终局」更会让玩家以为要通关才拿得到。
    source: `罗盘·灵兽栖息地（${beastGateLevel(b)} 级起可寻访，需灵兽栏有空位）`,
    effect: `${b.desc} 战力加成：+${b.power}。技能：${b.skill}。`,
  })),
  // ================================================================
  // 十一、灵草（洞府灵草园播种即解锁；集齐 4 种可得「百草通鉴」成就）
  // ================================================================
  { id: 'herb_lingcao', category: '灵草', name: '凝露灵草', rarity: '基础灵草', source: '洞府灵草园·播种', effect: '三月可收，收获「凝露草」×2，炼丹主药。' },
  { id: 'herb_huoqing', category: '灵草', name: '火精枣树', rarity: '火属灵草', source: '洞府灵草园·播种', effect: '五月结实，收获「火精枣」×2，火属灵材，炼器炼丹皆宜。' },
  { id: 'herb_yushu', category: '灵草', name: '玉髓芝', rarity: '上品灵草', source: '洞府灵草园·播种', effect: '七月方成，收获「玉髓芝」×1，上品灵植，高阶丹药关键辅药。' },
  { id: 'herb_yuehua', category: '灵草', name: '月华露藤', rarity: '仙品灵草', source: '洞府灵草园·播种', effect: '十月凝露，收获「天材地宝·月华露」×1，丹圣之物，价值连城。' },
  // —— 灵草园收获产物（材料，收获即录入图鉴） ——
  { id: 'mat_herb_ninlu', category: '材料', name: '凝露草', rarity: '材料', source: '灵草园收获（凝露灵草）', effect: '灵草园产出的基础灵草，炼丹常用。' },
  { id: 'mat_herb_huojing', category: '材料', name: '火精枣', rarity: '材料', source: '灵草园收获（火精枣树）', effect: '火属性灵植，炼器与炼丹皆宜。' },
  { id: 'mat_herb_yushu', category: '材料', name: '玉髓芝', rarity: '材料', source: '灵草园收获（玉髓芝）', effect: '上品灵植，炼制高阶丹药的关键辅药。' },
  { id: 'mat_herb_yuehua', category: '材料', name: '天材地宝·月华露', rarity: '传说材料', source: '灵草园收获（月华露藤）', effect: '月华凝露，炼丹圣物，价值连城。' },
  // —— 灵草杂交奇珍灵材（杂交产出即录入图鉴） ——
  { id: 'mat_hybrid_ninhuo', category: '材料', name: '凝火奇实', rarity: '奇珍灵材', source: '灵草园杂交（凝露草+火精枣）', effect: '凝露与火精交融所结奇实，灵气内蕴，炼器炼丹皆宜。' },
  { id: 'mat_hybrid_yuhua', category: '材料', name: '玉华灵髓', rarity: '奇珍灵材', source: '灵草园杂交（玉髓芝+月华露）', effect: '玉髓与月华同炼的灵髓，温润如玉，高阶丹药圣料。' },
  { id: 'mat_hybrid_luhua', category: '材料', name: '露华玉液', rarity: '奇珍灵材', source: '灵草园杂交（凝露草+月华露）', effect: '凝露承月华而成的玉液，可解百毒、助悟道。' },
  { id: 'mat_hybrid_yanlu', category: '材料', name: '炎玉灵枣', rarity: '奇珍灵材', source: '灵草园杂交（火精枣+玉髓芝）', effect: '火精与玉髓相济的灵枣，温补根基、淬炼筋骨。' },
];

/* ============================================================
 * 三、套装效果（集齐 2 件即激活，3 件额外加成）
 * 采用「名称片段（token）匹配」：只要持有物品的 名称 包含某 token 即算该套装的一件，
 * 因此无论动态生成还是静态掉落，只要凑齐同套碎片即可激活，比固定名列表更稳健。
 * ========================================================== */
export const SET_BONUSES = {
  星辉: {
    tokens: ['星辉', '星纹', '星砂'],
    text2: '星辉共鸣（2件）：战力 +8，法宝战力额外 +2（需佩戴本命法宝），秘境发现率提高 15%。',
    text3: '星辉圆满（3件）：战力再 +12，渡劫成功率 +10%（预览与结算同步计入）。',
    bonus2: { power: 8, artifactPower: 2, mysticFind: 0.15 },
    bonus3: { power: 12, breakthrough: 10 },
  },
  地火: {
    tokens: ['火纹', '赤铜', '地火'],
    text2: '地火相生（2件）：战力 +6，炼器额外品质加成，百艺经验 +30%。',
    text3: '地火圆满（3件）：战力再 +10，丹药出高品阶概率 +15%，丹毒产生减半。',
    bonus2: { power: 6, craftQuality: 1, craftExp: 0.3 },
    bonus3: { power: 10, pillToxicityHalf: true },
  },
  海行: {
    tokens: ['海兽', '海灵', '远航'],
    text2: '海行无阻（2件）：战力 +6，跨域路费降低 20%，海域（海外仙岛/北冥瀚海）游历灵石收益 +30%。',
    text3: '海行圆满（3件）：战力再 +10，海域游历时「风化洞府（遗府残图）」与「仙缘使者」奇遇概率翻倍。',
    bonus2: { power: 6, travelDiscount: 0.2, seaBonus: 0.3 },
    bonus3: { power: 10, seaChance: true },
  },
  妖纹: {
    tokens: ['妖纹', '青风'],
    text2: '妖纹护体（2件）：战力 +5，历练妖兽类战利品数量 +20%。',
    text3: '妖纹大成（3件）：战力再 +5，妖域探索更易寻得珍稀「仙缘」（掉落上限 15%→30%）。',
    bonus2: { power: 5, beastLoot: 0.2 },
    bonus3: { power: 5, beastFind: true },
  },
};

/** 返回某物品（按名称）归属的套装名；用于装备面板/图鉴的套装徽标 */
export function itemSetOf(name) {
  if (!name) return null;
  for (const [sname, set] of Object.entries(SET_BONUSES)) {
    if ((set.tokens || []).some((t) => String(name).includes(t))) return sname;
  }
  return null;
}

/* ============================================================
 * 三·补、成就系统（里程碑式长期目标）
 * ========================================================== */
/* 成就收集里程碑集合（不计入基础成就统计，避免自计数导致解锁抖动） */
export const ACH_MILESTONE_IDS = new Set(['achCount10', 'achCount20', 'achCountAll']);
/** 统计已解锁的「基础成就」数量（排除收集里程碑自身） */
function achBaseUnlocked(state) {
  return (state.achievements || []).filter((a) => !ACH_MILESTONE_IDS.has(a.id)).length;
}

export const ACHIEVEMENTS = [
  { id: 'start',   name: '初入仙途', icon: '🌱', desc: '开启你的修真之旅。', reward: { stones: 100 }, check: () => true },
  { id: 'qiyin',   name: '引气入体', icon: '🌬️', desc: '踏入炼气期。', reward: { stones: 200 }, check: (s) => s.player.level >= 11 },
  { id: 'zhuji',   name: '筑基立道', icon: '🪨', desc: '成功筑基，寿元翻倍。', reward: { stones: 400 }, check: (s) => s.player.level >= 21 },
  { id: 'jiedan',  name: '结丹化生', icon: '💠', desc: '凝结金丹。', reward: { stones: 800 }, check: (s) => s.player.level >= 41 },
  { id: 'yuanying',name: '元婴初成', icon: '👶', desc: '孕育元婴，寿元千年。', reward: { stones: 1500 }, check: (s) => s.player.level >= 61 },
  { id: 'huashen', name: '化神悟法', icon: '🌟', desc: '参悟法则。', reward: { stones: 3000 }, check: (s) => s.player.level >= 81 },
  { id: 'feisheng',name: '飞升在望', icon: '☀️', desc: '渡飞升之劫，随时可飞升。', reward: { stones: 8000 }, check: (s) => s.player.level >= 96 },
  { id: 'artifact',name: '本命重器', icon: '✨', desc: '拥有第一件法宝。', reward: { stones: 500 }, check: (s) => !!s.equipment.artifact },
  { id: 'beast',   name: '御兽初体验', icon: '🐾', desc: '收服第一头灵兽。', reward: { stones: 300 }, check: (s) => (s.beasts?.tamedCount || 0) >= 1, progress: (s) => ({ cur: Math.min(1, s.beasts?.tamedCount || 0), max: 1 }) },
  { id: 'set2',    name: '套装初成', icon: '🧩', desc: '激活任意一套装（2 件）。', reward: { stones: 500 }, check: (s) => activeSetBonuses(s).length >= 1 },
  { id: 'set3',    name: '套装圆满', icon: '👑', desc: '集齐某套装 3 件。', reward: { stones: 1000 }, check: (s) => activeSetBonuses(s).some((x) => x.count >= 3), progress: (s) => ({ cur: Math.max(0, ...activeSetBonuses(s).map((x) => x.count)), max: 3 }) },
  { id: 'codex50', name: '图鉴半百', icon: '📖', desc: '发现 50 种物品。', reward: { stones: 600 }, check: (s) => (s.codex?.discovered?.length || 0) >= 50, progress: (s) => ({ cur: s.codex?.discovered?.length || 0, max: 50 }) },
  { id: 'codex100',name: '图鉴百卷', icon: '📚', desc: '发现 100 种物品。', reward: { stones: 2500 }, check: (s) => (s.codex?.discovered?.length || 0) >= 100, progress: (s) => ({ cur: s.codex?.discovered?.length || 0, max: 100 }) },
  { id: 'rich',    name: '富甲一方', icon: '💰', desc: '持有灵石总值达 10000。', reward: { stones: 1000 }, check: (s) => totalStonesOf(s) >= 10000, progress: (s) => ({ cur: totalStonesOf(s), max: 10000 }) },
  { id: 'social',  name: '道缘广结', icon: '🤝', desc: '结识 5 位道友。', reward: { stones: 400 }, check: (s) => (s.npcs || []).filter((n) => n.met !== false).length >= 5, progress: (s) => ({ cur: (s.npcs || []).filter((n) => n.met !== false).length, max: 5 }) },
  { id: 'craft',   name: '百艺精通', icon: '⚗️', desc: '任一技艺达到 20 级。', reward: { stones: 800 }, check: (s) => Object.values(s.arts || {}).some((a) => a.level >= 20), progress: (s) => ({ cur: Math.max(0, ...Object.values(s.arts || {}).map((a) => a.level)), max: 20 }) },
  { id: 'tame3',   name: '灵兽成群', icon: '🐺', desc: '同时收服 3 只灵兽。', reward: { stones: 600 }, check: (s) => (s.beasts?.slots?.length || 0) >= 3, progress: (s) => ({ cur: s.beasts?.slots?.length || 0, max: 3 }) },
  { id: 'tameAll', name: '万兽朝宗', icon: '🦁', desc: '集齐全部 6 种灵兽。', reward: { stones: 5000 }, check: (s) => new Set(s.beasts?.slots?.map((b) => b.id) || []).size >= 6, progress: (s) => ({ cur: new Set(s.beasts?.slots?.map((b) => b.id) || []).size, max: 6 }) },
  { id: 'phoenix', name: '浴火重生', icon: '🔥', desc: '收服传说中的幼凰。', reward: { stones: 6666 }, check: (s) => (s.beasts?.slots || []).some((b) => b.id === 'phoenix') },
  { id: 'mainTech',name: '道法自然', icon: '📜', desc: '选定一门主修功法。', reward: { stones: 300 }, check: (s) => !!s.player?.mainTechnique },
  { id: 'power1k', name: '初露锋芒', icon: '⚔️', desc: '战力突破 1000。', reward: { stones: 500 }, check: (s) => (s.player?.power || 0) >= 1000, progress: (s) => ({ cur: s.player?.power || 0, max: 1000 }) },
  { id: 'power5k', name: '威震一方', icon: '🗡️', desc: '战力突破 5000。', reward: { stones: 1500 }, check: (s) => (s.player?.power || 0) >= 5000, progress: (s) => ({ cur: s.player?.power || 0, max: 5000 }) },
  { id: 'codex25', name: '图鉴初成', icon: '📖', desc: '发现 25% 的物品图鉴。', reward: { stones: 300 }, check: (s) => (s.codex?.discovered?.length || 0) >= Math.ceil(CODEX_ITEMS.length * 0.25), progress: (s) => ({ cur: s.codex?.discovered?.length || 0, max: Math.ceil(CODEX_ITEMS.length * 0.25) }) },
  { id: 'codex75', name: '博物洽闻', icon: '📚', desc: '发现 75% 的物品图鉴。', reward: { stones: 1200 }, check: (s) => (s.codex?.discovered?.length || 0) >= Math.ceil(CODEX_ITEMS.length * 0.75), progress: (s) => ({ cur: s.codex?.discovered?.length || 0, max: Math.ceil(CODEX_ITEMS.length * 0.75) }) },
  { id: 'stones50k',name: '灵石富贾', icon: '💎', desc: '持有灵石总值达 50000。', reward: { stones: 2000 }, check: (s) => totalStonesOf(s) >= 50000, progress: (s) => ({ cur: totalStonesOf(s), max: 50000 }) },
  { id: 'sectCore',name: '宗门栋梁', icon: '🏯', desc: '在宗门中晋升至核心弟子。', reward: { stones: 1000 }, check: (s) => (s.sect?.rank || 0) >= 3, progress: (s) => ({ cur: s.sect?.rank || 0, max: 3 }) },
  { id: 'heal',    name: '妙手回春', icon: '💉', desc: '服丹疗伤，将一身伤势尽数清除（服疗伤丹只减月份不算）。', reward: { stones: 200 }, check: (s) => !!s.flags?.curedWounds },
  { id: 'dujie',   name: '九九归真', icon: '⚡', desc: '成功渡过一次大境界天劫。', reward: { stones: 2000 }, check: (s) => !!s.flags?.tribulationSuccess },
  { id: 'herbCodex', name: '百草通鉴', icon: '🍃', desc: '集齐灵草园全部 4 种灵草图鉴。', reward: { stones: 800 }, check: (s) => ['灵草:凝露灵草', '灵草:火精枣树', '灵草:玉髓芝', '灵草:月华露藤'].every((k) => (s.codex?.discovered || []).includes(k)) },
  { id: 'herbHybrid', name: '灵植奇才', icon: '🌿', desc: '杂交出全部 4 种奇珍灵材。', reward: { stones: 1200 }, check: (s) => ['材料:凝火奇实', '材料:玉华灵髓', '材料:露华玉液', '材料:炎玉灵枣'].every((k) => (s.codex?.discovered || []).includes(k)) },
  // —— 成就收集里程碑：统计已解锁的「基础成就」数（不含里程碑自身），解锁阶段性收集奖励 ——
  { id: 'achCount10', name: '小有所成', icon: '🥉', desc: '累计解锁 10 个基础成就。', reward: { stones: 800 }, check: (s) => achBaseUnlocked(s) >= 10, progress: (s) => ({ cur: achBaseUnlocked(s), max: 10 }) },
  { id: 'achCount20', name: '登堂入室', icon: '🥈', desc: '累计解锁 20 个基础成就。', reward: { stones: 1800 }, check: (s) => achBaseUnlocked(s) >= 20, progress: (s) => ({ cur: achBaseUnlocked(s), max: 20 }) },
  { id: 'achCountAll', name: '仙途大成', icon: '🏆', desc: '解锁全部基础成就。', reward: { stones: 5000 }, check: (s) => achBaseUnlocked(s) >= ACH_BASE_TOTAL, progress: (s) => ({ cur: Math.min(achBaseUnlocked(s), ACH_BASE_TOTAL), max: ACH_BASE_TOTAL }) },
];
/** 基础成就总数（不含收集里程碑自身），用于「仙途大成」进度上限与测试断言 */
export const ACH_BASE_TOTAL = ACHIEVEMENTS.filter((a) => !ACH_MILESTONE_IDS.has(a.id)).length;


/** 返回每个成就的「视图」：是否已解锁 + 进度（cur/max/ratio），供 UI 渲染进度条 */
export function achievementView(state) {
  ensureAchievements(state);
  const recMap = new Map(state.achievements.map((a) => [a.id, a]));
  return ACHIEVEMENTS.map((a) => {
    let prog = null;
    try { if (a.progress) prog = a.progress(state); } catch { prog = null; }
    const rec = recMap.get(a.id);
    return {
      id: a.id, name: a.name, icon: a.icon, desc: a.desc,
      unlocked: recMap.has(a.id),
      claimed: !!(rec?.claimed),
      reward: a.reward || null,
      progress: prog ? { cur: prog.cur || 0, max: prog.max || 1, ratio: Math.max(0, Math.min(1, (prog.cur || 0) / (prog.max || 1))) } : null,
    };
  });
}

/**
 * 领取成就奖励：仅当已解锁且未领取时发放（灵石 + 可选材料），并标记 claimed。
 * 返回 { ok, msg, reward, logs } 供 UI 提示。
 */
export function claimAchievement(state, id) {
  ensureAchievements(state);
  ensureLifeState(state);
  const rec = state.achievements.find((a) => a.id === id);
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!rec || !def) return { ok: false, msg: '无此成就。' };
  if (rec.claimed) return { ok: false, msg: '奖励已领取。' };
  const rw = def.reward || { stones: 0 };
  state.currencies = state.currencies || {};
  codexAddStones(state, rw.stones || 0);
  const logs = [`领取成就「${def.name}」奖励：${rw.stones || 0} 下品灵石`];
  if (Array.isArray(rw.materials)) {
    state.items = state.items || [];
    for (const m of rw.materials) {
      state.items.push({ 名称: m, 类型: '材料', 数量: 1, 描述: '成就奖励' });
      logs.push(`获得材料：${m}`);
    }
  }
  rec.claimed = true;
  return { ok: true, msg: '奖励已领取。', reward: rw, logs };
}

/** 一键领取所有已解锁未领取的成就奖励，返回 { ok, total, logs } */
export function claimAllAchievements(state) {
  ensureAchievements(state);
  ensureLifeState(state);
  let total = 0;
  const logs = [];
  for (const a of ACHIEVEMENTS) {
    const rec = state.achievements.find((r) => r.id === a.id);
    if (!rec || rec.claimed) continue;
    const rw = a.reward || { stones: 0 };
    state.currencies = state.currencies || {};
    codexAddStones(state, rw.stones || 0);
    total += rw.stones || 0;
    rec.claimed = true;
    logs.push(`领取「${a.name}」：${rw.stones || 0} 下品灵石`);
  }
  return { ok: total > 0, total, logs };
}
function totalStonesOf(s) {
  return CURRENCIES.reduce((sum, c, i) => sum + (s.currencies?.[c] || 0) * Math.pow(CURRENCY_RATE, i), 0);
}
/** 按总量重新分档（成就奖励发放后账面自动进位，避免出现「5000 下品」） */
function codexRedistribute(state, totalUnits) {
  let rest = Math.max(0, Math.round(totalUnits));
  for (let i = CURRENCIES.length - 1; i >= 0; i--) {
    const unit = Math.pow(CURRENCY_RATE, i);
    const c = Math.floor(rest / unit);
    state.currencies[CURRENCIES[i]] = c;
    rest -= c * unit;
  }
}
/** 分层发放灵石奖励 */
export function codexAddStones(state, amount) {
  state.currencies = state.currencies || {};
  codexRedistribute(state, totalStonesOf(state) + Math.max(0, Math.round(amount || 0)));
}
export function ensureAchievements(state) {
  state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
}
/** 扫描并解锁已达成但未记录的成就，返回本次新解锁列表（供 UI 弹提示） */
export function checkAchievements(state) {
  ensureAchievements(state);
  const unlocked = new Set(state.achievements.map((a) => a.id));
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    let ok = false;
    try { ok = !!a.check(state); } catch { ok = false; }
    if (ok) {
      state.achievements.push({ id: a.id, name: a.name, icon: a.icon, time: `${state.world.year}年${state.world.month}月` });
      newly.push(a);
    }
  }
  return newly;
}

/* ============================================================
 * 四、丹药品质与丹毒系统
 * ========================================================== */
export const PILL_QUALITY = [
  { grade: '废品', mult: 0.5, color: 'dim', desc: '炼制失败所得，效果减半。' },
  { grade: '凡品', mult: 1.0, color: 'gray', desc: '正常品质，标准效果。' },
  { grade: '良品', mult: 1.3, color: 'jade', desc: '品质优良，效果提升 30%。' },
  { grade: '上品', mult: 1.6, color: 'gold', desc: '品质上乘，效果提升 60%。' },
  { grade: '极品', mult: 2.0, color: 'red', desc: '极为罕见，效果翻倍，丹毒减半。' },
];

/** 根据百艺等级和套装加成判定丹药品质 */
export function rollPillQuality(artLevel, bonusFlags = {}) {
  let rate = (artLevel || 0) * 0.8 + 30;
  if (bonusFlags.craftQuality) rate += 15;
  rate = Math.min(95, rate);
  const roll = Math.random() * 100;
  if (roll < rate * 0.1) return PILL_QUALITY[4]; // 极品
  if (roll < rate * 0.3) return PILL_QUALITY[3]; // 上品
  if (roll < rate * 0.6) return PILL_QUALITY[2]; // 良品
  if (roll < rate) return PILL_QUALITY[1];       // 凡品
  return PILL_QUALITY[0];                         // 废品
}

/** 丹毒分档 —— 全项目单一真源。
 *  【为何存在】此前 35/60/85 三个阈值与其对应的修炼效率系数、战斗胜率惩罚被硬编码在五处
 *  （codex: pillSideEffect 文案、systems: cultivate 结算、systems: cultivateGainPreview 预览、
 *  systems: resolveBattle 结算、systems: previewBattle 预览），连服弹窗又写了一遍 60 ——
 *  任何一处数值调整都会有地方对不上。现在结算侧与预览侧全部读这张表，改表即全改，
 *  禁止再写裸数字阈值。降序排列。
 *  crisis: 是否算「危机」（供危机预警横幅判定，轻档只提示不算危机）。 */
export const TOX_LEVELS = [
  { min: 85, level: 'danger', crisis: true, mul: 0.55, win: -10, text: '丹毒深重！修炼效率降至 55%，战斗胜率 -10%。请服用解毒丹或停止嗑药。' },
  { min: 60, level: 'warn', crisis: true, mul: 0.75, win: 0, text: '丹毒累积，修炼效率降至 75%。建议服用解毒丹。' },
  { min: 35, level: 'hint', crisis: false, mul: 0.9, win: 0, text: '体内略有丹毒淤积，修炼效率降至 90%。' },
];
/** 丹毒所处档位（纯函数，无档位返回 null） */
export function toxLevelOf(toxic) {
  const t = Number(toxic) || 0;
  return TOX_LEVELS.find((l) => t >= l.min) || null;
}
/** 丹毒对修炼效率的系数（1 = 无影响）。结算（cultivate）与预览（cultivateGainPreview）共用。 */
export function toxMul(toxic) { const lv = toxLevelOf(toxic); return lv ? lv.mul : 1; }
/** 丹毒对战斗胜率的惩罚（0 或负数）。结算（resolveBattle）与预览（previewBattle）共用。 */
export function toxWinPenalty(toxic) { const lv = toxLevelOf(toxic); return lv ? lv.win : 0; }
/** 丹毒危机等级：'danger' / 'warn' / 'ok'（轻档与无丹毒均为 'ok'，供危机预警判定）。 */
export function toxCrisisLevel(toxic) {
  const lv = toxLevelOf(toxic);
  return (lv && lv.crisis) ? lv.level : 'ok';
}

/** 返回丹药副作用文案（丹毒过高时）。判定与系数全部来自 TOX_LEVELS。 */
export function pillSideEffect(state) {
  const lv = toxLevelOf(state?.flags?.pillToxicity);
  return lv ? { level: lv.level, text: lv.text } : null;
}

/** 服用丹药时累加丹毒，返回是否触发副作用 */
export function applyPillToxicity(state, toxicity, bonusFlags = {}) {
  if (!state.flags) state.flags = {};
  let add = toxicity;
  if (toxicity > 0 && bonusFlags.pillToxicityHalf) add = Math.floor(add / 2);
  state.flags.pillToxicity = Math.max(0, (state.flags.pillToxicity || 0) + add);
  return pillSideEffect(state);
}

/* ============================================================
 * 五、灵兽系统函数
 * ========================================================== */
export function ensureBeastState(state) {
  state.beasts = state.beasts || { slots: [], maxSlots: 1, tamedCount: 0 };
  state.beasts.slots = state.beasts.slots || [];
  state.beasts.maxSlots = Math.max(1, state.beasts.maxSlots || 1);
  if (typeof state.beasts.activeIdx !== 'number') state.beasts.activeIdx = -1;
  return state.beasts;
}

export function canTameBeast(state) {
  ensureBeastState(state);
  return state.beasts.slots.length < state.beasts.maxSlots;
}

/** 灵兽对战力的加成 */
export function beastPowerBonus(state) {
  ensureBeastState(state);
  return state.beasts.slots.reduce((sum, b) => sum + (b.power || 0), 0);
}

/* ============================================================
 * 六、宗门系统数据
 * ========================================================== */
export const SECT_RANKS = [
  { rank: 0, name: '散修', contribution: 0, benefit: '无宗门归属，自由但无资源支持。' },
  { rank: 1, name: '外门弟子', contribution: 100, benefit: '每月可领取基础丹药，修炼加成 +5%。' },
  { rank: 2, name: '内门弟子', contribution: 500, benefit: '修炼加成 +10%，可接宗门任务换贡献。' },
  { rank: 3, name: '核心弟子', contribution: 2000, benefit: '修炼加成 +20%，可使用宗门秘境。' },
  { rank: 4, name: '长老', contribution: 8000, benefit: '修炼加成 +30%，可调度宗门资源。' },
  { rank: 5, name: '宗主', contribution: 20000, benefit: '修炼加成 +50%，宗门一切资源可调用。' },
];

export const SECT_TASKS = [
  { id: 'patrol', name: '巡视领地', contribution: 20, desc: '巡查宗门周边，驱逐妖兽。需 1 月。' },
  { id: 'gather', name: '采集灵材', contribution: 30, desc: '为宗门采集指定灵材。需 1 月。' },
  { id: 'escort', name: '护送商队', contribution: 50, desc: '护送宗门商队跨域。需 2 月。' },
  { id: 'subdue', name: '镇压叛乱', contribution: 80, desc: '镇压宗门内乱或外敌。需战斗。' },
  { id: 'teach', name: '传授弟子', contribution: 40, desc: '为外门弟子授课。需 1 月，提升悟性。' },
];

/* 各职级每月俸禄（下品灵石）。rank0 散修无宗门，不发放。
 * 数值与 SECT_RANKS 贡献阈值同级递增：外门 50 → 宗主 1500。 */
export const SECT_STIPEND = [0, 50, 120, 300, 700, 1500];

/* 宗门兑换所：以宗门贡献兑换资源（确定性，无 RNG）。
 * cost 为所需贡献；type 'stones' 直接发放下品灵石，type 'pill' 发放丹药
 * （effect/toxicity 与丹炉产出一致，可被 useItem 正常服用，且与同名丹药堆叠）。 */
export const SECT_EXCHANGE = [
  { id: 'ex_stones', name: '兑换宗门灵石', cost: 100, type: 'stones', amount: 600,
    desc: '以贡献换取宗门库藏下品灵石，充实行囊。' },
  { id: 'ex_qi', name: '兑换聚气丹', cost: 150, type: 'pill', item: '聚气丹', qty: 1,
    effect: { exp: 90 }, toxicity: 8, desc: '宗门丹房所出，服下修为 +90（连续服用生丹毒）。' },
  { id: 'ex_heal', name: '兑换凝血丹', cost: 180, type: 'pill', item: '凝血丹', qty: 1,
    effect: { heal: true }, toxicity: 0, desc: '宗门秘药，服下清除全部伤势，无毒副作用。' },
  { id: 'ex_ningshen', name: '兑换凝神丹', cost: 240, type: 'pill', item: '凝神丹', qty: 1,
    effect: { wuxing: 120 }, toxicity: 10, desc: '宗门丹房所出，服下悟性经验 +120（慎用丹毒）。' },
];

export function ensureSectState(state) {
  state.sect = state.sect || { name: '', rank: 0, contribution: 0, tasks: [] };
  // 真实俸禄状态：stipend=待领取灵石；claimedYear/claimedMonth=上次领取时的年月（用于提示）
  if (typeof state.sect.stipend !== 'number') state.sect.stipend = 0;
  if (typeof state.sect.claimedYear !== 'number') state.sect.claimedYear = 0;
  if (typeof state.sect.claimedMonth !== 'number') state.sect.claimedMonth = 0;
  return state.sect;
}

export function sectCultivateBonus(state) {
  ensureSectState(state);
  return SECT_RANKS[state.sect.rank || 0] ? SECT_RANKS[state.sect.rank].benefit.includes('修炼加成') ? (state.sect.rank * 0.05) : 0 : 0;
}

/* ============================================================
 * 七、拍卖会数据
 * ========================================================== */
export const AUCTION_ITEMS_POOL = [
  { name: '残缺功法玉简', type: '功法', basePrice: 500, rarity: '灵品', desc: '可能蕴含失传功法片段。' },
  { name: '聚灵阵旗', type: '道具', basePrice: 200, rarity: '消耗品', effect: { cultivateBoostMonths: 1 }, desc: '下次修炼效率提升（+15%，持续1月）。' },
  { name: '洗髓丹', type: '丹药', basePrice: 1500, rarity: '珍贵丹药', effect: { daoBase: { keys: ['根骨', '道心'], min: 5, max: 10 } }, toxicity: 20, desc: '洗髓伐毛，服用后随机提升一项道基 5~10 级。' },
  { name: '延寿丹', type: '丹药', basePrice: 2000, rarity: '珍贵丹药', effect: { lifespan: 20 }, desc: '服之延寿，寿元上限 +20 年。' },
  { name: '青锋剑', type: '法宝', basePrice: 3000, rarity: '法宝', desc: '等级 ×2 计入战力。' },
  { name: '海上遗府残图', type: '线索', basePrice: 300, rarity: '线索', desc: '集齐 3 张开启遗府。' },
  { name: '灵兽契约', type: '道具', basePrice: 800, rarity: '特殊道具', effect: { beastSlot: 1 }, desc: '驯兽凭证；服用可拓宽灵兽栏（上限 +1，至多 6 栏）。' },
  { name: '星砂', type: '材料', basePrice: 150, rarity: '稀有材料', desc: '高阶炼器材料。' },
];

export function ensureAuctionState(state) {
  state.auction = state.auction || { items: [], active: false, month: 0, bids: {} };
  return state.auction;
}

/* ============================================================
 * 八、秘境系统数据
 * ========================================================== */
export const MYSTIC_REALMS = [
  {
    id: 'qingxu', name: '青虚秘境', minLevel: 15, months: 1,
    desc: '炼气至筑基期修士常去的入门秘境，灵气充沛，偶有灵材。',
    rewards: { stones: [50, 200], materials: ['百越灵草', '冰魄符纸'], artifactChance: 0.05 },
    beastChance: 0.4,
  },
  {
    id: 'huoyan', name: '火焰谷秘境', minLevel: 25, months: 1,
    desc: '南明离火域深处的火属秘境，盛产火属灵材和炼器材料。',
    rewards: { stones: [100, 400], materials: ['赤铜精', '地火引'], artifactChance: 0.1 },
    beastChance: 0.5,
  },
  {
    id: 'binghai', name: '冰海遗迹', minLevel: 40, months: 2,
    desc: '西极玄冰域海底的上古遗迹，危险但回报丰厚。',
    rewards: { stones: [300, 800], materials: ['冰魄符纸', '星砂'], artifactChance: 0.2 },
    beastChance: 0.6,
  },
  {
    id: 'yifu', name: '海上遗府', minLevel: 50, months: 2,
    desc: '集齐 3 张残图方可开启的上古仙人洞府，必得高阶法宝。',
    rewards: { stones: [500, 1500], materials: ['星砂', '海灵珠'], artifactChance: 1.0 },
    beastChance: 0.7, requiresMap: true,
  },
];

export function availableMysticRealms(state) {
  const lv = state.player?.level || 1;
  return MYSTIC_REALMS.filter((r) => lv >= r.minLevel);
}

/* ============================================================
 * 九、修仙小说风格机缘事件链
 * ========================================================== */
export const SPECIAL_EVENTS = [
  {
    id: 'qihuo', name: '闭关走火入魔', minLevel: 30,
    trigger: (state) => state.flags?.seclusionStreak >= 3,
    desc: '连续闭关导致心神不宁，走火入魔！',
    options: [
      { text: '强行压制（道心判定）', effect: 'daoMind' },
      { text: '服用心定丹', effect: 'pill', needItem: '凝血丹' },
      { text: '任其自然', effect: 'random' },
    ],
  },
  {
    id: 'xinmo', name: '心魔幻境', minLevel: 50,
    trigger: (state) => Math.random() < 0.08 && state.player.level >= 50,
    desc: '修炼中心魔趁虚而入，你陷入了幻境！',
    options: [
      { text: '以道心破之', effect: 'daoMind' },
      { text: '以道韵化解', effect: 'daoYun' },
      { text: '求道友相助', effect: 'companion' },
    ],
  },
  {
    id: 'tiandao', name: '天道注视', minLevel: 60,
    trigger: (state) => state.player.level >= 60 && Math.random() < 0.05,
    desc: '你感到一道威严的目光自天穹落下，天道在注视你！',
    options: [
      { text: '顺应天道', effect: 'follow' },
      { text: '逆天而行', effect: 'defy' },
    ],
  },
  {
    id: 'yinguo', name: '因果债主', minLevel: 20,
    trigger: (state) => (state.flags?.kills || 0) >= 5 && Math.random() < 0.1,
    desc: '一位你曾击败的修士的师兄找上门来，讨要因果。',
    options: [
      { text: '赔礼道歉', effect: 'apologize', cost: 200 },
      { text: '一战了之', effect: 'battle' },
    ],
  },
  {
    id: 'relic', name: '上古遗宝', minLevel: 35,
    trigger: (state) => state.player.level >= 35 && Math.random() < 0.06,
    desc: '岩壁裂缝中透出一丝古老灵光，似有前辈遗宝封存于此。',
    options: [
      { text: '强行取宝（惊动禁制守卫）', effect: 'relic' },
      { text: '福缘未到，悄然离去', effect: 'leave' },
    ],
  },
  {
    id: 'vein', name: '灵脉喷涌', minLevel: 25,
    trigger: (state) => state.player.level >= 25 && Math.random() < 0.07,
    desc: '脚下一股精纯灵脉喷涌而出，天地灵气骤然浓郁！',
    options: [
      { text: '盘膝汲取灵脉', effect: 'vein' },
      { text: '引动阵法固化灵脉（道基）', effect: 'veinDao' },
    ],
  },
  {
    id: 'moxiu', name: '魔修挑衅', minLevel: 30,
    trigger: (state) => state.player.level >= 30 && Math.random() < 0.06,
    desc: '一名形貌阴鸷的魔修拦住去路，周身魔气翻涌，出言挑衅。',
    options: [
      { text: '拔剑迎战', effect: 'battle' },
      { text: '示弱离去（折损些许修为）', effect: 'flee' },
    ],
  },
  {
    id: 'qiuzhu', name: '散修求助', minLevel: 15,
    trigger: (state) => state.player.level >= 15 && Math.random() < 0.08,
    desc: '一名重伤的散修倒卧路旁，向你伸出求救之手。',
    options: [
      { text: '出手相助', effect: 'help' },
      { text: '修仙界弱肉强食，置之不理', effect: 'ignore' },
    ],
  },
  {
    id: 'baien', name: '白狐报恩', minLevel: 1,
    trigger: (state) => state.player.level >= 1 && Math.random() < 0.05,
    desc: '一只通体雪白的灵狐衔着灵草来到你面前，似要报答昔日救命之恩。',
    options: [
      { text: '收下灵狐所赠', effect: 'fox' },
      { text: '放归山林', effect: 'foxLeave' },
    ],
  },
];

/* ============================================================
 * 十、核心函数
 * ========================================================== */
export function realmGuide(level) {
  return REALM_GUIDE.find((r) => level >= r.min && level <= r.max) || REALM_GUIDE[0];
}

export function itemKey(item) {
  return `${item?.类型 || '道具'}:${item?.名称 || item?.name || '未知'}`;
}

function ensureCodexShell(state) {
  state.codex = state.codex || { discovered: [], seenCount: 0 };
  state.codex.discovered = state.codex.discovered || [];
  state.codex.counts = state.codex.counts || {};
}

export function ensureCodexState(state) {
  if (!state) return { discovered: [], seenCount: 0, counts: {} };
  ensureCodexShell(state);
  state.codex.discovered = [...new Set(state.codex.discovered || [])];
  for (const item of state.items || []) discoverItem(state, item, true);
  // 现代六部位装备结构（weapon/armor/pants/boots/accessory/artifact + stash）
  const eq = state.equipment || {};
  for (const k of ['weapon', 'armor', 'pants', 'boots', 'accessory', 'artifact']) discoverItem(state, eq[k], true);
  for (const it of eq.stash || []) discoverItem(state, it, true);
  // 旧版兼容
  for (const item of state.equipment?.gearSlots || []) discoverItem(state, item, true);
  for (const item of state.equipment?.artifactSlots || []) discoverItem(state, item, true);
  discoverItem(state, state.equipment?.gear, true);
  discoverItem(state, state.equipment?.artifact, true);
  // 已修习功法也录入图鉴（silent 避免读档刷屏）
  for (const t of state.techniques || []) discoverItem(state, { 名称: t.名称, 类型: '功法' }, true);
  // 已收服灵兽录入图鉴
  for (const b of state.beasts?.slots || []) discoverItem(state, { 名称: b.name, 类型: '灵兽' }, true);
  // 已播种的灵草录入图鉴（silent，避免读档刷屏）
  for (const h of state.cave?.garden || []) discoverItem(state, { 名称: h.name, 类型: '灵草' }, true);
  state.codex.counts = {};
  for (const item of state.items || []) {
    const k = itemKey(item);
    state.codex.counts[k] = (state.codex.counts[k] || 0) + (item.数量 || 1);
  }
  const eq2 = state.equipment || {};
  for (const k of ['weapon', 'armor', 'pants', 'boots', 'accessory', 'artifact']) {
    if (eq2[k]) state.codex.counts[itemKey(eq2[k])] = (state.codex.counts[itemKey(eq2[k])] || 0) + 1;
  }
  for (const it of eq2.stash || []) {
    state.codex.counts[itemKey(it)] = (state.codex.counts[itemKey(it)] || 0) + 1;
  }
  return state.codex;
}

export function discoverItem(state, item, silent = false) {
  if (!item?.名称 && !item?.name) return false;
  ensureCodexShell(state);
  const key = itemKey(item);
  if (!silent) state.codex.counts[key] = (state.codex.counts[key] || 0) + 1;
  if (!state.codex.discovered.includes(key)) {
    state.codex.discovered.push(key);
    state.codex.seenCount = (state.codex.seenCount || 0) + 1;
    // 仅在实际获得/装备物品时入队（初始化与读档用 silent 跳过，避免刷屏）
    if (!silent) {
      state.codex._pending = state.codex._pending || [];
      state.codex._pending.push(item.名称 || item.name);
    }
    return true;
  }
  return false;
}

/** 取出并清空「本次未消费的新发现图鉴名称」，供 UI 弹提示 / 闪烁 */
export function consumeCodexPending(state) {
  const list = state?.codex?._pending;
  if (!list || !list.length) return [];
  const names = [...list];
  state.codex._pending = [];
  return names;
}

export function itemDescription(item) {
  const name = item?.名称 || item?.name || '';
  const found = CODEX_ITEMS.find((x) => x.name === name);
  // 兜底返回空串（而非占位文案）：调用方统一按「有则显示、无则留白」处理。
  return found ? `${found.effect} 获取：${found.source}。` : (item?.描述 || item?.desc || '');
}

/** 返回当前激活的套装效果列表及加成标志 */
export function activeSetBonuses(state) {
  const eq = state.equipment || {};
  // 套装候选：已穿戴/备用装备 + 行囊全部物品（含材料）。匹配规则见下方 isMaterial 分支：
  // 装备/法宝按「名称包含 token」匹配；材料必须「名称精确等于 token」才计入，
  // 否则形如「青风狼内丹」的材料会误把妖纹套装激活（token '青风' 仅为其子串）。
  // 星辉套装的「星砂」材料因名称恰好等于 token，仍可正常作为套装组件计入。
  const owned = [
    eq.weapon, eq.armor, eq.pants, eq.boots, eq.accessory, eq.artifact,
    ...(eq.stash || []),
    ...(state.items || []),
  ];
  const items = owned.filter((it) => it?.名称);
  return Object.entries(SET_BONUSES).map(([name, set]) => {
    // 计件口径：命中任一套装 token 的「不同物品」数（而非不同 token 数），
    // 这样集齐 3 件实体套装部件即激活 3 件效果（妖纹仅 2 个 token，按原口径永远到不了 3 件）。
    // 材料仍须名称精确等于 token，否则「青风狼内丹」会因 token '青风' 为其子串而误触妖纹套装。
    const matchedItems = items.filter((it) => {
      const isMaterial = it?.类型 === '材料';
      return (set.tokens || []).some((t) => (isMaterial ? (it.名称 === t) : (it.名称 && it.名称.includes(t))));
    });
    const count = matchedItems.length;
    if (count < 2) return null; // 集齐 2 件才激活
    const bonus = { ...(set.bonus2 || {}), ...(count >= 3 ? (set.bonus3 || {}) : {}) };
    const text = count >= 3 ? set.text3 : set.text2;
    return { name, count, text, tokens: [...new Set(matchedItems.flatMap((it) => {
      const isMaterial = it?.类型 === '材料';
      return (set.tokens || []).filter((t) => (isMaterial ? (it.名称 === t) : (it.名称 && it.名称.includes(t))));
    }))], bonus };
  }).filter(Boolean);
}

/** 汇总所有激活套装的 bonus 标志，供战力/炼器/旅行判定使用 */
export function setBonusFlags(state) {
  const bonuses = activeSetBonuses(state);
  const flags = {};
  for (const b of bonuses) {
    if (!b.bonus) continue;
    for (const [k, v] of Object.entries(b.bonus)) {
      if (typeof v === 'number') flags[k] = (flags[k] || 0) + v;
      else flags[k] = v;
    }
  }
  return flags;
}

/* 按「名称」统计玩家实际持有数量（不依赖不可靠的 类型 前缀）。
 * 同一件装备在库存/装备栏/备用栏里的 类型 字段可能不一致（如法宝有时记为 装备），
 * 仅按 `类型:名称` 匹配会出现「明明有却显示未拥有」的错位，故改用名称兜底。 */
function heldCountOf(state, name) {
  if (!name) return 0;
  let n = 0;
  for (const it of state.items || []) if (it?.名称 === name) n += (it.数量 || 1);
  const eq = state.equipment || {};
  for (const k of ['weapon', 'armor', 'pants', 'boots', 'accessory', 'artifact']) {
    if (eq[k]?.名称 === name) n += 1;
  }
  for (const it of eq.stash || []) if (it?.名称 === name) n += 1;
  return n;
}

/** 返回玩家持有的该装备真实战力（取第一件匹配物），无则 null。供图鉴弹窗展示实测战力 */
export function ownedEquipPower(state, name) {
  if (!name) return null;
  for (const it of state.items || []) if (it?.名称 === name && it?._equip?.战力 != null) return it._equip.战力;
  const eq = state.equipment || {};
  for (const k of ['weapon', 'armor', 'pants', 'boots', 'accessory', 'artifact']) {
    if (eq[k]?.名称 === name && eq[k].战力 != null) return eq[k].战力;
  }
  for (const it of eq.stash || []) if (it?.名称 === name && it.战力 != null) return it.战力;
  return null;
}

export function codexEntries(state, category = '全部') {
  ensureCodexState(state);
  return CODEX_ITEMS.filter((item) => category === '全部' || item.category === category).map((item) => {
    const key = `${item.category}:${item.name}`;
    const held = heldCountOf(state, item.name);
    const count = (state.codex.counts?.[key] || 0) + held;
    const discovered = state.codex.discovered.includes(key) || held > 0;
    // 装备/法宝展示玩家手中真实战力（与实战力一致），避免「图鉴对不上」
    const realPower = (item.category === '装备' || item.category === '法宝') ? ownedEquipPower(state, item.name) : null;
    return { ...item, discovered, count, realPower };
  });
}

/** 图鉴统计：已发现/总数，按分类 */
export function codexStats(state) {
  ensureCodexState(state);
  const stats = {};
  for (const type of ITEM_TYPES) {
    const total = CODEX_ITEMS.filter((i) => i.category === type).length;
    const found = CODEX_ITEMS.filter((i) => i.category === type && state.codex.discovered.includes(`${i.category}:${i.name}`)).length;
    stats[type] = { found, total };
  }
  const totalFound = state.codex.discovered.length;
  const totalAll = CODEX_ITEMS.length;
  return { byType: stats, totalFound, totalAll };
}
