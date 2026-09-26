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
  assert.equal(g.run('S.xp'), 35); // Activity XP plus the first quest's one-time reward.
  g.run("S.energy=0;act('practice')");
  assert.equal(g.run('S.xp'), 35);
  g.run("S.energy=100;social('mira','chat')");
  assert.equal(g.run('S.xp'), 43);
  g.run("social('mira','chat')");
  assert.equal(g.run('S.xp'), 43);
  g.run("act('picnic');act('picnic')");
  assert.equal(g.run('S.xp'), 51);
  g.run('save()');
  assert.equal(JSON.parse(g.saved.get('project-superdj-v2')).xp, 51);
});

test('a first practice and finished set unlock level 2 work in play order', () => {
  const g = game();
  g.run("act('practice');S.hour=9;S.energy=100;startGig(0);gig.score=1000;finishGig(false)");
  assert.equal(g.run('playerLevel()'), 2);
  assert.equal(g.run('S.goalProgress.goals[0]'), 'first-set');
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
  assert.equal(g.run('S.career.venues.length'), 0);
  g.run('finishGig(false)');
  assert.equal(g.run('S.xp'), before);
  g.run('S.daily.gig=0;S.hour=9;S.energy=100;startGig(2);gig.score=1400;finishGig(false)');
  const earned = g.run('S.xp');
  assert.ok(earned > before);
  assert.deepEqual(Array.from(g.run('S.career.venues')), [2]);
  g.run('finishGig(false)');
  assert.equal(g.run('S.xp'), earned);
});

test('offline build remains one HTML file with no external resources', () => {
  assert.match(html, /function downloadGame\(\)/);
  assert.match(html, /cloneNode\(true\)/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<img[^>]+src=/i);
});

