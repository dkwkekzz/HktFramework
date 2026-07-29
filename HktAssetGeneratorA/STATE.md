# STATE — HktAssetGeneratorA

## 현재 상태

- **단계**: 설계 완료, 구현 미착수.
- **다음 작업**: Phase 1 / Step 1.1 — 코어 수학·결정성 기반 (`src/core/`)
  → 사양: [Docs/03-phase1-blade.md](Docs/03-phase1-blade.md) §Step 1.1
- 프로젝트 스캐폴드(package.json / index.html / vite / vitest) 도 Step 1.1 에서 함께 생성.
  Node 버전은 생성 시점의 LTS 로 `engines` 에 고정할 것 (02-architecture §5-5).

## 문서 이정표

| 문서 | 상태 |
|---|---|
| Docs/00-original-design.md | 확정 (수정 금지) |
| Docs/01-review.md | 확정 — 결정 D-1~D-12 |
| Docs/02-architecture.md | 확정 — 공통 규약 |
| Docs/03~07 (Phase 1~5) | 확정 — Step 단위 구현 사양 |
| Docs/08 (Phase 6~8) | 경계만 확정 — 착수 시 구체화 |

## Phase 진행

- [ ] Phase 1 — 칼날 생성기 (Step 1.1 ~ 1.8)
- [ ] Phase 2 — 가드·손잡이·폼멜·조립·Atlas (Step 2.1 ~ 2.6)
- [ ] Phase 3 — 머티리얼·CPU 베이크 (Step 3.1 ~ 3.7)
- [ ] Phase 4 — 표면 상태 Operation (Step 4.1 ~ 4.5)
- [ ] Phase 5 — 참조 이미지 형상 맞춤 (Step 5.1 ~ 5.5) ※ Phase 3~4 와 병행 가능
- [ ] Phase 6+ — AI 보조·빌드 최적화·도메인 확장

## 결정 이력

- 2026-07-29: 트랙 생성. 원본 설계 검토 → D-1~D-12 확정
  ([Docs/01-review.md](Docs/01-review.md)). 치명 모순 2건(가드 UV overlap, tip degenerate)과
  아키텍처 모순 1건(Node WebGL 베이크)을 수정판 설계에 반영.

## 이슈 / 어긋남 기록

(없음)
