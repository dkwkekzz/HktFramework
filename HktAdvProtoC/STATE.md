# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 8 완료 → 프로토타입 완료(§44 13/13).**
세계는 이제 **보인다.** §36 네 화면이 명세 항목 29개를 전부 표시하고(지도·주체 관찰·사건·생성 검토), 사건은 구조가 아니라 문장으로 읽힌다 — 제목·요약·소문·문서·대화·관찰 묘사 6종이 AI 포트 없이도 나온다. 화면의 핵심은 **시점**이다: 같은 반향수를 개발자 시점은 상태 28항(실제값 28)으로, 플레이어 시점은 2항(실제값 0·감춰짐 26종)으로 보여주고, 같은 사건의 실제 원인 7줄은 플레이어 시점에서 0줄이 된다. 표현이 정보 비대칭을 새게 하지 않는다는 것도 수로 남았다 — 금지 사실 6,106개를 가진 요청 153건에서 누출 0건, 흘리는 포트를 붙이면 그 문장은 폐기된다. 표현 방식은 갈아 끼울 수 있다: `rendering/` 8파일의 import 위반 0건, 같은 SceneViewModel 하나로 Canvas(171회 그리기)와 텍스트(294줄)가 같은 35개 대상을 그린다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase — 전부 완료)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1~8 완료 조건 ✓/✗ 70항 + §44 게이트 13항) · `npm test` (212) · `npm run smoke`(네 화면 브라우저 왕복 + Canvas 픽셀 확인) · `npm run baseline:sim`(§35 기준선 재고정)
- 생성 세계는 `src/content/first-world/` 의 녹화 응답으로 재생된다 — 코퍼스의 출처는 [Phase-5.md](design/impl/Phase-5.md), 수정 라운드의 녹화(`repairs.json`)는 [Phase-6.md](design/impl/Phase-6.md) 에 명시.
- 실행 기준선은 Phase 4 에서 고정된 그대로다 — Phase 5~8 은 수동 세계의 동역학을 건드리지 않았다. Phase 8 은 **읽기만 하는 층**이다(표현은 세계 상태를 바꾸지 않는다, §33).
- 화면은 `core/**`·`generation/**`·`content/**` 를 import 할 수 없고 렌더러는 `SceneViewModel` 밖의 어떤 타입도 import 할 수 없다 — 린트가 상시 강제한다([Phase-8.md](design/impl/Phase-8.md) §8.0).

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [x] Phase 3 — 주체 판단: 믿음·인식·기억·관계·압력·활성도 11항·softmax 선택 + 조직 주체화 (규칙 44·행동 14) ([Phase-3.md](design/impl/Phase-3.md))
- [x] Phase 4 — 사건 탐지: change 태그 전파 + 패턴 6개 → 사건 37건(참여자·중요도·관찰자별 앎·개입 기회) ([Phase-4.md](design/impl/Phase-4.md))
- [x] Phase 5 — 세계 생성 컴파일러: 15단계 파이프라인 + 심볼 테이블 + 오프라인 목 포트 → §41 첫 세계 생성·로드·30일 실행 ([Phase-5.md](design/impl/Phase-5.md))
- [x] Phase 6 — 자동 검증과 수정: 의미 검사기 10종(위반 픽스처로 증명) + §35 판정 8종·다양성/깊이 기준선 + 수정 루프 3라운드로 §41 세계 합격 ([Phase-6.md](design/impl/Phase-6.md))
- [x] Phase 7 — 플레이어 개입: 살던 주체를 조작(특권 코드 0건) + 지식 필터(관찰 불가 152종 노출 0) + §30 참여 5종·방관 + §32 성장(수치 + 선택 구조, 출처 사건 필수) ([Phase-7.md](design/impl/Phase-7.md))
- [x] Phase 8 — 표현 고도화: §36 네 화면 29항 + Event Interpreter 6종(누출 0) + 개발자/플레이어 시점 분리 + §44 최종 게이트 13/13 ([Phase-8.md](design/impl/Phase-8.md))

## 후속 — 시각 표현 1차 개선 (2026-07-28)