test('the top-left HUD opens all ten goals and shows the current quest', () => {
  const g = game();
  assert.equal(g.run('primaryGoals.length'), 10);
  g.run('render();showGoals()');
  assert.equal((g.elements.get('modalBody').innerHTML.match(/class="goalCard /g) || []).length, 10);
  assert.match(g.elements.get('modalBody').innerHTML, /Monsoon Main Stage/);
  assert.match(g.elements.get('goalCount').textContent, /GOAL 1 \/ 10/);
  assert.match(g.elements.get('goalCount').textContent, /0\/2 QUESTS/);
  assert.match(g.elements.get('questLine').textContent, /Reach Mixing 5/);
  assert.match(html, /class="hudQuest" onclick="showControlSection\('goals'\)"/);
  g.run('S.skill=5;checkGoals();render()');
  assert.match(g.elements.get('goalCount').textContent, /1\/2 QUESTS/);
  assert.match(g.elements.get('questLine').textContent, /Complete your first gig/);
});

test('quest and goal rewards are claimed once and useful items change play', () => {
  const g = game();
  g.run('S.skill=5;S.gigs=1;checkGoals()');
  assert.equal(g.run('S.goalProgress.quests.length'), 2);
  assert.equal(g.run('S.goalProgress.goals.length'), 1);
  assert.equal(g.run('S.xp'), 70);
  assert.equal(g.run('S.money'), 1600);
  assert.equal(g.run('S.rep'), 1);
  g.run("S.career.jobs=2;S.fans=60;S.discovered.push('bandra');checkGoals()");
  assert.equal(g.run('S.goalProgress.goals.length'), 2);
  assert.equal(g.run('trainFare()'), 10);
  assert.ok(g.run("S.items.includes('localPass')"));
  const before = [g.run('S.xp'), g.run('S.money'), g.run('S.rep')];
  g.run('checkGoals()');
  assert.deepEqual([g.run('S.xp'), g.run('S.money'), g.run('S.rep')], before);
  g.run('S.xp=xpAtLevel(2);travelTo(\'bandra\')');
  assert.equal(g.run('S.money'), before[1] - 10);
});

test('old saves reconstruct career history and claimed rewards survive reload', () => {
  const g = game();
  const old = JSON.parse(g.run('JSON.stringify(initial())'));
  delete old.career; delete old.goalProgress; delete old.items;
  old.skill = 5; old.gigs = 1; old.fans = 60; old.discovered = ['dadar', 'bandra'];
  old.journal = [
    { day: 2, text: 'Played Gully Signal. B grade.' },
    { day: 1, text: 'Chai-stall shift complete in Dadar.' },
    { day: 1, text: 'Lunch delivery round shift complete in Dadar.' },
  ];
  g.context.old = old;
  const migrated = g.run('validateSave(old)');
  assert.equal(migrated.career.jobs, 2);
  assert.deepEqual(Array.from(migrated.career.venues), [0]);
  g.context.migrated = migrated;
  g.run('S=migrated;checkGoals();save()');
  assert.equal(g.run('S.goalProgress.goals.length'), 2);
  const xp = g.run('S.xp');
  g.context.roundTrip = JSON.parse(g.saved.get('project-superdj-v2'));
  g.run('S=validateSave(roundTrip);checkGoals()');
  assert.equal(g.run('S.xp'), xp);
  assert.equal(g.run('S.items.filter(x=>x===\'localPass\').length'), 1);
});

test('all ten goals can complete in sequence with escalating requirements', () => {
  const g = game();
  g.run("S.xp=xpAtLevel(10);S.skill=100;S.gigs=20;S.fans=5000;S.records=3;S.production=100;S.tracks=[{name:'A',quality:70,day:1,fans:100},{name:'B',quality:70,day:2,fans:100},{name:'C',quality:70,day:3,fans:100}];S.discovered=Object.keys(districts);S.career={jobs:2,collabs:1,venues:[5,6,7,8]};S.friends.mira=40;S.gear=3;S.rep=50;checkGoals();render()");
  assert.equal(g.run('S.goalProgress.goals.length'), 10);
  assert.equal(g.run('S.goalProgress.quests.length'), 35);
  assert.deepEqual(Array.from(g.run('S.items')).sort(), ['headlinerPlaque', 'localPass', 'masterTape']);
  assert.match(g.elements.get('goalCount').textContent, /ALL 10 GOALS COMPLETE/);
  const xp = g.run('S.xp');
  g.run('checkGoals()');
  assert.equal(g.run('S.xp'), xp);
});

test('Mira’s tape improves a real track release by five quality points', () => {
  function release(withTape) {
    const g = game();
    g.run('S.xp=xpAtLevel(5);S.production=30;S.inspiration=50;S.energy=100;S.money=1500');
    if (withTape) g.run("S.items.push('masterTape')");
    g.run('releaseTrack()');
    return g.run('S.tracks[0].quality');
  }
  assert.equal(release(true) - release(false), 5);
});

test('startup migrates eligible old quest progress and saves it immediately', () => {
  const g = game();
  const old = JSON.parse(g.run('JSON.stringify(initial())'));
  delete old.career; delete old.goalProgress; delete old.items;
  old.skill = 5;
  g.saved.set('project-superdj-v2', JSON.stringify(old));
  const startup = script.slice(script.indexOf("$('modal').addEventListener('cancel'"));
  vm.runInContext(startup, g.context);
  const persisted = JSON.parse(g.saved.get('project-superdj-v2'));
  assert.equal(persisted.goalProgress.quests.length, 1);
  assert.equal(persisted.xp, 15);
  assert.match(g.elements.get('questLine').textContent, /Complete your first gig/);
});

test('timed quests start from acceptance, show in-game countdowns, and pay once at the deadline', () => {
  const g = game();
  g.run("S.career.jobs=3;acceptTimedQuest('rush')");
  assert.equal(g.run('S.timedQuests.rush.startValue'), 3);
  assert.equal(g.run('S.timedQuests.rush.deadlineAt'), 17);
  assert.match(g.elements.get('modalBody').innerHTML, /8h 0m left/);
  g.run('checkTimedQuests()');
  assert.equal(g.run('S.timedQuests.rush.status'), 'active');
  g.run("pinQuest('timed:rush');S.hour=16.5;render()");
  assert.match(g.elements.get('pinnedQuests').innerHTML, /0h 30m left/);
  g.run('S.hour=17;S.career.jobs++;checkTimedQuests();render();save()');
  assert.equal(g.run('S.timedQuests.rush.status'), 'completed');
  assert.equal(g.run('S.xp'), 35);
  assert.equal(g.run('S.money'), 1750);
  assert.equal(g.run('S.rep'), 1);
  assert.equal(g.run('S.pinnedQuests.length'), 0);
  g.run('checkTimedQuests()');
  assert.equal(g.run('S.xp'), 35);
  g.run("acceptTimedQuest('rush')");
  assert.equal(g.run('S.timedQuests.rush.acceptedDay'), 1);
});

test('sampling quest uses a real action and can be accepted again the next day', () => {
  const g = game();
  g.run("S.career.samples=2;acceptTimedQuest('field')");
  assert.equal(g.run('S.timedQuests.field.startValue'), 2);
  g.run("act('sample')");
  assert.equal(g.run('S.timedQuests.field.status'), 'completed');
  assert.equal(g.run('S.career.samples'), 3);
  assert.equal(g.run('S.money'), 1600);
  assert.ok(g.run('S.xp') >= 30);
  g.run('S.day=2;S.hour=8;acceptTimedQuest(\'field\')');
  assert.equal(g.run('S.timedQuests.field.status'), 'active');
  assert.equal(g.run('S.timedQuests.field.startValue'), 3);
});

test('paid work completes a timed quest; travel and sleep resolve passed deadlines', () => {
  const worked = game();
  worked.run("acceptTimedQuest('rush');workJob('chai')");
  assert.equal(worked.run('S.timedQuests.rush.status'), 'completed');
  assert.equal(worked.run('S.money'), 2000);

  const traveled = game();
  traveled.run("S.xp=xpAtLevel(2);acceptTimedQuest('rush');pinQuest('timed:rush');S.hour=16.9;travelTo('bandra')");
  assert.equal(traveled.run('S.timedQuests.rush.status'), 'failed');
  assert.equal(traveled.run('S.pinnedQuests.length'), 0);

  const slept = game();
  slept.run("acceptTimedQuest('rush');sleepDay()");
  assert.equal(slept.run('S.timedQuests.rush.status'), 'failed');
});

test('a completed gig fulfills a booking, while leaving the stage does not', () => {
  const g = game();
  g.run("S.skill=5;acceptTimedQuest('booker');startGig(0);leaveGig()");
  assert.equal(g.run('S.timedQuests.booker.status'), 'active');
  g.run("S.daily.gig=0;S.energy=100;startGig(0);gig.score=1000;finishGig(false)");
  assert.equal(g.run('S.timedQuests.booker.status'), 'completed');
  assert.ok(g.run('S.rep') >= 3);
  const xp = g.run('S.xp');
  g.run('checkTimedQuests()');
  assert.equal(g.run('S.xp'), xp);
});

test('expired opportunities fail, disappear, and apply one reputation consequence', () => {
  const g = game();
  g.run("S.rep=5;acceptTimedQuest('rush');acceptTimedQuest('field');acceptTimedQuest('booker');pinQuest('timed:rush');pinQuest('timed:field');pinQuest('timed:booker')");
  assert.equal(g.run('S.pinnedQuests.length'), 3);
  g.run('S.hour=20;checkTimedQuests();render()');
  assert.equal(g.run('S.timedQuests.rush.status'), 'failed');
  assert.equal(g.run('S.timedQuests.field.status'), 'gone');
  assert.equal(g.run('S.timedQuests.booker.status'), 'active');
  assert.equal(g.run('S.pinnedQuests.length'), 1);
  g.run('showGoals()');
  assert.doesNotMatch(g.elements.get('modalBody').innerHTML, /City Sound Hunt/);
  g.run('S.day=2;S.hour=15.1;checkTimedQuests();render()');
  assert.equal(g.run('S.timedQuests.booker.status'), 'failed');
  assert.equal(g.run('S.rep'), 2);
  assert.equal(g.run('S.pinnedQuests.length'), 0);
  g.run('checkTimedQuests()');
  assert.equal(g.run('S.rep'), 2);
  g.run("acceptTimedQuest('field')");
  assert.equal(g.run('S.timedQuests.field.acceptedDay'), 2);
});

test('HUD enforces three pins, supports replacement and unpinning, and drops completed quests', () => {
  const g = game();
  g.run("pinQuest('first-set:practice');pinQuest('first-set:gig');pinQuest('neighbourhood:jobs');acceptTimedQuest('rush');pinQuest('timed:rush')");
  assert.equal(g.run('S.pinnedQuests.length'), 3);
  assert.equal(g.elements.get('modalTitle').textContent, 'Replace a pinned quest');
  assert.match(g.elements.get('modalBody').innerHTML, /Replace Reach Mixing 5/);
  g.run("replacePinned('first-set:gig','timed:rush');render()");
  assert.equal(g.run('S.pinnedQuests.length'), 3);
  assert.ok(g.run("S.pinnedQuests.includes('timed:rush')"));
  assert.match(g.elements.get('pinnedQuests').innerHTML, /No deadline/);
  assert.match(g.elements.get('pinnedQuests').innerHTML, /8h 0m left/);
  g.run("unpinQuest('neighbourhood:jobs');S.skill=5;checkGoals();render()");
  assert.equal(g.run('S.pinnedQuests.length'), 1);
  assert.doesNotMatch(g.elements.get('pinnedQuests').innerHTML, /Reach Mixing 5/);
});

test('save migration sanitizes pins and timed records; expired load resolves once', () => {
  const g = game();
  const old = JSON.parse(g.run('JSON.stringify(initial())'));
  delete old.career.samples; delete old.timedQuests; delete old.pinnedQuests;
  old.journal.unshift({ day: 1, text: 'You sampled the local trains, street chatter, rain, and the sea. Inspiration +20.' });
  g.context.old = old;
  const migrated = g.run('validateSave(old)');
  assert.equal(migrated.career.samples, 1);
  assert.deepEqual(Array.from(migrated.pinnedQuests), []);
  g.run("acceptTimedQuest('booker');pinQuest('timed:booker');save()");
  const roundTrip = JSON.parse(g.saved.get('project-superdj-v2'));
  roundTrip.pinnedQuests = ['timed:booker', 'timed:booker', 'invalid', 'first-set:practice', 'first-set:gig', 'neighbourhood:jobs'];
  g.context.roundTrip = roundTrip;
  g.run('S=validateSave(roundTrip);render()');
  assert.deepEqual(Array.from(g.run('S.pinnedQuests')), ['timed:booker', 'first-set:practice', 'first-set:gig']);
  g.run('S.day=3;S.hour=9;checkTimedQuests();save()');
  assert.equal(g.run('S.timedQuests.booker.status'), 'failed');
  assert.equal(g.run('S.pinnedQuests.includes(\'timed:booker\')'), false);
  const rep = g.run('S.rep');
  g.context.savedAgain = JSON.parse(g.saved.get('project-superdj-v2'));
  g.run('S=validateSave(savedAgain);checkTimedQuests()');
  assert.equal(g.run('S.rep'), rep);
});
