const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const gameCode = script.slice(0, script.indexOf("$('modal').addEventListener('cancel'"));

function game() {
  const elements = new Map();
  const saved = new Map();
  function element(id = '') {
    if (!elements.has(id)) elements.set(id, {
      id, textContent: '', innerHTML: '', value: '', open: false,
      style: {}, classList: { add() {}, remove() {} },
      setAttribute(name, value) { this[name] = value; },
      getContext() { return { fillRect() {}, save() {}, restore() {}, translate() {}, scale() {} }; },
      showModal() { this.open = true; }, close() { this.open = false; }, focus() {},
      addEventListener() {}, remove() {}, click() {},
    });
    return elements.get(id);
  }
  const document = {
    getElementById: element, createElement: element, addEventListener() {},
    querySelectorAll() { return []; }, body: { appendChild() {} },
  };
  const context = vm.createContext({
    document, window: { addEventListener() {}, innerWidth: 1200, innerHeight: 800 },
    localStorage: { setItem(k, v) { saved.set(k, v); }, getItem(k) { return saved.get(k) ?? null; } },
    performance: { now: () => 1000 }, setTimeout: () => 1, clearTimeout() {},
    requestAnimationFrame() {}, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Blob, console,
  });
  vm.runInContext(gameCode, context);
  vm.runInContext('makeBackground=()=>{};announceDistrict=()=>{}', context);
  return { run: code => vm.runInContext(code, context), elements, saved, context };
}

test('curve grows, levels unlock in order, and HUD shows current progress', () => {
  const g = game();
  assert.equal(g.run('xpForNext(1)'), 100);
  assert.equal(g.run('xpForNext(2)'), 264);
  assert.ok(g.run('xpForNext(9)') > g.run('xpForNext(5)'));
  for (let n = 1; n <= 10; n++) assert.ok(g.run(`unlockText(${n})`).length > 10);
  g.run('S.xp=95;awardXP(5);render()');
  assert.equal(g.elements.get('playerLevel').textContent, 2);
  assert.match(g.elements.get('xpDetail').textContent, /0 \/ 264 XP/);
  assert.equal(g.elements.get('xpMeter')['aria-valuemax'], 264);
  assert.match(g.elements.get('nextUnlock').textContent, /Fort/);
  g.run('S.xp=xpAtLevel(11);render()');
  assert.equal(g.elements.get('playerLevel').textContent, 11);
  assert.equal(g.run('levelBonus()'), 1.01);
});

test('successful activities earn defined XP; failed and duplicate actions do not', () => {
  const g = game();
  g.run("act('practice')");
  assert.equal(g.run('S.xp'), 20);
  g.run("S.energy=0;act('practice')");
  assert.equal(g.run('S.xp'), 20);
  g.run("S.energy=100;social('mira','chat')");
  assert.equal(g.run('S.xp'), 28);
  g.run("social('mira','chat')");
  assert.equal(g.run('S.xp'), 28);
  g.run("act('picnic');act('picnic')");
  assert.equal(g.run('S.xp'), 36);
  g.run('save()');
  assert.equal(JSON.parse(g.saved.get('project-superdj-v2')).xp, 36);
});

test('a first practice and finished set unlock level 2 work in play order', () => {
  const g = game();
  g.run("act('practice');S.hour=9;S.energy=100;startGig(0);gig.score=1000;finishGig(false)");
  assert.equal(g.run('playerLevel()'), 2);
  g.run("S.hour=9;S.energy=100;changeDistrict('bandra');S.skill=20;workJob('records')");
  assert.equal(g.run('S.daily.work'), 1);
  assert.ok(g.run('S.xp') > g.run('xpAtLevel(2)'));
});

