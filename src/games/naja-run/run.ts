import { ArcadeRun, type ArcadeAction } from '../premium-kit/core';
import { najaCatalog } from './catalog';
export const NAJA_SIZE = 18;
export interface Tile { x: number; y: number }
export type Direction = 'up' | 'right' | 'down' | 'left';
export const DIRECTIONS: Record<Direction, Tile> = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const opposite: Record<Direction, Direction> = { up: 'down', right: 'left', down: 'up', left: 'right' };
export class NajaRun extends ArcadeRun {
  body: Tile[] = []; previousBody: Tile[] = []; direction: Direction = 'right'; queue: Direction[] = [];
  food: Tile = { x: 11, y: 9 }; crystal = false; obstacles: Tile[] = []; fruits = 0; growthLeft = 0; timer = 0; shield = 0; rushCooldown = 0; respawn = 0;
  private rng = 1; private pointerStart: Tile | null = null;
  constructor(checkpoint?: unknown) { super('naja-run', najaCatalog.defaults, najaCatalog.schema, checkpoint); }
  get goal(): number { return Math.min(12, 5 + this.level - 1); }
  get interval(): number { return 1 / (this.config.speed + Math.min(4, (this.level - 1) * 0.35)); }
  protected setup(): void {
    this.rng = this.level * 331 + 17; this.fruits = 0; this.food = { x: 11, y: 9 }; this.crystal = false; this.shield = 0; this.rushCooldown = 0; this.respawn = 0;
    this.obstacles = [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 13, y: 3 }, { x: 14, y: 3 }, { x: 3, y: 14 }, { x: 4, y: 14 }, { x: 13, y: 14 }, { x: 14, y: 14 }];
    if (this.level > 1) this.obstacles.push({ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 8, y: 13 }, { x: 9, y: 13 });
    this.resetSnake(); this.notice = 'Follow the golden fruit. Swipe or use the arrow keys.';
  }
  private resetSnake(): void { this.body = [8, 7, 6, 5].map(x => ({ x, y: 9 })); this.previousBody = structuredClone(this.body); this.direction = 'right'; this.queue = []; this.growthLeft = 0; this.timer = 0; this.pointerStart = null; }
  turn(direction: Direction): boolean {
    if (this.phase !== 'playing' || this.queue.length >= 2) return false;
    const previous = this.queue[this.queue.length - 1] ?? this.direction;
    if (direction === opposite[previous] || direction === previous) return false;
    this.queue.push(direction); this.metrics.actions++; return true;
  }
  action(action: ArcadeAction): void {
    if (this.phase !== 'playing') return;
    if (action === 'left' || action === 'right' || action === 'up' || action === 'down') this.turn(action);
    if ((action === 'ability' || action === 'primary') && this.config.overdrive && this.rushCooldown <= 0) { this.shield = 4; this.rushCooldown = 12; this.cue('ability', this.body[0].x * 36 + 54, this.body[0].y * 36 + 54, 'JADE SHIELD'); this.notice = 'JADE RUSH! Four seconds of protection.'; }
  }
  pointer(phase: 'down' | 'move' | 'up' | 'cancel', x: number, y: number): void {
    if (phase === 'cancel' || phase === 'up') { this.pointerStart = null; return; }
    if (phase === 'down') this.pointerStart = { x, y };
    if (phase === 'move' && this.pointerStart) { const dx = x - this.pointerStart.x, dy = y - this.pointerStart.y; if (Math.hypot(dx, dy) < 22) return; this.turn(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'); this.pointerStart = { x, y }; }
  }
  protected tick(dt: number): void {
    this.shield = Math.max(0, this.shield - dt); this.rushCooldown = Math.max(0, this.rushCooldown - dt);
    if (this.respawn > 0) { this.respawn -= dt; return; }
    this.timer += dt;
    while (this.timer >= this.interval && this.phase === 'playing') { this.timer -= this.interval; this.move(); }
  }
  private move(): void {
    if (this.queue.length) this.direction = this.queue.shift()!;
    const v = DIRECTIONS[this.direction], head = { x: this.body[0].x + v.x, y: this.body[0].y + v.y };
    const outside = head.x < 0 || head.y < 0 || head.x >= NAJA_SIZE || head.y >= NAJA_SIZE;
    if (outside && this.config.assist) { head.x = (head.x + NAJA_SIZE) % NAJA_SIZE; head.y = (head.y + NAJA_SIZE) % NAJA_SIZE; this.metrics.assisted++; this.cue('ability', head.x * 36 + 54, head.y * 36 + 54, 'PORTAL'); }
    else if (outside) { this.collide(); return; }
    const eating = head.x === this.food.x && head.y === this.food.y;
    const tailMoves = !eating && this.growthLeft === 0;
    const hitBody = this.body.slice(0, tailMoves ? -1 : undefined).some(t => t.x === head.x && t.y === head.y);
    const hitStone = this.obstacles.some(t => t.x === head.x && t.y === head.y);
    if (hitBody || hitStone) {
      if (this.shield <= 0) { this.collide(); return; }
      if (hitStone) this.obstacles = this.obstacles.filter(t => t.x !== head.x || t.y !== head.y);
      if (hitBody) { const index = this.body.findIndex(t => t.x === head.x && t.y === head.y); this.body = this.body.slice(0, index); }
      this.shield = 0; this.cue('ability', head.x * 36 + 54, head.y * 36 + 54, 'SHIELD SAVE');
    }
    this.previousBody = structuredClone(this.body); this.body.unshift(head);
    if (eating) {
      this.fruits++; this.growthLeft += this.config.bonus;
      const points = this.config.power * (this.crystal ? 3 : 1) * (this.config.overdrive ? 2 : 1);
      this.addScore(points, head.x * 36 + 54, head.y * 36 + 54, this.crystal ? `CRYSTAL +${points}` : `+${points}`);
      this.notice = `${this.fruits}/${this.goal} fruit collected. Keep your tail out of the way.`;
      if (this.fruits >= this.goal) { this.clear(360, 300); return; }
      this.spawnFood();
    }
    if (this.growthLeft > 0) this.growthLeft--; else this.body.pop();
  }
  private collide(): void { const h = this.body[0]; this.lose(h.x * 36 + 54, h.y * 36 + 54, 'TEMPLE CHARM LOST'); if (this.phase === 'playing') { this.resetSnake(); this.respawn = 0.9; this.notice = 'A fresh path. Keep moving and watch your tail.'; if (this.body.some(t => t.x === this.food.x && t.y === this.food.y)) this.spawnFood(); } }
  private spawnFood(): void {
    const free: Tile[] = [];
    for (let y = 0; y < NAJA_SIZE; y++) for (let x = 0; x < NAJA_SIZE; x++) if (!this.body.some(t => t.x === x && t.y === y) && !this.obstacles.some(t => t.x === x && t.y === y)) free.push({ x, y });
    if (!free.length) { this.clear(360, 360); return; }
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    this.food = free[this.rng % free.length]; this.crystal = this.fruits % 3 === 2;
  }
  stats() { return [{ label: 'HARVEST', value: `${this.fruits}/${this.goal}` }, { label: 'LENGTH', value: this.body.length }, { label: 'CHARMS', value: this.lives }]; }
}
