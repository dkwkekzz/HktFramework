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

## 다음

§44 13항을 통과했으므로 **이 트랙의 프로토타입 범위는 닫혔다.** §43 이 제외한 것들(완성된 경제 시장, 대규모 동시 접속 …)은 별도 기획의 몫이다. 시각 완성도는 위 1차 개선으로 최소선만 넘겼다 — 스프라이트·애니메이션은 여전히 범위 밖.
