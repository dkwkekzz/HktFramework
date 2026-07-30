# K3 event-replay

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [11-Phase-K-Kernel.md](../../../design/modules/11-Phase-K-Kernel.md)
> 선행: [V0](../../verification/V0-module-contract/README.md) · [V2](../../verification/V2-determinism/README.md) · [K0](../K0-entity-state/README.md) · [K1](../K1-predicate-query/README.md) · [K2](../K2-rule-transaction/README.md)
> 사건·시뮬레이션 루프의 근거: [Design-MMO.md](../../../design/Design-MMO.md) 19.4 · 29장

## 목적 (G0)

모든 상태 변화를 원인 사건으로 기록하고 같은 시드·같은 입력이면 언제나 같은 사건 순서와 같은 최종 상태로 재생한다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 소유 상태 | `event_log` · `scheduler_queue` · `world_snapshot` |
| 입력 | `intent_journal` · `scheduled_event_template` · `world_snapshot` |
| 출력 | `world_event` · `replay_hash` · `invariant_report` |

```ts
const runtime = new WorldRuntime({ store, rules, worldSeed: '20260730', templates });
runtime.submit({ id: 'i0', actor: 'hunter_a', verb: 'strike', targets: ['beast_ka'] });
runtime.advance();                    // 틱 진행 + 예약된 사건 발화
runtime.snapshot();                   // 중간부터 이어 굴리기 위한 전부
runtime.audit(initial, resimulated);  // GI-01 · GI-12 · GI-11
```

## 설계 판단

### ① 세계를 바꾸는 문은 하나뿐이다 (GI-01)

`submit` 을 지날 때마다 사건이 로그에 덧붙는다. 거부된 의도는 바꾼 것이 없으므로 사건도 없다 —
일지에는 남으므로 “무엇을 시도했다가 왜 막혔는가”는 그대로 재생된다.

### ② 재생을 두 갈래로 확인한다

| 갈래 | 무엇을 하는가 | 무엇을 보장하는가 |
|---|---|---|
| `replayFromLog` | 사건에 **적힌 결과**(`stateDelta`)만 되짚어 최종 상태를 다시 만든다 | GI-01 — 모든 변화에 원인 사건이 있다 |
| `resimulate` | 일지를 **원인부터** 다시 굴려 사건을 새로 만든다 | GI-12 — 같은 입력이면 같은 사건 순서 |

되짚을 때 규칙을 다시 돌리지 않는 것이 핵심이다. 규칙을 다시 돌리면 “규칙이 바뀌어도 옛 로그가
재생된다”는 성질을 잃는다 — 사건 로그는 **일어난 일의 기록**이지 규칙의 함수가 아니다.

두 갈래가 같은 곳에 도착해야 세계가 결정적이다. 원문 「9」 K3 의 대표 검증(1,000틱)이 바로 이것을 본다.

### ③ 예약도 데이터다

`schedule_event` 는 K2 가 만들고 K3 이 일으킨다. 무엇을 하는지도 `ScheduledEventTemplate` 이라는
**데이터**로 적는다 — 함수를 넘기면 스냅샷을 뜰 수도 재생할 수도 없다. 대기열은 `(발화 틱, id)` 로
정렬해 같은 틱의 예약도 언제나 같은 순서로 일어나게 한다.

재시뮬레이션에서는 예약 의도를 일지에서 **다시 제출하지 않는다.** 틱이 흐르면 스스로 다시 태어나므로,
다시 제출하면 같은 축복이 두 번 내린다.

### ④ 스냅샷에는 시계·ID 발급기·대기열·일지가 함께 들어간다

상태만 저장하면 이어 굴린 세계가 갈라진다. 특히 **ID 순번**이 빠지면 이어 굴린 사건의 id 가 이미 쓴
id 와 겹친다. 속성 테스트가 “중간 스냅샷에서 이어 굴린 세계 = 통째로 굴린 세계”를 200 표본에서 지킨다.

뽑기 시드도 소비량이 아니라 **틱**에서 파생한다. 그래서 어느 지점에서 이어 굴려도 같은 후보가 나온다.

### ⑤ 감사는 “누가 고쳤는가”를 묻지 않는다

`audit` 이 묻는 것은 하나다 — **사건 로그만으로 지금 상태를 다시 만들 수 있는가.**
만들 수 없다면 어딘가에서 사건 없이 세계가 바뀐 것이고, 보고서는 되짚은 상태와 실제 상태의 해시를
함께 적어 어디가 어긋났는지 지목한다. 사건을 하나 지운 로그도 같은 방식으로 걸린다.

### ⑥ 지금 채우지 않는 칸

원본 19.4 의 `WorldEvent` 에는 `situationId` · `createdCommitmentIds` · `breachedCommitmentIds` ·
`unresolvedHookIds` 가 있다. I·C 페이즈가 와야 채워지는 칸이므로 **거짓으로 채우지 않고 두지 않았다.**
빈 배열을 넣어 두면 “채워졌다”와 “채울 수 없다”를 구분할 수 없다.

## 실행

```bash
pnpm test K3-event-replay
pnpm lab                 # K3 탭
pnpm verify K3 --lab
```
