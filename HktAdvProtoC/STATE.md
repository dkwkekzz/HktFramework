# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 6 완료 → 다음은 Phase 7 (플레이어 개입).**
생성된 세계는 이제 **스스로 심판받는다** — §34 의미 검증 10종(각각 위반 픽스처로 증명)과 §35 무개입 30일 판정 8종을 거쳐야 "공개 가능"이 된다. §41 첫 세계는 이 관문에서 네 가지 결함이 드러났고(파생 상태를 쓰는 규칙 / 원하는 것이 하나도 없던 치유사 / 아무에게도 말을 걸 수 없던 밀수단 / 무한히 자라는 숲), 수정 루프가 원인 단계만 증분 재생성해 **3라운드 만에 합격**시켰다. 다양성·깊이 합격선은 임의 상수가 아니라 수동 세계의 측정치다. Phase 7 은 이 합격 게이트 뒤에서 플레이어를 한 주체로 세운다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1~6 완료 조건 ✓/✗ 55항) · `npm test` (178) · `npm run smoke`(생성 화면 포함) · `npm run baseline:sim`(§35 기준선 재고정)
- 생성 세계는 `src/content/first-world/` 의 녹화 응답으로 재생된다 — 코퍼스의 출처는 [Phase-5.md](design/impl/Phase-5.md), 수정 라운드의 녹화(`repairs.json`)는 [Phase-6.md](design/impl/Phase-6.md) 에 명시.
- 실행 기준선은 Phase 4 에서 고정된 그대로다 — Phase 5·6 은 수동 세계의 동역학을 건드리지 않았다(Phase 6 의 코어 변경은 `BeliefView.knowsAgent` 조직 갈래 한 줄기뿐, 3개 시드 기준선 불변).

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [x] Phase 3 — 주체 판단: 믿음·인식·기억·관계·압력·활성도 11항·softmax 선택 + 조직 주체화 (규칙 44·행동 14) ([Phase-3.md](design/impl/Phase-3.md))
- [x] Phase 4 — 사건 탐지: change 태그 전파 + 패턴 6개 → 사건 37건(참여자·중요도·관찰자별 앎·개입 기회) ([Phase-4.md](design/impl/Phase-4.md))
- [x] Phase 5 — 세계 생성 컴파일러: 15단계 파이프라인 + 심볼 테이블 + 오프라인 목 포트 → §41 첫 세계 생성·로드·30일 실행 ([Phase-5.md](design/impl/Phase-5.md))
- [x] Phase 6 — 자동 검증과 수정: 의미 검사기 10종(위반 픽스처로 증명) + §35 판정 8종·다양성/깊이 기준선 + 수정 루프 3라운드로 §41 세계 합격 ([Phase-6.md](design/impl/Phase-6.md))
- [ ] Phase 7 — 플레이어 개입 (동일 행동 체계·지식 필터·성장)
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
