# STATE — HktAssetGeneratorA

## 현재 상태

- **단계**: Phase 2 완료 (가드·손잡이·폼멜·조립·Atlas — Step 2.1~2.6 전부).
- **다음 작업**: Phase 3 / Step 3.1 — 결정적 노이즈 (`src/core/noise.js`)
  → 사양: [Docs/05-phase3-material-bake.md](Docs/05-phase3-material-bake.md) §Step 3.1
- 게이트: `npm run check` = vitest 67개 (칼날 golden 20종 + 검 golden 5종 + 부품·조립·Atlas).
  golden 갱신은 `npm run golden` (프리셋 파라미터 테이블은 tools/gen-golden.mjs).
- 실행: `npm run dev` → 뷰어(검 전체 조립, 부품 토글, 프리셋/슬라이더/UV 프리뷰/GLB 다운로드).
  Node 22 LTS 로 `engines` 고정.

## 문서 이정표

| 문서 | 상태 |
|---|---|
| Docs/00-original-design.md | 확정 (수정 금지) |
| Docs/01-review.md | 확정 — 결정 D-1~D-12 |
| Docs/02-architecture.md | 확정 — 공통 규약 |
| Docs/03~07 (Phase 1~5) | 확정 — Step 단위 구현 사양 |
| Docs/08 (Phase 6~8) | 경계만 확정 — 착수 시 구체화 |

## Phase 진행

- [x] Phase 1 — 칼날 생성기 (Step 1.1 ~ 1.8) — 2026-07-29
- [x] Phase 2 — 가드·손잡이·폼멜·조립·Atlas (Step 2.1 ~ 2.6) — 2026-07-29
- [ ] Phase 3 — 머티리얼·CPU 베이크 (Step 3.1 ~ 3.7)
- [ ] Phase 4 — 표면 상태 Operation (Step 4.1 ~ 4.5)
- [ ] Phase 5 — 참조 이미지 형상 맞춤 (Step 5.1 ~ 5.5) ※ Phase 3~4 와 병행 가능
- [ ] Phase 6+ — AI 보조·빌드 최적화·도메인 확장

## 결정 이력

- 2026-07-29: 트랙 생성. 원본 설계 검토 → D-1~D-12 확정
  ([Docs/01-review.md](Docs/01-review.md)). 치명 모순 2건(가드 UV overlap, tip degenerate)과
  아키텍처 모순 1건(Node WebGL 베이크)을 수정판 설계에 반영.
- 2026-07-29: Phase 1 구현. 감김 방향은 부호 부피(>0) 검사로 경험 확정 — 원본 §7.2 의
  (a,c,b) 감김은 본 프레임 규약(binormal = tangent×normal)에서 안쪽을 향해 반전함
  (blade.js 주석·topology.signedVolume 테스트로 고정).
- 2026-07-29: golden 프리셋은 별도 JSON 수기 작성 대신 tools/gen-golden.mjs 의 파라미터
  테이블에서 생성해 test/golden/*.json 으로 출력(JSON 이 커밋 산출물인 점은 03 문서와 동일).
- 2026-07-29: Phase 2 구현. 가드 면 감김은 부호 부피로 판정 불가(면이 y=0 평면이라 기여 ≈ 0)
  → 앞면 +Y / 뒷면 -Y 노멀 테스트로 경험 확정. Atlas 종횡비 보정(D-8)은 완전 균등화 대신
  이방성 상한 2.0 의 부분 보정으로 구현 — 완전 균등화는 Atlas 공간 낭비가 커서
  (근거: uv/atlas.js ANISOTROPY_CAP 주석).
- 2026-07-29: 개방 경계 규약 구체화 — 손잡이 = 링 2개(2×radial), 폼멜 = 위 링 1개(radial),
  칼날·가드 = 0. gen-golden 과 테스트가 부품별 기대치를 검사.

## 이슈 / 어긋남 기록

- 03-phase1 §1.3 은 flat 프로파일을 "4 crease" 로 표기했으나 구현은 6 crease
  (날 2 + 베벨 경계 4) — 시각적으로 더 정확해 채택. 문서 표기와 어긋남만 기록.
- lenticular 계열의 V 방향 텍셀 밀도 편차가 taper 때문에 ~3.9 로 관찰됨(면적 가중 p90/p10).
  02 §6 대로 밀도는 보고 전용이라 게이트는 통과 — Phase 2 Atlas 종횡비 보정(D-8)에서 재평가.
