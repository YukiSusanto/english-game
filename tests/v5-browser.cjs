const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium}=require('playwright')); }
catch (_) { ({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const url = process.env.V5_URL || 'http://127.0.0.1:5173';
const out = process.env.ARTIFACT_DIR || path.join(__dirname,'artifacts'); fs.mkdirSync(out,{recursive:true});
const defaults = require('../assets/v5/core.js').defaults();
defaults.settings = {voice:false,sound:false,reducedMotion:true};
async function tap(p, action, attrs='') { await p.locator(`[data-action="${action}"]${attrs}`).first().click(); }
async function settle(p) { await p.waitForFunction(()=>!window.V5Game.state.busy); }
async function answer(p) {
  const t=await p.evaluate(()=>({ability:V5Game.state.task.ability,word:V5Game.state.task.word.word,completed:V5Game.state.task.completed}));
  if(!t.completed) {
    if(t.ability==='spelling') { await p.locator('#task-input').fill(t.word); await tap(p,'task-submit'); }
    else await tap(p,'task-option',`[data-answer="${t.ability==='usage'?'door':t.word}"]`);
  }
  await tap(p,'task-next');
}
async function answerQueue(p) { for(let n=0;n<5;n++) { if(await p.locator('#modal').isHidden())return;await answer(p); }throw Error('任务队列没有结束'); }
async function use(p,w) {
  const cards=p.locator(`[data-action="select-card"][data-word="${w}"]`); if(!await cards.count()) return false;
  await cards.first().click(); const confirm=p.locator('[data-action="use-card"]');
  if(await confirm.isDisabled())return false;
  await confirm.click();await settle(p);return true;
}
async function battle(p) {
  for(let n=0;n<100;n++) {
    const b=await p.evaluate(()=>V5Game.save.run.battle);
    if(b.status==='won')return;
    if(b.status==='lost')throw Error(`第 ${b.page+1} 页失利，回合 ${b.turn}`);
    if(b.status==='repair'){await use(p,b.page===4?[['door','open'],['light','open'],['pencil','clean']][b.phase][0]:b.page===3?'open':'door');continue;}
    const pool=b.hand.map(c=>c.word), target=b.enemies[b.target];
    const goal=b.page===4?[['door','open'],['light','open'],['pencil','clean']][b.phase]:b.page===3?['open','clean']:['pencil','door'];
    let choice=target.shield&&pool.includes('open')?'open':target.boost&&pool.includes('clean')?'clean':!b.goal?goal.find(w=>pool.includes(w)):null;
    choice ||= pool.includes('pencil')?'pencil':null;
    if(!choice&&b.energy>=2&&pool.includes('book'))choice='book';
    if(!choice&&!require('../assets/v5/core.js').shield(b)&&pool.includes('door'))choice='door';
    if(choice&&b.energy>0&&await use(p,choice))continue;
    if(!b.basicUsed){await tap(p,'basic');await settle(p);continue;}
    await tap(p,'end-turn');await settle(p);
  }
  throw Error('战斗未收束');
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const ctx=await browser.newContext({viewport:{width:1365,height:900}});
    await ctx.addInitScript(s=>{if(!localStorage.getItem('wbo_v5_demo_v1'))localStorage.setItem('wbo_v5_demo_v1',JSON.stringify(s));},defaults);
    const p=await ctx.newPage(),errors=[],failed=[],external=[];
    p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.url());});p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))external.push(r.url());});
    await p.goto(url);await p.waitForFunction(()=>!!window.V5Game);
    await p.screenshot({path:path.join(out,'v5-home.png')});
    await tap(p,'start');
    for(const w of ['door','light','pencil','book'])await tap(p,'introduce',`[data-word="${w}"]`);
    const intro=await p.evaluate(()=>V5Game.save.words);assert.equal(Object.keys(intro).length,4);assert.ok(Object.values(intro).every(w=>Object.keys(w.abilities).length===0));
    await tap(p,'intro-check');await answerQueue(p);await tap(p,'prepare');await answerQueue(p);
    await use(p,'door');const savedEnergy=await p.evaluate(()=>V5Game.save.run.battle.energy);
    await p.reload();await tap(p,'resume');assert.equal(await p.evaluate(()=>V5Game.save.run.battle.energy),savedEnergy);
    await p.locator('[data-enemy="1"]').click();await use(p,'light');await use(p,'pencil');
    assert.equal(await p.evaluate(()=>V5Game.save.run.battle.enemies[1].hp),1);
    await p.screenshot({path:path.join(out,'v5-battle-desktop.png')});
    await battle(p);await tap(p,'reward','[data-reward="pencil"]');await tap(p,'battle-next');
    await tap(p,'solve-puzzle','[data-word="window"]');await tap(p,'lesson-done');
    assert.equal(await p.evaluate(()=>V5Game.save.run.puzzle),'window');
    assert.ok(await p.evaluate(()=>V5Game.save.run.scene.window&&V5Game.save.run.scene.cat));
    await p.screenshot({path:path.join(out,'v5-window-route.png')});
    await tap(p,'puzzle-next');
    for(const w of ['open','clean']){await tap(p,'tool-lesson',`[data-word="${w}"]`);await tap(p,'lesson-done');}
    await tap(p,'prepare');await answerQueue(p);await battle(p);await tap(p,'battle-next');
    await tap(p,'prepare');await answerQueue(p);await battle(p);await tap(p,'battle-next');
    assert.equal(await p.evaluate(()=>V5Game.save.run.page),5);assert.equal(await p.evaluate(()=>V5Game.save.collection.length),1);
    await p.screenshot({path:path.join(out,'v5-complete.png')});
    await tap(p,'report');await p.screenshot({path:path.join(out,'v5-report.png')});
    await tap(p,'practice');await tap(p,'practice-mode','[data-ability="spelling"]');
    await p.setViewportSize({width:320,height:568});await tap(p,'practice-start');await tap(p,'task-hint');
    const id=await p.evaluate(()=>V5Game.state.task.id);await tap(p,'modal-close');await tap(p,'practice-start');
    assert.equal(await p.evaluate(()=>V5Game.state.task.id),id);assert.ok(await p.evaluate(()=>V5Game.state.task.cache.hints.length>0));
    assert.equal(await p.locator('#app').evaluate(e=>getComputedStyle(e).visibility),'hidden');
    const sizes=await p.locator('.key').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
    assert.ok(sizes.every(r=>r.w>=48&&r.h>=48));
    const submit=await p.locator('[data-action="task-submit"]').boundingBox();assert.ok(submit.y>=0&&submit.y+submit.height<=568);
    await p.screenshot({path:path.join(out,'v5-spelling-small.png')});await answerQueue(p);
    const spell=await p.evaluate(()=>V5Game.save.words.door.abilities.spelling);assert.equal(spell.independent,0);assert.equal(spell.assisted,1);
    // Exercise the same UI module in other units and the audio fallback branch.
    await p.setViewportSize({width:390,height:844});await p.locator('#unit-select').selectOption('5');
    await tap(p,'pick-word','[data-word="spoon"]');await tap(p,'practice-mode','[data-ability="listening"]');await tap(p,'practice-start');
    assert.equal(await p.evaluate(()=>V5Game.state.task.ability),'recognition');await answerQueue(p);
    await tap(p,'home');await tap(p,'start');for(const w of ['door','light','pencil','book'])await tap(p,'introduce',`[data-word="${w}"]`);
    await tap(p,'intro-check');await answerQueue(p);await tap(p,'prepare');await answerQueue(p);
    let endBox=await p.locator('[data-action="end-turn"]').boundingBox();assert.ok(endBox.y>=0&&endBox.y+endBox.height<=844);
    await tap(p,'select-card','[data-word="door"]');let useBox=await p.locator('[data-action="use-card"]').boundingBox();assert.ok(useBox.y>=0&&useBox.y+useBox.height<=844);await tap(p,'cancel-card');
    await p.screenshot({path:path.join(out,'v5-battle-mobile.png')});
    await p.setViewportSize({width:844,height:390});
    endBox=await p.locator('[data-action="end-turn"]').boundingBox();assert.ok(endBox.y>=0&&endBox.y+endBox.height<=390);
    const handBox=await p.locator('.hand-area').boundingBox(),sceneBox=await p.locator('.scene-panel').boundingBox();assert.ok(handBox.x>sceneBox.x+sceneBox.width);
    await tap(p,'select-card','[data-word="door"]');useBox=await p.locator('[data-action="use-card"]').boundingBox();assert.ok(useBox.y>=0&&useBox.y+useBox.height<=390);await tap(p,'cancel-card');
    await p.screenshot({path:path.join(out,'v5-battle-landscape.png')});
    await battle(p);await tap(p,'battle-next');await tap(p,'solve-puzzle','[data-word="door"]');assert.equal(await p.evaluate(()=>V5Game.save.run.puzzle),'door');
    assert.ok(await p.locator('#app').innerText().then(t=>t.includes('从地面走进')));
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
    const fileCtx=await browser.newContext();const legacy='{"v":3,"stars":123,"flags":{"openingDone":1}}';
    await fileCtx.addInitScript(old=>{localStorage.setItem('wbo_save_v2',old);localStorage.setItem('wbo_v5_demo_v1','{broken');},legacy);
    const fp=await fileCtx.newPage();const fileErrors=[];fp.on('pageerror',e=>fileErrors.push(e.message));
    await fp.goto(require('node:url').pathToFileURL(path.join(__dirname,'..','index.html')).href);await fp.waitForFunction(()=>!!window.V5Game);
    assert.equal(await fp.evaluate(()=>localStorage.getItem('wbo_v5_demo_v1_unreadable_backup')),'{broken');
    await tap(fp,'start');assert.equal(await fp.evaluate(()=>localStorage.getItem('wbo_save_v2')),legacy);
    assert.equal(await fp.evaluate(()=>localStorage.getItem('wbo_v5_legacy_backup')),legacy);
    await tap(fp,'report');const beforeImport=await fp.evaluate(()=>localStorage.getItem(V5Game.key));
    const invalid=require('../assets/v5/core.js').defaults();invalid.words.door=null;
    await fp.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
    await fp.waitForFunction(()=>document.querySelector('#toast').textContent.includes('当前记录没有被修改'));
    assert.equal(await fp.evaluate(()=>localStorage.getItem(V5Game.key)),beforeImport);assert.deepEqual(fileErrors,[]);
    await fileCtx.close();
    console.log('✓ 五页主线完整通关、目标选择与连携、刷新续玩、门窗两解、提示取消重开、320px 键盘与固定提交、跨单元练习、无朗读降级、四尺寸截图');
    console.log('✓ 页面异常 0，失败资源请求 0，外部请求 0');
    console.log('✓ 直接打开本地 HTML 可运行；损坏存档原文备份；旧版进度未改；无效导入不覆盖');
    console.log('截图目录：'+out);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
