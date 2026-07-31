# 00. 새 모듈 착수 체크리스트

> **새 세션에서 모듈 작업을 시작하기 전에 이 문서를 읽는다.**
> 절차의 근거는 설계 원문이다 → [40-Agent-Protocol.md](../design/modules/40-Agent-Protocol.md) 「22」·「23」 ·
> [00-Module-Contract.md](../design/modules/00-Module-Contract.md) 「3」·「4」·「5」·「21」·「24」.
> 이 문서는 그 절차를 **이 저장소에서 실행하는 방법**만 모은 것이며, 원문을 대체하지 않는다.

## 0. 읽는 순서

```text
1. ../CLAUDE.md            트랙 규칙 · 설계 문서 취급 원칙
2. ../STATE.md             현재 상태 보드 · 다음 작업
3. 이 문서                  저장소 실행 방법
4. 해당 페이즈 문서(10~21)   대상 모듈의 목적·입출력·대표 검증·금지·선행
5. 00-Module-Contract.md   MODULE.yaml 형식 · 검증 상태 · 완료 게이트 · 증거 · Lab 화면
6. 01-Global-Invariants.md GI-01~GI-12 중 관련 조건
7. 30-Vertical-Slices.md   이 모듈이 포함된 슬라이스
8. progress/NN-*.md         선행 모듈이 남긴 인계 사항
```

## 1. 만들 파일 (원문 「3」)

```text
packages/<그룹>/<ID>-<name>/
├─ MODULE.yaml          계약 (id·name·purpose·depends_on·owns_state·inputs·outputs·invariants·scenarios·commands)
├─ README.md            목적 · 계약 · 설계 판단 · 실행 방법 · 검증 상태
├─ package.json         이름은 반드시 `@hkt/<id 소문자>-<name>`
├─ tsconfig.json        ../../../tsconfig.base.json 상속
├─ src/
├─ schemas/
├─ scenarios/           대표 검증 장면 (MODULE.yaml 의 scenarios 목록과 정확히 같아야 한다)
├─ lab/index.ts         `export const labModule = { id, version, purpose, scenarioIds, run }`
├─ tests/{unit,property,integration}/
└─ evidence/latest.json  pnpm verify 가 만든다 — 손으로 쓰지 않는다
```

디렉터리 이름과 `MODULE.yaml` 의 `id`·`name` 이 어긋나면 V0 이 등록을 거부한다.
선행이 없으면 `depends_on: [none]` 을 **명시**한다 (필드 생략은 결손으로 보고 거부한다).
`depends_on` 에 적은 모듈은 `package.json` 의 `dependencies` 에도 `workspace:*` 로 있어야 한다.

## 2. 절차 (원문 「22」)

| # | 단계 | 이 저장소에서 |
|---|---|---|
| 1 | 선행 모듈 확인 | STATE.md 상태 보드. 원문 「28」의 고정 순서를 벗어나지 않는다 |
| 2 | MODULE.yaml 읽기/작성 | 위 1절 |
| 3 | **실패하는** 검증 시나리오 작성 | `scenarios/` — 구현 전에 먼저 쓴다 |
| 4 | 최소 구현 | `src/` |
| 5 | 타입·단위 테스트 | `pnpm run typecheck` · `tests/unit/` |
| 6 | 속성 테스트 | `tests/property/` — fast-check, **시드 고정** |
| 7 | 대표 Lab 실행 | `pnpm lab` → 자동으로 탭이 생긴다 (`labModule` 만 내보내면 된다) |
| 8 | 인과 추적 확인 | 모든 거부·위반이 경로와 코드로 위치를 지목하는지 |
| 9 | 통합 시나리오 | `tests/integration/` · 해당 VS 가 실행 가능하면 실행, 아니면 `it.todo` 로 명시 |
| 10 | 증거 파일 | `pnpm verify <ID> --lab` |
| 11 | 상태 등록 | STATE.md + `progress/NN-<ID>-<name>.md` |

