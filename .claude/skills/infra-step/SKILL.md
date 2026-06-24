---
name: infra-step
description: HktInfra step 한 바퀴(읽기→스캐폴드→구현→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HktInfra step 진행/다음 step"을 요청하면 사용.
---

# HktInfra step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HktInfra/CLAUDE.md`(불변 규칙·4기둥·척추 체크 5항)와 `HktInfra/SPINE.md`(6계층 큰 그림)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HktInfra/`.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HktInfra/CLAUDE.md` · `HktInfra/SPINE.md` · `HktInfra/STATE.md` (전체).

> **과심화 반사 (단계 = 너비 우선일 때)**: STATE §2 가 1차 너비 단계를 지시하면 — 이번 조각이 *이미 기본 통신이 선 박스의 심화*(영속·failover·스냅샷·escrow·saga·정합 capstone)인데 `reviews/progress/README.md` 박스 상태 맵에 ⬜ 미착수/🌱 스텁 박스가 남아 있다면, **멈추고 그 빈 박스의 기본 통신을 이번 조각으로 잡는다**(STATE §2 잔여 박스 순서를 따른다). "기본" = 목적 달성 최소 연산 + 척추 5항 + reg 0 까지만 — 심화는 2차로 전가. 무거운 단계 판정(1차 완료 여부·다음 방향)은 `infra-review` 가 원장에 평결하고 STATE §2 가 집행한다 — step 은 이 값싼 반사만.

**조건부** (해당 작업 시에만): `TOOLS.md`(박스의 도구/승격 결정 시) · `TESTBED.md`(run.js/report 구조 변경 시 — 통상 step 은 불필요).

**읽기 금지** (STATE 가 명시 지시할 때만 예외): 옛 `step-NNNN.md`·`step-NNNN-concepts.md` 문서들.

**코드는 단일 소스 `src/` 의 박스 파일 단위로만**(0049 전환): 박스 1개=파일 1개(`gateway.js`·`zone.js`·`svc-*.js`·`persist.js`·`client.js`·`topology.js`·`metrics.js`) — 이번 조각이 닿는 박스 파일(통상 1~2개·2~18KB)만 읽는다. `net-core.js` 는 2.5KB 진입점(export 묶음)일 뿐이다. 누적 회귀 테스트는 `engine/verify-kit.js` 에 산다 — 새 모드 작성 시 kit 의 helpers(check·logDigest…)와 기존 모드 1개만 참고로 부분 읽기. **`baseline/` 은 직전 step 동결 스냅샷(reg 대조용·읽지 않는다)·archive `step-0001~0048/` 는 동결 역사(읽기 금지).**

## 2. 스캐폴드 — 코드 통복사 없음, src→baseline 스냅샷만

```
node engine/new-step.js        # src/*.js → baseline/ 스냅샷 회전 + src/STEP 전진 + md/concepts 골격 (코드 복사 0)
```

복사 전진은 0049 에서 폐기됐다 — 코드는 `src/` 한 곳에서 *제자리 수정*한다. new-step 은 직전 src 를 `baseline/`(reg 대조용 1벌)로 굳히고 `src/STEP` 을 전진시킬 뿐, 코드를 복사하지 않는다. **별도 scaffold 커밋 불필요**(델타 1커밋). 스크립트가 출력하는 "남은 일" 체크리스트를 따른다.

## 3. 구현 — 한 조각 + OFF 플래그, src/ 의 닿는 박스 파일만

- 이번 조각의 프로토콜은 `src/` 의 **닿는 박스 파일**에만 제자리 Edit (플래그 OFF → `baseline` 비트 동일 = 회귀 0). 새 박스면 `src/` 에 새 파일 + `net-core.js` 진입점에 require 1줄. 수정한 파일의 헤더 step 번호만 갱신(미수정 파일 헤더 = 마지막 수정 step 기록·건드리지 않음).
- 이번 step 의 새 검증 모드는 `src/verify.js` 셸에 `kit.MODES['<mode>'] = fn; kit.ORDER.splice(1, 0, '<mode>')` 로만 추가. NETPREV 는 `../baseline/net-core.js` 고정(치환 없음). **누적 회귀를 verify.js 로 복사해오지 않는다**(engine/verify-kit.js 가 든다·모드 제거 금지).
- dual-mode 노출(`module.exports` + `globalThis`) 유지.
- **비대화 트리거**: 박스 파일 >30KB 가 되면 다음 기능 step 전에 정리 step(재분할/engine 승격·기능 0·reg 0)을 제안한다.

## 4. 검증 — spine 사슬은 백그라운드로

- `node run.js` (현재 step 4기둥) — 문서의 모든 수치는 이 출력을 그대로 옮긴다.
- `node run.js spine` (전 시리즈 회귀 사슬)은 오래 걸린다 — `run_in_background` 로 돌려놓고 그동안 문서 작업.
- 시각 확인이 필요할 때만 `node run.js report` — html 손작성 금지.

## 5. 갱신 — step 문서는 압축형(한 일+검증), STATE.md 는 Edit 로만

- **step-NNNN.md 는 압축 골격 3절만** (new-step.js 가 연다): ① **한 일(delta)** — 어느 박스 파일에 무슨 메커니즘 + 계층 + OFF 플래그 + verify 새 모드. ② **검증** — 수치=run.js/spine 출력(reg·결정론·권위/수렴·가설·spine). ③ **척추 5항 + 한계** — 5항 판정 + *실제* 편차·이슈·정직한 한계·의외의 발견이 있을 때만 한 줄(없으면 "이상 없음").
  > **서사 금지**(사람이 안 읽고 review 가 대신함): 검증 질문 산문·인과/직관 해설·"다음 예고" 를 step 문서에 쓰지 않는다 — *왜·어떻게의 인과 서사*는 `reviews/`(infra-review 묶음 감사)가, *지금 어디·다음*은 STATE.md 가 가진다. step 문서는 *agent 가 한 일(delta) + review 가 재현·확인할 정보*만.
- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4 추가분·§5·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 30KB · §1 NOW 항목당 ≤ 6줄 · §7 은 literal 1줄(`step | 조각 | 통과+핵심수치 1개`) · **`step-NNNN.md` ≤ 8KB**(close-step 게이트). STATE 30KB 초과 시 헤더의 "누적 함정"부터 정리.

## 6. 닫기 — 기계 판정은 close-step 한 줄

```
node engine/close-step.js      # run.js + spine + 크기 예산 + 산출물·TODO·STATE §7 행 검사 (exit 0 필수)
```

에이전트가 남겨 판정할 것: ① 척추 체크 5항(설계 판정) ② 문서 수치 == verify 출력 ③ STATE §1~6 내용. 마지막으로 **델타 1커밋 + `git tag step-NNNN`** — 이 step 의 실질만 담은 커밋 + 역사 고고학 보존용 태그(동결 step-NNNN/ 디렉토리를 대신한다).

## 금지 사항 (비용 함정)

- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT 다.
- 박스 파일을 통째로 다시 쓰거나(전체 Write), 누적 회귀를 verify.js 로 복사해오지 않는다 — src/ 의 Grep + Edit + kit 모드 추가.
- `src/`·`baseline/` 를 통째 복사하거나 새 `step-NNNN/` 코드 디렉토리를 만들지 않는다(복사 전진은 0049 에서 폐기) — 코드는 src/ 제자리 수정.
- `engine/verify-kit.js` 에서 모드를 *빼지* 않는다(추가만) — 빼야 하면 별도 step 으로.
- spine 사슬을 포그라운드로 기다리며 놀지 않는다.
- step-NNNN.html·SYSTEM.html 손작성 금지 (testbed 일원화 — 폐기됨).
- UE5 빌드는 이 트랙과 무관 — 실행하지 않는다.
