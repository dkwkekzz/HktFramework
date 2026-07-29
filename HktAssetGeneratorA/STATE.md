# STATE — HktAssetGeneratorA

## 현재 상태

- **단계**: Phase 3 완료 (절차적 머티리얼 + CPU 베이크 — Step 3.1~3.7 전부)
  + 손잡이 단면 확장(D-13).
- **다음 작업**: Phase 4 / Step 4.1 — Operation 모델·재생 (`src/material/operations.js`)
  → 사양: [Docs/06-phase4-surface-state.md](Docs/06-phase4-surface-state.md) §Step 4.1
- 게이트: `npm run check` = vitest 83개 (칼날 20종 + 검 5종 + 베이크 golden/결정성/물성).
  golden 갱신은 `npm run golden`.
- 실행: `npm run dev` → 뷰어에서 "베이크(1024²)" 버튼 = Worker CPU 베이크(~2s) →
  PBR 텍스처 적용 미리보기, BaseColor 단독 토글, 텍스처 PNG 다운로드.
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
- [x] Phase 3 — 머티리얼·CPU 베이크 (Step 3.1 ~ 3.7) — 2026-07-29
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
- 2026-07-29: 손잡이 단면 일반화(D-13) — 원/타원/팔각 + 반지름 곡선 + 감기 기하 변위.
  칼날의 전개 레이아웃 기계 재사용, UV 정의 불변.
- 2026-07-29: Phase 3 구현. CPU 래스터라이저의 edge function 부호 버그(전 픽셀 미채움)를
  커버리지 게이트 테스트("빈 베이크 회귀 방지")로 잡음 — 이 게이트가 회귀 방지선.
  1024² 5채널 베이크 ≈ 2초 (Worker, 목표 5초 내). 산화·오염에 반점 확산 항 추가(D-14 —
  원본 §18.3 은 cavity 게이트뿐이라 매끈한 면에 상태가 보이지 않던 문제).
  Atlas 활용률 ~26% 는 letterbox 보정(D-8)의 트레이드오프 — 개선은 Phase 7 몫.

## 이슈 / 어긋남 기록

- 03-phase1 §1.3 은 flat 프로파일을 "4 crease" 로 표기했으나 구현은 6 crease
  (날 2 + 베벨 경계 4) — 시각적으로 더 정확해 채택. 문서 표기와 어긋남만 기록.
- lenticular 계열의 V 방향 텍셀 밀도 편차가 taper 때문에 ~3.9 로 관찰됨(면적 가중 p90/p10).
  02 §6 대로 밀도는 보고 전용이라 게이트는 통과 — Phase 2 Atlas 종횡비 보정(D-8)에서 재평가.
