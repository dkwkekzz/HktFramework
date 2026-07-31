# 09. K 페이즈 목적 도달 감사

> 대상 문서: [design/modules/11-Phase-K-Kernel.md](../design/modules/11-Phase-K-Kernel.md)
> (원문 「9. Phase K — 결정적 세계 커널」). 이 문서는 그 문서의 **목적에 실제로 도달했는지**만 판정한다.
> 구현 기록과 설계 판단은 [08](08-K-phase-kernel.md).

## 판정 요약

| 대상 | 판정 |
|---|---|
| K0~K3 네 모듈의 목적·포함·출력·대표 검증·금지·선행 | **도달** |
| 파생 메모의 패키지 경로 · Invariant Audit 대상(GI-01·GI-12) | **일치** |

감사는 문서를 다시 읽는 것이 아니라 **다시 실행**하는 방식으로 했다.

```text
pnpm run typecheck                     → 전 패키지 통과
pnpm test                              → 45파일 · 848 통과 (저장소 규약 98 · VS0 슬라이스 32 포함)
pnpm verify K0·K1·K2·K3 --lab --regression
                                       → 네 모듈 모두 status=VERIFIED · Lab 통과 · VS0 24검사 0실패
git status                             → 재발급된 증거 파일이 한 바이트도 바뀌지 않았다
```

증거가 바이트 단위로 재현된다는 것은, 저장소에 적힌 `VERIFIED` 가 과거의 주장이 아니라
**지금 다시 측정해도 나오는 값**이라는 뜻이다 — V 페이즈 감사([07](07-V-phase-completion-audit.md) 5절)와
같은 성질이 K 페이즈에서도 성립한다.

## 1. 대표 검증 대조 (원문 「9」의 표)

| ID | 원문의 대표 검증 | 어디서 확인되는가 | 판정 |
|---|---|---|---|
| K0 | 두 실체의 체력·위치·소유권이 섞이지 않고 독립적으로 조회됨 | 장면 `two_entities_do_not_bleed_into_each_other` — 한쪽만 다치게 한 뒤 옆 실체의 체력·위치가 그대로이고 소유권은 유물에만 있음을 확인 | 도달 |
| K1 | “체력 50 이하이며 반경 10m 내에 있는 인간”만 정확히 선택 | 장면 `weak_humans_within_ten_meters` — 후보 8 전원이 판정에 올라오고, 경계값 50 이 포함되며, 떨어진 후보마다 어긴 잎 조건이 원인으로 남는다 | 도달 |
| K2 | 에너지 부족 시 공격이 실패하며 피해·비용 모두 적용되지 않음 | 장면 `attack_fails_when_energy_is_short` — 네 번째 시도의 델타 0건, 전후 세계 해시 동일, `E_UNAFFORDABLE_COST` 가 못 낸 비용의 좌표(`rule/l1_strike/costs/0`)까지 지목 | 도달 |
| K3 | 1,000틱 실행 후 재생한 최종 상태와 사건 해시가 완전히 동일 | 장면 `thousand_ticks_replay_is_identical` — `finalTick=1000` 을 검사로 강제하고, 두 갈래 재생(로그 되짚기=GI-01 · 재시뮬레이션=GI-12)과 스냅샷 왕복이 모두 원본 해시와 일치 | 도달 |

대표 검증이 **형식만 채우지 않았는지**도 보았다.

- K1 은 후보를 `from` 으로 미리 좁히지 않고 세계 전체를 올린다 — “만 정확히 선택”은 떨어져야 할
  것들이 각자의 이유로 떨어질 때만 증명되기 때문이다. 전수 조회와의 교차 대조(`plan_equals_full_scan`)도 같이 간다.
- K3 은 `사건 100건 초과` 와 `거부가 섞여 있음` 을 검사로 강제한다 — 아무 일도 없는 세계를
  1,000틱 굴려 통과하는 길이 막혀 있다.

## 2. 포함·출력 대조

