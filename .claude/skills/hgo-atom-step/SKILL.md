---
name: hgo-atom-step
description: HGO 원자 트랙 step 한 바퀴(읽기→스캐폴드→구현→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HGO step 진행/다음 step/원자 step"을 요청하면 사용.
---

# HGO 원자 트랙 step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HGO/CLAUDE.md`(목표)·`HGO/SPINE.md`(척추·검증 4기둥·척추 체크 4항)·`HGO/STATE.md`(현재·다음)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HGO/`. 기질: **JS 결정론 샌드박스**(브라우저 패널 + 헤드리스 verify) — UE5/MMO 통합은 net 트랙(휴면) 몫.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HGO/CLAUDE.md` · `HGO/SPINE.md` · `HGO/STATE.md` (전체).

**읽기 금지**(STATE 가 명시 지시할 때만 예외): 옛 `steps/step-NNNN.md` 문서들(STATE 가 현재의 SSOT) · render/net 트랙 파일(`RENDER*`·`NET*` — 직교 트랙).

**큰 코드 파일은 부분 읽기만**: `engine/hgo-*.js` 전체 읽기 금지 — Grep 으로 `LAW_ORDER`·`DEFAULTS`·직전 법칙 1개만 찾아 offset/limit 로 해당 구간만. 새 법칙은 직전 법칙의 형식을 따른다.

## 2. 스캐폴드 — 손 복사 금지

```
node engine/new-step.js        # 직전 step 복사·치환 + md/html 골격 자동 생성
```

생성물(panel.js·verify.js·html·md 골격)은 **Edit 로만 수정** — 전체 Write 금지(복사는 끝났다, 델타만). 스크립트가 출력하는 "남은 일" 체크리스트를 따른다.

> **step-0001 예외(부트스트랩)**: `new-step.js`·엔진이 아직 없다. 이 첫 step 이 `engine/`(hgo-kernel·hgo-laws/atoms·hgo-sim) · `engine/validate/verify-sim-engine.js` · `golden-sim.json` · `engine/new-step.js` · 공통 UI/패널 골격을 *만든다*. HWS `engine/` 형식을 본보기로 삼되 원자 다발에 맞게. 이후 step 은 위 스캐폴드를 그대로 쓴다.

## 3. 구현 — 법칙 1개 + 노브 + 순서 한 자리

`engine/hgo-laws.js`(또는 동등 파일)에 Edit 로 **상호작용 법칙 1개 + 노브 1개 + 실행 순서 한 자리**를 더한다(노브=0 → early-return = 회귀 0). 보존 장부/golden 확장은 *미존재 시 no-op* 가법만. 원소·분자는 author 분기 아닌 *측정*으로(척추 체크 4항).

## 4. 검증 — 풀 골든 런은 백그라운드로

- `node engine/validate/verify-sim-engine.js`(풀 골든 런)는 오래 걸린다 — `run_in_background` 로 돌려놓고 그동안 step 문서·panel 을 진행하라. 법칙 고칠 때마다 포그라운드 대기 금지.
- `node steps/step-NNNN/verify.js all` — 검증 4기둥(회귀 0·닫힌 장부 Q·B·L·E·결정론·가설) + 척추 체크 4항. 문서의 모든 수치는 이 출력을 그대로 옮긴다.
- 닫기 직전에 풀 골든 런 1회 최종 PASS 확인.

## 5. 갱신 — STATE.md 는 Edit 로만

- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4 추가분·§5·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 30KB · §1 NOW 항목당 ≤ 6줄(상세는 step 문서로) · §7 은 literal 1줄. 초과 시 SPINE §6 "누적 함정"부터 정리.
- `step-NNNN.md` 예산 ≤ 14KB — 발견/한계 전문은 여기(STATE 아님). **"쉽게 풀어 쓴 설명" 절 필수**(비전문가도 따라올 수 있게·수치는 말로).

## 6. 닫기 체크리스트

1. 검증 4기둥(SPINE §9) + 척추 체크 4항(SPINE §5) 전부 통과 (verify 출력 인용)
2. 풀 골든 런 PASS (회귀 0 알리바이 — 0002~)
3. `step-NNNN.md` "쉽게 풀어 쓴 설명" 절 포함·수치=verify 출력
4. STATE.md §1~6 Edit + §7 1줄 append
5. 닫은 step 파일은 이후 불변

## 7. 활성 게이트 점검 (휴면 트랙 깨우기)

step 을 닫을 때, SPINE §7 활성 게이트가 충족됐는지 본다: **방출(요건3)이 실리면** render 트랙을, **결정론·보존이 안정되고 공유 상태가 풍부해지면** net 트랙을 깨울 때다. 깨움은 *별도 세션*이 그 트랙 SKILL+STATE 를 만들며 시작한다 — 이 atom 트랙에선 STATE §2 에 "render 활성 게이트 도달" 한 줄만 남기고 전가한다.

## 금지 사항 (비용 함정)

- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT.
- 같은 파일을 반복해서 통째로 다시 읽지 않는다(이미 컨텍스트에 있다).
- verify 풀 런을 포그라운드로 기다리며 놀지 않는다.
- 한 step 에 두 조각 이상 넣지 않는다 — 나머지는 다음 step 으로 전가.
- render/net 트랙 파일을 만지지 않는다(직교·휴면 — 시뮬 불가침).
