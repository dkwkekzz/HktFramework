# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 2 완료 → 다음은 Phase 3 (주체 판단).**
규칙은 이제 전부 JSON 이다(`content/manual-world/rules/*.json`). Phase 3 은 Phase 1 의 간이 판단(활성도 2항·최고 점수 1개)을 기획서 §19~§25 의 전체 모델(인식·믿음·기억·관계·목적 활성도·행동 선택)로 교체한다 — 교체 지점은 `AgentRuntime` 의 네 함수다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1·2 완료 조건 ✓/✗ 28항) · `npm test` · `npm run smoke` · `npm run sim -- --log`

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [ ] Phase 3 — 주체 판단 (인식·믿음·기억·관계·목적 활성도·행동 선택)
- [ ] Phase 4 — 사건 탐지 (change → 사건 클러스터링·중요도·개입 기회)
- [ ] Phase 5 — 세계 생성 컴파일러 (주제 문장 → WorldDefinition, 15단계 파이프라인)
- [ ] Phase 6 — 자동 검증과 수정 (§34 의미 검증 10종 + §35 자동 시뮬레이션 + 수정 루프)
- [ ] Phase 7 — 플레이어 개입 (동일 행동 체계·지식 필터·성장)
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
