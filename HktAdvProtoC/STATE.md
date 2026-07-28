# STATE.md

> 이 문서는 **지금 어디에 있는가**만 보여준다. 완료된 단계의 상세는 각 단계 문서가 갖는다.

## 현재 위치

**Phase 5 완료 → 다음은 Phase 6 (자동 검증과 수정).**
세계는 이제 **다섯 문장에서 만들어진다** — §41 의 주제 5개가 15단계 컴파일러를 지나 §40 규모의 `WorldDefinition`(규칙 59·지역 3·장소 12·종족 4·조직 5·인물 20·능력 5·개체 136)이 되고, 그 정의가 **수정 없이** 런타임에 올라가 30일을 돈다. 그 안에서 밀수 적발·능력 발현·조직 대치처럼 생성물에서만 나올 수 있는 사건이 스스로 생긴다. 생성 호출은 전부 구조화 입력만 받고(최대 3KB), 오프라인 목 포트로 재현된다. Phase 6 은 이 산출물을 §34 의미 검증 10종과 §35 자동 시뮬레이션으로 심판한다.

- 기획서: [design/Design-MMO.md](design/Design-MMO.md) (확정) · 구현 분해: [design/impl/README.md](design/impl/README.md) (총 9개 Phase)
- 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 2026-07-28 기획 §13 개정
- 검증: `cd proto && npm run verify` (Phase 1·2·3·4·5 완료 조건 ✓/✗ 49항) · `npm test` (161) · `npm run smoke`(생성 화면 포함) · `npx vite-node src/scripts/generate-first-world.ts`
- 생성 세계는 `src/content/first-world/` 의 녹화 응답으로 재생된다 — 코퍼스의 출처(무엇이 Phase 1~4 의 손 데이터이고 무엇이 새로 쓴 것인지)는 [Phase-5.md](design/impl/Phase-5.md) 에 명시.
- 실행 기준선은 Phase 4 에서 고정된 그대로다 — Phase 5 는 수동 세계의 동역학을 건드리지 않았다(규칙 엔진의 오류 메시지에 규칙 id 를 붙인 것이 유일한 코어 변경).

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([Phase-1.md](design/impl/Phase-1.md))
- [x] Phase 2 — 규칙 DSL: 실행기 6모듈 + 규칙 20개 JSON 이관(코드 규칙과 30일 로그 완전 일치) ([Phase-2.md](design/impl/Phase-2.md))
- [x] Phase 3 — 주체 판단: 믿음·인식·기억·관계·압력·활성도 11항·softmax 선택 + 조직 주체화 (규칙 44·행동 14) ([Phase-3.md](design/impl/Phase-3.md))
- [x] Phase 4 — 사건 탐지: change 태그 전파 + 패턴 6개 → 사건 37건(참여자·중요도·관찰자별 앎·개입 기회) ([Phase-4.md](design/impl/Phase-4.md))
- [x] Phase 5 — 세계 생성 컴파일러: 15단계 파이프라인 + 심볼 테이블 + 오프라인 목 포트 → §41 첫 세계 생성·로드·30일 실행 ([Phase-5.md](design/impl/Phase-5.md))
- [ ] Phase 6 — 자동 검증과 수정 (§34 의미 검증 10종 + §35 자동 시뮬레이션 + 수정 루프)
- [ ] Phase 7 — 플레이어 개입 (동일 행동 체계·지식 필터·성장)
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
