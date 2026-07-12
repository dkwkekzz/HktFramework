# CLAUDE.md — HktCreature

오픈월드 MMORPG 용 **창발형 3D 크리처**를 AI-only 파이프라인으로 만드는 웹 트랙.
UE 빌드·타 플러그인과 무관(독립 웹 프로토타입). 이 문서는 **얇게** 유지한다 —
목표·지켜야 할 사항·작업 방식만. 현황·명제는 [STATE.md](STATE.md).

## 목표

오픈월드 MMORPG 에서 쓸, **창발할 수 있고 AI-only 제작 파이프라인으로 애니메이션 가능한**
3D 모델을 만든다. 핵심 테제:

> **기본 스켈레톤을 제대로 로드하고, 그 위에 절차 살만 붙인다. Mixamo 애니메이션으로 구동한다.**

- 스켈레톤은 Mixamo 베이스(X Bot/Y Bot) FBX 를 **로드**해 얻는다 — HktCharacter 로더 방식
  (트윈 교차 리그에서 구동 뼈 선정). 실제 리그·비율·bind 포즈를 그대로 쓴다.
- 살(flesh)은 로드한 뼈 세그먼트마다 캡슐을 세워 skinning 가중치로 묶은 **절차 SkinnedMesh**.
  아티스트 스킨 메시는 숨기고 살을 우리가 기른다 — "모양을 그리는" 에셋 없이 실루엣이
  **살 파라미터**에서 창발한다.
- Mixamo 클립은 **월드 공간 리타깃**(`bakeClip`)으로 로드 리그에 구워 재생한다(회전 + hips
  수직 위치만; 타깃 뼈 불변 = 오염 없음). raw mixamorig 의 비-단위 rest 도 corr 이 흡수.

> **이력**: v1 은 스켈레톤을 코드로 생성(rig-template)했으나, HktCharacter 참고로 **기본
> 스켈레톤을 로드**해 그 위에 살을 붙이는 방식으로 전환(2026-07-12). 코드-리그는 폐기.

### 자매 트랙과의 차이
- `HktCharacter`: 아티스트 FBX **스킨 메시를 그대로 렌더**. — 우리는 스킨을 숨기고 **절차 살**을 얹는다.
- `HktSplatLife`: WebGPU **스플랫 살**이 FK 뼈를 지연 추종(폴리곤·스키닝 없음). — 우리는
  표준 폴리곤 SkinnedMesh + GPU 스키닝(엔진/UE 로 그대로 내보낼 수 있는 형태).

## 지켜야 할 사항

### 절대 원칙
1. **기본 스켈레톤은 로드해서 그대로 쓴다** — Mixamo 베이스 FBX 를 로드하고, 구동 뼈 선정은
   `creature.js` `pickDrivers`(트윈 교차 리그 = DFS-첫 뼈). 뼈 이름/계층/bind 를 훼손하지 않는다.
2. **살은 뼈의 함수** — flesh 는 로드 뼈 세그먼트 캡슐 + skinning 결과일 뿐. bind 는 **바인드
   (rest) 포즈**에서 잡는다(`buildFleshAtBind`: 재생 중 굵기 변경 시 잠시 rest 로 되돌려 굽고 복구).
3. **Mixamo 리타깃은 순수 계산** — `bakeClip` 은 소스만 샘플링하고 타깃 뼈를 읽지도 쓰지도
   않는다(상태 오염 = 본 흩어짐 방지). 트랙은 회전 + hips 수직(y)만. 접지는 `measureClipRootY`
   사전 측정만, 재생 중 재측정 금지(crossfade 혼합 포즈 측정은 중심 틀어짐).
4. **크리처 = 파라미터** — 새 개체는 새 코드가 아니라 새 살/베이스 값으로. 매직 넘버는
   살 파라미터(`DEFAULT_FLESH`)·슬라이더로 노출(UE CVar 관례의 웹 대응).

### 불변 조건 (깨지면 화면/스키닝이 무너짐)
- **좌표계 = cm 단위**(Mixamo 원본). obj 에 스케일 그룹을 씌우지 않는다 — Skeleton 역-bind
  공간과 살 정점 공간이 일치해야 한다(화면 크기는 카메라가 맞춤).
- 살 정점은 **뼈 월드(cm) 공간**으로 저작하고, 살 메시는 **씬 원점(identity)** 에 두고 로드
  스켈레톤을 공유(`new Skeleton(drivers)`)해 기본 bindMatrix 로 `mesh.bind`. 살 메시를 스케일된
  obj 밑에 넣으면 bind 가 오염된다(살 메시와 뼈는 다른 서브트리여도 skinning 은 뼈 행렬만 참조).