Phase 8 이후 화면이 "디버그 다이어그램"으로 보이는 원인을 고쳤다: **ViewModel 에 시각 어휘가 없어**(symbolKey→폰트 글리프, badges→문자열 인쇄) 렌더러가 텍스트로밖에 못 그렸다. `SceneMapMarker` 에 `shapeKey`(구체·결정·피라미드·큐브·깃발)·`size`·`gauge`·`emphasized` 를 더해 의미→시각 번역을 빌더에서 완결하고, `SceneSurface` 에 `poly` 동사를 추가해 개체를 그림자 딸린 입체 도형으로 그린다. 지도 배지·연결 라벨 텍스트는 캔버스에서 걷어냈고(패널·텍스트 렌더러가 갖는다) 팔레트는 다크 게임풍으로 교체. 렌더러 격리(§8.0 — rendering 은 SceneViewModel 만 import)는 그대로 린트가 강제한다. 검증: verify 70/70 · test 216 · smoke 통과.

2차: 라벨 충돌 회피(`rendering/LabelLayout.ts` — 겹치면 위·아래 빈 줄로 밀고 화면 밖은 안쪽으로) + 사건 오버레이 반경 상한 0.5→0.14 (빌더 `normalizeRadius` — 표시는 자리 표식이지 영향 범위 지도가 아니다).

3차: **three.js 3D 뷰** (`rendering/ThreeSceneRenderer.ts`) — 같은 SceneViewModel 을 소비하는 세 번째 렌더러. §13 의 3D 공간 데이터(빌더가 실어 준 elevation/elevationShade)를 높이로 되살린다: 지역=고도 판, 개체=3D 도형 + 발밑 그림자 + 고도 기둥, 사건=바닥 링, 신호=파문 링. 시뮬레이션 화면에 2D↔3D 토글(three 는 3D 첫 진입 시에만 동적 로드 — 코드 분할). 드래그 궤도 회전·휠 줌. 격리 검사기(`checkRendererImports`)는 "프로젝트 내부 경로는 SceneViewModel 만"으로 명확화 — 외부 표현 라이브러리(bare import)는 시뮬레이션 타입을 실어 나를 수 없으므로 위반이 아니다.

## 1차 구현 전수 재검증 (2026-07-28)

기획서 §1~§45 를 목차 순서대로 코드와 재대조 — **충분 33 / 부분 12 / 누락 0**, 갭 12건(G-1~G-12)과 요소별 ViewModel 시각 표현 판정은 [design/impl/Review-DesignValidation.md](design/impl/Review-DesignValidation.md). 핵심 발견: ① 생성 후 미소비 필드군(종족 5필드·hiddenPurposes·resourceProfiles·supports 엣지·knownSecrets) ② 목록 앞쪽만 구현(행동 21→11 — 사회적 조작 축 부재, 관찰 채널 12→8, 확률 용도 5→2, visibleSignals 14→4 발신) ③ 조직 지도 마커 도달 불가·§44-10 게이트 항진 항.

**G-5 수정 완료 (2026-07-29)** — §13 공간이 답할 수 있는 것을 되찾았다: `RegionDefinition.resourceProfiles`(자원·희귀도·노드수)와 `speciesSuitability` 를 정의에 보존 — 생성 세계는 **실제 배치를 세어** 만들고(거짓일 수 없다), §34 열세 번째 검사기 `space.profile` 이 선언↔배치 일치를 상시 감시(위반 픽스처 증명). 지도 ViewModel `SceneMapRegion.ecology` 로 "어디에 무엇이 나고 어느 종이 사는가"가 화면 재료가 됐다. `SpaceConnection.requirements` 는 타입·스키마 금지를 풀고 **런타임이 소비** — `canCross` 로 조건을 평가하고(평가 불가면 닫힘), 두 지역 사이 열린 길 중 가장 싼 것을 쓴다. 플레이어 층에 조건부 지름길 "잔재 능선"(known_threat_level ≥ 85)을 놓아 30일 실측으로 6명 열림/4명 닫힘. verify **82/82** · test **239/239**. 상세: [Review-DesignValidation.md §9](design/impl/Review-DesignValidation.md).

