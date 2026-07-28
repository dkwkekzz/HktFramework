# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

- 기획서 [design/Design-MMO.md](design/Design-MMO.md) 확정.
- **구현 분해 완료**: 기획서 §42 의 8단계를 그대로 따르되 §37~39(골격·워커·저장·결정론)를 Phase 0 으로 선행 분리 — 총 9개 Phase. 분해 개요와 단계별 상세 설계는 [design/impl/README.md](design/impl/README.md) 참조.
- **Phase 0 완료** — `proto/` 에 Vite+TS 골격, 시드 RNG(RandomContext), 이벤트 스케줄러, §26 루프 골격(no-op 훅), §38 Worker 브리지(+InlineHost), §39 저장 3종·스냅샷/로그 복원, SceneViewModel 경계(린트 강제), 최소 셸 페이지. 테스트 26개 + 실 Chromium 스모크 통과, DoD 5항 전부 체크([design/impl/Phase-0.md](design/impl/Phase-0.md)).
- **기획 개정(2026-07-28)**: 공간 데이터는 3D(x·y 수평 + z 고도), 렌더링은 2D 투영 — 기획서 §13 개정, `Position` 에 z 추가, 거리 계산은 3D 유클리드(`distance3d`), 3D→2D 투영은 ViewModel 빌더 담당.
- **Phase 1 완료** — 수동 세계(지역 2·종족 2·조직 2·개인 5·자원 3·행동 10·규칙 20)가 `proto/src/content/manual-world/` 에 JSON 으로 있고, 상태 스키마 검증(StateStore)·행동 체계·간이 인식/믿음·간이 목적 판단이 §26 루프 훅을 채운다. Phase 0 의 임시 심장박동 이벤트는 제거했고, `initialize_world` 는 기본으로 이 수동 세계를 연다. 테스트 74개 + 실 Chromium 스모크 통과, DoD 5항 전부 체크([design/impl/Phase-1.md](design/impl/Phase-1.md)).
- **시드 42, 30일 관측**: 마을 사냥터 고갈 → 사냥꾼이 숲으로 → 반향수의 습격 → 공포 → 마을 보고 → (위협 믿음 + 식량 부족) → 토벌 소집. 아무도 이 순서를 작성하지 않았다. 같은 생물을 두고 마을은 "공격적 90", 연구자는 "새끼를 지키는 중"이라 믿는다(실제 공격성 21).
- 다음 작업은 Phase 2 (규칙 DSL). Phase 1 의 코드 규칙 20개를 JSON 규칙 언어로 이관한다 — `WorldValidation` 이 행동의 `executionRules` 와 규칙 트리거의 1:1 대응을 강제하므로 이관 누락은 즉시 검증 오류로 드러난다.

## TODO

- [x] Phase 0 — 프로젝트 골격·시드 RNG·스케줄러·Worker 브리지·저장 구조 ([design/impl/Phase-0.md](design/impl/Phase-0.md))
- [x] Phase 1 — 수동 정의된 작은 세계 (규칙 20·행동 10·종족 2·조직 2·개인 5) ([design/impl/Phase-1.md](design/impl/Phase-1.md))
- [ ] Phase 2 — 규칙 DSL (JSON 규칙 언어 + 실행기, 코드 규칙 이관)
- [ ] Phase 3 — 주체 판단 (인식·믿음·기억·관계·목적 활성도·행동 선택)
- [ ] Phase 4 — 사건 탐지 (change → 사건 클러스터링·중요도·개입 기회)
- [ ] Phase 5 — 세계 생성 컴파일러 (주제 문장 → WorldDefinition, 15단계 파이프라인)
- [ ] Phase 6 — 자동 검증과 수정 (§34 의미 검증 10종 + §35 자동 시뮬레이션 + 수정 루프)
- [ ] Phase 7 — 플레이어 개입 (동일 행동 체계·지식 필터·성장)
- [ ] Phase 8 — 표현 고도화 (4개 화면 + Event Interpreter, §44 13항 최종 게이트)
