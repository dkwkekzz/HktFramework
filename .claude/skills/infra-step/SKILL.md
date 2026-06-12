---
name: infra-step
description: HktInfra step 한 바퀴(읽기→스캐폴드→구현→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HktInfra step 진행/다음 step"을 요청하면 사용.
---

# HktInfra step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HktInfra/CLAUDE.md`(불변 규칙·4기둥·척추 체크 5항)와 `HktInfra/SPINE.md`(6계층 큰 그림)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HktInfra/`.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HktInfra/CLAUDE.md` · `HktInfra/SPINE.md` · `HktInfra/STATE.md` (전체).

**조건부** (해당 작업 시에만): `TOOLS.md`(박스의 도구/승격 결정 시) · `TESTBED.md`(run.js/report 구조 변경 시 — 통상 step 은 불필요).

**읽기 금지** (STATE 가 명시 지시할 때만 예외): 옛 `step-NNNN.md`·`step-NNNN-concepts.md` 문서들.

**직전 step 코드는 박스 파일 단위로만**: 0030 분할 후 박스 1개=파일 1개(`gateway.js`·`zone.js`·`svc-*.js`·`persist.js`·`client.js`·`topology.js`·`metrics.js`) — 이번 조각이 닿는 박스 파일(통상 1~2개·2~18KB)만 읽는다. `net-core.js` 는 2.5KB 진입점(export 묶음)일 뿐이다. 누적 회귀 테스트는 `engine/verify-kit.js` 에 산다 — 새 모드 작성 시 kit 의 helpers(check·logDigest…)와 기존 모드 1개만 참고로 부분 읽기.

## 2. 스캐폴드 — 복사 전진은 기계가, 복사분은 별도 커밋

```
node engine/new-step.js        # 직전 step 전체 복사 + 자기참조·reg 경로 치환 + md/concepts 골격
git add … && git commit -m "HktInfra step-NNNN scaffold (mechanical copy)"   # 2-커밋 관행 ①
```

복사 전진(anti-DRY)의 *복사*는 이 스크립트의 일이다. **scaffold 를 즉시 커밋**해 두면 이후 `git diff` 가 이 step 의 실질 델타만 보여준다(self-review 비용 절감 — 두 번째 커밋이 PR 의 실질). 생성물은 **Edit 로만 수정** — 전체 Write 로 다시 쓰지 마라. 스크립트가 출력하는 "남은 일" 체크리스트를 따른다.

## 3. 구현 — 한 조각 + OFF 플래그, 닿는 박스 파일만

- 이번 조각의 프로토콜은 **닿는 박스 파일**에만 Edit (플래그 OFF → 직전 step 비트 동일 = 회귀 0). 새 박스면 새 파일 + `net-core.js` 진입점에 require 1줄.
- 이번 step 의 새 검증 모드는 `verify.js` 셸에 `kit.MODES['<mode>'] = fn; kit.ORDER.splice(1, 0, '<mode>')` 로만 추가 — **누적 회귀를 verify.js 로 복사해오지 않는다**(engine/verify-kit.js 가 든다·모드 제거 금지).
- dual-mode 노출(`module.exports` + `globalThis`) 유지.
- **비대화 트리거**: 박스 파일 >30KB 또는 step 디렉토리 >300KB 가 되면 다음 기능 step 전에 정리 step(재분할/승격·기능 0·reg 0)을 제안한다.

## 4. 검증 — spine 사슬은 백그라운드로

- `node run.js` (현재 step 4기둥) — 문서의 모든 수치는 이 출력을 그대로 옮긴다.
- `node run.js spine` (전 시리즈 회귀 사슬)은 오래 걸린다 — `run_in_background` 로 돌려놓고 그동안 문서 작업.
- 시각 확인이 필요할 때만 `node run.js report` — html 손작성 금지.

## 5. 갱신 — STATE.md 는 Edit 로만

- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4 추가분·§5·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 30KB · §1 NOW 항목당 ≤ 6줄(상세는 step 문서로) · §7 은 literal 1줄(`step | 조각 | 통과+핵심수치 1개`). 30KB 초과 시 STATE 헤더의 "누적 함정"부터 정리(가장 비대한 §7 행 압축 포함 — 전문은 step 문서가 SSOT).
- `step-NNNN.md` ≤ 18KB · `step-NNNN-concepts.md` ≤ 10KB — 발견/한계 전문은 step 문서에(STATE 아님).

## 6. 닫기 — 기계 판정은 close-step 한 줄

```
node engine/close-step.js      # run.js + spine + 크기 예산 + 산출물·TODO·STATE §7 행 검사 (exit 0 필수)
```

에이전트가 남겨 판정할 것: ① 척추 체크 5항(설계 판정) ② 문서 수치 == verify 출력 ③ STATE §1~6 내용. 마지막으로 **델타 커밋**(2-커밋 관행 ②) — scaffold 커밋과 분리된, 이 step 의 실질만 담은 커밋. 닫은 step 디렉토리는 이후 불변(동결 단위).

## 금지 사항 (비용 함정)

- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT 다.
- 박스 파일을 통째로 다시 쓰거나(전체 Write), 누적 회귀를 verify.js 로 복사해오지 않는다 — 스캐폴드 + Grep + Edit + kit 모드 추가.
- `engine/verify-kit.js` 에서 모드를 *빼지* 않는다(추가만) — 빼야 하면 별도 step 으로.
- spine 사슬을 포그라운드로 기다리며 놀지 않는다.
- step-NNNN.html·SYSTEM.html 손작성 금지 (testbed 일원화 — 폐기됨).
- UE5 빌드는 이 트랙과 무관 — 실행하지 않는다.
