# 07. V 페이즈 목적 도달 감사

> 대상 문서: [design/modules/10-Phase-V-Verification.md](../design/modules/10-Phase-V-Verification.md)
> (원문 「8. Phase V — 검증 기반 모듈」). 이 문서는 그 문서의 **목적에 실제로 도달했는지**만 판정한다.

## 판정 요약

| 대상 | 판정 |
|---|---|
| V0~V4 다섯 모듈의 목적·산출물·직관 검증·선행 | **도달** |
| 원문 「8」의 「V 단계 완료 결과」 (브라우저 `/lab` 여섯 구획) | **미도달 → 이 작업에서 닫음** |

V4 를 구현한 시점에 다섯 모듈은 모두 `LAB_PASS` 였지만, 원문 「8」이 표와 **별도로** 요구한
“V 단계 완료 결과” 화면은 여섯 구획 중 둘만 서 있었다. 판정 데이터(`buildBoard`)는 V4 안에 있었는데
**실제 `/lab` 페이지가 그것을 그리지 않았다.** 모듈이 옳다는 것과 화면이 선다는 것은 다른 주장이다.

## 1. 모듈별 대조 (원문 「8」의 표)

| ID | 원문의 직관적 검증 | 어디서 확인되는가 | 판정 |
|---|---|---|---|
| V0 | 목적이나 선행 모듈이 없는 모듈은 등록 실패 | 장면 `missing_purpose_is_rejected` · `missing_dependency_field_is_rejected` | 도달 |
| V1 | 잘못된 상태 JSON을 넣으면 **구체적인 경로**와 함께 실패 | 장면 `wrong_type_reports_pointer_path` (instancePath + schemaPath 양방향) | 도달 |
| V2 | 같은 시드를 **100회** 실행해 같은 ID·난수열 출력 | 장면 `same_seed_repeats_sequence` — 100회 digest 1종 | 도달 |
| V3 | **실패한 조건의 전후 상태가 한 화면에 표시** | 장면 `failed_condition_shows_before_and_after` — `before`/`after`/`blame` | 도달 |
| V4 | **의존 모듈 변경 시 하위 모듈이 자동으로 `BLOCKED`로 변경** | 장면 `dependency_contract_change_blocks_dependents` · `invalidation_propagates_through_the_chain` | 도달 |

산출물도 대조했다. V0 `MODULE.yaml`·레지스트리 / V1 런타임 스키마 검증기 / V2 Seed RNG·Tick Clock·
Deterministic ID / V3 Scenario Runner·Fixture Loader / V4 `evidence.json`·검증 상태 관리 — 여기까지 있다.
남은 하나가 V4 의 **Lab UI** 였다.

선행 관계는 원문대로다. V3 에 V0 를 더 적은 판단의 근거는 [05](05-V3-scenario-runner.md) 참조.

## 2. 「V 단계 완료 결과」 감사

원문은 표 아래에 이렇게 쓴다.

```text
/lab
  모든 모듈 상태 · 실패한 검증 · 의존성 그래프 · 최신 코드 해시 · 리플레이 해시 · 자동 검증 결과
```

감사 시점의 `/lab` 화면 상태는 이랬다.

| 구획 | 감사 전 | 무엇이 문제였나 |
|---|---|---|
| 모든 모듈 상태 | ✗ | 레지스트리 표는 id·name·선행·소유 상태·목적만 보여 준다 — **검증 상태가 없다** |
| 실패한 검증 | △ | 계약 **등록** 거부만 보였다. 막힌 게이트(G6·G7)는 어디에도 없었다 |
| 의존성 그래프 | ✓ | |
| 최신 코드 해시 | ✗ | `registryHash` 는 계약 해시다. 모듈별 `sourceHash` 가 없었다 |
| 리플레이 해시 | ✗ | 증거에는 있었지만 화면에 없었다 |
| 자동 검증 결과 | ✗ | 원문 「27」 완성 판정이 화면에 없었다 |

즉 **증거 파일에는 다 있는데 사람이 브라우저에서 볼 수 없는 상태**였다. 원문 「24」가 “그래픽 모듈이
아니더라도 반드시 눈으로 확인할 수 있어야 한다”고 요구하는 이유가 그대로 적용된다 — 파일을 열어 봐야
알 수 있는 것은 직관 게이트를 통과한 것이 아니다.

## 3. 닫은 방법

`apps/lab` 이 저장소의 실제 `MODULE.yaml` 과 `evidence/latest.json` 을 읽어 **V4 에 그대로 넣고**,
`auditRepository → buildBoard` 결과를 여섯 구획으로 그린다. 화면은 판정을 만들지 않는다 — 옮겨 그리기만 한다.
화면이 스스로 판정하면 그 화면은 증거가 아니라 또 하나의 주장이 된다.

레지스트리 표에 있던 의존성 그래프는 새 화면으로 옮겨 중복을 없앴고, 남은 표는 “계약 등록”만 맡는다.

## 4. 화면 자체를 기계가 검사한다

구획을 그려 놓고 다음 사람이 지워도 아무도 모르면 같은 일이 반복된다. `tools/lab-shot.mjs` 가
브라우저에서 여섯 구획의 **존재와 내용**을 확인한다 — 제목만 있고 본문이 빈 구획은 통과가 아니다.
실패하면 `pnpm verify <ID> --lab` 이 그 모듈의 증거 발급을 거부한다.

```text
vPhaseComplete=true · moduleRows=5
  모든 모듈 상태 ✓  실패한 검증 ✓  의존성 그래프 ✓
  최신 코드 해시 ✓  리플레이 해시 ✓  자동 검증 결과 ✓
```

## 5. 부수적으로 확인된 것

다섯 모듈의 증거를 다시 발급했더니 **파일이 한 바이트도 바뀌지 않았다.** V4 의 장면
`evidence_is_reproducible_from_the_same_measurements` 가 주장하는 것이 저장소 규모에서 실제로 성립한다는
뜻이다 — 같은 측정이면 같은 증거다.

## 6. 남는 것 (이 문서의 범위 밖)

원문 「8」의 목적은 도달했다. 다만 그 목적이 **모듈을 `VERIFIED` 로 만들지는 않는다.**

```text
status=LAB_PASS
  막힌 게이트 G6 통합 게이트 — 슬라이스 1개 · 미통과 VS0
  막힌 게이트 G7 회귀 게이트 — 미측정 (회귀 측정 없음)
```

G6 은 K0~K3 이 와야 열리고(원문 「20」 VS0), G7 은 `--regression` 을 켜야 측정된다.
이것은 V 페이즈의 결함이 아니라 원문 「28」이 정한 순서 그대로다.
