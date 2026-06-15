// render.js — 렌더 트랙의 그리기 구현. 공용 단일 뷰어(HGO/viewer.html)가 이 모듈을 load 해
//   캔버스 렌더링을 *위임*한다(SPINE §6.1 단일 뷰어 — 뷰어를 클론하지 않는다).
//   렌더는 atom 스냅샷(atoms·photons)을 *읽기만* 한다 — 위치·양은 sim 그대로, 색만 번역.
//
// 렌즈 L-3d: 평면 세계를 *원근 3D 무대*로 번역한다. 시뮬은 위치가 2D(rx,ry) 뿐이므로
//   z 를 시뮬 양에서 author 하지 않는다(RENDER §3 — 없는 실루엣 금지). 모든 개체는 평면 z=0 에
//   그대로 두고(위치=sim (rx,ry,0)), *표현만* 입체화한다: 원자=음영 구(球), 광자=발광 빌보드,
//   z=0 바닥 격자, 궤도 카메라. 색은 여전히 L-λ(광자 λ→스펙트럼, spectral.js)에서 *읽는다*.
//   원 vs 구·평행 vs 원근은 프레젠테이션 선택일 뿐 — 분포 재성형 0, 시뮬 객체 비변경.
//
// 렌즈 L-line: 하단 스펙트럼 띠를 *유무*에서 *세기*로 정제한다(읽기 정제 — 새 시뮬 양 0).
//   spectral.measureLines 가 광자를 전이선(from→to)별로 빈도 집계 → 선 밝기 = 빈도/최대빈도(측정 정규화).
//   실측 분광기처럼 강한 전이는 밝고 약한 전이는 흐리다 — 세는 것이지 author 가 아니다.
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGORender = root.HGORender || {}).render = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── 순수 3D 수학 (캔버스 무관 — 헤드리스로 검증 가능) ──────────────────────────
  // 세계 좌표: x,y = 시뮬 평면(rx,ry) · z = 높이(항상 0, 시뮬에 z 없음). worldUp=(0,0,1).
  // ── 인터랙티브 카메라 상태(렌즈 L-cam) — 프레젠테이션 한 항(시뮬 무관·결정론 영향 0) ──
  //   사용자가 마우스로 뷰를 자유 변경: 드래그=궤도(yaw·pitch)·휠=줌(distScale)·우드래그|Shift드래그=팬(target).
  //   카메라는 평면 중심을 타깃으로 방위각·고도로 궤도. 위치=sim (rx,ry,0) 그대로 — 분포 author 0.
  const camState = { yaw: 0.6, pitch: 0.78, distScale: 1.85, panX: 0, panY: 0 };

  function makeCamera(W, H, tick, cv) {
    const target = { x: W / 2 + camState.panX, y: H / 2 + camState.panY, z: 0 };
    const yaw = camState.yaw;                  // 3/4 뷰 기본 — 마우스로 자유 변경
    const pitch = camState.pitch;              // 고도(드래그 상하로 조절·짐벌락 회피 클램프)
    const dist = camState.distScale * Math.max(W, H);   // 카메라 거리(휠 줌)
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

  // 마우스로 카메라를 조종한다(공용 뷰어가 1회 배선). onChange = 정지 중에도 다시 그리게 하는 콜백.
  function attachControls(canvas, onChange) {
    if (canvas._hgoCamBound) return;          // 중복 바인딩 방지
    canvas._hgoCamBound = true;
    let drag = null;
    const redraw = () => { if (typeof onChange === 'function') onChange(); };
    canvas.addEventListener('mousedown', e => {
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
      e.preventDefault();
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());   // 우드래그 팬용
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) {                          // 화면 드래그 → 평면 팬(거리 비례)
        camState.panX -= dx * camState.distScale * 0.09;
        camState.panY += dy * camState.distScale * 0.09;
      } else {                                 // 궤도 회전
        camState.yaw -= dx * 0.008;
        camState.pitch = Math.max(0.05, Math.min(1.5, camState.pitch + dy * 0.006));  // 짐벌락 회피
      }
      redraw();
    });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('wheel', e => {    // 휠 줌(지수 — 부드러운 배율)
      camState.distScale = Math.max(0.3, Math.min(8, camState.distScale * Math.exp(e.deltaY * 0.001)));
      e.preventDefault(); redraw();
    }, { passive: false });
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

  // 측정된 스펙트럼선을 캔버스 하단 띠로(실제 분광기의 창발 — 색=λ, 밝기=세기). 화면 고정 HUD.
  //   렌즈 L-line: 선은 *유무*가 아니라 *세기*(전이별 광자 빈도)를 보인다 — measureLines 가
  //   from→to 별로 집계, maxCount(데이터에서 잰 최댓값)로 정규화. 강한 선=밝고, 약한 선=흐리게.
  function drawStrip(ctx, sim, SP, range, W, H) {
    const h = 18, y0 = H - h;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, y0, W, h);
    const { lines, maxCount } = SP.measureLines(sim.photons);
    for (const ln of lines) {
      const nm = SP.lambdaToNm(ln.lambda, range.lo, range.hi);
      const x = ((nm - 400) / 300) * W;
      const [cr, cg, cb] = SP.wavelengthToRGB(nm);
      // 세기 = 빈도/최대빈도 (측정 정규화). 약한 선도 식별되게 바닥 밝기 0.25 부여 후 세기로 가산.
      const inten = maxCount > 0 ? ln.count / maxCount : 1;
      const a = 0.25 + 0.75 * inten;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
      ctx.fillRect(x - 2, y0, 4, h);
    }
  }

  return { draw, makeCamera, project, attachControls, camState };
});
