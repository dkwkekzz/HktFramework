# step-0022 concepts — Chat Command-Log Snapshot Compaction

> 정식 기록: [step-0022.md](step-0022.md) · 현재 위치: [STATE.md](STATE.md)

이 step 의 *핵심 개념*("무엇을·왜·어떻게 검증했나")을 푼다. 압축적 정식 기록은 [step-0022.md](step-0022.md).

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 스냅샷 압축(snapshot compaction) | 로그를 무한히 쌓지 않게 *주기 스냅샷*을 떠 그 이전 로그를 폐기하는 것 | 채팅 커맨드 로그를 (스냅샷 1개 + 짧은 tail)로 유계화 |
| 효과소싱 vs 커맨드소싱 | 저널에 *상태 변화(효과)*를 적느냐 *명령(커맨드)*을 적느냐 | 가방=효과(0017) / 채팅=커맨드(0021) — 압축 스냅샷의 *내용*이 갈린다 |
| 파생 상태(derived/projected state) | 로그를 리듀스해 얻는, 직접 저장하지 않는 런타임 상태 | 채팅의 라우팅 테이블(channels/byAvatar)·deliveries — 채팅 스냅샷의 대상 |
| 스냅샷 베이스 + tail replay | 스냅샷으로 헤드를 복원하고 그 뒤 로그만 재실행해 전체 상태를 재구성 | `replay(journal, snapshot)` — 스냅샷 복원 후 tail 커맨드만 `_process` |
| 압축-인지 완전성 회계 | 압축이 로그 길이를 줄여도 *영속된 항목 수*는 누적 카운터로 추적 | `writes == joins+says+whispers+leaves`(journal.length 아님) |

## 1. 스냅샷 압축 — 왜 필요한가

event sourcing 의 로그는 **append-only** 다. 복구를 위해 모든 효과/커맨드를 적지만, 그대로 두면 로그가 *무한히 자란다*(복구 시간·디스크가 함께 폭발). 해법은 주기적으로 **스냅샷**(현재 상태의 사진)을 떠서, 그 시점 이전 로그를 *폐기*하는 것이다. 복구는 "마지막 스냅샷 + 그 이후 로그(tail)"만 보면 된다 → 로그가 **(스냅샷 1개 + 짧은 tail)로 유계**.

0018 이 가방 *효과* 저널에 이 패턴을 심었고, 이 step 은 같은 패턴을 채팅 *커맨드* 로그에 반복한다. "intent 로그 + 주기 스냅샷"은 데이터 계층의 정전(canonical) 패턴([STATE.md](STATE.md) §4 DURABLE).

## 2. 효과소싱 vs 커맨드소싱 — 스냅샷의 *내용*이 갈리는 이유

이 step 의 핵심 통찰. **스냅샷은 "복구의 베이스"이고, 베이스의 모양은 *무엇을 소싱하느냐*가 결정한다.**

- **가방(효과소싱·0017/0018)**: 저널에 *효과*(mint/xfer)를 적는다. 상태(원장 itemId→owner)는 효과의 *직접 누적*이다. → 스냅샷 = **원장 값** 직렬화. replay = 효과 재적용.
- **채팅(커맨드소싱·0021/0022)**: 저널에 *커맨드*(join/say/whisper/leave)를 적는다. say 의 팬아웃은 *그 시점의 라우팅 테이블*에 의존하는 **파생 상태**다 → 효과를 직접 적을 수 없어 커맨드를 적고 리듀서를 재실행한다. → 스냅샷 = **라우팅 파생 상태 전체**(channels: channel→Set\<avatar\> · byAvatar 역인덱스 · deliveries · 계측).

즉 채팅 스냅샷은 *커맨드 로그의 리듀스 결과를 통째로* 뜬다. 그럼에도 PersistStore 의 snapshot 핸들러는 `snap.upToSeq` 만 보고 그 이하 로그를 폐기할 뿐 — snap 의 *모양*에 무관(제네릭)하므로 가방·채팅이 **같은 박스를 무변경 공유**한다. event sourcing 압축의 추상이 효과/커맨드 양쪽에 동일하게 성립한다는 증거.

## 3. 스냅샷 베이스 + tail replay — 합성의 정확성

`replay(journal, snapshot)`:
1. **스냅샷 복원** — channels/byAvatar/deliveries/계측을 스냅샷에서 직접 세팅(헤드 커맨드들의 리듀스 결과).
2. **tail replay** — `seq > upToSeq` 인 커맨드만 `_process` 재실행(스냅샷에 이미 반영된 헤드는 skip → 이중 적용 방지). `replaying` 가드로 재발신은 0, 라우팅·deliveries·계측만 재구성.

이 *합성*이 전체-커맨드 replay 와 비트 동일이려면: ⒜ 스냅샷이 헤드의 리듀스 결과를 빠짐없이 담고 ⒝ Set/Map 의 **삽입 순서**가 보존돼야 한다(say 가 구독자 Set 을 순회하는 순서 = deliveries 순서 = 결정론). 직렬화 `[...set]` / 복원 `new Set(arr)` 가 순서를 보존하므로 성립. 검증(chat-compact)은 스냅샷 주기를 5로 잡아 *비-빈 tail(3개)* 를 강제 — 순수 스냅샷 복원이 아니라 *합성* 경로를 타게 했다.

## 4. 압축-인지 완전성 회계 — `journal.length` 의 함정

0021 의 완전성 검사는 `writes == journal.length`(영속된 커맨드가 로그에 다 있는가) 였다. 그런데 **압축이 journal.length 를 줄인다** → 이 검사가 거짓이 된다. 해법은 0018 과 동일: 완전성을 *누적 카운터*로 본다. `writes`(PersistStore 의 누적 append 수 — 압축에도 안 줄음)가 채팅이 *기록한 커맨드 수*(joins+says+whispers+leaves)와 같은가. 이를 위해 `leaves` 누적 카운터를 새로 추가했다(기존 joins/says/whispers 처럼). 압축은 *보관*을 줄일 뿐 *영속된 커맨드 수*는 안 줄인다는 불변을 회계가 반영한다.

## 검증으로 무엇을 보였나

- **무손실**: 라우팅 스냅샷+tail replay == 전체-커맨드 replay == 무재시작(chatDigest 비트 동일·전 시드).
- **유계화**: 커맨드 로그 78→3(96% 절감)·15 스냅샷.
- **비-침습**: chatSnapshot OFF → 0021 비트 동일(reg 25/25)·월드 비트 동일(신성한 tick).
- **E2E**: 멀티프로세스(chat-restart 14) = 인프로세스 비트 동일(chatPersistDigest 에 라우팅 스냅샷 포함).

## 한 줄 요약

**채팅 커맨드 로그도 주기 *라우팅 스냅샷*으로 유계화된다 — 효과소싱(가방)·커맨드소싱(채팅) 둘 다 압축 완성.** 핵심: 커맨드소싱의 스냅샷은 *원장 값*이 아니라 *리듀스 결과(라우팅 파생 상태) 전체*이지만, PersistStore 압축은 제네릭이라 무변경 공유된다 — event sourcing 압축 추상이 효과/커맨드 양쪽에 성립.
