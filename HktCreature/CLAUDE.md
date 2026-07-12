# CLAUDE.md — HktCreature

오픈월드 MMORPG 용 **창발형 3D 크리처**를 AI-only 파이프라인으로 만드는 웹 트랙.
UE 빌드·타 플러그인과 무관(독립 웹 프로토타입). 이 문서는 **얇게** 유지한다 —
목표·지켜야 할 사항·작업 방식만. 현황·명제는 [STATE.md](STATE.md).

## 목표

오픈월드 MMORPG 에서 쓸, **창발할 수 있고 AI-only 제작 파이프라인으로 애니메이션 가능한**
3D 모델을 만든다. 핵심 테제:

> **스켈레톤은 코드로 짓고, 그 위에 살만 붙인다. Mixamo 애니메이션을 그대로 구동한다.**

- 스켈레톤은 손으로 그린 FBX 스킨 메시를 로드하는 게 아니라 **코드로 생성**한다
  (Mixamo 표준 리그의 rest 계층을 실측한 템플릿에서 THREE.Bone 을 절차 조립).
- 살(flesh)은 뼈 세그먼트마다 캡슐을 세워 skinning 가중치로 묶은 **절차 SkinnedMesh**.
  "모양을 그리는" 에셋이 없다 — 크리처의 실루엣은 **게놈 숫자 벡터**에서 창발한다.
- 뼈 이름·계층·bind 포즈가 Mixamo 원본과 같으므로, Mixamo 클립이 **리타깃 없이** 그대로
  이 리그를 구동한다(이름 접두사 정규화만 — 포즈 데이터 불변).

### 자매 트랙과의 차이
- `HktCharacter`: 아티스트 FBX **스킨 메시를 로드**(절차 살은 폐기). — 우리는 살도 절차 생성.
- `HktSplatLife`: WebGPU **스플랫 살**이 FK 뼈를 지연 추종(폴리곤·스키닝 없음). — 우리는
  표준 폴리곤 SkinnedMesh + GPU 스키닝(엔진/UE 로 그대로 내보낼 수 있는 형태).

## 지켜야 할 사항

### 절대 원칙
1. **스켈레톤은 만든다, 로드하지 않는다** — 리그는 `rig.js` 의 `buildRig()` 가 `rig-template.js`
   표에서 절차 생성. 스킨 메시 FBX 로드 금지.
2. **살은 뼈의 함수** — flesh 는 뼈 세그먼트 캡슐 + skinning 결과일 뿐. bind 는 리그 rest
   (=Mixamo bind) 포즈에서 한 번 잡고, 이후 표준 스켈레탈 애니메이션이 구동한다.
3. **Mixamo 를 그대로** — 클립 적용은 **이름 정규화**(`normalizeClip`)까지만. 키프레임 값
   재계산(리타깃)·bind 포즈 재저장 금지. 뼈 이름/계층을 바꾸면 이 원칙이 깨진다.
4. **크리처 = 게놈 벡터** — 새 개체는 새 코드가 아니라 새 게놈 값으로. 매직 넘버는
   게놈/살 파라미터(슬라이더)로 노출(UE CVar 관례의 웹 대응).

### 불변 조건 (깨지면 화면/스키닝이 무너짐)
- **좌표계 = cm 단위**(Mixamo 원본, Hips.y≈103). 리그에 스케일 그룹을 씌우지 않는다 —
  Skeleton 역-bind 공간과 살 정점 공간이 반드시 일치해야 한다(화면 크기는 카메라가 맞춤).
- 살 정점은 **월드(cm) 공간**으로 저작하고, `hips` 를 SkinnedMesh 자식으로 넣은 뒤 기본
  bindMatrix 로 `mesh.bind(skeleton)`. 리그를 스케일한 부모 밑에 넣으면 bind 가 오염된다.
- `rig-template.js` 는 생성물 — 손으로 수정하지 말고 `node test/extract-template.mjs` 로 재생성.

### 컨벤션
- three.js(r161) + Vite, ES 모듈, 무-프레임워크. 주석 한국어.
- 튜닝 노브는 하드코딩 금지 — 게놈(`DEFAULT_GENOME`)·살(`DEFAULT_FLESH`) 파라미터로.

## 작업 방식
1. 세션 시작 시 [STATE.md](STATE.md) 로 현재 명제·상태 확인.
2. 한 번에 하나의 명제만. 구현/논의 후 STATE.md 갱신.
3. **검증은 반드시 캡처로 — 모든 세션 공통 게이트.** 변경을 닫기 전 `npm run check` 를 통과시킨다:
   - `npm run verify` — Node 로 코어 구동(리그 생성·살 바인딩·Mixamo 트랙 매칭·실제 포즈 구동).
   - `npm run build` — 번들 무결성.
   - `npm run shot` — **실제 브라우저 렌더 후 픽셀 자동 판정 + 스크린샷 저장**. 크리처가
     화면에 실제로 그려졌는지(배경 아닌 면적 임계)·클립별로 포즈가 변형되는지(대기≠걷기
     서명)·페이지 에러 0 을 검사하고, 실패 시 exit 1. 산출물 `test/out/*.png`.
   → **"데이터만 통과, 화면은 비었다"** 회귀를 픽셀로 막는다. 결과를 사용자에게 보고할 땐
   `test/out/*.png` 를 **첨부**해 육안 확인까지 남긴다. (샌드박스는 pre-installed Chromium
   사용 — `test/shot.mjs` 가 버전 무관하게 경로를 해석.)

## 파일 맵
- `index.html` — 무대 HUD/패널(애니메이션·게놈·살·표시·드롭존) + CSS
- `src/rig.js` — `buildRig(genome)` 코드-리그 생성 + `normalizeClip` (Mixamo 그대로 바인딩)
- `src/rig-template.js` — **생성물**. Mixamo 표준 57본 rest 계층 실측 데이터.
- `src/flesh.js` — `growFlesh(rig, flesh)` 뼈 세그먼트 캡슐 → 절차 SkinnedMesh
- `src/main.js` — 무대 전부(씬·리빌드·클립 재생·UI·`window.__hkt`)
- `public/assets/anim/*.fbx` — 동봉 Mixamo 애니메이션(idle/walk/run, 애니메이션 전용). Mixamo 무료 라이선스.
- `test/rig-verify.mjs` — Node 검증 하네스(`npm run verify`) — 데이터 레벨
- `test/shot.mjs` — 픽셀 검증 게이트(`npm run shot`) — 실제 Chromium 렌더 + 자동 판정 + `test/out/` 스크린샷
- `test/extract-template.mjs` — rig-template.js 재생성기(리그 소스 교체 시에만)

## 실행
```bash
npm install
npm run dev       # http://localhost:5173 — 무대에 크리처 한 명
npm run check     # 게이트: verify(데이터) + build + shot(픽셀/스크린샷). 변경 닫기 전 필수.
npm run shot      # 픽셀 검증만 — test/out/*.png 생성(육안 첨부용)
```

## 다음 후보 (사용자와 논의 후)
- 접지(발 y=0 고정)·root 정규화, 크로스페이드 개선.
- 살 품질: 세그먼트 캡슐 → 관절 블렌드/메타볼 표면, 정점 법선 다듬기.
- 게놈 확장(부위별 굵기·비대칭·프리셋 저장) → 창발 로스터.
- UE5 / HktGameplay 스켈레탈 메시 익스포트 경로 정리.