**G-10 수정 완료 (2026-07-29)** — 게이트의 무판정 항과 §32 빈칸: §44-10 판정식의 항진 항(`>= 0` → `> 0`)을 고쳐 "새 목적이 사건 화면에 후속으로 오르는가"까지 실제로 판정하고(게이트 13/13 유지), §32 성장 발생 조건 7종 중 빠져 있던 "기존 능력을 다른 방식으로 사용했다"를 `rule.growth_ability_reapplied`(정지의 손을 짐승이 아니라 사람을 돕는 데 쓴다 — 조건은 §16 능력 정의에서 그대로)로 채웠다. 조건 7종 ↔ 담당 규칙 매핑을 코드에 고정해 verify 가 상시 대조 — 30일 조작에서 7종 전부 발화. 수동 세계 불변이라 기준선 무변경. verify **80/80** · test **233/233**. 상세: [Review-DesignValidation.md §8](design/impl/Review-DesignValidation.md).

**G-1 수정 완료 (2026-07-29)** — 확률을 아무 데나 붙는 수에서 §12 5용도로: `RuleEffect.chanceUse` 라벨 + 위반 8종 검증기(라벨 없음·목록 밖·엔진 전용·원인 없는 주사위·조건에 굴린 주사위·문맥 불일치·결정론 값·라벨만 있음)를 §34 열두 번째 검사기 `rule.chance` 로 세우고(확률 전용 픽스처 9종 + §34 픽스처 12종 — 로드 계약이 아니라 기획 원칙의 자리다), **관찰 실패를 확률화**(임계+15 여유 구간 — 엔진 용도 3/3 실현)해 5/5 를 실행으로 증명. 확률 지점은 `chance` 뿐 아니라 바인딩을 타고 오는 `random_int` 까지 전수 수집(수동·플레이어·실험실·생성 세계 16지점, 라벨 없음 0). 첫 세계는 §42-6 수정 라운드 녹화 3건으로 채웠다. 동반: 관찰 실패로 궤적이 바뀌며 드러난 Phase 5 DoD 3 의 잠복 결함(1라운드 원본이 `rule.healing_care` 파생 상태 쓰기로 중단) — 올리는 세계를 수정 라운드 통과본으로 바꾸고 원본의 중단 이유를 근거에 남김. 기준선 재고정(다양성 28.70→28.50, §35 8/8 유지). verify **79/79** · test **232/232**. 상세: [Review-DesignValidation.md §7](design/impl/Review-DesignValidation.md).

**G-3 수정 완료 (2026-07-29)** — 은닉 목적을 실행 데이터로: `FactionDefinition.hiddenGoalIds` + §34 의미 검사기 11호 `faction.hidden`(위반 픽스처 증명) + 수동 세계 2·첫 세계 5개 조직 연결(첫 세계는 §42-6 수정 라운드 녹화로) + 외부 관찰자 금지 사실 편입(§30·§33.3, 내부자 제외) + §41 초기 상태 6항 검사기(6/6 — 은닉 동기 2건이 처음 실행 데이터 판정). verify **75/75** · test **227/227** · smoke 통과. 잔여: structures/policies(§17 제도) 타입. 상세: [Review-DesignValidation.md §6](design/impl/Review-DesignValidation.md).

**G-2 수정 완료 (2026-07-28)** — §21 사회 행동 10종(행동 24종·규칙 54개) + visibleSignals 자동 발신(선언=발신, 침묵 위반 0) + §19 supports/alternative/completionEffects 소비 + DSL `make_promise`(§25). 과정에서 잠재 결함 3건 동반 수정(조직 기억 중요도 예외·전문에 의한 확신 침식·플레이어 다가가기 후보 충돌). 기준선 재고정(rebaseline + baseline:sim), 첫 세계는 수정 라운드 녹화로 재합격. verify **73/73** · test **222/222**. 상세: [Review-DesignValidation.md §5](design/impl/Review-DesignValidation.md).

## 다음

§44 13항을 통과했으므로 **이 트랙의 프로토타입 범위는 닫혔다.** §43 이 제외한 것들(완성된 경제 시장, 대규모 동시 접속 …)은 별도 기획의 몫이다. 시각 완성도는 위 1차 개선으로 최소선만 넘겼다 — 스프라이트·애니메이션은 여전히 범위 밖.