## 3. 하지 말 것 (원문 「23」)

```text
자신의 모듈 범위 밖 파일을 임의 수정   ← 다른 모듈의 파일은 읽기만 한다
실패한 테스트 삭제
검증 조건 완화                        ← 테스트가 깨지면 테스트가 아니라 원인을 고친다
예상 결과를 현재 잘못된 결과로 변경
결정성을 깨는 Math.random 사용         ← Date.now·new Date 도 금지 (V2 가 결정적 시계를 준다)
실제 세계 상태 직접 수정
임의 실행 코드를 콘텐츠 데이터에 삽입
증거 없이 VERIFIED 표시
```

상위 계약 변경이 필요하면 고치지 말고 Change Request 절차를 따른다 (원문 「23」).

## 4. 상태 등록 (원문 「4」)

`IMPLEMENTED` 는 완료가 아니다. `VERIFIED` 는 해당 수직 슬라이스가 **실제로 통과**했을 때만 쓴다.
현재 V 페이즈 모듈들은 VS0(K0~K3 필요) 때문에 `LAB_PASS` 에 머물러 있으며, VS0 통과 시점에 함께 승격한다.

## 5. 자동으로 강제되는 것 / 스스로 지켜야 하는 것

`pnpm test` 하나로 아래가 검사된다. **새 모듈을 어디에도 등록하지 않아도 걸린다.**

| 검사 | 위치 |
|---|---|
| 표준 계약 파일 존재 · 패키지 이름 · 버전 형식 | [tests/conventions.test.ts](../tests/conventions.test.ts) |
| MODULE.yaml 형식 · id/name 과 디렉터리 일치 · 거부 없이 등록 · 위상 순서 | 같은 파일 + V0·V1 통합 테스트 |
| `labModule` 내보내기 · 계약의 scenarios 와 Lab 장면 일치 · 전 장면 통과 · 원문 「24」 8구획 | 같은 파일 |
| 비결정적 호출(Math.random·Date.now·new Date·crypto.getRandomValues) 없음 — 주석·문자열은 제외 | 같은 파일 |
| `schemas/*.schema.json` 이 `$id` 를 갖고 V1 로 컴파일된다 · 저장소 안에서 `$id` 유일 | 같은 파일 |
| 같은 입력 재실행 시 같은 결과 | 같은 파일 |
| evidence 형식 · 상태값 · 슬라이스 미통과 시 VERIFIED 금지 | 같은 파일 → **V4** 에 위임 |
| 게이트보다 높은 상태를 주장하는 증거 | 같은 파일 → **V4** `auditRepository` |
| **선행 계약이 바뀐 채로 남은 증거** (원문 「2.5」) | 같은 파일 → **V4** `auditRepository` |
| `depends_on` 과 package.json 의존 일치 | 같은 파일 |
| 타입 검사 · 테스트 편입 | `tools/typecheck.mjs` · `vitest.config.ts` (경로 규약만 지키면 자동) |
| Lab 에 없는 모듈의 증거 발급 차단 | `tools/lab-shot.mjs` (요청 모듈의 탭이 없으면 실패) |

스스로 지켜야 하는 것 (아직 자동 검사가 없다):

- 시나리오가 **구현 전에** 실패하는 상태로 먼저 작성되었는가 (원문 「22」 3단계)
- 속성 테스트의 시드를 고정했는가
- 다른 모듈의 파일을 고치지 않았는가 (`git diff --stat` 으로 범위 확인)
- 대표 장면이 원문의 "직관적 검증"에 실제로 답하는가 — 눈으로 `pnpm lab` 을 본다

## 6. 명령

```bash
pnpm install
pnpm run typecheck
pnpm test                  # 전 모듈 + 저장소 규약
pnpm test <ID>-<name>      # 한 모듈만
pnpm lab                   # 브라우저 Lab
pnpm verify <ID> --lab     # 증거 발급 → evidence/latest.json
pnpm verify <ID> --lab --regression   # G7 회귀 게이트까지 측정 (저장소 전체 실행)
```

