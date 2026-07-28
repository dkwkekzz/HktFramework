# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 7 완료 → 다음은 Phase 8 (표현 고도화).**
세계에 **사람이 들어왔다.** 플레이어는 새 개체가 아니라 이미 살고 있던 사냥꾼이고, 믿음·기억·관계·비용·행동 예약을 NPC 와 같은 함수로 지난다 — 규칙·효과·행동·판단 11개 모듈에 플레이어 분기는 0건이고, 유일한 분기는 "행동을 시스템이 고르지 않는다"는 `shouldReplan` 한 줄이다(§21·§31). 화면은 세계가 아니라 **아는 것**을 그린다: 관찰 불가 상태 152종 중 노출 0종, 그리고 반향수의 공격성은 실제 0 인데 화면에는 90 으로 뜬다. 성장은 경험치가 아니라 §32 그대로 — 출처 사건이 없는 성장은 기록되지 않고(0건), 새 제약을 받아들이면 능력 출력이 40→80 으로 열린다. 아무것도 하지 않아도 세계는 change 9,000건·사건 33건만큼 흘렀다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1~7 완료 조건 ✓/✗ 62항) · `npm test` (196) · `npm run smoke`(생성 화면 + 플레이어 조작 포함) · `npm run baseline:sim`(§35 기준선 재고정)
- 생성 세계는 `src/content/first-world/` 의 녹화 응답으로 재생된다 — 코퍼스의 출처는 [Phase-5.md](design/impl/Phase-5.md), 수정 라운드의 녹화(`repairs.json`)는 [Phase-6.md](design/impl/Phase-6.md) 에 명시.
- 실행 기준선은 Phase 4 에서 고정된 그대로다 — Phase 5·6·7 은 수동 세계의 동역학을 건드리지 않았다. 개입 층은 `src/content/player-world/` 가 **덧대는** 별도 세계다(§35 는 무개입 판정이므로 그 기준선을 움직일 수 없다 — [Phase-7.md](design/impl/Phase-7.md) "왜 별도의 세계 층인가").

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [x] Phase 3 — 주체 판단: 믿음·인식·기억·관계·압력·활성도 11항·softmax 선택 + 조직 주체화 (규칙 44·행동 14) ([Phase-3.md](design/impl/Phase-3.md))
- [x] Phase 4 — 사건 탐지: change 태그 전파 + 패턴 6개 → 사건 37건(참여자·중요도·관찰자별 앎·개입 기회) ([Phase-4.md](design/impl/Phase-4.md))
- [x] Phase 5 — 세계 생성 컴파일러: 15단계 파이프라인 + 심볼 테이블 + 오프라인 목 포트 → §41 첫 세계 생성·로드·30일 실행 ([Phase-5.md](design/impl/Phase-5.md))
- [x] Phase 6 — 자동 검증과 수정: 의미 검사기 10종(위반 픽스처로 증명) + §35 판정 8종·다양성/깊이 기준선 + 수정 루프 3라운드로 §41 세계 합격 ([Phase-6.md](design/impl/Phase-6.md))
- [x] Phase 7 — 플레이어 개입: 살던 주체를 조작(특권 코드 0건) + 지식 필터(관찰 불가 152종 노출 0) + §30 참여 5종·방관 + §32 성장(수치 + 선택 구조, 출처 사건 필수) ([Phase-7.md](design/impl/Phase-7.md))
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
