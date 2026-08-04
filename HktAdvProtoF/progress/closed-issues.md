# 닫힌 이슈·상환된 소급 부채

> STATE.md 에서 분리한 **해결 완료 기록** (CLAUDE.md·WORKFLOW §8 규칙).
> 아직 열려 있는 이슈의 원본 장부는 [STATE.md](../STATE.md) 열린 이슈 표다 — 이 문서는 그 표에서
> 내려온 것만 담는다. 리뷰 원본은 [reviews/](../reviews/README.md).

## 닫힌 이슈

| 이슈 | 내용 한 줄 | 출처 | 미러 | 상환 |
|---|---|---|---|---|
| V3 증거 강등 커밋 | `evidence/V3.json` 이 D2 완료 커밋부터 `IMPLEMENTED`(스냅샷 신선도 테스트 1건 실패)로 강등된 채 커밋됨 — 원인은 증거 생성기가 루프 안에서 증거를 즉시 써서 lab 스냅샷이 낡아지는 순서 버그 | [단계 0 리뷰 §3](../reviews/stage0-review.md) | [#662](https://github.com/dkwkekzz/HktFramework/issues/662) | **상환(V4-e)** — `collectEvidence` 가 검증 전량 → 일괄 기록 두 마당으로 나누고 `recordingOrderViolations` 가 위반 시 exit 1. 증거 20개 내용이 전부 바뀌는 재생성에서도 한 바퀴에 20/20 VERIFIED. WORKFLOW §5 에 `verify` exit 0 커밋 조건 명문화 |
| 레지스트리 증거 교차검사 비활성 | `verify/v0.ts` 가 `buildRegistry(sources)` 를 증거 맵 없이 호출해 `evidence-unsupported` 관문이 실전에서 돌지 않음. "착수 가능" 목록도 미착수 계약 미등록으로 항상 빈다 | [단계 0 리뷰 §3](../reviews/stage0-review.md) | [#663](https://github.com/dkwkekzz/HktFramework/issues/663) | **상환(V0-c)** — `buildRegistry(sources, { evidence, sourceHashes })` 로 연결하고, 소스 명부(`MODULE_SOURCES`)·해시 공식(`hashSources`)을 증거를 만드는 쪽과 대조하는 쪽이 함께 쓴다. 강등·낡음·없음 셋을 실제 계약으로 재현해 판정에 넣었다(exit 1 조건). 착수 가능 목록은 **P3 를 PLANNED 로 선등록**해 해소 |
| 보고 문서 정비 | STATE.md 표가 빈 줄로 쪼개져 렌더링(P2 병합에서 해소) · 증거 생성기 경로 오기(해소 — 실물은 `packages/lab/verify/evidence.ts`) · progress/ 분리 미이행 · 부채 표 Lab 자동화 항목에 상환 카드 미지정 | [리뷰 인덱스](../reviews/README.md) | [#664](https://github.com/dkwkekzz/HktFramework/issues/664) | **상환(2026-08-03)** — 단계 0·1 상세를 [progress/stage-0.md](stage-0.md)·[progress/stage-1.md](stage-1.md) 로 분리하고 STATE.md 는 모듈·상태·한 줄 장면만 남김(79행 → 단계별 표 3개). 부채 표의 Lab 자동화 항목에 상환 카드(V3-b Playwright 스모크)를 명시 |
| MasterPlan §10 능력 체계 매핑 격차 | §10(표현 6종·강도 식·mastery·stability·저항)이 ModulePlan·MODULES.md 검색 0건 — 작동 체계의 주인 모듈이 없다 | [리뷰 인덱스](../reviews/README.md) | [#666](https://github.com/dkwkekzz/HktFramework/issues/666) 닫음 | **상환(2026-08-03)** — CLAUDE.md 에 북극성 2개(넨급 능력 문법·방대한 세계관) 명문화 + MODULES.md 에 북극성 대조표·G5 확장(PersonalAbility 전체 문법)·G6 신설(강도 판정, §10.2 식)·E3 소비 연결. 남은 자리: `unknownDomains`·`dangerScale` 소유 모듈은 W 계층 착수 시 작업 카드 |
| 능력 정보 표면·판정의 정보 의존 (격차 A) | G5 `PersonalAbility` 에 노출/은닉/오인/봉쇄 정보 표면이 없고, E3 가 G6 스칼라(`EffectMagnitude`)만 소비 — 능력 충돌이 숫자 비교로 퇴화할 위험 | [북극성 검토](../reviews/northstar-critique.md) §2 | (이 검토 PR 로 알림) | **상환(기획 반영, 2026-08-03)** — MODULES.md G5 행(정보 표면 4필드 + 계통 간 적성 + 다산성 검사)·E3 행(판정 입력에 `BeliefGraph` 절편·준비·환경) 계약 문안 편입. 두 계층 미착수라 소급 비용 0. 구현·검증(정보 상태만 바꿔 승패가 뒤집히는 장면)은 착수 시 계약이 강제 |
| 장르 변주 장치 부재 (격차 B) | 사건 생성 축이 결핍→압력→충돌 하나 — 제도 무대(시험·경매·규칙 게임·선거·계승전)를 주체 결핍에서 도출하는 소유 모듈이 없다 | 같은 검토 §3 | (동일) | **상환(기획 반영, 2026-08-03)** — MODULES.md **E5 신설**(`InstitutionalStage` — sponsor 결핍에서 도출, 저작 무대 거부, 무대별 해결 방식 변주·연속성 검증 포함). 구현·검증은 E 계층 착수 시 계약이 강제 |
| P3 Chromium 눈검증 미완 | 단계 2 표에서 P3 행만 "(Chromium 확인 필요)" 인 채 단계가 닫혔다 | [단계 2 리뷰 §3-1](../reviews/stage2-review.md) | [#673](https://github.com/dkwkekzz/HktFramework/issues/673) 닫음 | **상환(2026-08-03)** — `/#/p3` 를 Chromium(Playwright)으로 실측: 7섹션 채움·빈칸 0, 표 7개·33행, SVG 5장면(노드 11·11·11·16·16 / 간선 10·10·10·23·14), 붉은 행 0, 페이지 요청 4xx 0. P3 행 괄호를 실측으로 교체, R0 착수 전 게이트 조건 해소 |
| P4 무게표 원문 순서 비단조 | `p4/factor.ts` 무게가 원문 순서와 어긋나는 자리 둘 + docblock 이 "순서를 거스르지 않는 선에서" 라고 사실과 다르게 주장 | [단계 2 리뷰 §3-2](../reviews/stage2-review.md) | [#674](https://github.com/dkwkekzz/HktFramework/issues/674) 닫음 | **상환(2026-08-03, 판정: 순서=나열)** — 원문 순서는 나열이지 무게의 단조 규정이 아니다. 무게는 P4 의 선언으로 명시하고 어긋나는 자리 둘의 의도(가치관>비용·위험 — 사람이 갈리는 자리가 값싼 셈보다 앞선다 · 매몰>관계·기억·약속 — 머무름의 값은 요소 안에서 선다)를 출처표 docblock 에 기록. 검증된 장면·점수는 바뀌지 않았다(테스트 1218 통과·verify exit 0·P4 증거만 재생성). 무게를 단조로 바꾸는 쪽(장면 소급)은 원하면 별도 작업 카드 |
| 물리 벽 우회 장면 재검증 | 단계 2 완료 조건 ③ "벽이 있으면 우회" 는 물리 벽이 아직 없어 구조적 우회로만 확인됨 | [단계 2 리뷰 §3-3](../reviews/stage2-review.md) | [#675](https://github.com/dkwkekzz/HktFramework/issues/675) 닫음 | **상환(기획 반영, 2026-08-03)** — MODULES.md **W4 행**에 예약된 검증 장면으로 편입("벽 하나를 세우면 같은 목적의 `ActionPlan` 이 우회 경로로 갈라진다"). W4 미착수라 소급 비용 0 — 착수 시 계약이 강제 |

## 상환된 소급 부채 (WORKFLOW §5)

V0~V4 자체가 없는 동안 5~7단계를 수동으로 수행하며 쌓인 부채 중 상환된 것.

| 부채 | 상환 | 상태 |
|---|---|---|
| V1 시나리오가 `Scenario{arrange,act,assert}` 가 아니다 | **V2-b 로 상환** — `suites/v1.ts` | 완료 |
| 계약이 레지스트리에 등록되지 않았다 | **V0 으로 상환** — `buildRegistry` 가 실제 계약을 검사 | 완료 |
| 증거를 손으로 쓴 스크립트가 만든다 | **V4 로 상환** — `buildEvidence` 가 유일한 status 판정자 | 완료 |
| Lab 페이지가 없다 | **V3 으로 상환** — 모듈당 페이지 1개, 화면 7요소 | 완료 |

## 검증 파이프라인 이슈 두 건

**검증 파이프라인 이슈 두 건이 모두 닫혔다.** 단계 0 리뷰는 둘을 **P0 착수 전**에 닫으라고
적었으나, P0~P2 는 리뷰가 main 에 오르기 전에 병렬로 진행되어 그 조건을 지나쳤다. 지금은
갚았다 — 증거 생성기의 순서 버그는 V4-e 로(한 바퀴에 20/20 VERIFIED), 레지스트리 증거
교차검사는 V0-c 로(강등·낡음·없음 셋이 실제 계약에서 기각되고, 착수 가능 목록이 P3 를 계산한다).
**P3 착수 전 게이트는 비어 있었고, P3 은 그 위에서 착수했다.**
