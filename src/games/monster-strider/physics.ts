/** Small deterministic position-based dynamics solver for the stunt courses (2D, y up). */
export interface Particle {
  x: number; y: number; px: number; py: number; vx: number; vy: number;
  /** Inverse mass. Zero pins the particle in place. Drag is a per-second velocity loss that settles wobbly props. */
  w: number; r: number; body: number; collide: boolean; friction: number; drag: number;
  /** Contact gathered during the last substep: accumulated normal push, normal and the surface it touched. */
  cn: number; cnx: number; cny: number; cseg: number; ct: number;
}
export interface Link { a: number; b: number; len: number; on: boolean }
/** Long-range attachment: keeps chain particles within reach of an anchor so heavy loads cannot over-stretch a bridge. */
export interface Tether { p: number; anchor: number; max: number; on: boolean }
export interface Seg { a: number; b: number; body: number; on: boolean; plank: number }
export interface Wall { ax: number; ay: number; bx: number; by: number; nx: number; ny: number; minX: number; maxX: number; minY: number; maxY: number }

const MAX_SPEED = 40;

export class Sim {
  readonly p: Particle[] = []; readonly links: Link[] = []; readonly tethers: Tether[] = []; readonly segs: Seg[] = []; readonly walls: Wall[] = [];
  gravity = 16;
  /** Called after any dynamic segment touch, so games can react (crumbling planks). */
  onTouch: ((seg: Seg, particle: number) => void) | null = null;

