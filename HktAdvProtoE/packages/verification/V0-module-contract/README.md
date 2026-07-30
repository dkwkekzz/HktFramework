# V0 module-contract

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [10-Phase-V-Verification.md](../../../design/modules/10-Phase-V-Verification.md) · 표준 계약: [00-Module-Contract.md](../../../design/modules/00-Module-Contract.md)

## 목적 (G0)

모든 모듈의 계약 문서를 읽어 모듈 레지스트리에 등록하고, 목적·선행 모듈 선언이 없거나 어긋난 계약은 등록을 거부한다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 입력 | `module_contract_documents` — `{ path, text }[]` (파일 시스템 접근 없음) |
| 출력 | `module_registry`, `registration_report` |
| 소유 상태 | `module_registry` (문서에서 파생되는 메모리 상태) |
| 선행 | 없음 |

오류는 모두 `VerificationIssue { code, path, message }` 로 보고한다. `path` 는 `<문서 경로>#/<필드>` 형식이라
실패한 조건이 문서 내 어디인지 바로 지목된다.

### 거부 코드

| 코드 | 조건 |
|---|---|
| `E_YAML_PARSE` · `E_NOT_A_MAP` | YAML 이 깨졌거나 최상위가 매핑이 아님 |
| `E_MISSING_FIELD` | 필수 필드 누락 (`purpose` 없음 · `depends_on` 없음 포함) |
| `E_EMPTY_PURPOSE` | 목적이 공백뿐 |
| `E_ID_FORMAT` · `E_NAME_FORMAT` · `E_PATH_ID_MISMATCH` | id/name 형식, 디렉터리와 id 불일치 |
| `E_LIST_TYPE` · `E_NONE_MIXED` | 목록이 비었거나 `none` 을 다른 값과 섞음 |
| `E_COMMAND_TYPE` | `commands.test/lab/verify` 누락 또는 빈 문자열 |
| `E_DUPLICATE_ID` | 같은 id 를 선언한 문서가 둘 이상 (양쪽 모두 거부) |
| `E_SELF_DEPENDENCY` · `E_DEPENDENCY_CYCLE` | 자기 참조 · 의존성 순환 |
| `E_UNKNOWN_DEPENDENCY` · `E_DEPENDENCY_REJECTED` | 없는 선행 참조 · 거부된 선행에 의존(연쇄 차단) |

`none` 은 "없음"의 명시적 선언이며 빈 배열로 정규화한다. 필드를 아예 쓰지 않은 것은 결손으로 보고 거부한다 —
원문 「8」의 V0 대표 검증(“목적이나 선행 모듈이 없는 모듈은 등록 실패”)을 그대로 옮긴 것이다.

## 결정성 (G5)

- 문서 배열 순서와 무관하게 같은 레지스트리·같은 `registryHash` 가 나온다 (모든 중간 단계를 경로/id 오름차순으로 고정).
- 위상 정렬의 동순위는 id 오름차순으로 깬다.
- 해시는 자체 SHA-256([src/sha256.ts](src/sha256.ts)) 이며, `node:crypto` 와 교차 검증한다. 브라우저에서도 같은 코드가 돈다.
- `Math.random` 을 쓰지 않는다. 시나리오·속성 테스트의 순열은 시드에서 유도한다(원문 「23」).

## 실행

```bash
pnpm test V0-module-contract   # 단위 · 속성 · 통합 테스트
pnpm lab                       # 브라우저 Lab (원문 「24」 공통 화면)
pnpm verify V0 --lab           # 증거 발급 → evidence/latest.json
```

## 검증 상태

현재 `LAB_PASS` — [evidence/latest.json](evidence/latest.json) 참조.

`VERIFIED` 가 아닌 이유는 원문 「5」 G6 통합 게이트다. V0 이 포함된 수직 슬라이스 VS0 은 K0~K3 을 함께 요구하므로
아직 실행할 수 없다. 원문 「23」이 증거 없는 `VERIFIED` 표시를 금지하므로 VS0 통과 전에는 올리지 않는다.

## 파일

```text
MODULE.yaml                  계약
schemas/                     MODULE.yaml 의 JSON Schema (V1 이 런타임 검증기로 소비할 예정)
src/contract.ts              원문 「3.2」 공통 TS 계약 (ModuleDefinition · VerificationScenario · …)
src/parse.ts                 문서 하나의 파싱·구조 검증
src/registry.ts              등록 · 연쇄 거부 · 위상 정렬 · 해시 · 의존 폐쇄
src/sha256.ts                브라우저/Node 공용 SHA-256
src/module.ts                ModuleDefinition 구현 (validateInput / execute / validateOutput)
scenarios/                   대표 검증 장면 6개 + 픽스처 생성기
lab/                         Lab 실행 진입점 (apps/lab 이 소비)
tests/{unit,property,integration}/
evidence/latest.json         원문 「21」 증거
```
