---
name: hgo-flux-review
description: HGO flux 트랙의 닫힌 step 들을 10개 묶음으로 회고 리뷰한다 — 세 축 감사(① 목적 부합=척추 4항+verify 재현 ② 골격 주제별 도달=arc 직관 ③ LADDER 흐름 도달/잔여) + 이슈→후속 step 연결. 사용자가 "flux 리뷰/flux step 리뷰/flux 묶음 정리/flux 리뷰 진행"을 요청하면 사용.
---

# HGO flux 트랙 묶음 리뷰 루프 — 토큰 효율 실행 절차

이 스킬은 flux 트랙의 닫힌 step 들을 **10개 묶음**으로 회고 감사한다. step-loop(`hgo-flux-step`)이 *세계를 굴리는* 것과 직교 — 리뷰는 *굴러간 것을 검증·정리*하고 **이슈를 전방(다음 step)으로 연결**한다. **작업 디렉토리: `HGO/flux/`** — 이하 상대 경로는 이 폴더 기준. 산출물은 `reviews/review-NNNN-MMMM.md` + `reviews/README.md`(인덱스·LADDER 지도·이슈 원장) 둘뿐. **시뮬 코드·STATE·step 문서는 읽기만**(리뷰는 flux 를 안 바꾼다 — 골든 비트 불변).

> **flux 의 결정적 차이(atom 과)**: 단일 힘의 법칙은 step-0001 에 *고정*이다. 한 step 은 *법칙을 추가하지 않는다* — 장면+측정만(SPINE §5·§6). 그래서 감사도 "이 step 이 어떤 법칙을 박았나"가 아니라 **"같은 규칙 + 노브(+관성)가 어떤 층을 측정으로 드러냈나"**를 본다. atom-review 의 "법칙별 감사" 틀을 그대로 가져오지 마라.

## 핵심 원칙 — 리뷰는 "주장"이 아니라 "재현"이다

step 문서의 PASS 는 *주장*이다. 리뷰의 권위는 **실물 코드(`engine/*.js`) + `verify.js` 재현 + grep 감사**다. "문서가 PASS 라 함"으로 닫지 마라 — 직접 돌려 수치를 인용하고, 코드 라인(`file:line`)으로 알리바이를 댄다. 문서-코드 불일치를 찾는 게 리뷰의 본령.

## 1. 읽기 — 허용 목록만

**필독**: `SPINE.md`(§3 단일 규칙·§4 왜 관성·§9 arc 로드맵·§10 검증 4기둥) · `STATE.md`(§7 INDEX 로 묶음 범위 확인·§2 NEXT·§3 OPEN GAPS) · `reviews/README.md`(§3 열린 이슈 원장 — 직전 묶음이 이월한 것) · `reviews/LADDER.md`(§2 LADDER 지도 갱신의 기준 = 사다리 6단계·arc 대응).

**묶음 step 문서**: 그 10개 `steps/step-NNNN.md` 만(전체 읽기 OK — 리뷰 대상). 묶음 밖 옛 step·다른 트랙(atom/render) 문서는 읽지 마라.

**실물 코드(부분 읽기)**: 핵심 4벌을 *해당 부분만* — `engine/flux-laws.js`(`rule()` 고정·`applyInertial`/`applyCoupled` opt-in 게이트·반대칭 `−F/+F`) · `engine/flux-kernel.js`(`gridEdges` 6-이웃·SCALE 정수·해시) · `engine/flux-sim.js`(`decorate` 렌더 채널·DEFAULTS 노브) · `engine/scenes.js`(그 묶음의 장면 spec·측정 함수 — Grep 으로 함수명→줄번호). 전체 통독 금지(scenes.js 는 큼).

## 2. 더할 것은 둘 — 복사·누적 폐기

1. **묶음 감사 1편** — `reviews/review-NNNN-MMMM.md`(아래 §3 *세 축 전용*). ≤ 10KB. 닫으면 불변(역사).
2. **README 갱신** — `reviews/README.md` §1 묶음 인덱스 1줄 append + **§2 LADDER 진척 지도**(사다리 단계 도달도 겹치기) + §3 열린 이슈 원장 갱신(해소분 떨굼·신규 이월).

그 외 복사 0. 감사는 step 문서를 복제하지 않는다(교차 참조만). *무엇을 했나*는 STATE §7 INDEX·step 문서·LADDER 가 가지므로 **감사는 재서술하지 않는다**(중복 0).

> **네 고도**(README §0): `SPINE`(트랙·동결) · `LADDER`(흐름→고분자 교육·진척 — atom 의 phase-X 자리) · `review-NNNN`(묶음) · `step-NNNN`(조각). flux 는 *법칙을 안 쌓으므로* 별도 phase 서사를 두지 않는다 — LADDER.md 가 이론·표현·진척을 겸한다.

## 3. 묶음 감사 문서 — 세 축 구조 (사용자 요청·고정)

> **narrative 금지**: "각 step 이 뭘 했나" 요약표를 두지 않는다(STATE INDEX·step 문서와 중복). 맨 위 한 줄로 *범위 + 국면/arc + LADDER 링크*만 가리키고 바로 세 축으로 들어간다.

