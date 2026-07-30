# V1 schema

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [10-Phase-V-Verification.md](../../../design/modules/10-Phase-V-Verification.md) · 선행: [V0](../V0-module-contract/README.md)

## 목적 (G0)

모듈의 입력·출력 데이터가 선언된 스키마를 지키도록 런타임에 강제하고, 어긋난 값은 JSON Pointer 경로와 함께 거부한다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 입력 | `schema_document` (JSON Schema 부분집합), `instance_data` |
| 출력 | `validation_result`, `schema_issues` |
| 소유 상태 | `schema_registry` (`$id` → 스키마 문서 · 컴파일된 Validator 캐시) |
| 선행 | V0 — 공통 계약 타입(`ModuleDefinition` 등)과 해시를 쓴다 |

위반 하나는 다음 형태다. **경로를 두 방향으로 남긴다** — 데이터의 어디가 틀렸고, 스키마의 어느 조건에 걸렸는지.

```ts
{
  code: 'E_TYPE',
  instancePath: '/entities/1/energy',                 // 데이터 위치 (RFC 6901)
  schemaPath: '/$defs/entity/properties/energy/type', // 조건 위치
  message: '타입이 number 이어야 하는데 string 이다.',
}
```

## 지원하는 JSON Schema 부분집합

[schemas/json-schema-subset.schema.json](schemas/json-schema-subset.schema.json) 이 지원 키워드를 열거한다.
목록에 없는 키워드가 스키마에 있으면 **검증이 아니라 컴파일이 실패한다** — 모르는 조건을 조용히 통과시키는 것은
검증 조건 완화(원문 「23」)이기 때문이다. `format` 처럼 흔히 쓰이지만 구현하지 않은 키워드도 같은 이유로 거부한다.

| 분류 | 키워드 |
|---|---|
| 판정 | `$ref` `type` `const` `enum` `minLength` `maxLength` `pattern` `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` `multipleOf` `minItems` `maxItems` `uniqueItems` `items` `minProperties` `maxProperties` `required` `properties` `additionalProperties` `allOf` `anyOf` `oneOf` `not` |
| 주석(무시) | `$schema` `$id` `$comment` `$defs` `title` `description` `examples` `default` `deprecated` |

구현 규칙 중 표준과 다르게 선택한 것:

- **`required` 위반의 `instancePath` 는 없는 속성의 자리**(`/entities/0/position`)를 가리킨다. 통상적인 구현은 부모 객체를
  가리키지만, "어디를 채워야 하는가"가 오류의 핵심이므로 자리를 지목한다.
- **타입이 틀리면 그 노드의 나머지 조건은 검사하지 않는다.** 파생 오류로 화면을 채우지 않기 위한 것이다.
- **`oneOf`/`anyOf` 가 전부 실패하면 후보별 첫 위반을 요약**해 한 줄로 보여 준다.
- 출력 순서는 키워드 적용 순서(`KEYWORD_ORDER`)와 속성 이름 오름차순으로 고정한다 — 스키마 작성 순서가 결과를 바꾸지 않는다.

## 쓰는 법

```ts
import { compileSchema, guardInput, enforceSchemas, SchemaRegistry } from '@hkt/v1-schema';

// 1) 한 번 컴파일해 여러 값에 재사용
const validator = compileSchema(worldStateSchema);
const { valid, issues } = validator.validate(state);

// 2) 모듈 경계에서 예외로 막기
const parseInput = guardInput<MyInput>(myInputSchema, 'K2 입력');

// 3) 기존 ModuleDefinition 의 입력·출력 검증을 스키마로 대체
const guarded = enforceSchemas(myModule, { inputSchema, outputSchema });

// 4) 문서 간 $ref
const registry = new SchemaRegistry().add(entitySchema).add(worldSchema);
registry.validator(worldSchema.$id).validate(state);
```

V1 은 자기 입력·출력도 자기 스키마([schemas/v1-input.schema.json](schemas/v1-input.schema.json) ·
[schemas/v1-output.schema.json](schemas/v1-output.schema.json))로 검증한다.

## 결정성 (G5)

- 같은 스키마·같은 값이면 언제나 같은 위반 목록이 나온다 (속성 테스트 1000 표본 + Lab 20회 재실행).
- 검증은 입력 데이터를 변경하지 않는다.
- `$ref` 재귀는 `maxRefDepth`(기본 64)에서 멈추고, 조용히 통과시키지 않고 `E_REF_DEPTH` 로 보고한다.
- `Math.random` 을 쓰지 않는다 (원문 「23」).

## 실행

```bash
pnpm test V1-schema     # 단위 · 속성 · 통합 테스트
pnpm lab                # 브라우저 Lab → V1 탭
pnpm verify V1 --lab    # 증거 발급 → evidence/latest.json
```

## 검증 상태

현재 `LAB_PASS` — [evidence/latest.json](evidence/latest.json) 참조. `VERIFIED` 가 아닌 이유는 V0 과 같다
(G6 통합 게이트의 VS0 이 K0~K3 을 요구한다).

## V0 과의 경계

`MODULE.yaml` 검증은 두 모듈이 나눠 갖는다. 통합 테스트가 이 경계를 고정한다.

| 검사 | 담당 |
|---|---|
| 문서 내부 형식 (필드 유무·타입·`none` 혼용·id/name 패턴) | 양쪽 모두 (V0 파서 · V1 스키마 — 판정이 일치해야 한다) |
| 디렉터리 이름과 `id` 의 일치 | V0 (스키마는 파일 경로를 모른다) |
| id 중복 · 미등록 선행 · 의존성 순환 | V0 (문서 하나만 봐서는 알 수 없다) |
| 임의 데이터의 스키마 적합성 | V1 |

## 파일

```text
MODULE.yaml                          계약
schemas/json-schema-subset.schema.json  지원 키워드 명세 (코드와 대조하는 테스트가 있다)
schemas/v1-input.schema.json         V1 자기 입력 스키마
schemas/v1-output.schema.json        V1 자기 출력 스키마
src/keywords.ts                      지원 키워드 · 적용 순서
src/pointer.ts                       RFC 6901 JSON Pointer
src/compile.ts                       스키마 형식 검사 + 검증기
src/registry.ts                      SchemaRegistry ($id · $ref · 해시)
src/enforce.ts                       모듈 경계 강제 (guardInput · enforceSchemas)
src/module.ts                        ModuleDefinition (자기 스키마로 자기 입출력 검증)
scenarios/                           대표 검증 장면 7개 + 픽스처
lab/                                 Lab 실행 진입점
tests/{unit,property,integration}/
evidence/latest.json                 원문 「21」 증거
```
