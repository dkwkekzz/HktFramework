---
name: hgo-atom-review
description: HGO 원자 트랙의 닫힌 step 들을 10개 묶음으로 회고 리뷰한다 — 한 일 요약 + 척추 정합성 4항 감사(실물 코드 + verify 재현) + 이슈→후속 step 연결. 사용자가 "HGO 리뷰/step 리뷰/묶음 정리/리뷰 진행"을 요청하면 사용.
---

# HGO 원자 트랙 묶음 리뷰 루프 — 토큰 효율 실행 절차

이 스킬은 atom 트랙의 닫힌 step 들을 **10개 묶음**으로 회고 감사한다. step-loop(`hgo-atom-step`)이 *세계를 굴리는* 것과 직교 — 리뷰는 *굴러간 것을 검증·정리*하고 **이슈를 전방(다음 step)으로 연결**한다. **작업 디렉토리: `HGO/atom/`** — 이하 상대 경로는 이 폴더 기준. 산출물은 `reviews/review-NNNN-MMMM.md` + `reviews/README.md`(원장) 갱신 둘뿐. **시뮬 코드·STATE·step 문서는 읽기만**(리뷰는 atom 을 안 바꾼다 — 골든 비트 불변).

## 핵심 원칙 — 리뷰는 "주장"이 아니라 "재현"이다

step 문서의 PASS 는 *주장*이다. 리뷰의 권위는 **실물 코드(`engine/*.js`) + verify 재현 + grep 감사**다. "문서가 PASS 라 함"으로 닫지 마라 — 직접 돌려 수치를 인용하고, 코드 라인(`file:line`)으로 알리바이를 댄다. 문서-코드 불일치를 찾는 게 리뷰의 본령.

## 1. 읽기 — 허용 목록만

**필독**: `HGO/SPINE.md`(§5 척추 체크 4항·§9 검증 4기둥) · `HGO/atom/STATE.md`(§7 INDEX 로 묶음 범위 확인) · `reviews/README.md`(열린 이슈 원장 — 직전 묶음이 이월한 것).

**묶음 step 문서**: 그 10개 `steps/step-NNNN.md` 만(전체 읽기 OK — 리뷰 대상). 묶음 밖 옛 step·다른 트랙(render/net) 문서는 읽지 마라.

**실물 코드(부분 읽기)**: 그 묶음이 더한 법칙을 `engine/hgo-laws.js`·`engine/hgo-kernel.js` 에서 Grep/offset 으로 *해당 함수만*. 전체 통독 금지(큰 파일). 노브 가드(`if(!k) return`)·ledger/hash 가법 가드(`if(sim.xxx)`)가 실제로 걸렸는지 *눈으로* 확인.

## 2. 더할 것은 둘 — 복사·누적 폐기

1. **리뷰 1편** — `reviews/review-NNNN-MMMM.md`(아래 §3 4절 구조). ≤ 12KB. 닫으면 불변(역사).
2. **README 원장 갱신** — `reviews/README.md` §1 인덱스 1줄 append + §2 열린 이슈 원장 갱신(해소분 떨굼·신규 이월).

그 외 복사 0. 리뷰는 step 문서를 복제하지 않는다(요약·교차 참조만).

> **근본 이론은 별도**: *왜 이런 설계인가*(보존량 다발·세 기둥·step 순서·빛 2트랙)는 묶음 무관이라 `reviews/FOUNDATIONS.md` 1벌에 산다(묶음마다 재서술 금지). 새 묶음이 *근본 철학*에 닿는 발견을 하면 FOUNDATIONS 를 가법 갱신, 묶음별 정합성은 review-NNNN 에. 권위는 SPINE — FOUNDATIONS 는 말로 푼 해설.

## 3. 리뷰 문서 4절 구조 (고정)

- **§1 한 일 요약** — 10 step arc 를 Phase 별 표로(step|법칙|*메운 이론적 빈칸*|핵심 수치 1개). "무엇"보다 *왜 그 순서·무엇을 가능케 했나*.
- **§2 척추 정합성** — SPINE §5 4항(①단일 척추 ②창발 환원 ③국소 ④닫힌 장부) 각각 판정(✅/🟡/🔴) + **코드 알리바이**(`file:line`). 비판적으로 — 견고한 것은 견고하다 하고, 긴장·편차는 숨기지 말고 *이슈로 승격*. 회귀 0 규율 구현 품질도 메타로.
- **§3 검증 재현** — 대표 step 들 `node engine/verify.js step-NNNN` + `node engine/validate/verify-sim-engine.js`(골든) + grep 감사(`Math.random` 실호출·`Z===상수`/author 분기) 실행 출력 인용. 풀 골든은 `run_in_background` 로.
- **§4 이슈 → 후속 step 연결** — 표(#|이슈|항|상태|후속 step 연결). **이게 이 스킬의 요지**(아래 §4).

## 4. 이슈는 반드시 후속 step 으로 연결한다 (불가침)

리뷰는 회고이자 **전방 입력**이다. §2 가 찾은 모든 이슈는 *반드시* 둘 중 하나로 연결된다:

- **(a) 이미 해소** — 후속 step(같은/다른 묶음)이 메웠으면 그 step 을 가리킨다(예: "과응집 → step-0012 bondValence"). README 인덱스에서 제거, 해소 기록만 남김.
- **(b) 미해소** — `reviews/README.md` §2 **열린 이슈 원장**에 이월하고 *권고 후속 step* 을 단다(무엇을, 노브=0 회귀 0 으로 어떻게). load-bearing 이면 "다음 atom-step 세션이 STATE §2/§3 로 흡수" 한 줄.

> **STATE 를 직접 고치지 마라.** 리뷰는 *권고*만 한다 — STATE §2 NEXT·§3 OPEN GAPS 의 권위는 step-loop(`hgo-atom-step`)다. 리뷰는 원장에 권고를 쌓고, step 세션이 그걸 집어 STATE 에 반영한다. 이 분리가 리뷰(읽기)와 step(쓰기)의 직교를 지킨다.

다음 묶음 리뷰는 *먼저 원장을 재점검*해 그새 해소된 이슈를 떨군다 — 원장이 무한 누적되지 않게.

## 5. 닫기 체크리스트

1. §3 검증 재현 전부 실행·인용(골든 PASS 포함) — 미실행 추정 금지.
2. §2 4항 판정마다 코드 알리바이(`file:line`) 1개 이상.
3. §4 모든 이슈가 후속 step 에 연결됨(해소 step or 원장 이월+권고).
4. `reviews/README.md` §1 인덱스 append + §2 원장 갱신(해소 떨굼·신규 이월).
5. **알리바이**: `git status` 에 `reviews/` 만 — `engine/`·`STATE.md`·`steps/` diff **0**(리뷰는 atom 을 안 만진다). 잡히면 되돌려라.

## 금지 사항 (비용·정합 함정)

- **문서 PASS 를 그대로 베끼지 않는다** — 직접 verify 재현·grep 감사로 확인.
- **STATE·engine·steps 를 고치지 않는다** — 리뷰는 읽기 회고 + 원장 쓰기뿐(권고는 원장에).
- **이슈를 후속 step 연결 없이 남기지 않는다**(§4 불가침) — 떠다니는 이슈 = 미완 리뷰.
- 원장에 ✅해소 이슈 전문을 누적 보존하지 않는다(인덱스서 제거·한 줄 기록만).
- 묶음 밖 step·render/net 트랙을 "참고로" 읽지 않는다.
- 한 리뷰에 두 묶음 이상 넣지 않는다 — 10 step = 1 리뷰.
</content>