Windows 에서 지금까지의 작업을 한 번에 확인하려면 [run.bat](../run.bat) 을 더블클릭한다 —
`install → typecheck → test → lab(브라우저)` 을 순서대로 돌린다 (`run.bat lab` = Lab 만,
`run.bat test` = 콘솔 검증만). 출력이 필요하면 `run.bat test > run-log.txt 2>&1`.

배치파일을 고칠 때 지킬 것 — 기준은 같은 저장소에서 **실제로 작동하는**
[HktAdvProtoC/run.bat](../../HktAdvProtoC/run.bat) 이다 (UTF-8 · BOM 없음 · LF · 한글 본문).

- **패키지 매니저를 `for /f` 로 감싸지 않는다.** `for /f ('pnpm -v')` 는 stdout 을 캡처하므로,
  corepack 이 `packageManager` 에 적힌 pnpm 을 내려받는 동안 화면에 아무것도 나오지 않는다 —
  창은 떠 있는데 멈춘 것처럼 보인다. `for /f` 는 ProtoC 처럼 `node -p` 같은 즉답 명령에만 쓰고,
  패키지 매니저는 언제나 `call pnpm ...` 로 직접 불러 출력을 그대로 흘려보낸다.
- **`COREPACK_ENABLE_DOWNLOAD_PROMPT=0` 을 세운다.** 이 값이 `1` 이면 corepack 이
  "Do you want to continue? [Y/n]" 로 stdin 에서 멈춘다.
- **오래 걸리는 단계는 먼저 알린다.** 설치·테스트 앞에 소요 시간을 찍어, 진행 중을 멈춘 것으로
  오인하지 않게 한다.
- UTF-8(BOM 없음)로 저장하고 `chcp 65001` 을 맨 앞에 둔다. `.bat` 선두의 BOM 은 첫 명령을 깨뜨린다.

`tools/*.mjs` 도 같은 이유로 **`pnpm` 을 spawn 하지 않는다.** Windows 의 `pnpm` 은 `pnpm.CMD` 이고,
Node 는 CVE-2024-27980 대응 이후 `.cmd`/`.bat` 을 `shell: true` 없이 spawn 하면 **EINVAL 로 던진다**.
그래서 하위 명령은 로컬에 설치된 **JS 진입점을 `process.execPath`(node)로 직접** 실행한다.

| 도구 | 부르는 것 |
|---|---|
| `tools/typecheck.mjs` | `node node_modules/typescript/bin/tsc -p <tsconfig>` |
| `tools/verify.mjs` | `node tools/typecheck.mjs` · `node node_modules/vitest/vitest.mjs run …` |
| `tools/lab-shot.mjs` | `node node_modules/vite/bin/vite.js build --config apps/lab/vite.config.ts` |

실패를 `catch {}` 로 삼키지 않는다. 명령이 **실행조차 안 된 것**과 **검사에서 떨어진 것**은
구별되어야 한다 — 전자는 `error.status` 가 없다. 이걸 구분하지 않으면 Windows 에서 전 모듈이
tsc 출력 한 줄 없이 "실패" 로만 찍혀 원인을 찾을 수 없다.

**`MODULE.yaml` 을 고쳤으면 그 모듈과 하위 모듈의 증거를 다시 발급한다.** V4 의 감사가 발급 시점의
계약 해시를 대조하므로, 고친 채로 두면 `pnpm test` 가 “선행 계약이 바뀐 채로 남은 증거” 로 잡는다.
바꾸기 전에 영향 범위를 보려면 V4 의 `impactOf(registry, id)` 를 쓴다 (원문 「23」 Change Request).

**상태는 손으로 적지 않는다.** `pnpm verify` 가 출력하는 `status=` 와 “막힌 게이트” 줄이 그 모듈의 실제
상태다. STATE.md 에는 그 값을 옮겨 적는다.