- 접지: obj.position.y 로만(스킨 CPU bbox 아닌 **뼈 월드 bbox**). 살 메시는 identity 지만 뼈
  이동이 boneMatrix 로 흘러 살이 따라간다.

### 컨벤션
- three.js(r161) + Vite, ES 모듈, 무-프레임워크. 주석 한국어.
- 튜닝 노브는 하드코딩 금지 — 살(`DEFAULT_FLESH`) 파라미터/슬라이더로.
- 로드·리타깃 코어는 `creature.js` 에 두고 main.js(무대)·verify(검증) 가 **공유** — 중복 금지.

## 작업 방식
1. 세션 시작 시 [STATE.md](STATE.md) 로 현재 명제·상태 확인.
2. 한 번에 하나의 명제만. 구현/논의 후 STATE.md 갱신.
3. **검증은 반드시 캡처로 — 모든 세션 공통 게이트.** 변경을 닫기 전 `npm run check` 를 통과시킨다:
   - `npm run verify` — Node 로 **공유 코어** 구동(스켈레톤 로드·구동뼈 선정·살 바인딩·bakeClip
     리타깃·실제 포즈 변형). main.js 와 같은 `creature.js`+`flesh.js` 를 실물 에셋에 돌린다.
   - `npm run build` — 번들 무결성.
   - `npm run shot` — **실제 브라우저 렌더 후 픽셀 자동 판정 + 스크린샷 저장**. 크리처가
     화면에 실제로 그려졌는지(배경 아닌 면적 임계)·클립별로 포즈가 변형되는지(대기↔걷기
     셀 그리드 차)·페이지 에러 0 을 검사하고, 실패 시 exit 1. 산출물 `test/out/*.png`.
   → **"데이터만 통과, 화면은 비었다"** 회귀를 픽셀로 막는다. 결과를 사용자에게 보고할 땐
   `test/out/*.png` 를 **첨부**해 육안 확인까지 남긴다. (샌드박스는 pre-installed Chromium
   사용 — `test/shot.mjs` 가 버전 무관하게 경로를 해석.)

## 파일 맵
- `index.html` — 무대 HUD/패널(베이스·애니메이션·살·표시) + CSS
- `src/creature.js` — **공유 코어**: simpleName·boneBox·pickDrivers(구동뼈 선정)·makeBindCaches·
  buildSource·bakeClip(월드 리타깃)·measureClipRootY(사전 접지). main.js·verify 가 함께 쓴다.
- `src/flesh.js` — `growFlesh(drivers, simpleName, flesh)` 로드 뼈 세그먼트 캡슐 → 절차 SkinnedMesh
- `src/main.js` — 무대 전부(씬·로드/전환·재생·UI·`window.__hkt`). 로드·리타깃은 creature.js 사용.
- `public/assets/character/{X Bot,Y Bot}.fbx` — Mixamo 베이스(남/여, with-skin). 스킨은 숨기고 뼈만 쓴다.
- `public/assets/anim/*.fbx` — 동봉 Mixamo 애니메이션(idle/walk/run, 애니메이션 전용). 리타깃 소스.
  (전부 Mixamo 무료 라이선스.)
- `test/rig-verify.mjs` — Node 검증(`npm run verify`) — 공유 코어를 실물 에셋에 구동(데이터 레벨)
- `test/shot.mjs` — 픽셀 검증 게이트(`npm run shot`) — 실제 Chromium 렌더 + 자동 판정 + `test/out/` 스크린샷

## 실행
```bash
npm install
npm run dev       # http://localhost:5173 — 무대에 크리처 한 명(베이스 로드 후 살)
npm run check     # 게이트: verify(데이터) + build + shot(픽셀/스크린샷). 변경 닫기 전 필수.
npm run shot      # 픽셀 검증만 — test/out/*.png 생성(육안 첨부용)
```

## 다음 후보 (사용자와 논의 후)
- 리타깃 접지 다듬기(걷기 전방 기울기·발 미세 부양), 크로스페이드 정착.
- 살 품질: 세그먼트 캡슐 겹침 → 관절 블렌드/메타볼 표면, 정점 법선·손가락 살.
- 살 파라미터 확장(부위별 굵기·비대칭·프리셋) + 베이스 뼈 비율 편집 → 창발 로스터.
- UE5 / HktGameplay 스켈레탈 메시(구운 SkinnedMesh) 익스포트 경로 정리.