  particle(x: number, y: number, mass: number, body: number, r = 0, collide = false, friction = .6, drag = 0): number {
    this.p.push({ x, y, px: x, py: y, vx: 0, vy: 0, w: mass > 0 ? 1 / mass : 0, r, body, collide, friction, drag, cn: 0, cnx: 0, cny: 0, cseg: -1, ct: 0 });
    return this.p.length - 1;
  }
  link(a: number, b: number): Link {
    const l = { a, b, len: Math.hypot(this.p[a].x - this.p[b].x, this.p[a].y - this.p[b].y), on: true }; this.links.push(l); return l;
  }
  tether(p: number, anchor: number, max: number): void { this.tethers.push({ p, anchor, max, on: true }); }
  seg(a: number, b: number, body: number, plank = -1): Seg { const s = { a, b, body, on: true, plank }; this.segs.push(s); return s; }
  /** Solid outline, wound so the outward normal is on the left of a→b in a y-up frame. */
  outline(points: readonly (readonly [number, number])[]): void {
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length], len = Math.hypot(bx - ax, by - ay); if (len < 1e-6) continue;
      this.walls.push({ ax, ay, bx, by, nx: -(by - ay) / len, ny: (bx - ax) / len, minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minY: Math.min(ay, by), maxY: Math.max(ay, by) });
    }
  }

  integrate(h: number): void {
    for (const q of this.p) {
      q.cn = 0; q.cseg = -1;
      if (q.w === 0) { q.px = q.x; q.py = q.y; q.vx = q.vy = 0; continue; }
      q.vy -= this.gravity * h; if (q.drag) { const keep = Math.max(0, 1 - q.drag * h); q.vx *= keep; q.vy *= keep; }
      const speed = Math.hypot(q.vx, q.vy); if (speed > MAX_SPEED) { q.vx *= MAX_SPEED / speed; q.vy *= MAX_SPEED / speed; }
      q.px = q.x; q.py = q.y; q.x += q.vx * h; q.y += q.vy * h;
    }
  }
  solveLinks(): void {
    for (const l of this.links) {
      if (!l.on) continue;
      const a = this.p[l.a], b = this.p[l.b], w = a.w + b.w; if (w === 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, k = (d - l.len) / d / w;
      a.x += dx * k * a.w; a.y += dy * k * a.w; b.x -= dx * k * b.w; b.y -= dy * k * b.w;
    }
    for (const t of this.tethers) {
      if (!t.on) continue;
      const q = this.p[t.p], a = this.p[t.anchor], dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy);
      if (d > t.max && q.w > 0) { const k = (d - t.max) / d; q.x -= dx * k; q.y -= dy * k; }
    }
  }
  private contact(q: Particle, nx: number, ny: number, push: number, seg: number, t: number): void {
    q.cn += push; q.cnx = nx; q.cny = ny; q.cseg = seg; q.ct = t;
  }
  solveCollisions(): void {
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i]; if (!q.collide || q.w === 0) continue;
      const r = q.r;
      for (const s of this.walls) {
        if (q.x + r < s.minX || q.x - r > s.maxX || q.y + r < s.minY - .8 || q.y - r > s.maxY + .8) continue;
        const dx = s.bx - s.ax, dy = s.by - s.ay, len2 = dx * dx + dy * dy, t = ((q.x - s.ax) * dx + (q.y - s.ay) * dy) / len2;
        if (t >= 0 && t <= 1) {
          // One-sided: anything slightly behind a face is pushed back out through that face.
          const sd = (q.x - s.ax) * s.nx + (q.y - s.ay) * s.ny;
          if (sd < r && sd > -.9) { const push = r - sd; q.x += s.nx * push; q.y += s.ny * push; this.contact(q, s.nx, s.ny, push, -1, 0); }
        } else {
          const ex = t < 0 ? s.ax : s.bx, ey = t < 0 ? s.ay : s.by, ox = q.x - ex, oy = q.y - ey, d2 = ox * ox + oy * oy;
          if (d2 < r * r && d2 > 1e-10 && ox * s.nx + oy * s.ny > -.05) { const d = Math.sqrt(d2), push = r - d, nx = ox / d, ny = oy / d; q.x += nx * push; q.y += ny * push; this.contact(q, nx, ny, push, -1, 0); }
        }
      }
      for (let k = 0; k < this.segs.length; k++) {
        const s = this.segs[k]; if (!s.on || s.body === q.body) continue;
        const a = this.p[s.a], b = this.p[s.b];
        if (q.x + r < Math.min(a.x, b.x) || q.x - r > Math.max(a.x, b.x) || q.y + r < Math.min(a.y, b.y) || q.y - r > Math.max(a.y, b.y)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1e-9;
        const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2));
        let nx = q.x - (a.x + dx * t), ny = q.y - (a.y + dy * t); const d2 = nx * nx + ny * ny; if (d2 >= r * r) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) { const l = Math.sqrt(len2); nx = -dy / l; ny = dx / l; d = 0; } else { nx /= d; ny /= d; }
        const pen = r - d, wa = a.w * (1 - t), wb = b.w * t, denom = q.w + wa * (1 - t) + wb * t; if (denom === 0) continue;
        const lambda = pen / denom;
        q.x += nx * lambda * q.w; q.y += ny * lambda * q.w;
        a.x -= nx * lambda * wa; a.y -= ny * lambda * wa; b.x -= nx * lambda * wb; b.y -= ny * lambda * wb;
        this.contact(q, nx, ny, lambda * q.w, k, t); this.onTouch?.(s, i);
      }
    }
  }
  finishVelocities(h: number): void {
    for (const q of this.p) if (q.w > 0) { q.vx = (q.x - q.px) / h; q.vy = (q.y - q.py) / h; }
  }
  /** Plain fixed step for props with no driver attached (used to settle a course before play). */
  step(h: number, iterations: number): void {
    this.integrate(h); for (let i = 0; i < iterations; i++) { this.solveLinks(); this.solveCollisions(); } this.finishVelocities(h); this.friction(h, new Set());
  }
  /** Velocity of whatever the particle is touching (zero for land). */
  surfaceVelocity(q: Particle): [number, number] {
    if (q.cseg < 0) return [0, 0];
    const s = this.segs[q.cseg], a = this.p[s.a], b = this.p[s.b];
    return [a.vx + (b.vx - a.vx) * q.ct, a.vy + (b.vy - a.vy) * q.ct];
  }
  /** Coulomb friction for ordinary contacts, bounded by the normal push of this substep. */
  friction(h: number, skip: ReadonlySet<number>): void {
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i]; if (q.cn <= 0 || q.w === 0 || skip.has(i)) continue;
      const [sx, sy] = this.surfaceVelocity(q), rx = q.vx - sx, ry = q.vy - sy, tx = q.cny, ty = -q.cnx, vt = rx * tx + ry * ty;
      const limit = q.friction * q.cn / h, change = Math.sign(vt) * Math.min(Math.abs(vt), limit);
      q.vx -= tx * change; q.vy -= ty * change;
    }
  }
}
