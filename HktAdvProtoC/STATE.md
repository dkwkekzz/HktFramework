# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 3 완료 → 다음은 Phase 4 (사건 탐지).**
주체는 이제 실제 상태가 아니라 자기 믿음으로 판단한다 — 판단의 유일한 입력은 `BeliefView` 이고, 목적 활성도는 §20 의 11항 전부다. 조직도 같은 파이프라인을 타는 주체가 되어 개인에게 목적을 위임한다. Phase 4 는 지금 쌓이고 있는 change 로그(30일 8천 건)를 **사건**으로 묶는다 — 진입점은 `WorldSystems` 의 `detectEmergentEvents` / `updateEventSummaries` 훅 두 개다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1·2·3 완료 조건 ✓/✗ 37항) · `npm test` (133) · `npm run smoke` · `npm run sim -- --log`
- 실행 기준선은 Phase 3 에서 재고정됐다(`npx vite-node src/scripts/rebaseline.ts`) — Phase 2 의 이관 증명 기록은 `migration-baseline.json` 의 `previous` 에 보존.

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [x] Phase 3 — 주체 판단: 믿음·인식·기억·관계·압력·활성도 11항·softmax 선택 + 조직 주체화 (규칙 44·행동 14) ([Phase-3.md](design/impl/Phase-3.md))
- [ ] Phase 4 — 사건 탐지 (change → 사건 클러스터링·중요도·개입 기회)
- [ ] Phase 5 — 세계 생성 컴파일러 (주제 문장 → WorldDefinition, 15단계 파이프라인)
- [ ] Phase 6 — 자동 검증과 수정 (§34 의미 검증 10종 + §35 자동 시뮬레이션 + 수정 루프)
- [ ] Phase 7 — 플레이어 개입 (동일 행동 체계·지식 필터·성장)
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