test('legacy version 2 and Afterhours version 1 saves migrate into XP safely', () => {
  const g = game();
  const old = JSON.parse(g.run('JSON.stringify(initial())'));
  delete old.xp; delete old.discovered;
  old.fans = 3400; old.district = 'juhu'; old.gear = 3; old.home = 2;
  g.context.old = old;
  const migrated = g.run('validateSave(old)');
  assert.equal(migrated.version, 2);
  assert.equal(migrated.district, 'juhu');
  assert.ok(migrated.xp >= g.run('xpAtLevel(10)'));
  assert.deepEqual(Array.from(migrated.discovered), ['juhu']);
  old.version = 1; old.money = 100; old.daily = { work: 2, gig: 1 };
  const v1 = g.run('validateSave(old)');
  assert.equal(v1.money, 1000);
  assert.equal(v1.district, 'dadar');
  assert.equal(v1.daily.work, undefined);
  assert.equal(v1.daily.gig, undefined);
  old.xp = -1;
  assert.throws(() => g.run('validateSave(old)'), /Invalid XP/);
});

test('district and vehicle gates protect direct calls, discovery pays only once', () => {
  const g = game();
  g.run("travelTo('juhu')");
  assert.equal(g.run('S.district'), 'dadar');
  assert.equal(g.run('S.money'), 1500);
  g.run('S.xp=xpAtLevel(2)');
  g.run("travelTo('bandra','rickshaw')");
  assert.equal(g.run('S.money'), 1500);
  g.run("pendingSpot='exit_e';visit('exit_e')");
  assert.equal(g.run('pendingSpot'), null);
  assert.equal(g.run('S.district'), 'dadar');
  g.run("changeDistrict('bandra')");
  assert.equal(g.run('S.xp'), g.run('xpAtLevel(2)') + 15);
  g.run("changeDistrict('dadar');changeDistrict('bandra')");
  assert.equal(g.run('S.xp'), g.run('xpAtLevel(2)') + 15);
  g.run("showCity('juhu')");
  assert.match(g.elements.get('modalBody').innerHTML, /Unlock at Player Level 9/);
});

test('job, gig, release, equipment, home and collaboration gates apply to action functions', () => {
  const g = game();
  g.run('S.money=100000;S.skill=100;S.production=100;S.fans=10000;S.energy=100;S.friends.mira=50');
  g.run("S.district='andheri';spots=createSpots('andheri');workJob('assistant')");
  assert.equal(g.run('S.daily.work'), undefined);
  assert.equal(g.run('S.xp'), 0);
  g.run("S.district='dadar';spots=createSpots('dadar');buyGear(1);upgradeHome(1);releaseTrack();collaborate();startGig(2)");
  assert.equal(g.run('S.gear'), 0);
  assert.equal(g.run('S.home'), 0);
  assert.equal(g.run('S.tracks.length'), 0);
  assert.equal(g.run('S.daily.collab'), undefined);
  assert.equal(g.run('gig'), null);
  assert.equal(g.run('S.xp'), 0);
  g.run('S.xp=xpAtLevel(5);S.inspiration=100;S.hour=9;releaseTrack()');
  assert.equal(g.run('S.tracks.length'), 1);
  assert.ok(g.run('S.xp') > g.run('xpAtLevel(5)'));
  g.run('S.hour=9;S.energy=100;collaborate()');
  assert.equal(g.run('S.daily.collab'), 1);
});

test('cancelled gig earns no XP; completed gig pays once', () => {
  const g = game();
  g.run('S.xp=xpAtLevel(3);S.skill=100;S.fans=1000;S.energy=100;S.hour=9');
  g.run('startGig(2)');
  assert.equal(g.run('gig.i'), 2);
  const before = g.run('S.xp');
  g.run('finishGig(true)');
  assert.equal(g.run('S.xp'), before);
  g.run('finishGig(false)');
  assert.equal(g.run('S.xp'), before);
  g.run('S.daily.gig=0;S.hour=9;S.energy=100;startGig(2);gig.score=1400;finishGig(false)');
  const earned = g.run('S.xp');
  assert.ok(earned > before);
  g.run('finishGig(false)');
  assert.equal(g.run('S.xp'), earned);
});

test('offline build remains one HTML file with no external resources', () => {
  assert.match(html, /function downloadGame\(\)/);
  assert.match(html, /cloneNode\(true\)/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<img[^>]+src=/i);
});
