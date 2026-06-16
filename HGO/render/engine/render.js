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
//
// 렌즈 L-recoil: 광자 *진행 방향*(운동량 px,py = p=E/c, 시뮬 step-0003 recoil·0004 propagate 가 실음)을
//   읽어 *빛 줄기/이방성*으로 번역한다. 줄기 방향 = 운동량 방향(읽기), 줄기 길이 ∝ |p|(측정 정규화 — maxP).
//   px=py=0 광자(방출만 한 step-0002)는 *방향이 없으니 줄기를 author 하지 않는다*(빌보드 점만). 위치=sim 그대로.
//
// 렌즈 L-bond: 시뮬이 내보낸 *결합 목록*(sim.bonds = [i,j] 원자쌍 — 연결 성분의 간선, step-0010 bond·0012 valence)을
//   읽어 결합한 두 원자를 잇는 *선*으로 번역한다 — 분자 윤곽은 시뮬이 측정한 연결성에서 창발한다.
//   *어느 원자가 결합인가*는 읽기(sim.bonds), 선은 그 연결을 보일 뿐(분포·실루엣 author 0). 위치=두 원자의 sim (rx,ry,0) 그대로.
//   결합이 없으면(sim.bonds 비었거나 결합 0) 선을 author 하지 않는다 — 격자처럼 구조선(시뮬 양 아닌 무대 장치 색).
//
// 렌즈 L-trail: 광자가 *실제로 난 경로*를 읽는다 — 출생 위치(rx0,ry0)→현 위치(rx,ry)의 변위(step-0004 propagate·0007 escape).
//   L-recoil 줄기는 |p| 를 고른 창(STREAK_FRAC)에 정규화한 *글리프*였다(방향만). 트레일은 시뮬이 굴린 *실제 이동 거리*를
//   그대로 읽어 잇는다(길이=측정 변위, 손박은 창 0) — 빛이 공간을 가른 자취. 변위 0(갓 방출된 step-0002 광자: rx0==rx)이면
//   트레일을 author 하지 않는다(점만). 머리=현 위치(밝음)→꼬리=출생(투명). 색은 여전히 L-λ(λ→스펙트럼) 읽기.
//
// 렌즈 L-glow: 원자 *들뜸 준위*(x = 양자수 0,1,2,3 …)를 *광원 밝기*로 읽는다(입력 계약 §2: 들뜸 x=광원 밝기).
//   이전엔 x 를 불리언(들뜸 유무)으로만 읽어 x=1 과 x=3 이 같아 보였다 — 이제 측정 최댓값(maxX)으로 정규화한
//   *등급* 글로우로: 더 들뜬 원자가 더 밝게 발광한다(읽기). x=0(바닥 상태)이면 글로우 0(빛 author 0).
//   밝기만 읽고 색은 중립 온백(presentation — hue author 0, "E=밝기"와 동형 magnitude 채널). 정규화는 측정.
//
// 렌즈 L-order: 시뮬이 내보낸 *결합 차수*(sim.bonds[k][3] = order ∈ {1,2,3} = 공유 전자쌍 수,
//   step-0018 bondOrder 가 빈자리만큼 다중 공유를 측정해 실음 — O=O 이중·N≡N 삼중)를 읽어
//   결합선을 그 차수만큼 *평행 복제*한다(단일 1줄·이중 2줄·삼중 3줄). 차수는 시뮬 측정값(읽기) —
//   평행선 글리프는 그 수를 보일 뿐(분포·실루엣 author 0). 차수가 없는 결합(step-0010~12, bond[3]===undefined)은
//   단일선(order 1, 종전 L-bond 와 동일) — 시뮬이 안 내보낸 차수를 근사로 author 하지 않는다(RENDER §3).
//
// 렌즈 L-Ebond: 시뮬이 내보낸 *결합 에너지*(sim.bonds[k][2]=Eabs = 결합에 국소화된 E, step-0015 bondLocalE 가 실음)를
//   읽어 결합선 *밝기*로 번역한다(magnitude 채널 — "광자 E=밝기"·"들뜸 x=밝기"와 동형). 측정 최댓값(maxE)으로
//   정규화한 등급 밝기: 강한 결합일수록 밝게. 색조는 중립 청백(hue author 0 — 밝기만 읽음). Eabs 없는 결합
//   (step-0010~12, bond[2]===undefined)이거나 E=0 이면 기본 구조선 톤(밝기 0 가산 — 시뮬이 안 낸 E author 0).
//
// 렌즈 L-element: 시뮬이 내보낸 *양성자 수* Z(= 원소 정체성, atoms 채널)를 원자 구의 *색조*(hue)로 읽는다.
//   지금까지 구의 색은 들뜸 x(밝기, L-glow)만 실었고 Z 는 *크기*(질량 Z+N)에만 쓰여, 핵 변환(붕괴·융합)이
//   Z+N 보존(β붕괴)·정지 무대에선 화면에 *안 보였다* — 바뀌는 건 Z 뿐인데 색 채널이 없었다.
//   L-element 가 Z 를 색조로 읽으면 *원소가 바뀌면 색이 바뀐다*(탄소→질소→산소 …): 붕괴·융합이 색 이동으로 보인다.
//   author 0: 종류별 색 박기(`if(Z==8) 파랑`)가 아니라 *측정 Z 범위*[lo,hi]를 색조 창에 정규화하는 *연속 사상*
//   (λ→가시광 창과 동형). 변이 없는 장면(단일 원소 → 범위 0)은 중립 무채색(가짜 색 author 0). 밝기는 여전히 들뜸 x(L-glow, 직교 채널).
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

  // ── 렌즈 L-recoil: 광자 운동량(px,py) → 빛 줄기 기하 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 줄기 세계 길이 창: 단위 운동량 줄기 길이를 장면 크기에 비례시킨다(데이터에서 잰 창 — λ→nm 창과 동형).
  const STREAK_FRAC = 0.08;

  // 광자 배열에서 운동량 크기 최댓값을 *측정*(정규화 기준 — 손박은 임계 0). 방향 없으면 0.
  function measureMaxMomentum(photons) {
    let m = 0;
    for (const p of photons) { const mag = Math.hypot(p.px || 0, p.py || 0); if (mag > m) m = mag; }
    return m;
  }

  // ── 렌즈 L-glow: 원자 들뜸 준위 x → 광원 밝기 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 들뜸 준위 최댓값을 *측정*(등급 정규화 기준 — 손박은 임계 0). 들뜬 원자 없으면 0.
  function measureMaxExcitation(atoms) {
    let m = 0;
    for (const a of atoms) { const x = a.x | 0; if (x > m) m = x; }
    return m;
  }

  // 들뜸 준위 x 를 측정 최댓값으로 정규화한 *광원 밝기* ∈[0,1](등급 — 불리언 아님).
  //   maxX=0(들뜸 없음) 또는 x=0(바닥 상태)이면 0 — 빛을 author 하지 않는다(RENDER §3).
  function excitationGlow(x, maxX) {
    if (!(maxX > 0) || !(x > 0)) return 0;
    return Math.min(1, x / maxX);
  }

  // ── 렌즈 L-element: 원자 양성자 수 Z(원소 정체성) → 색조 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 색조 창(presentation): 저 Z → 파랑(0.66)·고 Z → 빨강(0). λ→가시광 창과 동형 — 측정 범위를 창에 정규화.
  const ELEMENT_HUE_LO = 0.66;   // 측정 최저 Z 의 색조(파랑)
  const ELEMENT_HUE_REF = 0.58;  // 단일 원소(범위 0)일 때 중립 기준 색조(변이 author 0)

  // 원자 배열에서 Z 범위를 *측정*(색조 정규화 기준 — 손박은 임계 0). 원자 없으면 {lo:0,hi:0}.
  function measureZRange(atoms) {
    let lo = Infinity, hi = -Infinity;
    for (const a of atoms) { const z = a.Z | 0; if (z < lo) lo = z; if (z > hi) hi = z; }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 0 };
    return { lo, hi };
  }

  // Z 를 측정 범위[lo,hi]로 정규화한 색조 ∈[0,1](연속 사상 — 종류별 색 박기 0).
  //   범위 0(단일 원소 — 변이 없음)이면 중립 기준 색조: 시뮬에 없는 색 변이를 author 하지 않는다(RENDER §3).
  function elementHue(Z, lo, hi) {
    if (!(hi > lo)) return ELEMENT_HUE_REF;
    const t = ((Z | 0) - lo) / (hi - lo);             // 측정 정규화 ∈[0,1]
    return ELEMENT_HUE_LO * (1 - Math.max(0, Math.min(1, t)));
  }

  // HSV → RGB(0..255) — 색조를 화면 색으로(presentation 변환, 분포 재성형 0).
  function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (((i % 6) + 6) % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // 광자 → 화면 줄기 {head,tail,mag,L}. 머리=현 위치(밝음)·꼬리=운동량 반대(자취). 길이 ∝ |p|/maxP.
  //   운동량이 0(방향 없음)이면 null — 줄기를 author 하지 않는다(RENDER §3). 운동량은 평면(z=0) 2D.
  function photonStreak(p, cam, maxP, worldLen) {
    const mag = Math.hypot(p.px || 0, p.py || 0);
    if (!(mag > 1e-9)) return null;
    const inv = 1 / mag;
    const dir = { x: p.px * inv, y: p.py * inv };           // 정규화 진행 방향(읽기)
    const L = (maxP > 0 ? mag / maxP : 1) * worldLen;       // 줄기 세계 길이(측정 정규화)
    const head = project({ x: p.rx, y: p.ry, z: 0 }, cam);
    const tail = project({ x: p.rx - dir.x * L, y: p.ry - dir.y * L, z: 0 }, cam);   // 자취=−방향
    return { head, tail, mag, L };
  }

  // ── 렌즈 L-trail: 광자 출생(rx0,ry0)→현 위치(rx,ry) 실제 전파 경로 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 운동량 줄기(L-recoil)가 정규화 글리프였다면, 트레일은 시뮬이 굴린 *실제 변위*를 그대로 읽는다.
  //   변위 0(방출만)이거나 출생/현재가 카메라 뒤(depth≤0)면 null — 경로를 author 하지 않는다(RENDER §3). 평면(z=0).
  function photonTrail(p, cam) {
    if (p.rx0 === undefined || p.ry0 === undefined) return null;
    const dx = p.rx - p.rx0, dy = p.ry - p.ry0;
    if (!(Math.hypot(dx, dy) > 1e-9)) return null;          // 변위 없음(갓 방출) → 트레일 0(author 0)
    const head = project({ x: p.rx, y: p.ry, z: 0 }, cam);    // 머리 = 현 위치(밝음)
    const tail = project({ x: p.rx0, y: p.ry0, z: 0 }, cam);  // 꼬리 = 출생 위치(자취 끝)
    if (head.depth <= 0 || tail.depth <= 0) return null;
    return { head, tail };
  }

  // ── 렌즈 L-bond: 결합 [i,j] → 화면 선분 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 결합쌍의 두 원자(인덱스)를 투영해 잇는 선분 {a,b} 를 돌려준다. 인덱스가 무효(없는 원자)거나
  //   카메라 뒤(depth≤0)면 null — 결합을 author 하지 않는다(RENDER §3). 위치=두 원자의 sim (rx,ry,0) 그대로.
  function bondSegment(bond, sim, cam) {
    const a = sim.atoms[bond[0]], b = sim.atoms[bond[1]];
    if (!a || !b) return null;
    const pa = project({ x: a.rx, y: a.ry, z: 0 }, cam);
    const pb = project({ x: b.rx, y: b.ry, z: 0 }, cam);
    if (pa.depth <= 0 || pb.depth <= 0) return null;
    return { a: pa, b: pb };
  }

  // ── 렌즈 L-order: 결합 차수(sim.bonds[k][3]) → 다중 평행선 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 결합 차수를 *읽는다*(없으면 1 — 단일선, author 0). 정수 ≥1 로 클램프(읽기 충실).
  //   step-0018 bondOrder 가 [i,j,Eabs,order] 로 실음 · 그 전 장면(step-0010~12)은 [i,j] → order undefined → 1.
  function bondOrder(bond) {
    const o = bond[3];
    if (!Number.isFinite(o) || o < 1) return 1;
    return Math.round(o);
  }

  // ── 렌즈 L-Ebond: 결합 에너지(sim.bonds[k][2]=Eabs) → 결합선 밝기 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 결합 배열에서 결합 E 최댓값을 *측정*(등급 정규화 기준 — 손박은 임계 0). Eabs 없는 결합은 0 취급.
  function measureMaxBondEnergy(bonds) {
    let m = 0;
    for (const b of bonds) { const e = b[2]; if (Number.isFinite(e) && e > m) m = e; }
    return m;
  }

  // 결합 E 를 읽는다(없거나 음수면 0 — 시뮬이 안 낸 E author 0). Eabs = bond[2].
  function bondEnergy(bond) {
    const e = bond[2];
    return (Number.isFinite(e) && e > 0) ? e : 0;
  }

  // 결합 E 를 측정 최댓값으로 정규화한 *밝기* ∈[0,1](등급). maxE=0 또는 E=0 이면 0(밝기 가산 0 — author 0).
  function bondGlow(E, maxE) {
    if (!(maxE > 0) || !(E > 0)) return 0;
    return Math.min(1, E / maxE);
  }

  // 화면 선분 {a,b} 를 차수만큼 *평행 복제*한다 — 결합 축에 수직으로 ±sepPx 오프셋(중심 대칭).
  //   order=1 → [중심 1줄] · order=2 → [±sep/2] · order=3 → [−sep,0,+sep]. 평행선 간격은 presentation
  //   (lineWidth 와 동형 글리프 창 — 측정 양 아님). 순수 화면 수학(분포 재성형 0).
  function bondMultiline(seg, order, sepPx) {
    const n = Math.max(1, order | 0);
    const dx = seg.b.sx - seg.a.sx, dy = seg.b.sy - seg.a.sy;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;          // 결합 축에 수직인 단위 벡터(평행 오프셋 방향)
    const lines = [];
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * sepPx;      // 중심 대칭 오프셋
      lines.push({
        a: { sx: seg.a.sx + px * off, sy: seg.a.sy + py * off },
        b: { sx: seg.b.sx + px * off, sy: seg.b.sy + py * off },
      });
    }
    return lines;
  }

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
    drawBonds(ctx, sim, cam);  // 결합선(분자 윤곽 — sim.bonds 읽기, 구의 하층에 깔아 연결을 보임)

    // 개체 수집 후 painter 정렬(먼 것 먼저). 위치=sim (rx,ry,0) 그대로.
    const draws = [];
    const maxX = measureMaxExcitation(sim.atoms);                  // 들뜸 글로우 정규화 기준(측정)
    const zRange = measureZRange(sim.atoms);                       // 원소 색조 정규화 기준(측정 Z 범위 — L-element)
    for (const a of sim.atoms) {
      const pr = project({ x: a.rx, y: a.ry, z: 0 }, cam);
      if (pr.depth <= 0) continue;
      draws.push({ depth: pr.depth, kind: 'atom', a, pr });
    }
    const range = SP.measureRange(sim.photons) || { lo: 1, hi: 2 };
    const maxP = measureMaxMomentum(sim.photons);                  // 운동량 정규화 기준(측정)
    const streakWorld = STREAK_FRAC * Math.max(sim.W, sim.H);      // 줄기 길이 창(장면 크기 비례)
    for (const p of sim.photons) {
      const pr = project({ x: p.rx, y: p.ry, z: 0 }, cam);
      if (pr.depth <= 0) continue;
      draws.push({ depth: pr.depth, kind: 'photon', p, pr });
    }
    draws.sort((u, v) => v.depth - u.depth);

    for (const d of draws) {
      if (d.kind === 'atom') drawAtom(ctx, d.a, d.pr, K, maxX, zRange);
      else drawPhoton(ctx, SP, d.p, d.pr, range, photonStreak(d.p, cam, maxP, streakWorld), photonTrail(d.p, cam));
    }
    ctx.globalCompositeOperation = 'source-over';

    drawStrip(ctx, sim, SP, range, cv.width, cv.height);   // 측정 스펙트럼 띠(2D HUD 오버레이)
  }

  // 원자 = 음영 구(球). 반지름 = 질량(Z+N) — 읽기.
  //   렌즈 L-glow: 들뜸 *준위* x(0..maxX 양자수)를 *광원 밝기*로 등급 읽기 — 불리언(유무) 아님.
  //     exc=x/maxX∈[0,1](측정 정규화). x=0 이면 글로우 0(빛 author 0).
  //   렌즈 L-element: 양성자 수 Z(원소 정체성)를 *색조*로 등급 읽기(측정 Z 범위 정규화) — 원소 바뀌면 색 바뀜.
  //     색조와 밝기는 직교: hue=Z(원소)·value=들뜸 x. 변이 없는 장면(범위 0)은 무채색(가짜 색 author 0).
  function drawAtom(ctx, a, pr, K, maxX, zRange) {
    const wr = 1.5 + Math.sqrt(K.mass(a));     // 세계 반지름(질량에서 읽음)
    const r = Math.max(1.2, wr * pr.scale);    // 화면 반지름(원근 축소)
    const exc = excitationGlow(a.x | 0, maxX); // 들뜸 준위 → 광원 밝기 ∈[0,1](측정 등급)
    const zr = zRange || { lo: 0, hi: 0 };
    const spread = zr.hi > zr.lo;              // 측정 Z 변이 존재 여부(없으면 무채색 — author 0)
    const hue = elementHue(a.Z | 0, zr.lo, zr.hi);   // 원소 → 색조(연속 사상·측정 정규화)
    const sat = spread ? 0.55 : 0.12;          // 변이 없으면 거의 무채색(시뮬에 없는 색 author 0)
    const val = 0.16 + 0.22 * exc;             // 들뜸이 밝기 — L-glow 채널 유지(직교)
    const base = hsvToRgb(hue, sat, val);      // 색조=원소(Z)·밝기=들뜸(x)
    // 좌상단 광원 가정한 라디얼 그래디언트로 구의 입체감(프레젠테이션, 시뮬 양 아님)
    const g = ctx.createRadialGradient(pr.sx - r * 0.35, pr.sy - r * 0.35, r * 0.1, pr.sx, pr.sy, r);
    const hi = base.map(v => Math.min(255, v + 45 + Math.round(40 * exc)));  // 들뜸↑ → 하이라이트↑
    g.addColorStop(0, `rgb(${hi[0]},${hi[1]},${hi[2]})`);
    g.addColorStop(1, `rgb(${base[0]},${base[1]},${base[2]})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pr.sx, pr.sy, r, 0, 6.2832); ctx.fill();
    // 발광 헤일로 = 들뜸 준위에 비례하는 광원 밝기(읽기 — magnitude 채널). 색은 중립 온백(hue author 0).
    //   x=0(바닥)이면 헤일로 0 — 들뜨지 않은 원자는 빛을 author 하지 않는다.
    if (exc > 0) {
      const hr = r * (1.4 + 1.2 * exc);        // 헤일로 반경도 준위에 비례(밝을수록 멀리)
      const gh = ctx.createRadialGradient(pr.sx, pr.sy, r * 0.5, pr.sx, pr.sy, hr);
      gh.addColorStop(0, `rgba(255,238,210,${(0.45 * exc).toFixed(3)})`);
      gh.addColorStop(1, 'rgba(255,238,210,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gh;
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, hr, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // 광자 = 색 있는 발광 빌보드(가법 합성). 색 = λ → 스펙트럼(측정 범위 정규화 — L-λ 읽기).
  //   렌즈 L-trail: 실제 변위가 있으면(trail≠null) *전파 자취*(출생→현재 실거리, 가장 흐리게)를 맨 아래 깔고,
  //   렌즈 L-recoil: 운동량 방향이 있으면(streak≠null) *빛 줄기 글리프*(머리 밝음→투명)를 그 위에,
  //   마지막에 밝은 머리 코어. 둘 다 없으면(방출만) 점만 — 방향·경로 author 0.
  function drawPhoton(ctx, SP, p, pr, range, streak, trail) {
    const [cr, cg, cb] = SP.photonColor(p.lambda, range);
    ctx.globalCompositeOperation = 'lighter';
    if (trail) {                                     // 실제 전파 경로 = 출생→현재 변위(측정 — 손박은 창 0)
      const g = ctx.createLinearGradient(trail.head.sx, trail.head.sy, trail.tail.sx, trail.tail.sy);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.5)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, 2 * pr.scale);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(trail.head.sx, trail.head.sy); ctx.lineTo(trail.tail.sx, trail.tail.sy); ctx.stroke();
    }
    if (streak) {                                    // 이방성 줄기 = 운동량 방향(읽기)
      const g = ctx.createLinearGradient(streak.head.sx, streak.head.sy, streak.tail.sx, streak.tail.sy);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1.5, 4 * pr.scale);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(streak.head.sx, streak.head.sy); ctx.lineTo(streak.tail.sx, streak.tail.sy); ctx.stroke();
    }
    const rad = Math.max(2.5, 6 * pr.scale);         // 밝은 머리 코어(광자 위치)
    const gg = ctx.createRadialGradient(pr.sx, pr.sy, 0, pr.sx, pr.sy, rad);
    gg.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
    gg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(pr.sx, pr.sy, rad, 0, 6.2832); ctx.fill();
  }

  // 렌즈 L-bond: 시뮬이 측정한 결합(sim.bonds = [i,j,…] 연결 성분 간선)을 두 원자를 잇는 선으로.
  //   결합 *존재*는 읽기(sim.bonds) — 선이 그 연결을 보일 뿐. 색은 구조선(격자와 동형 무대 장치 톤,
  //   시뮬 양을 거짓 인코딩하지 않음). 결합 0이면 선 0(author 0). 굵기=원근(평균 스케일).
  //   렌즈 L-order: 결합 차수(bond[3], step-0018 bondOrder)를 읽어 선을 차수만큼 평행 복제한다(단일·이중·삼중).
  //   렌즈 L-Ebond: 결합 E(bond[2]=Eabs, step-0015)를 읽어 선 밝기를 등급화(maxE 정규화 — 강한 결합=밝게).
  function drawBonds(ctx, sim, cam) {
    const bonds = sim.bonds;
    if (!bonds || !bonds.length) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    const maxE = measureMaxBondEnergy(bonds);     // 결합 E 정규화 기준(측정 — 손박은 임계 0)
    for (const bond of bonds) {
      const seg = bondSegment(bond, sim, cam);
      if (!seg) continue;
      const lw = Math.max(1, (seg.a.scale + seg.b.scale));   // 원근 굵기(가까울수록 굵게)
      const order = bondOrder(bond);              // 결합 차수 읽기(없으면 1 — 단일선, author 0)
      const sepPx = lw * 2.2;                     // 평행선 간격(굵기 비례 — 겹치지 않게, presentation)
      // 결합 E → 밝기 등급(magnitude 채널). E 없거나 0 이면 g=0 → 기본 구조선 톤(밝기 가산 0, author 0).
      const g = bondGlow(bondEnergy(bond), maxE);
      const base = [176, 198, 255], a = 0.40 + 0.55 * g;     // 강한 결합일수록 불투명·밝게
      const c = base.map(v => Math.min(255, Math.round(v + (255 - v) * 0.5 * g)));   // E↑ → 흰색 쪽으로(밝기)
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;             // 청백, 색조 author 0
      ctx.lineWidth = lw;
      for (const ln of bondMultiline(seg, order, sepPx)) {   // 차수만큼 평행 복제
        ctx.beginPath(); ctx.moveTo(ln.a.sx, ln.a.sy); ctx.lineTo(ln.b.sx, ln.b.sy); ctx.stroke();
      }
    }
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

  return { draw, makeCamera, project, attachControls, camState, photonStreak, photonTrail, measureMaxMomentum, measureMaxExcitation, excitationGlow, bondSegment, bondOrder, bondMultiline, measureMaxBondEnergy, bondEnergy, bondGlow, measureZRange, elementHue, hsvToRgb };
});