- **§1 목적에 부합하는가** — SPINE 의 목적("코딩할 건 함수 하나·다양성은 author 아닌 창발")에 부합하는지를 **척추 4항**으로 판정(✅/🟡/🔴) + **코드 알리바이**(`file:line`):
  - ① 단일 척추 — `rule()` 가 step-0001 고정인가(`flux-laws.js`). 노브만 돌렸나, 새 법칙·새 노브 0 인가. 정련(`applyInertial`/`applyCoupled`)은 opt-in 게이트·비트 재현인가.
  - ② 창발 환원(author 0) — `grep -nE 'Z===|isWater|kind===' engine/*.js` → 0 매치 확인. 층·구조가 *측정 함수*(scenes.js)서 나오나, 라벨을 박았나.
  - ③ 국소 — 비국소 입력이 이웃(`gridEdges`)뿐인가. 전역 조율자 0 인가.
  - ④ 닫힌 장부 — ΣQ 비트 0(반대칭 `−F/+F`)·관성 국면이면 ΣP 비트 0·E 유계(심플렉틱·*비트 아님*에 주의). verify 출력 인용.
  - **verify 재현**: `node engine/verify.js all`(또는 대표 step) 실행 출력 인용(문서 수치 비트 재현 확인) + 골든 회귀 0(`verify.js` ③) + grep 결정론(`Math.random`·`Math.pow` 0).
- **§2 골격 주제별 도달 — 직관** — SPINE §9 의 각 arc(A~E 과감쇠 / F~I 관성)를 "**같은 규칙 + 노브(+관성)가 *어떻게* 그 층을 냈나**"를 비전문가도 따라올 직관으로. arc 별 ✅/🟡 + 한 직관 단위. step 번호 나열이 아니라 *어떤 문제를 어떻게 풀었나*.
- **§3 LADDER 흐름 도달/잔여 + 이슈 연결** — *이 묶음이 사다리에서 민 칸*(어떤 step 이 어떤 단계를 도달/씨앗으로 밀었나)만 짧게 + 이슈→후속 step 연결(아래 §4). **사다리 *누적* 도달 지도(✅/🟡 판정·잔여·1차 목표까지의 거리)는 닫히면 변하므로 묶음 문서에 재현하지 말고 README §2 한 곳에만** 둔다(가변 단일 출처) — 묶음 문서는 README §2 를 *가리키기만* 한다. 묶음 §3 의 load-bearing 부분은 *이슈 연결 표*다.

## 4. 이슈는 반드시 후속 step 으로 연결한다 (전파 고리 — 불가침)

리뷰는 회고이자 **전방 입력**이다. 핵심: **과거 step 은 동결 — 이슈는 *이후 게이트 step* 으로 반영**(노브/채널=0 → 회귀 0). §1·§3 이 찾은 모든 이슈는 *반드시* 둘 중 하나:

- **(a) 이미 해소** — 후속 게이트 step 이 메웠으면 그 step 을 가리킨다(예: "과감쇠 천장 → step-0011 관성"·"동결 잔류 정체 → 0004 도메인+0005 ξ"). README 원장서 제거, 해소 기록만.
- **(b) 미해소** — `reviews/README.md` §3 **열린 이슈 원장**에 이월하되 *세 가지 명시*: ① **목적지**(load-bearing·무르익음 → STATE §2 NEXT / 경미 → §3 백로그) ② **게이트 형태**(어떤 노브/채널을, 0 이면 회귀 0) ③ **arc 정합**(SPINE §9 와 충돌하면 백로그 대기).

> **전파 경로**: 리뷰는 원장에 *기록*만(write). step-loop(`hgo-flux-step`)이 다음 조각 고르기 전 원장을 *읽어* 무르익은 이슈를 STATE §2/§3 로 *승급*하고 게이트 step 으로 구현한다. **STATE 를 직접 고치지 마라** — review=기록, step=승급·구현. (예: 단일 q 결합 천장 #7 → step-0021 다발 확장.)

**양방향**: 다음 묶음 리뷰는 *먼저 원장을 재점검* — engine 변경(grep/golden)으로 그새 해소된 이슈를 ✅떨군다(원장 무한 누적 방지). 미해소는 두되 목적지·게이트가 여전한지 갱신.

## 5. 닫기 체크리스트

1. 감사 §1 verify 재현 실행·인용(`verify.js all` PASS·골든 회귀 0·grep) — 미실행 추정 금지.
2. 감사 §1 척추 4항 판정마다 코드 알리바이(`file:line`) 1개 이상. (관성 국면이면 ΣP 비트 0·E 는 *유계*까지임을 명시.)
3. 감사 §2 arc 별 도달을 직관으로(step 나열 아님). §3 LADDER 지도 + 모든 이슈가 후속 step 에 연결됨(해소 게이트 or 원장 이월+목적지·게이트).
4. 감사 문서에 narrative 요약표 없음(범위 한 줄 + LADDER 링크만) — 중복 0.
5. `reviews/README.md` §1 인덱스 append + §2 LADDER 지도 갱신 + §3 원장 갱신(해소 떨굼·신규 이월).
6. **알리바이**: `git status` 에 `reviews/`(+스킬) 만 — `engine/`·`STATE.md`·`steps/`·다른 트랙 diff **0**(리뷰는 flux 를 안 만진다). 잡히면 되돌려라.

## 금지 사항 (비용·정합 함정)

- **문서 PASS 를 그대로 베끼지 않는다** — 직접 `verify.js` 재현·grep 감사로 확인.
- **STATE·engine·steps 를 고치지 않는다** — 리뷰는 읽기 회고 + 원장 쓰기뿐(권고는 원장에).
- **"법칙별 감사" 틀 금지** — flux 는 법칙 1개 고정. arc(층)·노브·창발 측정으로 본다.
- **이슈를 후속 step 연결 없이 남기지 않는다**(§4 불가침) — 떠다니는 이슈 = 미완 리뷰.
- 원장에 ✅해소 이슈 전문을 누적 보존하지 않는다(인덱스서 제거·한 줄 기록만).
- 묶음 밖 step·atom/render 트랙을 "참고로" 읽지 않는다. 한 리뷰에 두 묶음 이상 넣지 않는다(10 step = 1 리뷰).
