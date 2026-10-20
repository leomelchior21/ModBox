/**
 * A compact rigid-body engine in the style of Box2D-lite: boxes and circles, SAT + clipping
 * contacts, sequential impulses with warm starting (stable stacks), restitution, sleeping and
 * impact reporting. Units are meters, y points up.
 */
export interface Vec { x: number; y: number }
export interface Body {
  id: number; shape: 'box' | 'circle'; w: number; h: number; r: number;
  x: number; y: number; angle: number; vx: number; vy: number; w0: number;
  mass: number; invMass: number; invI: number; friction: number; restitution: number;
  awake: boolean; still: number; tag: unknown;
}
interface Contact { x: number; y: number; nx: number; ny: number; sep: number; feature: number; pn: number; pt: number; mn: number; mt: number; bias: number }
interface Arbiter { a: Body; b: Body; contacts: Contact[]; friction: number }

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
const EDGE1 = 1, EDGE2 = 2, EDGE3 = 3, EDGE4 = 4;
interface ClipVertex { x: number; y: number; inE1: number; outE1: number; inE2: number; outE2: number }
const featureKey = (v: ClipVertex) => v.inE1 | v.outE1 << 3 | v.inE2 << 6 | v.outE2 << 9;

function incidentEdge(hx: number, hy: number, px: number, py: number, c: number, s: number, nx: number, ny: number): ClipVertex[] {
  // Normal in the incident box frame, negated.
  const lx = -(c * nx + s * ny), ly = -(-s * nx + c * ny);
  let v: [number, number, number, number, number, number, number, number, number, number, number, number];
  if (Math.abs(lx) > Math.abs(ly)) v = lx > 0 ? [hx, -hy, EDGE3, EDGE4, hx, hy, EDGE4, EDGE1, 0, 0, 0, 0] : [-hx, hy, EDGE1, EDGE2, -hx, -hy, EDGE2, EDGE3, 0, 0, 0, 0];
  else v = ly > 0 ? [hx, hy, EDGE4, EDGE1, -hx, hy, EDGE1, EDGE2, 0, 0, 0, 0] : [-hx, -hy, EDGE2, EDGE3, hx, -hy, EDGE3, EDGE4, 0, 0, 0, 0];
  const world = (x: number, y: number) => ({ x: px + c * x - s * y, y: py + s * x + c * y });
  const a = world(v[0], v[1]), b = world(v[4], v[5]);
  return [{ ...a, inE1: 0, outE1: 0, inE2: v[2], outE2: v[3] }, { ...b, inE1: 0, outE1: 0, inE2: v[6], outE2: v[7] }];
}
function clip(input: ClipVertex[], nx: number, ny: number, offset: number, edge: number): ClipVertex[] {
  const out: ClipVertex[] = [], d0 = nx * input[0].x + ny * input[0].y - offset, d1 = nx * input[1].x + ny * input[1].y - offset;
  if (d0 <= 0) out.push(input[0]); if (d1 <= 0) out.push(input[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1), v: ClipVertex = { ...(d0 > 0 ? input[0] : input[1]), x: input[0].x + t * (input[1].x - input[0].x), y: input[0].y + t * (input[1].y - input[0].y) };
    if (d0 > 0) { v.inE1 = edge; v.inE2 = 0; } else { v.outE1 = edge; v.outE2 = 0; }
    out.push(v);
  }
  return out;
}
function boxBox(A: Body, B: Body): Contact[] {
  const hAx = A.w / 2, hAy = A.h / 2, hBx = B.w / 2, hBy = B.h / 2, cA = Math.cos(A.angle), sA = Math.sin(A.angle), cB = Math.cos(B.angle), sB = Math.sin(B.angle);
  const dpx = B.x - A.x, dpy = B.y - A.y;
  const dAx = cA * dpx + sA * dpy, dAy = -sA * dpx + cA * dpy, dBx = cB * dpx + sB * dpy, dBy = -sB * dpx + cB * dpy;
  // C = RotA^T * RotB
  const c11 = cA * cB + sA * sB, c12 = -cA * sB + sA * cB, c21 = -sA * cB + cA * sB, c22 = sA * sB + cA * cB;
  const a11 = Math.abs(c11), a12 = Math.abs(c12), a21 = Math.abs(c21), a22 = Math.abs(c22);
  const faceAx = Math.abs(dAx) - hAx - (a11 * hBx + a12 * hBy), faceAy = Math.abs(dAy) - hAy - (a21 * hBx + a22 * hBy);
  if (faceAx > 0 || faceAy > 0) return [];
  const faceBx = Math.abs(dBx) - (a11 * hAx + a21 * hAy) - hBx, faceBy = Math.abs(dBy) - (a12 * hAx + a22 * hAy) - hBy;
  if (faceBx > 0 || faceBy > 0) return [];
  let axis = 0, separation = faceAx, nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
  const rel = .95, abs = .01;
  if (faceAy > rel * separation + abs * hAy) { axis = 1; separation = faceAy; nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA; }
  if (faceBx > rel * separation + abs * hBx) { axis = 2; separation = faceBx; nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB; }
  if (faceBy > rel * separation + abs * hBy) { axis = 3; separation = faceBy; nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB; }
  let fnx: number, fny: number, front: number, snx: number, sny: number, negSide: number, posSide: number, negEdge: number, posEdge: number, incident: ClipVertex[];
  if (axis === 0) { fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + hAx; snx = -sA; sny = cA; const side = A.x * snx + A.y * sny; negSide = -side + hAy; posSide = side + hAy; negEdge = EDGE3; posEdge = EDGE1; incident = incidentEdge(hBx, hBy, B.x, B.y, cB, sB, fnx, fny); }
  else if (axis === 1) { fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + hAy; snx = cA; sny = sA; const side = A.x * snx + A.y * sny; negSide = -side + hAx; posSide = side + hAx; negEdge = EDGE2; posEdge = EDGE4; incident = incidentEdge(hBx, hBy, B.x, B.y, cB, sB, fnx, fny); }
  else if (axis === 2) { fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + hBx; snx = -sB; sny = cB; const side = B.x * snx + B.y * sny; negSide = -side + hBy; posSide = side + hBy; negEdge = EDGE3; posEdge = EDGE1; incident = incidentEdge(hAx, hAy, A.x, A.y, cA, sA, fnx, fny); }
  else { fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + hBy; snx = cB; sny = sB; const side = B.x * snx + B.y * sny; negSide = -side + hBx; posSide = side + hBx; negEdge = EDGE2; posEdge = EDGE4; incident = incidentEdge(hAx, hAy, A.x, A.y, cA, sA, fnx, fny); }
  const clip1 = clip(incident, -snx, -sny, negSide, negEdge); if (clip1.length < 2) return [];
  const clip2 = clip(clip1, snx, sny, posSide, posEdge); if (clip2.length < 2) return [];
  const contacts: Contact[] = [];
  for (const v of clip2) {
    const sep = fnx * v.x + fny * v.y - front;
    if (sep > 0) continue;
    let feature = v;
    if (axis >= 2) feature = { ...v, inE1: v.inE2, inE2: v.inE1, outE1: v.outE2, outE2: v.outE1 };
    contacts.push({ x: v.x - sep * fnx, y: v.y - sep * fny, nx, ny, sep, feature: featureKey(feature), pn: 0, pt: 0, mn: 0, mt: 0, bias: 0 });
  }
  return contacts;
}
function circleBox(circle: Body, box: Body, flip: boolean): Contact[] {
  const c = Math.cos(box.angle), s = Math.sin(box.angle), dx = circle.x - box.x, dy = circle.y - box.y, lx = c * dx + s * dy, ly = -s * dx + c * dy, hx = box.w / 2, hy = box.h / 2;
  let px = Math.max(-hx, Math.min(hx, lx)), py = Math.max(-hy, Math.min(hy, ly)), nx: number, ny: number, dist: number;
  if (px === lx && py === ly) { // centre inside: push out through the nearest face
    const ex = hx - Math.abs(lx), ey = hy - Math.abs(ly);
    if (ex < ey) { nx = Math.sign(lx) || 1; ny = 0; px = nx * hx; dist = -ex; } else { nx = 0; ny = Math.sign(ly) || 1; py = ny * hy; dist = -ey; }
  } else { const ox = lx - px, oy = ly - py; dist = Math.hypot(ox, oy); if (dist > circle.r) return []; nx = ox / dist; ny = oy / dist; }
  const wx = c * nx - s * ny, wy = s * nx + c * ny, sep = dist - circle.r;
  const point = { x: circle.x - wx * circle.r, y: circle.y - wy * circle.r };
  return [{ ...point, nx: flip ? -wx : wx, ny: flip ? -wy : wy, sep, feature: 0, pn: 0, pt: 0, mn: 0, mt: 0, bias: 0 }];
}
function circleCircle(A: Body, B: Body): Contact[] {
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6, sep = d - A.r - B.r; if (sep > 0) return [];
  const nx = dx / d, ny = dy / d; return [{ x: A.x + nx * A.r, y: A.y + ny * A.r, nx, ny, sep, feature: 0, pn: 0, pt: 0, mn: 0, mt: 0, bias: 0 }];
}
function collide(A: Body, B: Body): Contact[] {
  if (A.shape === 'box' && B.shape === 'box') return boxBox(A, B);
  if (A.shape === 'circle' && B.shape === 'circle') return circleCircle(A, B);
  return A.shape === 'circle' ? circleBox(A, B, true) : circleBox(B, A, false);
}
function bounds(b: Body) { const e = b.shape === 'circle' ? b.r : Math.hypot(b.w, b.h) / 2; return { minX: b.x - e, maxX: b.x + e, minY: b.y - e, maxY: b.y + e }; }

