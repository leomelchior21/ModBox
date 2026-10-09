import { describe, expect, it } from 'vitest';
import { parseGameScript } from '../../interpreter/gameScript';
import { formatCodeForLanguage } from '../../interpreter/languageSyntax';
import { YARD_DEFAULTS, yardSchema, type YardConfig } from './mods';
import { YardRun, ZOMBIE_INFO, type Zombie, type ZombieKind } from './run';
import { YARD_MISSIONS, YARD_SANDBOX, YARD_STARTER, yardUnlocked, playableYardProgram, yardMissionPassed } from './missions';
import { YardEffects } from './effects';

const parse = (s: string) => parseGameScript<YardConfig>(s, 'csharp', yardSchema);
const advance = (run: YardRun, seconds: number) => { for (let i = 0; i < seconds * 60; i++) run.step(1 / 60); };
const zombie = (kind: ZombieKind = 'worker', row = 2, x = 5): Zombie => ({ id: 999, kind, row, x, hp: ZOMBIE_INFO[kind].hp, maxHp: ZOMBIE_INFO[kind].hp, slowed: 0, flash: 0, biteTimer: 0.1, chewing: false });

describe('workshop defense simulation', () => {
  it('requires launch, charges for deployment and prevents invalid or occupied placement', () => {
    const r = new YardRun(); expect(r.interact('saw', 2, 0)).toBe(false); r.launch();
    expect(r.interact('saw', 2, 0)).toBe(true); expect(r.power).toBe(250);
    expect(r.interact('charger', 2, 0)).toBe(false); expect(r.power).toBe(250);
    for (const [row, col] of [[-1,0],[5,0],[1,9],[0,0.5]]) expect(r.interact('saw', row, col)).toBe(false);
    r.power = 20; expect(r.interact('saw', 0, 0)).toBe(false); expect(r.units).toHaveLength(1); expect(r.notice).toContain('Not enough');
  });
  it('upgrades health and damage, caps level, and refunds half the investment', () => {
    const r = new YardRun(); r.launch(); r.power = 1000; r.interact('saw', 2, 0); r.units[0].hp = 1;
    expect(r.interact('upgrade', 2, 0)).toBe(true); expect(r.units[0].level).toBe(2); expect(r.units[0].hp).toBe(r.units[0].maxHp);
    expect(r.interact('upgrade', 2, 0)).toBe(true); expect(r.interact('upgrade', 2, 0)).toBe(false);
    const before = r.power; expect(r.interact('recycle', 2, 0)).toBe(true); expect(r.power - before).toBe(170); expect(r.units).toHaveLength(0);
  });
  it('stops zombies at defenders, deals bite damage, then resumes movement after destruction', () => {
    const r = new YardRun(); r.launch(); r.interact('wall', 2, 4); const z = zombie('worker', 2, 5.05); r.zombies = [z];
    advance(r, 1); expect(z.x).toBe(5.05); expect(z.chewing).toBe(true); expect(r.units[0].hp).toBeLessThan(450);
    r.units[0].hp = 1; advance(r, 1); expect(r.units).toHaveLength(0); advance(r, 1); expect(z.x).toBeLessThan(5.05);
  });
  it('shoots only into its lane and awards kills exactly once', () => {
    const r = new YardRun(); r.launch(); r.interact('saw', 2, 0); r.zombies = [zombie('worker', 1, 3)];
    advance(r, 1); expect(r.metrics.shots).toBe(0);
    r.zombies = [zombie('worker', 2, 3)]; advance(r, 5); expect(r.metrics.kills).toBe(1); expect(r.score).toBe(50); expect(r.zombies).toHaveLength(0);
    advance(r, 1); expect(r.metrics.kills).toBe(1);
  });
  it('frost applies a real movement penalty and upgrades improve fire rate and damage', () => {
    const r = new YardRun(); r.launch(); r.power = 1000; r.interact('frost', 2, 0); r.interact('upgrade', 2, 0);
    const z = zombie('brute', 2, 4); r.zombies = [z]; advance(r, 1.2); expect(z.slowed).toBeGreaterThan(0); expect(z.hp).toBeLessThan(360); expect(r.metrics.slowed).toBeGreaterThan(0);
    const before = z.x; advance(r, 1); expect(before - z.x).toBeCloseTo(0.075 * 0.45, 3);
  });
  it('sky and chargers produce collectible power, collection is idempotent, and auto collection works', () => {
    const r = new YardRun(); r.launch(); r.interact('charger', 2, 0); advance(r, 5.2);
    expect(r.batteries).toHaveLength(2); const id = r.batteries[0].id, before = r.power;
    expect(r.collect(id)).toBe(true); expect(r.collect(id)).toBe(false); expect(r.power - before).toBe(25);
    r.setProgram(parse('bool autoCollect = true;')); advance(r, 0.1); expect(r.batteries).toHaveLength(0); expect(r.metrics.collected).toBe(50);
  });
  it('bounded batteries expire, and paused simulation and actions do not advance', () => {
    const r = new YardRun(); r.launch(); r.batteries = [{ id: 123, row: 0, x: 2, value: 25, age: 21.99 }]; advance(r, .1); expect(r.batteries).toHaveLength(0);
    r.pause(); const elapsed = r.elapsed, power = r.power; advance(r, 3); expect(r.elapsed).toBe(elapsed); expect(r.interact('saw', 0, 0)).toBe(false); expect(r.power).toBe(power); r.resume(); advance(r, 1); expect(r.elapsed).toBeGreaterThan(elapsed);
  });
  it('each emergency sweeper works once; subsequent breaches damage the workshop and end the run', () => {
    const r = new YardRun(); r.launch(); r.zombies = [zombie('worker', 2, .2)]; advance(r, .2);
    expect(r.sweepers[2].used).toBe(true); expect(r.metrics.kills).toBe(1); expect(r.lives).toBe(3); advance(r, 3);
    for (let i = 0; i < 3; i++) { r.zombies = [zombie('worker', 2, -.61)]; advance(r, .1); }
    expect(r.lives).toBe(0); expect(r.phase).toBe('gameover'); const score = r.score; advance(r, 1); expect(r.score).toBe(score);
    r.launch(); expect(r.lives).toBe(3); expect(r.metrics.kills).toBe(0); expect(r.sweepers.every(s => !s.used)).toBe(true);
  });
  it('progresses through three waves and produces a winnable default defense', () => {
    const r = new YardRun(); r.launch(); r.interact('saw', 2, 0); r.interact('saw', 0, 0); r.interact('saw', 4, 0); r.interact('charger', 2, 1);
    for (let frame = 0; frame < 60 * 300 && r.phase === 'playing'; frame++) {
      r.step(1 / 60); r.collectAll();
      for (const row of [1,3]) if (!r.units.some(u => u.kind === 'saw' && u.row === row)) r.interact('saw', row, 0);
      if (r.power >= 90) { const u = r.units.find(u => u.kind === 'saw' && u.level === 1); if (u) r.interact('upgrade', u.row, u.col); }
    }
    expect(r.phase).toBe('cleared'); expect(r.wave).toBe(3); expect(r.metrics.clears).toBe(1); expect(r.metrics.kills).toBe(27); expect(r.lives).toBe(3);
    r.advance(); expect(r.night).toBe(2); expect(r.wave).toBe(0); expect(r.units).toHaveLength(0); expect(r.metrics.clears).toBe(1);
  });
  it('stops simultaneous breaches at zero integrity', () => {
    const r=new YardRun();r.launch();r.lives=1;r.sweepers.forEach(s=>{s.used=true;});
    r.zombies=[{...zombie('worker',0,-1),id:1},{...zombie('worker',1,-1),id:2}];r.step(.1);
    expect(r.phase).toBe('gameover');expect(r.lives).toBe(0);expect(r.zombies).toHaveLength(1);
  });
  it('prevents overlapping waves and spawns all enemy variants including the foreman', () => {
    const r = new YardRun(); r.launch(); expect(r.sendWave()).toBe(true); expect(r.sendWave()).toBe(false);
    advance(r, 14); expect(r.zombies).toHaveLength(7); r.zombies = []; r.step(.1); expect(r.countdown).toBeGreaterThan(11);
    r.sendWave(); advance(r, 20); expect(r.zombies.some(z => z.kind === 'hardhat')).toBe(true); expect(r.zombies.some(z => z.kind === 'sprinter')).toBe(true);
    r.zombies=[]; r.step(.1); r.sendWave(); advance(r, 24); expect(r.zombies.some(z => z.kind === 'brute')).toBe(true);
  });
  it('keeps the last valid program and evaluates runtime rules without accumulating overrides', () => {
    const r = new YardRun(); r.setProgram(parse('int bladeDamage = 35;\nbool doubleShot = false;\nif (kills >= 3)\n{\n doubleShot = true;\n}')); r.launch();
    expect(r.config.bladeDamage).toBe(35); r.setProgram(parse('int bladeDamage = ;')); expect(r.config.bladeDamage).toBe(35);
    r.metrics.kills=3; r.step(.1); expect(r.config.doubleShot).toBe(true); expect(r.metrics.ruleTraces.length).toBe(1);
    r.metrics.kills=0; r.step(.1); expect(r.config.doubleShot).toBe(false);
  });
});

