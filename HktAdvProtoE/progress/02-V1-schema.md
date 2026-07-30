# 02. V1 schema

> 현재 상태 요약은 [../STATE.md](../STATE.md). 선행 기록은 [01-scaffold-and-V0.md](01-scaffold-and-V0.md).

## 한 일

원문 「22」의 1~11 단계대로 V1(schema)을 구현했다. 원문 「8」의 V1 정의는
"입력·출력 데이터가 계약을 지키도록 강제한다 / 런타임 스키마 검증기 / 잘못된 상태 JSON을 넣으면 구체적인 경로와 함께 실패"다.

| 단계 | 결과 |
|---|---|
| 1 선행 모듈 확인 | V0 = `LAB_PASS` (원문 「28」 고정 순서에 따라 V 페이즈를 먼저 마친다) |
| 2 MODULE.yaml 작성 | [V1-schema/MODULE.yaml](../packages/verification/V1-schema/MODULE.yaml) |
| 3 실패하는 시나리오 | 대표 장면 7개 |
| 4 최소 구현 | `src/{keywords,pointer,compile,registry,enforce,module}.ts` |
| 5 타입·단위 테스트 | 단위 88건 |
| 6 속성 테스트 | 9속성 × numRuns 1000 (시드 20260730 고정) |
| 7 대표 Lab 실행 | Lab 에 모듈 탭 추가 — V0/V1 을 같은 화면 형식으로 본다 |
| 8 인과 추적 확인 | 모든 위반이 `instancePath` + `schemaPath` 두 경로를 남긴다 |
| 9 통합 시나리오 | 통합 19건 (저장소 실제 MODULE.yaml · 스키마 레지스트리). VS0 은 여전히 K0~K3 대기 |
| 10 증거 파일 | `evidence/latest.json` |
| 11 VERIFIED 등록 | **하지 않음** — G6 미충족, 상태는 `LAB_PASS` |

## 설계 판단

- **직접 구현 대신 라이브러리(ajv 등)를 쓰지 않았다.** V1 의 산출물 자체가 "런타임 스키마 검증기"이고,
  요구가 *경로*와 *결정성*이다. 오류 경로 형식·출력 순서·미지원 키워드 정책을 우리가 통제해야 한다.
  코드 생성(eval)을 쓰지 않으므로 브라우저 Lab 에서도 그대로 돈다.
- **지원 부분집합을 명시하고, 목록 밖 키워드는 컴파일을 실패시킨다.** 모르는 키워드를 무시하면 스키마가 있는데도
  검증이 통과하는 최악의 상태가 된다(원문 「23」의 "검증 조건 완화"). `format` 도 같은 이유로 거부한다.
  지원 목록은 [json-schema-subset.schema.json](../packages/verification/V1-schema/schemas/json-schema-subset.schema.json) 에
  선언하고, 단위 테스트가 코드의 목록과 대조한다 — 문서와 구현이 갈라지지 않게.
- **경로를 두 방향으로 남긴다.** `instancePath`(데이터) + `schemaPath`(조건). 원문의 직관 검증은 데이터 경로만 요구하지만,
  "왜 걸렸는지"를 보려면 조건 위치가 필요하다.
- **`required` 위반은 없는 속성의 자리를 지목한다.** 통상 구현은 부모 객체를 가리키지만, 채워야 할 자리가 오류의 핵심이다.
- **타입 불일치 시 하위 조건 검사를 멈춘다.** 파생 오류가 Lab 화면을 덮지 않게 한다.
- **V1 을 V1 로 검증한다.** V1 의 `validateInput`/`validateOutput` 은 자기 입력·출력 스키마를 통과한다.
  스키마로 표현할 수 없는 조건(집계 일치 등)만 코드로 남겼다.
- **V0 을 고치지 않았다.** V0 의 손으로 쓴 구조 검증을 스키마 기반으로 교체하는 것은 V0 의 계약 변경이므로
  원문 「23」의 Change Request 대상이다. 대신 **두 판정이 일치하는지 검증**하고 경계를 문서화했다.
  V0 의 픽스처·스키마 파일은 읽기만 한다.

## 이번 단계에서 스캐폴드가 바뀐 것

- `apps/lab` — 모듈 탭 추가. 등록된 모듈마다 원문 「24」의 같은 화면을 그린다.
- `tools/typecheck.mjs` — 모듈이 늘어나도 tsconfig 를 자동으로 훑는다.
- `tools/verify.mjs` 증거 정직성 두 곳 수정:
  - `propertyTests.seeds` 가 V0 의 파일명에 하드코딩되어 있어 V1 에서 0 으로 나왔다 → `tests/property/` 전체를 훑고
    파일마다 다르면 최솟값을 쓴다.
  - `replay` 가 `{runs: 100, uniqueHashes: 1}` 상수였다 → 브라우저에서 대표 장면을 20회 다시 실행해
    결과 해시 개수를 실제로 센 값(`window.__hktReplayDigest`)으로 대체했다. 손으로 적은 수치는 증거가 아니다.

## 게이트 판정 (원문 「5」)

| 게이트 | 상태 | 근거 |
|---|---|---|
| G0 목적 | 통과 | MODULE.yaml `purpose` 한 문장 |
| G1 계약 | 통과 | 입력·출력·소유 상태·오류 형식(`SchemaIssue`) 명시 |
| G2 단위 | 통과 | 키워드별 정상·실패·경계값 88건 |
| G3 속성 | 통과 | 임의 JSON 에서 예외 없음·비변경·결정성·경로 실재성 (9속성 × 1000) |
| G4 직관 | 통과 | Lab V1 탭 7장면 통과 (패널 7 · 체크 37 · 콘솔 오류 0) |
| G5 결정성 | 통과 | 브라우저 20회 재실행 → 해시 1개 · 스키마 작성 순서 무관 |
| G6 통합 | **미충족** | VS0 이 K0~K3 을 요구 |
| G7 회귀 | 통과 | V0 의 기존 시나리오·테스트 그대로 통과 (V0 증거 재발급 확인) |
| G8 증거 | 통과 | `evidence/latest.json` (sourceHash · contractHash · dependencyVersions V0=0.1.0) |

## 다음 작업에 넘기는 것

- **V2 determinism** — `ModuleContext` 의 `seed`/`tick` 을 Seed RNG · Tick Clock · Deterministic ID 로 교체한다.
  현재 시나리오의 시드 유도(순열·오프셋)는 임시 구현이다.
- **V3 scenario-runner** — `runScenario` 와 각 모듈의 `defineScene` 헬퍼를 대체한다. V0·V1 이 같은 모양의
  `defineScene` 을 각자 갖고 있는데, 이 중복이 V3 이 흡수할 몫이다.
- **V4 evidence-gate** — `tools/verify.mjs` · `tools/lab-shot.mjs` · Lab 의 모듈 탭·레지스트리 보드를 대체하고
  모듈 상태 관리(의존 모듈 변경 시 하위 `BLOCKED`)를 맡는다.
- **K0 entity-state** — 정식 세계 상태 스키마의 소유자. V1 의
  `scenarios/fixtures.ts` 의 세계 상태 스키마는 검증용 픽스처이며 K0 의 스키마가 아니다.
- **A1·A2** — [Design-MMO.md](../design/Design-MMO.md) 의 AI 생성 파이프라인에서 "JSON 스키마 검증" 단계가 V1 을 쓴다.
- V0·V1 의 `VERIFIED` 승격은 K0~K3 완료 후 VS0 통과 시점.