export class World2D {
  bodies: Body[] = []; gravity = -10; iterations = 10;
  /** Called with the closing speed of every contact that starts this step (for damage and sound). */
  onImpact: ((a: Body, b: Body, speed: number) => void) | null = null;
  private arbiters = new Map<string, Arbiter>(); private nextId = 1;
  add(shape: 'box' | 'circle', x: number, y: number, size: { w?: number; h?: number; r?: number }, density: number, options: Partial<Pick<Body, 'friction' | 'restitution' | 'angle' | 'tag'>> = {}): Body {
    const w = size.w ?? (size.r ?? .5) * 2, h = size.h ?? w, r = size.r ?? 0;
    const area = shape === 'circle' ? Math.PI * r * r : w * h, mass = density > 0 ? density * area : Infinity;
    const inertia = shape === 'circle' ? .5 * mass * r * r : mass * (w * w + h * h) / 12;
    const body: Body = { id: this.nextId++, shape, w, h, r, x, y, angle: options.angle ?? 0, vx: 0, vy: 0, w0: 0, mass, invMass: density > 0 ? 1 / mass : 0, invI: density > 0 ? 1 / inertia : 0,
      friction: options.friction ?? .6, restitution: options.restitution ?? .1, awake: density > 0, still: 0, tag: options.tag };
    this.bodies.push(body); return body;
  }
  remove(body: Body): void { this.bodies = this.bodies.filter(b => b !== body); for (const [key, arb] of this.arbiters) if (arb.a === body || arb.b === body) this.arbiters.delete(key); this.wakeAll(); }
  wakeAll(): void { for (const b of this.bodies) if (b.invMass > 0) { b.awake = true; b.still = 0; } }
  wake(_b: Body): void { this.wakeAll(); }
  /** Pushes everything near a point outward and returns the bodies it reached. */
  explode(x: number, y: number, radius: number, impulse: number): Body[] {
    const hit: Body[] = [];
    for (const b of this.bodies) { if (b.invMass === 0) continue; const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); if (d > radius) continue; const k = impulse * (1 - d / radius) / Math.max(.3, d); b.vx += dx * k * b.invMass; b.vy += dy * k * b.invMass + impulse * .3 * (1 - d / radius) * b.invMass; b.w0 += Math.sin(b.id * 12.9898) * 2; this.wake(b); hit.push(b); }
    return hit;
  }
  step(dt: number): void {
    const invDt = dt > 0 ? 1 / dt : 0, live = new Set<string>();
    const boxes = this.bodies.map(b => ({ b, box: bounds(b) }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.b.invMass === 0 && B.b.invMass === 0 || !A.b.awake && !B.b.awake) continue;
      if (A.box.maxX < B.box.minX || B.box.maxX < A.box.minX || A.box.maxY < B.box.minY || B.box.maxY < A.box.minY) continue;
      const [a, b] = A.b.id < B.b.id ? [A.b, B.b] : [B.b, A.b], key = `${a.id}:${b.id}`, contacts = collide(a, b);
      if (!contacts.length) { this.arbiters.delete(key); continue; }
      live.add(key);
      const old = this.arbiters.get(key);
      if (old) { for (const c of contacts) { const match = old.contacts.find(o => o.feature === c.feature); if (match) { c.pn = match.pn; c.pt = match.pt; } } old.contacts = contacts; }
      else {
        this.arbiters.set(key, { a, b, contacts, friction: Math.sqrt(a.friction * b.friction) });
        // A sleeping body touched by something moving wakes up.
        const speed = Math.hypot(a.vx - b.vx, a.vy - b.vy) + Math.abs(a.w0) + Math.abs(b.w0);
        if (speed > .4 && (!a.awake || !b.awake)) this.wakeAll();
      }
    }
    for (const key of this.arbiters.keys()) if (!live.has(key)) this.arbiters.delete(key);

    for (const b of this.bodies) if (b.invMass > 0 && b.awake) { b.vy += this.gravity * dt; }
    const solving = [...this.arbiters.values()].filter(arb => arb.a.awake && arb.a.invMass > 0 || arb.b.awake && arb.b.invMass > 0);
    const im = (b: Body) => b.awake ? b.invMass : 0, ii = (b: Body) => b.awake ? b.invI : 0;
    for (const arb of solving) {
      const { a, b } = arb;
      for (const c of arb.contacts) {
        const r1x = c.x - a.x, r1y = c.y - a.y, r2x = c.x - b.x, r2y = c.y - b.y;
        const rn1 = r1x * c.nx + r1y * c.ny, rn2 = r2x * c.nx + r2y * c.ny;
        c.mn = 1 / (im(a) + im(b) + ii(a) * (r1x * r1x + r1y * r1y - rn1 * rn1) + ii(b) * (r2x * r2x + r2y * r2y - rn2 * rn2));
        const tx = c.ny, ty = -c.nx, rt1 = r1x * tx + r1y * ty, rt2 = r2x * tx + r2y * ty;
        c.mt = 1 / (im(a) + im(b) + ii(a) * (r1x * r1x + r1y * r1y - rt1 * rt1) + ii(b) * (r2x * r2x + r2y * r2y - rt2 * rt2));
        const dvx = b.vx - b.w0 * r2y - a.vx + a.w0 * r1y, dvy = b.vy + b.w0 * r2x - a.vy - a.w0 * r1x, vn = dvx * c.nx + dvy * c.ny;
        c.bias = -.2 * invDt * Math.min(0, c.sep + .01);
        if (vn < -1.2) { c.bias = Math.max(c.bias, -Math.max(a.restitution, b.restitution) * vn); if (c.pn === 0) this.onImpact?.(a, b, -vn); }
        const px = c.pn * c.nx + c.pt * tx, py = c.pn * c.ny + c.pt * ty;
        a.vx -= im(a) * px; a.vy -= im(a) * py; a.w0 -= ii(a) * cross(r1x, r1y, px, py);
        b.vx += im(b) * px; b.vy += im(b) * py; b.w0 += ii(b) * cross(r2x, r2y, px, py);
      }
    }
    for (let it = 0; it < this.iterations; it++) for (const arb of solving) {
      const { a, b } = arb;
      for (const c of arb.contacts) {
        const r1x = c.x - a.x, r1y = c.y - a.y, r2x = c.x - b.x, r2y = c.y - b.y;
        let dvx = b.vx - b.w0 * r2y - a.vx + a.w0 * r1y, dvy = b.vy + b.w0 * r2x - a.vy - a.w0 * r1x;
        let dPn = c.mn * (-(dvx * c.nx + dvy * c.ny) + c.bias); const pn0 = c.pn; c.pn = Math.max(pn0 + dPn, 0); dPn = c.pn - pn0;
        let px = dPn * c.nx, py = dPn * c.ny;
        a.vx -= im(a) * px; a.vy -= im(a) * py; a.w0 -= ii(a) * cross(r1x, r1y, px, py); b.vx += im(b) * px; b.vy += im(b) * py; b.w0 += ii(b) * cross(r2x, r2y, px, py);
        dvx = b.vx - b.w0 * r2y - a.vx + a.w0 * r1y; dvy = b.vy + b.w0 * r2x - a.vy - a.w0 * r1x;
        const tx = c.ny, ty = -c.nx, maxPt = arb.friction * c.pn; let dPt = c.mt * -(dvx * tx + dvy * ty); const pt0 = c.pt; c.pt = Math.max(-maxPt, Math.min(maxPt, pt0 + dPt)); dPt = c.pt - pt0;
        px = dPt * tx; py = dPt * ty;
        a.vx -= im(a) * px; a.vy -= im(a) * py; a.w0 -= ii(a) * cross(r1x, r1y, px, py); b.vx += im(b) * px; b.vy += im(b) * py; b.w0 += ii(b) * cross(r2x, r2y, px, py);
      }
    }
    for (const b of this.bodies) {
      if (b.invMass === 0 || !b.awake) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.angle += b.w0 * dt;
      b.w0 *= 1 - Math.min(1, dt * .15);
      b.still = Math.hypot(b.vx, b.vy) < .08 && Math.abs(b.w0) < .08 ? b.still + dt : 0;
    }
    // Sleep is all-or-nothing: once every body has settled, the whole scene freezes until disturbed.
    // (Partly sleeping stacks would feed inconsistent impulses into the solver.)
    const dynamic = this.bodies.filter(b => b.invMass > 0 && b.awake);
    if (dynamic.length && dynamic.every(b => b.still > .7)) for (const b of dynamic) { b.awake = false; b.vx = b.vy = b.w0 = 0; }
  }
}
