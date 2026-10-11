const assert = require('node:assert/strict');
const C = require('../assets/v5/core.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }
function result(id, extra = {}) { return { attemptId:id, word:'door', ability:'spelling', variant:'meaning', correct:true, inputMode:'free', hints:[], mistakes:0, completedAt:1700000000000, ...extra }; }
function card(b, w) { return b.hand.find(c => c.word === w).id; }
test('接触与能力分开，重复事件不重复记录', () => {
  const s=C.defaults(); C.expose(s,'door','click-1'); C.expose(s,'door','click-1');
  assert.equal(s.words.door.exposures,1); assert.deepEqual(s.words.door.abilities,{});
});
test('提交去重，使用提示不能伪造独立成功', () => {
  const s=C.defaults(); const r=result('one',{hints:['letter'],independent:true});
  const x=C.record(s,r); assert.equal(x.independent,false); assert.equal(C.record(s,r),false);
  assert.equal(s.words.door.abilities.spelling.assisted,1); assert.equal(s.words.door.abilities.spelling.independent,0);
});
test('独立状态需要变化题干；跨 24 小时复测才保留', () => {
  const s=C.defaults(); C.record(s,result('a')); C.record(s,result('b'));
  assert.equal(C.abilityStatus(s.words.door.abilities.spelling),'独立完成过');
  C.record(s,result('c',{variant:'picture'})); assert.equal(C.abilityStatus(s.words.door.abilities.spelling),'可以独立完成');
  C.record(s,result('d',{variant:'meaning',completedAt:1700000000000+C.DAY}));
  assert.equal(C.abilityStatus(s.words.door.abilities.spelling),'间隔后仍会');
});
test('失败不抹掉其他能力；取消不生成能力记录', () => {
  const s=C.defaults(); C.record(s,result('a',{ability:'recognition'})); C.record(s,result('b',{correct:false}));
  assert.equal(s.words.door.abilities.recognition.independent,1);
  assert.equal(C.record(s,result('c',{cancelled:true})),false);
});
test('跨日重复同一提示仍不足以标为变化题干验证', () => {
  const s=C.defaults();C.record(s,result('same-1'));C.record(s,result('same-2',{completedAt:1700000000000+C.DAY}));
  assert.equal(s.words.door.abilities.spelling.retained,false);
});
test('认读结果不增长拼写证据，到期最多取两个词', () => {
  const s=C.defaults(); for(const w of ['door','light','book']) C.record(s,result(w,{word:w,ability:'recognition'}));
  assert.equal(s.words.door.abilities.spelling,undefined);
  assert.equal(C.dueWords(s,['door','light','book'],1700000000000+C.DAY).length,2);
});
test('不适用的目标不扣资源；同一张卡不能用两次', () => {
  const b=C.createBattle(3,C.newRun()); const id=card(b,'clean');
  assert.equal(C.useCard(b,id).ok,false); assert.equal(b.energy,3);
  const open=card(b,'open'); assert.equal(C.useCard(b,open).ok,true); assert.equal(b.energy,2);
  assert.equal(C.useCard(b,open).ok,false); assert.equal(b.energy,2);
});
test('light 减攻只维持本回合，pencil 同目标连携 +2', () => {
  const b=C.createBattle(1,C.newRun()); b.target=1;
  C.useCard(b,card(b,'light')); assert.equal(C.preview(b,'pencil').damage,8);
  C.useCard(b,card(b,'pencil')); assert.equal(b.enemies[1].hp,1); assert.equal(b.enemies[0].hp,9);
  assert.equal(b.enemies[1].exposed,false); C.endTurn(b); assert.equal(b.enemies[1].weak,0);
});
test('每件 door 护盾独立褪去 2；book 不超过 6 张手牌', () => {
  const b=C.createBattle(1,C.newRun()); C.useCard(b,card(b,'door'));
  b.enemies.forEach(e=>e.attack=0); C.endTurn(b); assert.equal(C.shield(b),4);
  const b2=C.createBattle(1,C.newRun()); C.useCard(b2,card(b2,'book')); assert.equal(b2.hand.length,6);
});
test('open 只破盾，clean 只清强化', () => {
  const b=C.createBattle(3,C.newRun()); b.enemies[0].boost=2;
  C.useCard(b,card(b,'clean')); assert.equal(b.enemies[0].boost,0); assert.equal(b.enemies[0].shield,6);
  b.enemies[0].boost=2; C.useCard(b,card(b,'open')); assert.equal(b.enemies[0].shield,0); assert.equal(b.enemies[0].boost,2);
});
test('普攻清敌后有免费收尾；零墨力也能完成', () => {
  const b=C.createBattle(1,C.newRun()); b.enemies.forEach(e=>{e.hp=3;e.attack=0});
  C.basic(b); C.endTurn(b); C.basic(b); assert.equal(b.status,'repair');
  b.energy=0; assert.equal(C.useCard(b,'repair_door').ok,true); assert.equal(b.status,'won'); assert.equal(b.energy,0);
});
test('Boss 不让溢出伤害穿透下一段；先修复再推进', () => {
  const b=C.createBattle(4,C.newRun()); b.upgrades.pencil=20;
  C.useCard(b,card(b,'pencil')); assert.equal(b.phase,0); assert.equal(b.status,'repair');
  C.useCard(b,'repair_open'); assert.equal(b.phase,1); assert.equal(b.enemies[0].hp,18); assert.equal(b.goal,false);
});
test('正确单词但解法不适用，区分语义与拼写错误', () => {
  assert.equal(C.puzzleAnswer(' WINDOW ',['window','candy']).answer,'window');
  assert.equal(C.puzzleAnswer('candy',['candy']).kind,'semantic');
  assert.equal(C.puzzleAnswer('dorr',['door']).kind,'spelling');
});
test('无效存档与不支持版本被拒绝，不隐式接受空对象', () => {
  assert.equal(C.validateSave(C.defaults()),true); assert.equal(C.validateSave({}),false);
  const s=C.defaults();s.version=99;assert.equal(C.validateSave(s),false);
});
test('导入损坏的能力、提示或战斗字段时拒绝整个存档', () => {
  const s=C.defaults();s.words.door=null;assert.equal(C.validateSave(s),false);
  const h=C.defaults();h.hints.bad=5;assert.equal(C.validateSave(h),false);
  const b=C.defaults();b.run=C.newRun();b.run.page=1;b.run.battle={status:'active'};assert.equal(C.validateSave(b),false);
});
console.log(`\n${passed} 项场景检查通过。`);
