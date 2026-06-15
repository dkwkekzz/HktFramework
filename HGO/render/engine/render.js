// render.js — 렌더 트랙의 그리기 구현. 공용 단일 뷰어(HGO/viewer.html)가 이 모듈을 load 해
//   캔버스 렌더링을 *위임*한다(SPINE §6.1 단일 뷰어 — 뷰어를 클론하지 않는다).
//   렌더는 atom 스냅샷(atoms·photons)을 *읽기만* 한다 — 위치·양은 sim 그대로, 색만 번역.
//
// 렌즈 L-3d: 평면 세계를 *원근 3D 무대*로 번역한다. 시뮬은 위치가 2D(rx,ry) 뿐이므로
//   z 를 시뮬 양에서 author 하지 않는다(RENDER §3 — 없는 실루엣 금지). 모든 개체는 평면 z=0 에
//   그대로 두고(위치=sim (rx,ry,0)), *표현만* 입체화한다: 원자=음영 구(球), 광자=발광 빌보드,
//   z=0 바닥 격자, 궤도 카메라. 색은 여전히 L-λ(광자 λ→스펙트럼, spectral.js)에서 *읽는다*.
//   원 vs 구·평행 vs 원근은 프레젠테이션 선택일 뿐 — 분포 재성형 0, 시뮬 객체 비변경.
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGORender = root.HGORender || {}).render = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── 순수 3D 수학 (캔버스 무관 — 헤드리스로 검증 가능) ──────────────────────────
  // 세계 좌표: x,y = 시뮬 평면(rx,ry) · z = 높이(항상 0, 시뮬에 z 없음). worldUp=(0,0,1).
  // 카메라는 평면 중심을 타깃으로 방위각(yaw)·고도(pitch)로 궤도. yaw 는 sim.tick 에서 파생
  //   → 상태 없음·결정론(같은 tick → 같은 화면). 재성형이 아니라 카메라 한 항(프레젠테이션).
  function makeCamera(W, H, tick, cv) {
    const target = { x: W / 2, y: H / 2, z: 0 };
    const yaw = 0.6 + (tick || 0) * 0.008;   // 3/4 뷰에서 출발해 재생 중 천천히 선회
    const pitch = 0.78;                       // 고도 ≈45° — 평면을 내려다봄
    const dist = 1.85 * Math.max(W, H);       // 카메라 거리
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // 카메라 위치 = 타깃에서 방위·고도 방향으로 dist 만큼
    const eye = { x: target.x + dist * cp * cy, y: target.y + dist * cp * sy, z: target.z + dist * sp };
    // 카메라 기저: forward(타깃 향함)·right·up
    const f = norm(sub(target, eye));
    const right = norm(cross(f, { x: 0, y: 0, z: 1 }));
    const up = cross(right, f);
    const focal = 1.5 * (cv ? cv.width : 560);
    const cw = cv ? cv.width : 560, ch = cv ? cv.height : 560;
    return { eye, f, right, up, focal, cw, ch };
  }

  // 세계 점 → 화면 {sx,sy,depth,scale}. depth=카메라 전방 거리(클수록 멀다·painter 정렬 키).
  function project(p, cam) {
    const rel = { x: p.x - cam.eye.x, y: p.y - cam.eye.y, z: (p.z || 0) - cam.eye.z };
    const depth = dot(rel, cam.f);            // 전방 성분(>0 = 카메라 앞)
    const cx = dot(rel, cam.right), cy = dot(rel, cam.up);
    const scale = cam.focal / Math.max(depth, 1e-3);   // 원근 축소율
    return { sx: cam.cw / 2 + cx * scale, sy: cam.ch / 2 - cy * scale, depth, scale };
  }

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function norm(a) { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }

  // ── 그리기 (단일 뷰어가 매 프레임 호출: draw(ctx, sim, K). 상태 없음 — 스냅샷만 읽음) ──
  function draw(ctx, sim, K) {
    const SP = (typeof globalThis !== 'undefined' ? globalThis : this).HGORender.spectral;
    const cv = ctx.canvas;
    const cam = makeCamera(sim.W, sim.H, sim.tick, cv);

    // 검은 무대
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, cv.width, cv.height);

    drawGrid(ctx, sim, cam);   // z=0 바닥 격자(입체 기준선 — 시뮬 양 아님, 무대 장치)

    // 개체 수집 후 painter 정렬(먼 것 먼저). 위치=sim (rx,ry,0) 그대로.
    const draws = [];
    for (const a of sim.atoms) {
      const pr = project({ x: a.rx, y: a.ry, z: 0 }, cam);
      if (pr.depth <= 0) continue;
      draws.push({ depth: pr.depth, kind: 'atom', a, pr });
    }
    const range = SP.measureRange(sim.photons) || { lo: 1, hi: 2 };
    for (const p of sim.photons) {
      const pr = project({ x: p.rx, y: p.ry, z: 0 }, cam);
      if (pr.depth <= 0) continue;
      draws.push({ depth: pr.depth, kind: 'photon', p, pr });
    }
    draws.sort((u, v) => v.depth - u.depth);

    for (const d of draws) {
      if (d.kind === 'atom') drawAtom(ctx, d.a, d.pr, K);
      else drawPhoton(ctx, SP, d.p, d.pr, range);
    }
    ctx.globalCompositeOperation = 'source-over';

    drawStrip(ctx, sim, SP, range, cv.width, cv.height);   // 측정 스펙트럼 띠(2D HUD 오버레이)
  }

  // 원자 = 음영 구(球). 반지름 = 질량(Z+N) — 읽기. 들뜸 x>0 = 더 밝게. 색 author 0.
  function drawAtom(ctx, a, pr, K) {
    const wr = 1.5 + Math.sqrt(K.mass(a));     // 세계 반지름(질량에서 읽음)
    const r = Math.max(1.2, wr * pr.scale);    // 화면 반지름(원근 축소)
    const excited = (a.x | 0) > 0;
    const base = excited ? [0x39, 0x40, 0x5a] : [0x20, 0x24, 0x2f];
    // 좌상단 광원 가정한 라디얼 그래디언트로 구의 입체감(프레젠테이션, 시뮬 양 아님)
    const g = ctx.createRadialGradient(pr.sx - r * 0.35, pr.sy - r * 0.35, r * 0.1, pr.sx, pr.sy, r);
    const hi = base.map(v => Math.min(255, v + (excited ? 70 : 45)));
    g.addColorStop(0, `rgb(${hi[0]},${hi[1]},${hi[2]})`);
    g.addColorStop(1, `rgb(${base[0]},${base[1]},${base[2]})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pr.sx, pr.sy, r, 0, 6.2832); ctx.fill();
  }

  // 광자 = 색 있는 발광 빌보드(가법 합성). 색 = λ → 스펙트럼(측정 범위 정규화 — L-λ 읽기).
  function drawPhoton(ctx, SP, p, pr, range) {
    const [cr, cg, cb] = SP.photonColor(p.lambda, range);
    const rad = Math.max(2.5, 6 * pr.scale);
    const g = ctx.createRadialGradient(pr.sx, pr.sy, 0, pr.sx, pr.sy, rad);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pr.sx, pr.sy, rad, 0, 6.2832); ctx.fill();
  }

  // z=0 바닥 격자 — 평면을 원근으로 그어 입체 기준을 준다(무대 장치, 시뮬 양 0).
  function drawGrid(ctx, sim, cam) {
    const N = 10, W = sim.W, H = sim.H;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(60,70,100,0.25)';
    ctx.lineWidth = 1;
    const line = (ax, ay, bx, by) => {
      const a = project({ x: ax, y: ay, z: 0 }, cam), b = project({ x: bx, y: by, z: 0 }, cam);
      if (a.depth <= 0 || b.depth <= 0) return;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
    };
    for (let i = 0; i <= N; i++) {
      const x = (W * i) / N, y = (H * i) / N;
      line(x, 0, x, H);   // 세로선
      line(0, y, W, y);   // 가로선
    }
  }

  // 측정된 스펙트럼선을 캔버스 하단 띠로(실제 스펙트럼선의 창발 — 색=λ). 화면 고정 HUD.
  function drawStrip(ctx, sim, SP, range, W, H) {
    const h = 14, y0 = H - h;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, y0, W, h);
    const lines = new Map();   // 'from→to' → lambda (중복 제거)
    for (const p of sim.photons) lines.set(p.from + '→' + p.to, p.lambda);
    for (const lambda of lines.values()) {
      const nm = SP.lambdaToNm(lambda, range.lo, range.hi);
      const x = ((nm - 400) / 300) * W;
      const [cr, cg, cb] = SP.wavelengthToRGB(nm);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x - 2, y0, 4, h);
    }
  }

  return { draw, makeCamera, project };
});
