# step-0030 concepts — Box-per-File Split, Verify-Kit Promotion, Close Gate

> 정식 기록: [step-0030.md](step-0030.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 박스=파일 분할 (box-per-file) | 프로토타입 파일 구조를 목표 토폴로지(박스=독립 서버)와 1:1 로 맞추는 분할 | net-core 124.8KB → 진입점 2.5KB + 부품 13개 |
| 승격 (promotion to engine) | 안정화·동결된 공유 자산을 복사 전진에서 빼내 `engine/` 한 곳에 두는 것 | 누적 회귀 18모드 → `engine/verify-kit.js` |
| 닫기 게이트 (close gate) | step 닫기 체크리스트 중 기계 판정 가능분의 자동 실행 | `engine/close-step.js` 한 줄 |
| 2-커밋 관행 | 기계 복사(scaffold)와 에이전트 델타를 커밋으로 분리 | 이 step 부터의 작업 관행 |
| verbatim 이동 | 코드 본문을 한 글자도 다시 쓰지 않는 기계 절단·이동 — 회귀 0 의 보증 장치 | 분할·승격 둘 다의 실행 방식 |

## 1. 왜 "정리 step" 인가 — 비용 곡선도 인프라다

이 시리즈의 제1 운영 제약은 *원격 headless 검증*이지만, 그 검증을 *수행하는 에이전트의 작업 비용*도 시리즈가 30 step 을 넘으며 무시할 수 없는 인프라 문제가 됐다. 복사 전진(anti-DRY)은 동결 스냅샷을 위한 옳은 설계지만, 산물이 **단일 파일**로 누적되면 매 step 의 탐색(Grep)·수정(Edit)·부분 읽기 비용이 파일 크기에 비례해 커진다 — 0029 시점 net-core.js 124.8KB·verify.js 73.7KB. 이 step 은 프로토콜을 더하지 않고 이 곡선만 꺾는다. 검증 기준은 기능 step 과 동일하게 4기둥 — 특히 "구조 변경 = 동작 불변" 을 reg 비트 동일로 증명한다.

## 2. 박스=파일 분할 — 파일 경계가 곧 미래의 서버 경계

CLAUDE.md 는 이미 "한 step 의 박스가 4개를 넘으면 박스 1개=파일 1개" 를 규정했지만, 누적 박스 10개가 한 파일에 살고 있었다(임계의 2.5배). 분할 후 구조가 SPINE 6계층과 정렬된다: `gateway.js`(엣지) · `zone.js`(월드) · `svc-*.js`(게임 서비스·버스) · `orchestrator.js`(코디네이션) · `persist.js`(데이터) · `client.js` + 배선(`topology.js`)·회계(`metrics.js`)·공통(`common.js`). 진입점 `net-core.js` 는 부품을 묶어 **0029 와 동일한 export 집합**을 노출하므로 run.js·host.js·cluster.js·panel.js·verify 의 require 인터페이스가 무변경이다. 박스를 독립 OS 프로세스/원격 서버로 승격할 때 파일 경계가 그대로 서버 경계가 된다 — 분할은 편의가 아니라 목표 토폴로지의 *예행*이다.

## 3. verify-kit 승격 — "step 산출물" 과 "시리즈 공유 자산" 의 구분

verify.js 의 18개 모드 중 이번 step 고유분은 통상 1개뿐이고 나머지는 과거 step 의 *동결 가설*(잔존 회귀)이다. 동결된 것을 step 마다 복사 전진할 이유가 없다 — 그것은 `engine/index.js`(VM 커널)·`panel-kit.js`(관찰 키트)와 같은 **시리즈 공유 자산**이다. `makeVerifyKit(ctx)` 는 ctx(NET·NETPREV·시드·상수)를 받아 MODES·ORDER·cli 를 돌려주고, 새 step 은 `kit.MODES['<mode>'] = fn` 으로 자기 가설만 더한다. 공유 가변 코드가 된 키트의 안전망은 spine 사슬(키트를 쓰는 전 step 의 reg 동시 실행) — 단 키트에서 *모드 제거는 금지*(추가만), 제거가 필요하면 그 모드의 도입 step 문서에 폐기 사유를 남기고 별도 step 으로.

## 4. 닫기 게이트와 2-커밋 — 판단이 필요 없는 일은 기계로

닫기 체크리스트의 절반은 기계 판정이다(검증 exit 0·크기 예산·산출물 존재·INDEX 행). `node engine/close-step.js` 가 이를 한 줄로 돌고, 에이전트는 판단분(척추 5항·수치 대조·STATE §1~6)만 남긴다. 2-커밋 관행도 같은 원리 — 기계 복사분(scaffold)을 먼저 커밋해 두면 두 번째 커밋이 *이 step 의 실질 델타*만 담아, 리뷰와 self-diff 가 복사 페이로드에서 해방된다.

## 한 줄 요약

**동작을 1비트도 바꾸지 않고(reg 25/25·spine 30-step) — 단일 128KB 를 박스 13파일로, 누적 회귀 74KB 를 engine 1곳으로, 닫기 절반을 스크립트 한 줄로 옮겨 — step 작업 비용이 step 수에 비례해 터지는 곡선을 꺾었다.**
