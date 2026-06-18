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
// 렌즈 L-glow: 원자 *magnitude x*(밝기 채널 — atom 들뜸 양자수 0,1,2,3 …·flux 연속 보존량 q)를 *광원 밝기*로 읽는다(입력 계약 §2).
//   불리언(유무)→등급으로 정제했으나 *최댓값 단독*(x/maxX) 정규화라 DC 오프셋이 큰 연속 장(flux 의 q≈1 위 작은 기울기)은
//   전부 포화해 평형 근방 확산이 안 보였다 — 이제 형제 magnitude 렌즈(L-element·L-isotope)처럼 *측정 범위*[lo,hi]로 정규화:
//   좁은 범위도 전체 대비로 펴진다(읽기). **"x=0→글로우 0" 보존**: atom x≥0 이라 바닥 원자가 곧 lo(=0) → glow(0)=0(클램프).
//   밝기만 읽고 색은 중립 온백(presentation — hue author 0, "E=밝기"와 동형 magnitude 채널). 정규화는 측정. 절단(|0) 0.
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
//
// 렌즈 L-ion: 시뮬이 내보낸 *전하* Q=Z−e(이온화 상태, atoms 채널의 Z·e — 늘 실림)를 원자 구의 *테두리 고리*로 읽는다.
//   색조(Z·L-element)·밝기(x·L-glow)와 직교한 *별도 글리프*(고리)다. 전하는 *부호 있는* 양 → 발산(diverging) 사상:
//   양이온(Q>0·전자 부족)=따뜻한 고리·음이온(Q<0·전자 과잉)=차가운 고리·중성(Q=0)=고리 0(빛 author 0과 동형).
//   세기(고리 굵기·불투명도) = |Q|/maxAbs(측정 정규화 — 손박은 임계 0). 종류별 색 박기 아닌 *부호 채널의 발산 정규화*
//   (측정 범위를 화면 창에 맞춤 — RENDER §3 허용). 계약 감사서 드러난 미독 채널(e·Z 늘 있으나 전하를 읽는 렌즈 0)을 읽음.
//
// 렌즈 L-isotope: 시뮬이 내보낸 *중성자 수* N(동위원소, atoms 채널 — 늘 실림)을 원자 구의 *동심 안쪽 코어*로 읽는다.
//   지금까지 N 은 *크기*(질량 Z+N)에만 들어가 같은 Z 다른 N(동위원소)이 β붕괴서 Z+N 보존이면 구분 안 됐다(계약 감사 미독 채널).
//   측정 N 범위[lo,hi]로 정규화한 등급으로 안쪽 코어 밝기를 매긴다: 중성자 많을수록 밝은 코어(중성자 풍부=조밀한 핵).
//   색조(Z·L-element)·밝기(x·L-glow)·고리(Q·L-ion)와 직교한 *별도 글리프*(안쪽 코어). 변이 없으면(단일 동위원소 → 범위 0)
//   코어 0 — 시뮬에 없는 구분을 author 하지 않는다(RENDER §3). 핵 변환서 Z(색)·N(코어)이 함께 움직여 (Z,N) 궤적을 보인다.
//
// 렌즈 L-molecule: 시뮬이 내보낸 결합 간선(sim.bonds=[i,j])으로 원자들의 *연결 성분*(같은 분자)을 *측정*해
//   분자별 *묶음 색*으로 읽는다. L-bond(렌즈-006)는 결합쌍을 청백 *구조선*으로만 그어 어느 선이 한 분자에
//   속하는지(연결 성분)는 화면에 *안 보였다* — 여러 분자가 한 무대에 있으면 결합망이 한 색으로 뭉개졌다.
//   L-molecule 이 결합 그래프의 연결 성분을 읽어(union-find 측정 — author 0) 같은 분자의 결합선을 같은 색조로,
//   다른 분자는 다른 색조로 칠한다 → 분자가 *한 덩이*로 보인다. 색조는 분자 id 의 presentation 사상(황금각 분산 —
//   종류별 색 박기 아닌 측정된 연결 성분 라벨의 구분). 결합 E(L-Ebond)=밝기·차수(L-order)=평행선과 직교(색조 채널).
//   단일 분자(연결 성분 1) 또는 결합 0 이면 중립 청백(시뮬에 없는 구분을 author 하지 않는다 — RENDER §3).
//
// 렌즈 L-source: 시뮬이 광자에 늘 싣는 *방출 원소* srcZ(이 빛을 낸 원자의 Z)를 광자 *출처 고리*로 읽는다.
//   광자 색(L-λ)은 *전이*(from→to 준위차)로 정해져 원소 무관 — 같은 전이를 탄소·산소·헬륨이 방출해도 *같은 색*(λ 동일).
//   그래서 "어느 원소가 이 빛을 냈는가"는 화면에서 안 보였다(계약 감사 미독 채널 — atoms 의 Z 누락과 동형, 광자판).
//   L-source 가 srcZ 를 *측정 범위 정규화*해 출처 고리 색조로(L-element 와 *동일 사상* — 저 Z 파랑→고 Z 빨강):
//   광자 핵은 여전히 lambda(전이색·직교 채널), 바깥 고리만 출처 원소색. 같은 원소가 낸 빛은 같은 고리색.
//   단일 원소(범위 0)·srcZ 없으면 고리 0 — 시뮬에 없는 구분을 author 하지 않는다(RENDER §3).
//
// 렌즈 L-scatter: 시뮬이 광자에 늘 싣는 *산란 횟수* nscatter(이 빛이 몇 번 튕겼나, step-0005·0006 산란 장면)를
//   *산란 헤일로*로 읽는다. 광자 색(L-λ)은 *현재* 에너지만 보여 — 11번 산란해 색이 붉어진 광자와 갓 방출된
//   같은 색 광자가 화면에서 똑같았다(산란 이력이 안 보임, 실 스냅샷 감사 미독 채널). nscatter 를 측정 최댓값으로
//   정규화한 *등급* 헤일로로: 많이 산란한 광자일수록 더 퍼지고 흐린 빛(여러 번 튕겨 방향이 흩어진 빛의 표현).
//   밝기·반경만 읽고 톤은 중립 냉백(magnitude 채널 — L-glow 들뜸 글로우와 동형, hue author 0). nscatter=0(직진)이면
//   헤일로 0 — 안 튕긴 빛에 산란을 author 하지 않는다(RENDER §3). 핵 색(lambda)·출처 고리(srcZ)·줄기(운동량)와 직교.
//
// 렌즈 L-velocity: 시뮬이 원자에 늘 싣는 *속도 벡터*(vx,vy)를 원자 *운동 자취*로 읽는다. 원자는 거의 모든 장면서
//   움직이나(중력·충돌·반발) 정지 프레임엔 *정적 구*로만 보여 어디로 가는지 안 보였다(운동 방향 미독 — 광자는 L-recoil
//   로 운동량을 보이는데 원자는 0이었다). 이는 ⛔blocked 인 *온도색(L-T)* 과 **다르다** — 열 의미화(흑체색)가 아니라
//   *순수 운동 방향*(광자 L-recoil 의 원자판). 속도 방향 = 자취 방향(읽기), 길이 ∝ |v|/maxV(측정 정규화). 톤은 중립
//   냉백(hue author 0 — 온도색 아님). |v|=0(정지)이면 자취 0(author 0). 색조(Z)·밝기(x)·고리(Q)·코어(N)와 직교 글리프.
//
// 렌즈 L-population: 시뮬이 원자에 싣는 *출신 집단* c0(어느 별/우물/세대 풀에서 왔나, step-0081 2세대 별·0086 중력
//   병합 풀·0093 성간 수송)을 원자 *오라*(구 아래 부드러운 그룹 색조 디스크)로 읽는다. 두 집단은 위치로 *떨어진 두
//   덩이*로 보이나 — 어느 원자가 *어느 출신*인지(집단 라벨)는 색 채널이 없었다(실 스냅샷 재감사가 atom-0100 에서 잡은
//   미독 per-atom 채널 — 분자 색조 L-molecule 의 *원자판*: 거기선 결합 간선의 연결 성분, 여기선 sim 이 실은 출신 라벨).
//   c0 를 골든각 그룹 색조로 *읽어*(L-molecule moleculeHue 와 동일 사상 — 측정 라벨의 구분, 종류별 색 박기 0) 같은
//   집단은 같은 오라·다른 집단은 다른 오라. 색조(Z)·밝기(x)·고리(Q)·코어(N)·자취(v)와 직교한 *별도 글리프*(배경 오라).
//   단일 집단(라벨 1종)이거나 c0 없는 장면(대부분)은 오라 0 — 시뮬에 없는 구분을 author 하지 않는다(RENDER §3).
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGORender = root.HGORender || {}).render = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── 순수 3D 수학 (캔버스 무관 — 헤드리스로 검증 가능) ──────────────────────────
  // 세계 좌표: x,y = 시뮬 평면(rx,ry) · z = 깊이(원자 a.rz — step-0111 drift3d 가 실음; rz 미존재 2D 장면 → 0). worldUp=(0,0,1).
  //   ※ 광자(p)·바닥 격자는 아직 2D(z=0) — 광자 z 는 후속 atom step 이 실으면 같은 방식으로 배선(읽기만·author 0).
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

  // ── 렌즈 L-velocity: 원자 속도 벡터(vx,vy) → 운동 자취 글리프 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 원자는 거의 모든 장면서 vx,vy 로 움직이나(중력·충돌·반발) 정지 프레임엔 *정적 구*로만 보였다(운동 방향 미독).
  //   이는 ⛔blocked 인 *온도색(L-T)* 과 다르다 — 열 의미화(흑체색)가 아니라 *순수 운동 방향*(광자 L-recoil 의 원자판).
  //   원자 배열에서 속력 최댓값을 *측정*(자취 길이 정규화 기준 — 손박은 임계 0). 정지면 0.
  function measureMaxSpeed(atoms) {
    let m = 0;
    for (const a of atoms) { const v = Math.hypot(a.vx || 0, a.vy || 0); if (v > m) m = v; }
    return m;
  }

  // 원자 속도 → 화면 운동 자취 {head,tail,mag}. 머리=현 위치(밝음)·꼬리=−속도(뒤쪽 자취). 길이 ∝ |v|/maxV(측정).
  //   속도 0(정지)이면 null — 운동을 author 하지 않는다(RENDER §3). photonStreak(운동량)과 동형. 속도는 평면(z=0) 2D.
  function atomVelocityStreak(a, cam, maxV, worldLen) {
    const mag = Math.hypot(a.vx || 0, a.vy || 0);
    if (!(mag > 1e-9)) return null;
    const inv = 1 / mag;
    const dir = { x: a.vx * inv, y: a.vy * inv };          // 정규화 진행 방향(읽기)
    const L = (maxV > 0 ? mag / maxV : 1) * worldLen;      // 자취 세계 길이(측정 정규화)
    const head = project({ x: a.rx, y: a.ry, z: a.rz || 0 }, cam);                     // 머리=원자 현 위치(밝음·z=깊이 step-0111 drift3d, 미존재 → 0)
    const tail = project({ x: a.rx - dir.x * L, y: a.ry - dir.y * L, z: a.rz || 0 }, cam);  // 꼬리=−속도(뒤쪽 자취·같은 깊이)
    if (head.depth <= 0 || tail.depth <= 0) return null;
    return { head, tail, mag };
  }

  // ── 렌즈 L-escape: 세계 밖으로 빠져나간 입자(sim.escaped 누적) → 탈출 게이지 읽기 (캔버스 무관 순수) ──
  // 핵 장면(붕괴·융합 step-0032~)은 입자/에너지가 경계를 넘어 *세계를 떠난다* — sim.escaped 가 그 총합을
  //   누적한다({E, px, py, count}). 떠난 입자는 더는 장면에 없어 화면에 *완전히 안 보였다*(실 스냅샷 감사가 잡은
  //   미독 부채 — 문서 §2 계약엔 없던 양). per-atom nuc/lep 장부(어느 보존 통에 들었나=추상 태그)와 다르다 —
  //   escaped 는 *실제 방출된 입자/에너지*(광자처럼 개수·방향·E 를 가진 실측 방출량)다. 광자를 스펙트럼 띠로
  //   집계 표시하듯(drawStrip), escaped 를 HUD 게이지로 집계 표시한다 — 장면 공간 글리프가 아닌 *오버레이*(위치 author 0).
  //   읽는 양: count(정수 개수·정확)·E(에너지·정확)·net 운동량 (px,py)→방향 atan2(정확, 정규화 불필요).
  //   스칼라 누적이라 in-frame 범위가 없다 — 크기 정규화(손박은 캡)를 피하고 *방향·개수·E 의 정확 읽기*만.
  //   count=0(또는 escaped 없음)이면 null → 게이지 0(시뮬에 없는 탈출을 author 하지 않는다, RENDER §3).
  function escapeReadout(escaped) {
    if (!escaped) return null;
    const count = escaped.count | 0;
    if (count <= 0) return null;
    const px = escaped.px || 0, py = escaped.py || 0;
    const mag = Math.hypot(px, py);
    const hasDir = mag > 1e-9;
    return {
      count,
      E: escaped.E || 0,
      mag,                                                 // |net 운동량| (실측 — 크기는 표시 안 함, 방향만)
      angle: hasDir ? Math.atan2(py, px) : null,           // net 운동량 방향(정확 읽기) — |p|=0 등방 복사 탈출이면 방향 없음
      hasDir,
    };
  }

  // ── 렌즈 L-glow: 원자 magnitude x → 광원 밝기 (캔버스 무관 순수 — 헤드리스 검증) ──
  // x 는 *연속* magnitude 다(정수 절단 0) — atom 은 이산 들뜸 양자수(0,1,2,3)·flux 는 연속 보존량 q.
  //   둘을 같은 사상으로 읽되, 형제 magnitude 렌즈(L-element measureZRange·L-isotope measureNRange)와 동형으로
  //   *측정 범위*[lo,hi]를 정규화 기준으로 잰다(max 단독 아님 — 손박은 임계 0). 원자 없으면 {lo:0,hi:0}.
  function measureExcitationRange(atoms) {
    let lo = Infinity, hi = -Infinity;
    for (const a of atoms) { const x = a.x || 0; if (x < lo) lo = x; if (x > hi) hi = x; }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 0 };
    return { lo, hi };
  }

  // x 를 측정 범위[lo,hi]로 정규화한 *광원 밝기* ∈[0,1](등급·클램프 — isotopeShade 와 동일 구조).
  //   범위 0(단일 값·들뜸 균일)이면 0(빛 author 0). x≤lo(최저)면 0 — **"x=0→글로우 0"이 보존된다**:
  //   atom x 는 ≥0 이라 바닥 원자가 있으면 그게 곧 lo(=0) → glow(0)=0(클램프). flux 의 좁은 q 범위는
  //   전체 대비로 펴져 평형 근방 확산이 보인다(max 단독 정규화의 DC 포화 해소). 절단(|0) 없이 연속 읽기.
  function excitationGlow(x, lo, hi) {
    if (!(hi > lo)) return 0;
    return Math.max(0, Math.min(1, ((x || 0) - lo) / (hi - lo)));
  }

  // ── 렌즈 L-scatter: 광자 산란 횟수 nscatter → 산란 헤일로 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 광자 배열에서 산란 횟수 최댓값을 *측정*(등급 정규화 기준 — 손박은 임계 0). 산란 광자 없으면 0.
  function measureMaxScatter(photons) {
    let m = 0;
    for (const p of photons) { const n = p.nscatter | 0; if (n > m) m = n; }
    return m;
  }

  // 산란 횟수 n 을 측정 최댓값으로 정규화한 *헤일로 세기* ∈[0,1](등급 — L-glow 와 동형 magnitude).
  //   maxN=0(아무도 안 튕김) 또는 n=0(직진 광자)이면 0 — 산란을 author 하지 않는다(RENDER §3).
  function scatterGlow(n, maxN) {
    if (!(maxN > 0) || !(n > 0)) return 0;
    return Math.min(1, n / maxN);
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

  // ── 렌즈 L-ion: 원자 전하 Q=Z−e(이온화) → 테두리 고리 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 부호 있는 발산 톤: 양이온(전자 부족)=따뜻함·음이온(전자 과잉)=차가움. presentation 창(측정 정규화).
  const CATION_TONE = [255, 200, 120];   // Q>0(전자 부족) — 따뜻한 고리
  const ANION_TONE = [120, 190, 255];    // Q<0(전자 과잉) — 차가운 고리

  // 원자 전하 Q = Z − e(읽기 — 양수=양이온·음수=음이온·0=중성).
  function ionCharge(a) { return (a.Z | 0) - (a.e | 0); }

  // 원자 배열에서 |전하| 최댓값을 *측정*(고리 세기 정규화 기준 — 손박은 임계 0). 전부 중성이면 0.
  function measureMaxAbsCharge(atoms) {
    let m = 0;
    for (const a of atoms) { const q = Math.abs(ionCharge(a)); if (q > m) m = q; }
    return m;
  }

  // 전하를 측정 최댓값으로 정규화한 *고리 세기* ∈[0,1](등급). maxAbs=0 또는 Q=0(중성)이면 0(고리 author 0).
  function ionRing(charge, maxAbs) {
    if (!(maxAbs > 0) || !(Math.abs(charge) > 0)) return 0;
    return Math.min(1, Math.abs(charge) / maxAbs);
  }

  // ── 렌즈 L-isotope: 원자 중성자 수 N(동위원소) → 안쪽 코어 밝기 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 원자 배열에서 N 범위를 *측정*(코어 정규화 기준 — 손박은 임계 0). 원자 없으면 {lo:0,hi:0}.
  function measureNRange(atoms) {
    let lo = Infinity, hi = -Infinity;
    for (const a of atoms) { const n = a.N | 0; if (n < lo) lo = n; if (n > hi) hi = n; }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 0 };
    return { lo, hi };
  }

  // N 을 측정 범위[lo,hi]로 정규화한 *코어 밝기* ∈[0,1](등급). 범위 0(단일 동위원소)이면 0(코어 author 0).
  function isotopeShade(N, lo, hi) {
    if (!(hi > lo)) return 0;
    return Math.max(0, Math.min(1, ((N | 0) - lo) / (hi - lo)));
  }

  // ── 렌즈 L-source: 광자 방출 원소 srcZ → 출처 고리 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 광자 색(L-λ)은 *전이*(from→to 준위차)로 정해져 원소 무관이다 — 같은 전이를 탄소·산소가 방출해도 같은 색.
  //   그래서 *어느 원소가 이 빛을 냈는가*(srcZ, atoms 와 별개로 광자에 늘 실림)는 화면에서 안 보였다(계약 감사 미독 채널).
  //   광자 배열에서 srcZ 범위를 *측정*(출처 색조 정규화 기준 — 손박은 임계 0). srcZ 없으면 {lo:0,hi:0}.
  function measureSrcZRange(photons) {
    let lo = Infinity, hi = -Infinity;
    for (const p of photons) { const z = p.srcZ; if (z === undefined) continue; if (z < lo) lo = z; if (z > hi) hi = z; }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 0 };
    return { lo, hi };
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
    const pz = p.rz || 0;                                  // 광자 깊이(step-0112 emit 가 방출 원자 rz 실음·2D 장면 미존재 → 0)
    const head = project({ x: p.rx, y: p.ry, z: pz }, cam);
    const tail = project({ x: p.rx - dir.x * L, y: p.ry - dir.y * L, z: pz }, cam);   // 자취=−방향
    return { head, tail, mag, L };
  }

  // ── 렌즈 L-trail: 광자 출생(rx0,ry0)→현 위치(rx,ry) 실제 전파 경로 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 운동량 줄기(L-recoil)가 정규화 글리프였다면, 트레일은 시뮬이 굴린 *실제 변위*를 그대로 읽는다.
  //   변위 0(방출만)이거나 출생/현재가 카메라 뒤(depth≤0)면 null — 경로를 author 하지 않는다(RENDER §3). 평면(z=0).
  function photonTrail(p, cam) {
    if (p.rx0 === undefined || p.ry0 === undefined) return null;
    const dx = p.rx - p.rx0, dy = p.ry - p.ry0;
    if (!(Math.hypot(dx, dy) > 1e-9)) return null;          // 변위 없음(갓 방출) → 트레일 0(author 0)
    const pz = p.rz || 0;                                     // 광자 깊이(step-0112 emit 가 방출 원자 rz 실음·2D 장면 미존재 → 0)
    const head = project({ x: p.rx, y: p.ry, z: pz }, cam);    // 머리 = 현 위치(밝음)
    const tail = project({ x: p.rx0, y: p.ry0, z: pz }, cam);  // 꼬리 = 출생 위치(자취 끝)
    if (head.depth <= 0 || tail.depth <= 0) return null;
    return { head, tail };
  }

  // ── 렌즈 L-bond: 결합 [i,j] → 화면 선분 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 결합쌍의 두 원자(인덱스)를 투영해 잇는 선분 {a,b} 를 돌려준다. 인덱스가 무효(없는 원자)거나
  //   카메라 뒤(depth≤0)면 null — 결합을 author 하지 않는다(RENDER §3). 위치=두 원자의 sim (rx,ry,0) 그대로.
  function bondSegment(bond, sim, cam) {
    const a = sim.atoms[bond[0]], b = sim.atoms[bond[1]];
    if (!a || !b) return null;
    const pa = project({ x: a.rx, y: a.ry, z: a.rz || 0 }, cam);
    const pb = project({ x: b.rx, y: b.ry, z: b.rz || 0 }, cam);
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

  // ── 렌즈 L-molecule: 결합 그래프 → 연결 성분(분자) (캔버스 무관 순수 — 헤드리스 검증) ──
  // 결합 간선(sim.bonds=[i,j])으로 union-find 연결 성분을 *측정*한다(그래프 읽기 — 분포 author 0).
  //   반환 {comp,count}: comp[원자 인덱스]=분자 id(0..count−1)·결합에 안 든 원자는 −1, count=분자 수.
  //   결합 0이면 count 0 — 분자를 author 하지 않는다(RENDER §3). 이행적 연결(0-1-2)은 한 분자로 합쳐진다.
  function connectedComponents(bonds, atomCount) {
    const parent = new Array(atomCount);
    for (let i = 0; i < atomCount; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const bonded = new Uint8Array(atomCount);
    for (const b of (bonds || [])) {
      const i = b[0], j = b[1];
      if (!(i >= 0 && i < atomCount && j >= 0 && j < atomCount) || i === j) continue;
      bonded[i] = 1; bonded[j] = 1;
      const ri = find(i), rj = find(j);
      if (ri !== rj) parent[ri] = rj;
    }
    // 성분 루트를 0..count−1 로 재라벨(결합에 든 원자만 — 고립 원자는 −1, 분자 아님)
    const label = new Map();
    const comp = new Array(atomCount).fill(-1);
    let count = 0;
    for (let i = 0; i < atomCount; i++) {
      if (!bonded[i]) continue;
      const r = find(i);
      if (!label.has(r)) label.set(r, count++);
      comp[i] = label.get(r);
    }
    return { comp, count };
  }

  // 분자 id → 색조 ∈[0,1)(presentation 사상). 같은 분자=같은 색·다른 분자=다른 색(그룹 구분 채널 — magnitude 아님).
  //   황금각(0.618…) 회전으로 인접 id 색을 최대 분리(종류별 색 박기 0 — id 는 측정된 연결 성분 라벨).
  //   단일 분자(count≤1)거나 미결합(id<0)이면 중립 기준 색조 — 구분할 분자가 없으니 author 하지 않는다(RENDER §3).
  const MOLECULE_HUE_REF = 0.58;          // 단일 분자/미결합 — 중립(L-bond 청백 톤과 동형)
  function moleculeHue(compId, count) {
    if (!(count > 1) || compId < 0) return MOLECULE_HUE_REF;
    return ((compId * 0.61803398875) % 1 + 1) % 1;
  }

  // ── 렌즈 L-population: 원자 출신 집단 c0 → 그룹 색조 오라 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 원자 배열에서 *출신 집단 라벨*(c0 — sim 이 2세대 별/병합 풀/수송 장면서 실음)을 *측정*한다(읽기 — 분포 author 0).
  //   c0 가 없는 원자(대부분 장면)는 제외. 반환 {labels(정렬된 유니크 라벨), count(집단 수)}. 단일/없음이면 count≤1.
  function measurePopulations(atoms) {
    const set = new Set();
    for (const a of atoms) { if (a.c0 !== undefined && a.c0 !== null) set.add(a.c0 | 0); }
    const labels = [...set].sort((p, q) => p - q);
    return { labels, count: labels.length };
  }

  // 출신 집단 라벨 c0 → 오라 색조 ∈[0,1)(presentation 사상 — moleculeHue 와 동형 그룹 구분 채널, magnitude 아님).
  //   라벨을 측정 순위로 매겨 황금각(0.618…) 회전 색조로(인접 집단 색 최대 분리 — 종류별 색 박기 0, 측정 라벨의 구분).
  //   단일 집단(count≤1)이거나 c0 없음(undefined)·미측정 라벨이면 null → 오라 0(시뮬에 없는 구분 author 0, RENDER §3).
  function populationHue(c0, pop) {
    if (!pop || !(pop.count > 1) || c0 === undefined || c0 === null) return null;
    const idx = pop.labels.indexOf(c0 | 0);
    if (idx < 0) return null;
    return ((idx * 0.61803398875) % 1 + 1) % 1;
  }

  // ── 렌즈 L-core: 원자 결속 코어/분산 헤일로 분류 core → 운명 테 글리프 (캔버스 무관 순수 — 헤드리스 검증) ──
  // 분산 장면(step-0096 Otsu 이봉 골 임계)은 원자에 *구조적 운명* core(1=결속 코어=중력으로 묶여 남음·0=분산 헤일로
  //   =경계로 흩어짐)를 싣는다. 밀도/반경 기울기로 *대략* 보이나 — sim 의 *임계 결정*(어느 원자를 코어로 셈했나, 골
  //   경계가 어디인가)은 색 채널이 0이었다(atom-0100 재감사가 잡은 미독 per-atom 채널). 두 분류가 *공존*해야 구분이
  //   의미 있다(전부 코어/전부 헤일로면 author 0). 원자 배열에서 *두 분류 공존 여부*를 측정(읽기 — 손박은 임계 0).
  function measureCoreClasses(atoms) {
    let has0 = false, has1 = false;
    for (const a of atoms) {
      if (a.core === undefined || a.core === null) continue;
      if (a.core) has1 = true; else has0 = true;
    }
    return { present: has0 && has1 };   // 코어·헤일로 둘 다 있을 때만 구분(시뮬에 없는 분류 author 0)
  }

  // 원자 구조 운명 읽기 — core 진리값이면 결속(true)·거짓이면 분산(false)·core 없으면 null(글리프 author 0).
  function coreBound(a) {
    if (a.core === undefined || a.core === null) return null;
    return !!a.core;
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
    const xRange = measureExcitationRange(sim.atoms);              // 밝기 글로우 정규화 기준(측정 x 범위 — L-glow, 연속)
    const zRange = measureZRange(sim.atoms);                       // 원소 색조 정규화 기준(측정 Z 범위 — L-element)
    const maxQ = measureMaxAbsCharge(sim.atoms);                   // 이온 고리 정규화 기준(측정 |전하| 최댓값 — L-ion)
    const nRange = measureNRange(sim.atoms);                       // 동위원소 코어 정규화 기준(측정 N 범위 — L-isotope)
    const maxV = measureMaxSpeed(sim.atoms);                       // 운동 자취 정규화 기준(측정 최대 속력 — L-velocity)
    const pop = measurePopulations(sim.atoms);                     // 출신 집단 측정(c0 — L-population, 단일/없으면 오라 0)
    const coreCls = measureCoreClasses(sim.atoms);                 // 결속 코어/분산 헤일로 공존 여부(core — L-core, 둘 다 있어야 구분)
    const velWorld = STREAK_FRAC * Math.max(sim.W, sim.H);         // 운동 자취 길이 창(장면 크기 비례 — 줄기와 동일 창)
    for (const a of sim.atoms) {
      const pr = project({ x: a.rx, y: a.ry, z: a.rz || 0 }, cam);  // z=깊이(step-0111 drift3d·미존재 → 0·2D 비트 동일)
      if (pr.depth <= 0) continue;
      draws.push({ depth: pr.depth, kind: 'atom', a, pr });
    }
    const range = SP.measureRange(sim.photons) || { lo: 1, hi: 2 };
    const maxP = measureMaxMomentum(sim.photons);                  // 운동량 정규화 기준(측정)
    const szRange = measureSrcZRange(sim.photons);                 // 광자 출처 원소 색조 정규화 기준(측정 srcZ 범위 — L-source)
    const maxScatter = measureMaxScatter(sim.photons);             // 산란 헤일로 정규화 기준(측정 최대 산란 횟수 — L-scatter)
    const streakWorld = STREAK_FRAC * Math.max(sim.W, sim.H);      // 줄기 길이 창(장면 크기 비례)
    for (const p of sim.photons) {
      const pr = project({ x: p.rx, y: p.ry, z: p.rz || 0 }, cam);   // 광자 깊이(step-0112 emit 가 방출 원자 rz 실음·2D 장면 미존재 → 0·비트 동일)
      if (pr.depth <= 0) continue;
      draws.push({ depth: pr.depth, kind: 'photon', p, pr });
    }
    draws.sort((u, v) => v.depth - u.depth);

    for (const d of draws) {
      if (d.kind === 'atom') drawAtom(ctx, d.a, d.pr, K, xRange, zRange, maxQ, nRange, atomVelocityStreak(d.a, cam, maxV, velWorld), populationHue(d.a.c0, pop), coreCls.present ? coreBound(d.a) : null);
      else drawPhoton(ctx, SP, d.p, d.pr, range, photonStreak(d.p, cam, maxP, streakWorld), photonTrail(d.p, cam), szRange, maxScatter);
    }
    ctx.globalCompositeOperation = 'source-over';

    drawStrip(ctx, sim, SP, range, cv.width, cv.height);   // 측정 스펙트럼 띠(2D HUD 오버레이)
    drawEscape(ctx, sim);                                  // 탈출 누적 게이지(L-escape — 2D HUD 오버레이·경계 밖 방출 입자)
  }

  // 원자 = 음영 구(球). 반지름 = 질량(Z+N) — 읽기.
  //   렌즈 L-glow: magnitude x(atom 들뜸 양자수·flux 연속 q)를 *광원 밝기*로 등급 읽기 — 측정 범위 정규화(L-isotope 동형).
  //     exc=(x−lo)/(hi−lo)∈[0,1](클램프). x≤lo(최저)면 0 → 바닥 원자(x=0=lo) 글로우 0 보존(빛 author 0).
  //   렌즈 L-element: 양성자 수 Z(원소 정체성)를 *색조*로 등급 읽기(측정 Z 범위 정규화) — 원소 바뀌면 색 바뀜.
  //     색조와 밝기는 직교: hue=Z(원소)·value=들뜸 x. 변이 없는 장면(범위 0)은 무채색(가짜 색 author 0).
  //   렌즈 L-ion: 전하 Q=Z−e(이온화)를 *테두리 고리*로 읽기 — 양이온 따뜻·음이온 차가움(발산)·중성 고리 0. 색조·밝기와 직교.
  //   렌즈 L-isotope: 중성자 수 N(동위원소)을 *안쪽 동심 코어*로 읽기 — 중성자 많을수록 밝은 코어. 단일 동위원소면 코어 0.
  //   렌즈 L-velocity: 속도 벡터(vx,vy)를 *운동 자취*로 읽기 — 머리=현 위치·꼬리=−속도, 길이 ∝ |v|. 정지면 자취 0. 온도색 아님(중립).
  //   렌즈 L-population: 출신 집단 c0(어느 별/풀 출신)을 *배경 오라*로 읽기(골든각 그룹 색조 — 같은 집단 동색). 단일/c0 없으면 오라 0. 모든 채널과 직교.
  //   렌즈 L-core: 구조 운명 core(결속 코어 vs 분산 헤일로)를 *점선 운명 테*로 읽기 — 코어=조밀 청록 테·헤일로=옅은 보라 테. 두 분류 공존 안 하면 0.
  function drawAtom(ctx, a, pr, K, xRange, zRange, maxQ, nRange, vel, popHue, coreFate) {
    const wr = 1.5 + Math.sqrt(K.mass(a));     // 세계 반지름(질량에서 읽음)
    const r = Math.max(1.2, wr * pr.scale);    // 화면 반지름(원근 축소)
    // 렌즈 L-population: 출신 집단 c0 → 그룹 색조 오라(구 *아래* 부드러운 디스크 — 맨 바닥 배경 글리프). 같은 집단 동색·다른 집단 이색.
    //   popHue=null(단일 집단·c0 없음)이면 안 그림 — 시뮬에 없는 출신 구분을 author 하지 않는다(RENDER §3). 색조(Z)·자취(v) 등과 직교.
    if (popHue !== null && popHue !== undefined) {
      const [pr_, pg_, pb_] = hsvToRgb(popHue, 0.6, 0.95);
      const aR = r * 2.4;                                          // 오라 반경(구보다 넓게 — 영역 톤)
      const ga = ctx.createRadialGradient(pr.sx, pr.sy, r * 0.7, pr.sx, pr.sy, aR);
      ga.addColorStop(0, `rgba(${pr_},${pg_},${pb_},0.20)`);       // 집단 색조 — 옅은 영역 오라
      ga.addColorStop(1, `rgba(${pr_},${pg_},${pb_},0)`);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = ga;
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, aR, 0, 6.2832); ctx.fill();
    }
    // 렌즈 L-velocity: 운동 자취(속도 방향, 측정 |v|/maxV 길이) — 구 아래 깔아 진행 방향을 보임. 톤 중립 냉백(온도색 아님·hue author 0).
    //   정지(|v|=0)면 vel=null → 자취 0(시뮬에 없는 운동을 author 하지 않는다, RENDER §3). 광자 L-recoil 줄기와 동형.
    if (vel) {
      const g = ctx.createLinearGradient(vel.head.sx, vel.head.sy, vel.tail.sx, vel.tail.sy);
      g.addColorStop(0, 'rgba(186,196,216,0.6)');    // 머리=원자(짙음)
      g.addColorStop(1, 'rgba(186,196,216,0)');      // 꼬리=−속도 자취(투명)
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, 1.8 * pr.scale);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(vel.head.sx, vel.head.sy); ctx.lineTo(vel.tail.sx, vel.tail.sy); ctx.stroke();
    }
    const exc = excitationGlow(a.x, xRange.lo, xRange.hi); // magnitude x → 광원 밝기 ∈[0,1](측정 범위 등급·연속·절단 0)
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
    // 렌즈 L-ion: 전하 Q=Z−e 를 테두리 고리로(부호 발산 — 양이온 따뜻·음이온 차가움, 세기=|Q|/maxQ 측정).
    //   중성(Q=0) 또는 maxQ=0 이면 고리 0 — 시뮬에 없는 전하를 author 하지 않는다(RENDER §3).
    const q = ionCharge(a), ringI = ionRing(q, maxQ || 0);
    if (ringI > 0) {
      const tone = q > 0 ? CATION_TONE : ANION_TONE;          // 부호 → 발산 톤(종류별 색 박기 아님)
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${(0.45 + 0.5 * ringI).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, (1 + 2 * ringI) * pr.scale);  // 세기 → 굵기(측정 등급)
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, r + ctx.lineWidth * 0.6, 0, 6.2832); ctx.stroke();
    }
    // 렌즈 L-isotope: 중성자 수 N 을 안쪽 동심 코어 밝기로(측정 N 범위 정규화 — 중성자 많을수록 밝은 코어).
    //   단일 동위원소(범위 0) 또는 코어 0 이면 안 그림 — 시뮬에 없는 구분을 author 하지 않는다(RENDER §3).
    const iso = isotopeShade(a.N | 0, (nRange && nRange.lo) || 0, (nRange && nRange.hi) || 0);
    if (iso > 0) {
      const cr = r * 0.5;                                       // 안쪽 코어 반경(동심 — 바깥 색조와 분리)
      const gc = ctx.createRadialGradient(pr.sx, pr.sy, 0, pr.sx, pr.sy, cr);
      gc.addColorStop(0, `rgba(238,244,255,${(0.25 + 0.6 * iso).toFixed(3)})`);   // 중성자↑ → 밝은 코어
      gc.addColorStop(1, 'rgba(238,244,255,0)');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = gc;
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, cr, 0, 6.2832); ctx.fill();
    }
    // 렌즈 L-core: 구조 운명 core(결속 코어 vs 분산 헤일로) → 점선 운명 테(분류 구분 글리프 — 색조·고리·코어와 직교).
    //   결속(true)=조밀 청록 점선 테·분산(false)=옅은 보라 점선 테(둘 다 그려 *어느 운명*인지 보임). coreFate=null(두 분류
    //   공존 안 함·core 없음)이면 안 그림 — 시뮬에 없는 분류를 author 하지 않는다(RENDER §3). 점선이라 솔리드 이온 고리와 구별.
    if (coreFate !== null && coreFate !== undefined) {
      const tone = coreFate ? [120, 230, 220] : [200, 170, 240];   // 결속=청록·분산=보라(부호 발산형 분류 톤)
      const fr = coreFate ? r * 1.28 : r * 1.55;                    // 코어=가까운 테·헤일로=먼 테(운명 분리)
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${coreFate ? 0.75 : 0.4})`;
      ctx.lineWidth = Math.max(1, 1.4 * pr.scale);
      ctx.setLineDash([Math.max(2, 3 * pr.scale), Math.max(2, 3 * pr.scale)]);   // 점선 — 솔리드 이온 고리와 구별
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, fr, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);                                          // 점선 해제(다른 그리기에 영향 0)
    }
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
  //   렌즈 L-source: 방출 원소 srcZ 를 *출처 고리*로(색조=원소, L-element 와 동일 사상). 핵 색(lambda=전이)과 직교.
  //   렌즈 L-scatter: 산란 횟수 nscatter 를 *산란 헤일로*로(많이 튕긴 빛=더 퍼진 흐린 빛, magnitude 채널). 직진(nscatter=0)이면 헤일로 0.
  function drawPhoton(ctx, SP, p, pr, range, streak, trail, szRange, maxScatter) {
    const [cr, cg, cb] = SP.photonColor(p.lambda, range);
    ctx.globalCompositeOperation = 'lighter';
    // 렌즈 L-scatter: 산란 헤일로 = 산란 횟수 등급(측정 정규화 — 많이 튕긴 빛일수록 넓고 짙은 흐린 빛). 직진이면 0(author 0).
    //   톤은 중립 냉백(magnitude 채널 — hue author 0). 핵 코어보다 먼저 깔아 코어가 위에 뜨게(흩어진 빛의 표현).
    const sg = scatterGlow(p.nscatter | 0, maxScatter || 0);
    if (sg > 0) {
      const sr = Math.max(3, 7 * pr.scale) * (1.6 + 2.4 * sg);   // 많이 산란할수록 넓게 퍼짐
      const gs = ctx.createRadialGradient(pr.sx, pr.sy, 0, pr.sx, pr.sy, sr);
      gs.addColorStop(0, `rgba(205,216,236,${(0.32 * sg).toFixed(3)})`);
      gs.addColorStop(1, 'rgba(205,216,236,0)');
      ctx.fillStyle = gs;
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, sr, 0, 6.2832); ctx.fill();
    }
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
    // 렌즈 L-source: 방출 원소 srcZ → 출처 고리(측정 srcZ 범위 정규화·색조=원소, L-element 와 동일 사상).
    //   같은 원소가 낸 빛은 같은 고리색 — 전이가 같아 핵 색(lambda)이 같아도 출처가 갈린다. 핵 색과 직교 글리프.
    //   srcZ 없거나 변이 없으면(단일 원소 → 범위 0) 고리 0 — 시뮬에 없는 구분을 author 하지 않는다(RENDER §3).
    if (p.srcZ !== undefined && szRange && szRange.hi > szRange.lo) {
      const [rr, rg, rb] = hsvToRgb(elementHue(p.srcZ | 0, szRange.lo, szRange.hi), 0.7, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${rr},${rg},${rb},0.75)`;
      ctx.lineWidth = Math.max(1, 1.6 * pr.scale);
      ctx.beginPath(); ctx.arc(pr.sx, pr.sy, rad * 0.9, 0, 6.2832); ctx.stroke();
    }
  }

  // 렌즈 L-bond: 시뮬이 측정한 결합(sim.bonds = [i,j,…] 연결 성분 간선)을 두 원자를 잇는 선으로.
  //   결합 *존재*는 읽기(sim.bonds) — 선이 그 연결을 보일 뿐. 색은 구조선(격자와 동형 무대 장치 톤,
  //   시뮬 양을 거짓 인코딩하지 않음). 결합 0이면 선 0(author 0). 굵기=원근(평균 스케일).
  //   렌즈 L-order: 결합 차수(bond[3], step-0018 bondOrder)를 읽어 선을 차수만큼 평행 복제한다(단일·이중·삼중).
  //   렌즈 L-Ebond: 결합 E(bond[2]=Eabs, step-0015)를 읽어 선 밝기를 등급화(maxE 정규화 — 강한 결합=밝게).
  //   렌즈 L-molecule: 결합 그래프의 연결 성분(분자)을 측정해 분자별 *색조*로(같은 분자 동색·다른 분자 이색). 밝기(E)·평행선(차수)과 직교.
  function drawBonds(ctx, sim, cam) {
    const bonds = sim.bonds;
    if (!bonds || !bonds.length) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    const maxE = measureMaxBondEnergy(bonds);     // 결합 E 정규화 기준(측정 — 손박은 임계 0)
    const cc = connectedComponents(bonds, sim.atoms.length);   // 분자(연결 성분) 측정 — 같은 분자 묶음색
    const spread = cc.count > 1;                  // 분자 ≥2 → 색조로 구분(단일 분자면 중립 — author 0)
    for (const bond of bonds) {
      const seg = bondSegment(bond, sim, cam);
      if (!seg) continue;
      const lw = Math.max(1, (seg.a.scale + seg.b.scale));   // 원근 굵기(가까울수록 굵게)
      const order = bondOrder(bond);              // 결합 차수 읽기(없으면 1 — 단일선, author 0)
      const sepPx = lw * 2.2;                     // 평행선 간격(굵기 비례 — 겹치지 않게, presentation)
      // 결합 E → 밝기 등급(magnitude 채널). E 없거나 0 이면 g=0 → 기본 구조선 톤(밝기 가산 0, author 0).
      const g = bondGlow(bondEnergy(bond), maxE);
      // 렌즈 L-molecule: 분자 id → 색조(hue 채널 — 분자 구분). 단일 분자면 거의 무채색(L-bond 청백 톤·author 0).
      const hue = moleculeHue(cc.comp[bond[0]], cc.count);
      const sat = spread ? 0.50 : 0.12;           // 분자 ≥2 → 채색 구분·단일 분자 → 중립(시뮬에 없는 색 author 0)
      const val = 0.72 + 0.28 * g;                // 결합 E → 명도(L-Ebond 직교 — value 채널, 강한 결합 밝게)
      const c = hsvToRgb(hue, sat, val), a = 0.40 + 0.55 * g;   // 색조=분자·명도/불투명=E(직교 채널)
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
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

  // 렌즈 L-escape: 탈출 누적(sim.escaped)을 좌상단 HUD 게이지로 — 스펙트럼 띠와 동형(집계 방출량 오버레이, 화면 고정).
  //   방향 화살 = net 운동량 방향(atan2 정확 읽기 — 어느 쪽으로 빠져나갔나). |p|=0(등방 복사 탈출)이면 방향 없음 → 등방 고리.
  //   텍스트 = 개수·E 원시값(정규화 없음 — 스칼라라 in-frame 범위 없음, 손박은 캡 0). escaped 없거나 count=0 이면 안 그림(author 0).
  function drawEscape(ctx, sim) {
    const r = escapeReadout(sim.escaped);
    if (!r) return;                                    // 탈출 없음 → 아무것도 안 그림(author 0)
    ctx.globalCompositeOperation = 'source-over';
    const x0 = 12, y0 = 16, L = 24, cx = x0 + L, cy = y0 + L;
    const TONE = 'rgba(210,180,255';                   // 탈출 톤(보라 — 세계를 떠난 방사)
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (r.hasDir) {
      const dx = Math.cos(r.angle), dy = Math.sin(r.angle);   // 화면 평면 나침반(2D HUD — 고정 길이 글리프, 방향만 읽기)
      const ex = cx + dx * L, ey = cy + dy * L;
      ctx.strokeStyle = `${TONE},0.85)`;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      const a1 = r.angle + 2.6, a2 = r.angle - 2.6, hl = 7;   // 화살촉
      ctx.beginPath();
      ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a1) * hl, ey + Math.sin(a1) * hl);
      ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a2) * hl, ey + Math.sin(a2) * hl);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `${TONE},0.6)`;                // |p|=0 등방 복사 탈출 — 방향 author 금지, 등방 고리로
      ctx.beginPath(); ctx.arc(cx, cy, L * 0.55, 0, 6.2832); ctx.stroke();
    }
    ctx.fillStyle = `${TONE},0.9)`;
    ctx.font = '11px monospace';
    ctx.fillText(`탈출 ${r.count}  E ${r.E.toFixed(1)}`, x0, cy + L + 14);
  }

  return { draw, escapeReadout, makeCamera, project, attachControls, camState, photonStreak, photonTrail, measureMaxMomentum, measureExcitationRange, excitationGlow, bondSegment, bondOrder, bondMultiline, measureMaxBondEnergy, bondEnergy, bondGlow, measureZRange, elementHue, hsvToRgb, ionCharge, measureMaxAbsCharge, ionRing, measureNRange, isotopeShade, connectedComponents, moleculeHue, measureSrcZRange, measureMaxScatter, scatterGlow, measureMaxSpeed, atomVelocityStreak, measurePopulations, populationHue, measureCoreClasses, coreBound };
});
