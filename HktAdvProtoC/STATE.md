# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 4 완료 → 다음은 Phase 5 (세계 생성 컴파일러).**
세계는 이제 자기가 겪은 일을 **사건**으로 읽는다 — change 로그(30일 8천 건)가 6개 패턴으로 묶여 37건의 사건이 되고, 각 사건은 참여자(종족·조직·개인)·영향 상태·중요도(§29 6항)·관찰자별 앎(§30)을 갖는다. 아무도 작성하지 않은 대립(마을은 위협 믿음을 가라앉히려 하고 마을 사람들은 알리려 한다)이 사건 안에서 자동 판정된다. Phase 5 는 지금까지 손으로 쓴 데이터 포맷(규칙·목적·행동·사건 패턴)을 **주제 문장에서 생성**한다 — Phase 1~4 의 실행 포맷이 곧 생성기의 출력 계약이다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1·2·3·4 완료 조건 ✓/✗ 43항) · `npm test` (146) · `npm run smoke` · `npm run sim -- --log`
- 실행 기준선은 Phase 4 에서 재고정됐다(`npx vite-node src/scripts/rebaseline.ts`) — 태그·id 추가로 로그 해시만 바뀌고 변경 건수·개체 상태 해시·규칙 발동 횟수는 Phase 3 과 동일(= 동역학 무변경 증명). Phase 2 의 이관 증명 기록은 `migration-baseline.json` 의 `previous` 에 보존.

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [x] Phase 3 — 주체 판단: 믿음·인식·기억·관계·압력·활성도 11항·softmax 선택 + 조직 주체화 (규칙 44·행동 14) ([Phase-3.md](design/impl/Phase-3.md))
- [x] Phase 4 — 사건 탐지: change 태그 전파 + 패턴 6개 → 사건 37건(참여자·중요도·관찰자별 앎·개입 기회) ([Phase-4.md](design/impl/Phase-4.md))
- [ ] Phase 5 — 세계 생성 컴파일러 (주제 문장 → WorldDefinition, 15단계 파이프라인)
- [ ] Phase 6 — 자동 검증과 수정 (§34 의미 검증 10종 + §35 자동 시뮬레이션 + 수정 루프)
- [ ] Phase 7 — 플레이어 개입 (동일 행동 체계·지식 필터·성장)
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
