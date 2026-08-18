// 纯逻辑测试：直接 import systems.js（不依赖 DOM）
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const g = globalThis;
g.window = g.window || { localStorage: { getItem(){return null;}, setItem(){} }, matchMedia(){return{matches:false};} };

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(__dirname, '..');
const S = await import(pathToFileURL(join(gameRoot, 'public/js/systems.js')).href);
const D = await import(pathToFileURL(join(gameRoot, 'public/js/data.js')).href);

function mkState(root, daoYunLevel=1) {
  return {
    player: {
      level: 10,
      spiritRoot: root,
      daoYun: { id:'none', name:'未觉醒', level:daoYunLevel, exp:0 },
      daoBase: {},
      mainTechnique: '无',
      realm: '练气',
      milestones: [],
    },
    equipment: { slots:{}, stash:[] },
    artifacts: {},
    techniques: [],
    beasts: [],
    buffs: {},
    world: { year:1, month:1 },
    logs: [],
  };
}

console.log('=== #63 灵根战力加成核验 ===');
for (const root of D.SPIRIT_ROOTS) {
  const st = mkState({ grade: root.name, gradeId: root.id, elements:'火', speed: root.speed });
  const pw = S.calcPower(st);
  const expectedRoot = 10 * root.speed * 2; // 灵根加成
  const baseOther = 10*5; // realmPower
  console.log(`灵根 ${root.name}(${root.id}, speed=${root.speed}) => 战力=${pw}｜灵根加成=${expectedRoot}（其余基础=${baseOther}）`);
}

console.log('\n=== #63 旧档兼容（仅有 grade 名称，无 gradeId）===');
{
  const st = mkState({ grade:'极品', elements:'火', speed:1.5 });
  const pw = S.calcPower(st);
  console.log('旧档 极品 => 战力', pw, '(应体现 1.5 加成，非中品 1.0)');
}

console.log('\n=== #66 道韵 与 战力 ===');
console.log('DAO_YUNS 是否含 power 字段:', D.DAO_YUNS.map(y=>({id:y.id, hasPower:'power' in y})));
{
  const st = mkState({grade:'上品',gradeId:'shang',speed:1.2}, 5);
  st.player.daoYun = { id:'x1', name:'太上忘情', level:5, exp:0 };
  console.log('已觉醒道韵 level=5 => 战力', S.calcPower(st), '(道韵贡献 5*3=15)');
}

console.log('\n=== #65 道缘/NPC 生成数量（createNewGame 逐步结识）===');
const st = S.createNewGame({
  name:'测试', gender:'男', raceId:'human', ageId:'young', regionId:'zhongzhou',
  packId:5, spiritRoot:{ grade:'上品', gradeId:'shang', elements:['火'], speed:1.2, desc:'' },
});
console.log('createNewGame 返回 npcs 总数:', st.npcs.length);
console.log('已结识(met=true) 数量:', st.npcs.filter(n=>n.met).length);
console.log('未结识(met=false) 数量:', st.npcs.filter(n=>!n.met).length);
console.log('开局故交示例:', st.npcs.filter(n=>n.met).slice(0,3).map(n=>({name:n.name, job:n.job, favor:n.favor})));
console.log('knownNpcs 数量:', S.knownNpcs(st).length);
let revealed = 0;
for (let i=0;i<5;i++){ if (S.revealNpc(st)) revealed++; }
console.log('revealNpc 调用5次，新结识:', revealed, '；已知总数变为:', S.knownNpcs(st).length);
console.log('spiritRoot 形状:', JSON.stringify(st.player.spiritRoot));
console.log('daoYun 默认:', JSON.stringify(st.player.daoYun));