describe('workshop scripts, mission gates and feedback', () => {
  for (const language of ['csharp','python','swift'] as const) it(`parses starter, sandbox and live rules in ${language}`, () => {
    for (const code of [YARD_STARTER,YARD_SANDBOX]) expect(parseGameScript<YardConfig>(formatCodeForLanguage(code,language),language,yardSchema).ok).toBe(true);
    const r=new YardRun(); r.setProgram(parseGameScript<YardConfig>(formatCodeForLanguage(YARD_SANDBOX,language),language,yardSchema)); r.launch(); r.metrics.kills=3; r.wave=2; r.step(.1);
    expect(r.config.doubleShot).toBe(true); expect(r.config.overdrive).toBe(true);
  });
  it('locks future mods and rule actions until their mission and carries explicit free-mode unlocks', () => {
    const unlocked=yardUnlocked(YARD_MISSIONS[0],[],false); expect(unlocked.map(m=>m.id)).toEqual(['toolColor']);
    const p=playableYardProgram(parse(YARD_SANDBOX),unlocked.map(m=>m.id)); expect(p.config).toEqual({toolColor:'teal'}); expect(p.rules).toHaveLength(0);
    expect(yardUnlocked(YARD_MISSIONS[0],[],true)).toHaveLength(10);
    const r=new YardRun();r.setProgram(p);expect(r.config.bladeDamage).toBe(YARD_DEFAULTS.bladeDamage);
  });
  it('requires real arithmetic, play actions and executed rules for mission completion', () => {
    const r=new YardRun(); r.launch(); expect(yardMissionPassed(YARD_MISSIONS[0],parse('string toolColor = "amber";'),r.snapshot())).toBe(true);
    expect(yardMissionPassed(YARD_MISSIONS[2],parse('int bladeDamage = 35;'),r.snapshot())).toBe(false);
    expect(yardMissionPassed(YARD_MISSIONS[2],parse('int bladeDamage = 25 + 10;'),r.snapshot())).toBe(true);
    const p=parse('int chargeRate = 7;'); expect(yardMissionPassed(YARD_MISSIONS[3],p,r.snapshot())).toBe(false);
    r.setProgram(p);r.interact('saw',2,0);advance(r,3.2);r.collectAll();expect(yardMissionPassed(YARD_MISSIONS[3],p,r.snapshot())).toBe(true);
    const rule=parse('bool doubleShot = false;\nif (kills >= 3) { doubleShot = true; }');r.setProgram(rule);expect(yardMissionPassed(YARD_MISSIONS[5],rule,r.snapshot())).toBe(false);
    r.metrics.kills=3;r.step(.1);expect(yardMissionPassed(YARD_MISSIONS[5],rule,r.snapshot())).toBe(true);
  });
  it('bounds effects, respects reduced motion and expires all feedback', () => {
    const fx=new YardEffects(); const cue={kind:'kill' as const,row:2,x:4,text:'+50'};
    fx.consume(Array.from({length:100},()=>cue),'#64e7d5',false);expect(fx.particles.length).toBeLessThanOrEqual(200);expect(fx.floaters.length).toBeLessThanOrEqual(24);
    fx.step(2);expect(fx.particles).toHaveLength(0);expect(fx.floaters).toHaveLength(0);
    fx.consume([{...cue,kind:'breach'}],'#64e7d5',true);expect(fx.shake).toBe(0);expect(fx.particles).toHaveLength(0);expect(fx.floaters).toHaveLength(1);
  });
  it('requires the final mission to keep an executed runtime rule in the current script', () => {
    const r=new YardRun(), p=parse(YARD_SANDBOX);r.setProgram(p);r.launch();r.metrics.kills=3;r.step(.1);r.metrics.clears=1;
    expect(yardMissionPassed(YARD_MISSIONS[7],p,r.snapshot())).toBe(true);
    const noRule=parse('string toolColor = "teal";\nstring workshopName = "Saw Society";\nint bladeDamage = 35;\nbool doubleShot = true;\nConsole.WriteLine(workshopName);');
    expect(yardMissionPassed(YARD_MISSIONS[7],noRule,r.snapshot())).toBe(false);
  });
});