| ID | 원문의 「포함」 | 실물 | 원문의 「출력」 | 실물 |
|---|---|---|---|---|
| K0 | Entity Registry · Component Store · 타입별 인덱스 | `EntityStore`(spawn/despawn) · 컴포넌트 맵 + `ComponentRegistry` · `byKind`/`byComponent` | `EntityState` · `ComponentSnapshot` | `src/types.ts` 의 두 타입 + JSON 스키마 2종 |
| K1 | Predicate AST · Query Planner · Path Resolver | `PredicateSpec`(**원문 여덟 연산자 그대로, 한 줄도 늘리지 않음**) · `src/plan.ts` · `src/path.ts` | 참·거짓 · 대상 목록 · 조건 실패 원인 | `PredicateResult.passed` · `QueryReport.matched` · `PredicateCause`(후보별 `causes`) |
| K2 | Intent Validation · Rule Matching · Cost Calculation · StateDelta | 의도·행위자 검증(장면 6 이 없는 행위자·규칙 없는 행동을 각각 거부) · `RuleBook` · `costs`/`costDelta` · `StateDelta` | 성공 또는 실패 결과와 상태 변경안 | `TransactionOutcome`(ok/rejection + `delta`) |
| K3 | Event Log · Scheduler · Snapshot · Replay · Invariant Audit | `WorldRuntime` 일지 · 예약 대기열(장면 4: 3틱 뒤 축복) · 스냅샷(시계·ID 발급기·대기열 포함) · `replayFromLog`/`resimulate` | `WorldEvent` · 리플레이 해시 · 스냅샷 | `WorldEvent` 스키마 · `logHash` · `WorldSnapshot` 스키마 |

## 3. 금지 대조 — K0 「다른 모듈이 내부 Map을 직접 수정하는 것」

금지가 규약이 아니라 **구조**로 지켜지는지 보았다.

- 내부 Map 은 전부 private 필드(`#entities` · `#byKind` · `#byComponent`)라 밖에서 닿을 수 없다.
- 모든 쓰기는 새 `EntityStore` 를 돌려주고, 읽기는 동결(`Object.freeze`)된 사본만 내보낸다.
- 장면 `outside_mutation_does_not_shake_the_store` 가 “읽어 간 상태를 밖에서 고쳐도 저장소는
  흔들리지 않는다”를 화면에서 확인하고, K2 는 실제로 이 성질 위에서 원자성을 얻는다
  (작업용 저장소를 버리는 것으로 — [08](08-K-phase-kernel.md) 설계 판단).

## 4. 선행 대조

원문 「9」의 선행(K1←K0 · K2←K0,K1 · K3←K0~K2,V2)은 네 `MODULE.yaml` 의 `depends_on` 에 모두
들어 있다. 원문에 없는 V0(K0 은 V1 도)를 더 적은 근거는 [08](08-K-phase-kernel.md) 「선행 선언」 —
실제로 쓰는 것을 그대로 적었고, `tests/conventions.test.ts` 가 `depends_on` 과 `package.json`
의존을 양방향으로 대조하므로 몰래 의존하거나 쓰지 않는 것을 적는 것 모두 걸린다.

파생 메모의 패키지 경로 네 줄도 실물과 일치하고, K3 의 Invariant Audit 은 파생 메모가 지목한
GI-01·GI-12 를 실제로 감사한다(추가로 K0 이 GI-11 을 본다).

## 5. 남는 것 (이 문서의 범위 밖)

원문 「9」의 목적은 도달했다. 다만 그것이 저장소 전체의 완성을 뜻하지는 않는다 — 이미
[08](08-K-phase-kernel.md) 「다음으로 넘긴 것」과 [STATE.md](../STATE.md) 에 적힌 그대로다.

- 원문 「27」의 전체 완성 판정은 여전히 `false` — 측정 주체가 없는 지표 7개가 남아 있다.
- `WorldEvent` 의 `situationId`·약속·훅 칸은 I·C 페이즈가 채운다.
- GI-02~GI-10 은 담당 모듈이 와야 측정된다 — 0 이 아니라 미측정으로 남아 있다.
- 다음 작업은 원문 「28」 3단계의 **S0 (spatial-affordance)** 다.
