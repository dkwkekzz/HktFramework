# CLAUDE.md — HktCharacter

> **리셋 v2 (2026-07)**: SDF flesh 접근(스켈레톤→SDF 살 생성)은 제대로 된 캐릭터 품질에
> 도달하지 못해 폐기. 전체 코드는 `legacy/` 에 보관. 지금은 **미니멀 FBX 뷰어**에서 재출발.

## 목표

오픈월드 mmorpg에서 사용할 창발할 수 있고 ai only 제작 파이프라인으로 애니메이션 가능한 3d 모델을 제작한다.

## v1(SDF flesh)에서 배운 것 / 버린 이유

- 뼈에서 살을 절차 생성(SDF loft + 정점 메시 투영)하는 접근은 실루엣 지표는 통과해도
  음영·이음새 품질이 캐릭터로 쓸 수준에 못 미쳤다 (fit 파이프라인 유지비도 과대).
- v1 뷰어의 두 가지 착시(이번 리셋의 직접 계기):
  - **"메시가 안 보인다"** — FBX 를 로드해도 뼈만 추출하고 스킨 메시를 씬에 추가하지 않았다.
  - **"본 길이가 어색하다/손가락이 길다"** — 본 표시가 실제 스켈레톤이 아니라 SDF 세그먼트
    (가상 뼈·볼륨 헬퍼 포함)를 선으로 그린 것이었다.
- v2 는 이 두 가지를 정면으로 고친다: 메시는 FBX 그대로, 본은 `THREE.SkeletonHelper`.

## 구조 (전부 `src/main.js` 하나, ~330줄)

1. **씬** — three.js + OrbitControls, 헤미/디렉셔널 라이트, 그리드.
2. **로드** (`loadFBXBuffer`) — FBX 파싱 후:
   - 메시 있음 → 캐릭터 교체. 정규화(키 1.7m·발바닥 y=0·원점), `frustumCulled=false`
     (스킨 메시가 애니메이션으로 원래 바운드를 벗어나면 사라지는 고전 버그 방지),
     SkeletonHelper 생성, 내장 클립 등록·재생.
   - 메시 없음(애니메이션-only) → 캐릭터 있으면 클립 리타깃 추가, 없으면 스켈레톤만 표시.
3. **리타깃** (`retargetClip`) — 트랙 노드명을 `simpleName` 으로 정규화해 현재 캐릭터 뼈에
   매핑. **position 트랙은 Hips 만 유지** (회전만 옮기면 리그 간 뼈 길이가 달라도 안 늘어난다).
   `simpleName`: `"mixamorig:LeftHand"` / `"mixamorigLeftHand"`(FBXLoader 가 콜론을 벗기는
   내보내기 존재) / 무접두어 → 모두 `lefthand`.
4. **UI** — 샘플 버튼 / 클립 버튼(크로스페이드) / 속도 / 메시·본·회색 재질·와이어·SDF 살 토글.
   `window.__hkt` 콘솔 핸들.
5. **SDF 살** (`src/mcflesh.js`, 실험) — 뼈마다 캡슐 세그먼트, Wyvill 밀도
   `(1-d²/R²)³` (R=BLEND(2.5)×반지름, 부모→자식 반지름 테이퍼)를 필드에 가산 →
   `THREE.MarchingCubes`(res 64, isolation ≈0.593 = 캡슐 반지름 지점)로 매 프레임
   폴리곤화. 세그먼트 bbox 안 복셀만 채워 실시간(~7ms). 리그 2벌 FBX 는 simpleName
   중복 세그먼트를 스킵. 손가락 생략, `end$` 리프 본은 0.02 로 가늘게(머리 필통 방지).
   반지름 테이블은 `RADII`(simpleName 정규식 매칭).
   **알려진 한계**: 고정 격자 재샘플링이라 움직임에 표면이 미세하게 떨림(시간적
   앨리어싱) — res·BLEND 로 완화만 가능. 애니메이션-only FBX 의 내장 리그는 비율이
   실제 캐릭터와 다름(예: walk 리그 손바닥→중지1 20.9cm, samba 3.4cm) — with-skin
   캐릭터에 리타깃해서 봐야 정상 비율.

## 파일 맵

- `index.html` — HUD/패널/드롭존 + CSS
- `src/main.js` — 뷰어 전부
- `src/mcflesh.js` — SDF 살(MarchingCubes) 실험 모듈
- `public/assets/anim/*.fbx` — 동봉 Mixamo 샘플. **주의: samba.fbx 는 메시 포함**(뼈 119
  = 리그 2벌·클립 2), 나머지(walk/run/idle/jump/attack)는 애니메이션 전용(메시 없음).
- `legacy/` — v1 전체 (src/eval/index.html/LOFT-PLAN/VERTEX-PLAN/README). 참고용, import 금지.
  (루트의 `eval/` 잔재는 샌드박스 권한 문제로 못 지운 복사본 — 지워도 된다.)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
```

with-skin 캐릭터 FBX 를 드롭 → 로코모션 샘플 버튼으로 클립을 입혀 재생.

## 검증 (2026-07-11, Node 스모크)

- `vite build` 통과. 동봉 FBX 파싱: walk(뼈 57·클립 1·트랙 45 전량 매핑),
  samba(뼈 119·메시 2·클립 2). 교차 리타깃 walk→samba 45/45 매핑.
- MC 살(res 64·테이퍼): walk 스켈레톤(애니메이션 0.5s 진행) → 삼각형 3,620개
  · update 7.4ms · NaN 없음 (Node 폴리곤화 — 셰이더 없이 지오메트리만).
- 렌더 눈 검증은 브라우저에서 수동 (샌드박스에 headless 브라우저 없음).

## 다음 후보 (사용자와 논의 후)

- 캐릭터 커스터마이징(뼈 스케일 등)을 실제 스킨 메시 위에서 재시도
- 클립 블렌딩/전환 개선, UE5 연동 방향 정리

## 설계 결정

- **메시는 FBX 원본을 그대로** — 절차 생성으로 돌아가려면 근거부터.
- 리타깃은 이름 기반 + 회전 전용(Hips position 예외) 유지.
