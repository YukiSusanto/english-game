const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({chromium} = require('playwright')); }
catch (_) { ({chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const C = require('../assets/v5/core.js');
const url = process.env.V5_URL || 'http://127.0.0.1:5173';
const out = process.env.ARTIFACT_DIR || path.join(__dirname, 'artifacts', 'layout');
fs.mkdirSync(out, {recursive: true});
const devices = [[320,568], [390,844], [768,1024], [820,1180], [1024,768], [1180,820], [844,390], [667,375]]
  .filter(([w,h]) => !process.env.LAYOUT_SIZES || process.env.LAYOUT_SIZES.split(',').includes(`${w}x${h}`));
const tap = (p, action, attrs = '') => p.locator(`[data-action="${action}"]${attrs}`).first().tap();
async function box(p, selector) { return p.locator(selector).first().boundingBox(); }
function visible(b, width, height, name) {
  assert.ok(b && b.x >= -1 && b.y >= -1 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1, `${name} 超出 ${width}×${height}: ${JSON.stringify(b)}`);
}
(async () => {
  const browser = await chromium.launch({executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true});
  const failures = [];
  try {
    for (const [width, height] of devices) {
      const ctx = await browser.newContext({viewport: {width, height}, hasTouch: true, isMobile: true});
      const state = C.defaults(); state.settings = {voice: false, sound: false, reducedMotion: true};
      state.run = C.newRun('layout'); state.run.page = 1; state.run.introduced = [...C.BASE];
      state.run.battle = C.createBattle(1, state.run); assert.ok(C.validateSave(state));
      await ctx.addInitScript(s => { if (!localStorage.getItem('wbo_v5_demo_v1')) localStorage.setItem('wbo_v5_demo_v1', JSON.stringify(s)); }, state);
      const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      try {
        await p.goto(url); await tap(p, 'resume'); await tap(p, 'select-card', '[data-word="door"]');
        await p.screenshot({path: path.join(out, `battle-${width}x${height}.png`)});
        const scene = await box(p, '.scene-panel'), hand = await box(p, '.hand-area');
        visible(scene, width, height, '场景');
        const hitArea = await box(p, '.foe [data-hit-area]');
        assert.ok(hitArea.width >= 44 && hitArea.height >= 44, '墨团触控范围太小');
        await p.locator('[data-enemy="1"] [data-hit-area]').tap();
        assert.equal(await p.evaluate(() => V5Game.save.run.battle.target), 1, '触控无法切换墨团');
        for (const action of ['use-card', 'reinforce', 'end-turn']) visible(await box(p, `[data-action="${action}"]`), width, height, action);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '页面横向溢出');
        if (width >= 1000 || (width >= 600 && width > height)) assert.ok(hand.x >= scene.x + scene.width, '横屏手牌未靠近场景右侧');
        else assert.ok(hand.y >= scene.y + scene.height && hand.y - scene.y - scene.height < 70, '竖屏手牌离场景过远');
        await tap(p, 'reinforce');
        await p.screenshot({path: path.join(out, `spelling-${width}x${height}.png`)});
        const taskScene = await box(p, '.scene-panel'), dialog = await box(p, '.scene-modal .dialog');
        visible(taskScene, width, height, '拼写时场景'); visible(dialog, width, height, '拼写面板');
        visible(await box(p, '[data-action="task-submit"]'), width, height, '提交按钮');
        assert.equal(await p.locator('#app').evaluate(el => getComputedStyle(el).visibility), 'visible');
        assert.equal(await p.locator('.dock-content').isVisible(), false, '原词卡泄漏题目答案');
        assert.equal(await p.locator('.scene-caption strong').isVisible(), false, '场景目标中的词形泄漏拼写答案');
        assert.equal(await p.locator('.dialog').evaluate(el => !!el.closest('[inert]')), false, '题目不可交互');
        const keys = await p.locator('.key').evaluateAll(es => es.map(e => ({width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height})));
        assert.ok(keys.every(k => k.width >= 48 && k.height >= 48), `字母键过小: ${JSON.stringify(keys[0])}`);
        const keyboard = await box(p, '.keyboard'), tenthKey = await p.locator('.key').nth(9).boundingBox();
        assert.ok(tenthKey.y + tenthKey.height <= keyboard.y + keyboard.height + 1, '至少两排字母应完整可见');
        // The last row must remain reachable even when the task body scrolls.
        await tap(p, 'task-key', '[data-key="z"]'); assert.equal(await p.locator('#task-input').inputValue(), 'z');
        await tap(p, 'task-backspace'); await p.locator('#task-input').fill('door'); await tap(p, 'task-submit'); await tap(p, 'task-next');
        assert.equal(await p.locator('#modal').isHidden(), true); assert.equal(await p.locator('#app').evaluate(el => el.inert), false);
        await tap(p, 'use-card'); await p.waitForFunction(() => !V5Game.state.busy);
        assert.ok(await p.evaluate(() => V5Game.save.run.battle.guards.length > 0), '拼写后无法继续出牌');
        // Check the other page controls too, not only a seeded battle.
        await tap(p, 'home'); await tap(p, 'restart-confirm'); await tap(p, 'start');
        for (const w of C.BASE) await tap(p, 'introduce', `[data-word="${w}"]`);
        visible(await box(p, '[data-action="intro-check"]'), width, height, '认词入口');
        await tap(p, 'intro-check');
        await p.screenshot({path: path.join(out, `recognition-${width}x${height}.png`)});
        visible(await box(p, '.scene-panel'), width, height, '认词时场景');
        for (const option of await p.locator('.task-option').all()) visible(await option.boundingBox(), width, height, '认词选项');
        for (let n = 0; n < 2; n++) {
          const answer = await p.evaluate(() => V5Game.state.task.word.word);
          await tap(p, 'task-option', `[data-answer="${answer}"]`); await tap(p, 'task-next');
        }
        visible(await box(p, '[data-action="prepare"]'), width, height, '准备入口');
        assert.deepEqual(errors, []);
        console.log(`✓ ${width}×${height} 场景、认词与拼写同屏，44px 墨团点击区，能提交并返回战斗`);
      } catch (e) { failures.push(`${width}×${height}: ${e.message}`); console.error(failures.at(-1)); }
      finally { await ctx.close(); }
    }
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
