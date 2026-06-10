# step-0014 개념 해설 — 가방 서비스 분리 (신성한 tick · 단일 소유 · 쌍 거래)

> 이 문서는 step-0014 가 다루는 *핵심 개념*을 푼다(무엇을·왜·어떻게 검증했나). 압축적 정식 기록은 [step-0014.md](step-0014.md), 현재 위치는 [STATE.md](STATE.md). 닫은 step 의 개념 문서는 이후 수정하지 않는다.

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|---|---|---|
| **신성한 tick** | 시뮬 tick 안엔 시뮬만 — 그 외(아이템·인증·채팅)는 비동기 서비스/버스 경유 | 가방을 존 tick 밖으로 뺀 *첫 실증* (`sacred`) |
| **게임 서비스 계층** | tick 과 무관한 게임 상태(가방·채팅·거래소…)를 담는 SPINE 계층 3 | 첫 박스 = InventoryService (⬜→🟡) |
| **순수 반응형 서비스** | onTick 없이 onMsg(요청)에만 반응하는 액터 — tick 박자와 무관 | InventoryService 가 onTick 0 |
| **아이템 원장(ledger)** | itemId→owner 의 단일 진실(Map) — 구조적 소유자=1 | `InventoryService.ledger` |
| **쌍 거래(release+acquire)** | 이동 = sender 제거 + receiver 추가를 한 트랜잭션 안에 원자적으로 | give 가 한 onMsg 에서 원자 |
| **트랜잭션 정합(consistent)** | 원장 ≡ 역인덱스(byOwner) — 비-원자 이동 검출 | `ledgerConsistent` 교차검증 |
| **보존(conserved)** | 아이템 총수 불변(ledger.size==minted) — dupe·loss 0 | `itemConserved`, 전송 열화에도 |
| **멱등 이동(idempotent transfer)** | 같은 이동의 재적용 = no-op fail(owner≠from) | 전송 redundancy/dedup 내성 |
| **비-침습(non-invasive)** | 새 박스가 기존 월드 상태를 비트 단위로 안 바꿈 | worldDigest(on)==worldDigest(off) |
| **belief 수렴** | 클라의 아이템 믿음이 서버 원장 진실로 수렴(itemDesync 0) | 서버 권위로만 belief 갱신 |

---

## 1. 신성한 tick — 왜 가방을 존 밖으로 빼는가

**정의.** "신성한 tick"은 이 시리즈의 founding belief 다([CLAUDE.md](CLAUDE.md)·[SPINE.md](SPINE.md) §2): *존 시뮬 tick 안에는 시뮬만 돌고, 시뮬 외 작업(동기 I/O·인증·아이템 트랜잭션·채팅 팬아웃)은 전부 비동기 서비스/버스 경유*다. 분리 판정 기준은 단 하나 — **"그 일이 존 시뮬 tick 과 같은 박자로 돌아야 하는가?"** 아니라면 존 밖으로.

**왜 중요한가.** 한 프로세스가 모든 일을 하면 *모든 일이 서로의 병목*이다. 아이템 거래가 존 tick 안에서 일어나면 트랜잭션·팬아웃이 시뮬 헤드룸을 갉아먹는다(곧 동접 한계). 아이템은 *tick 박자와 무관*하므로(언제 거래하든 시뮬 결정론과 무관) 존 밖 비동기 서비스로 빼면, 존 tick 은 순수 시뮬만 돌고 가방은 자기 속도로 돈다.

**이 step 에서.** 0001~0013 은 월드(존)·버스·코디네이션을 채웠지만, *비-시뮬 게임 상태*(아이템)는 아직 어디에도 없었다 — "신성한 tick"이 *원칙*으로만 존재하고 *실증*된 적이 없었다. 이 step 이 가방을 떼어 처음으로 그것을 수치로 보였다: `sacred` 모드가 ⒜ 가방 ON/OFF 에 존 시뮬 상태가 *비트 동일*(worldDigest 불변 = 가방이 시뮬에 비-침습) ⒝ 그러면서 가방은 *실제 일함*(minted 47~53·transfer 6~13) ⒞ 존에 도달한 item 메시지 *0*(가방은 존 우회) ⒟ inventory 가 *onTick 없음*(tick 무관)을 단언한다.

---

## 2. 순수 반응형 서비스 — onTick 의 부재가 곧 분리의 증거

**정의.** 0013 까지 모든 액터는 `onTick(tick)`(매 tick 호출)과 `onMsg(m)`(메시지 도착)을 가졌다. `InventoryService` 는 **onTick 이 없다** — 오직 `onMsg`(item_req)에만 반응한다. 즉 *tick 의 박자를 타지 않는* 순수 반응형 서비스다.

**왜 중요한가.** "신성한 tick"의 가장 깔끔한 증명은 복잡한 격리가 아니라 *서비스가 tick 에 붙어있지 않음*을 보이는 것이다. inventory 가 onTick 을 갖지 않는다는 사실 하나가 "이 박스는 시뮬 박자와 무관하다"를 코드 구조에 그대로 드러낸다. 멀티프로세스에서도 broker 는 매 tick inventory 호스트에 tick RPC 를 보내지만 onTick 이 없어 *no-op* 이다 — 가방은 deliver(요청)에만 일한다.

**이 step 에서.** `sacred` 가 `typeof inventory.onTick !== 'function'` 을 단언한다. 이것이 0013 의 모든 박스(존·orch·게이트웨이는 onTick 으로 lease·뷰·라우팅을 했다)와 가방을 가르는 선이다.

---

## 3. 아이템 원장과 단일 소유 — 자료구조가 보장하는 것, 증명할 것

**정의.** 원장(ledger)은 `Map<itemId, owner>` — 각 아이템이 *정확히 한* 소유자를 가리키는 함수다. 이 자료구조 자체가 *소유자=1*(어떤 아이템도 동시에 두 곳에 있을 수 없음)과 *dupe 불가*를 구조적으로 보장한다.

**왜 중요한가.** 권위 단일 소유는 netcode 의 핵심 불변이다(존 엔티티의 소유자=1 과 같은 원리, 아이템 판). 하지만 Map 이 소유자=1 을 *공짜로* 주므로, 진짜 검증해야 할 위험은 따로 있다 — *비-원자 이동*(이동 중 한쪽만 갱신되어 아이템이 두 소유자 집합에 잠깐 존재하거나 사라지는 것). 이건 원장 단독으로는 안 보인다.

**이 step 에서.** 그래서 `byOwner`(owner→Set\<itemId>) *역인덱스*를 따로 두고, **원장 ≡ byOwner**(ledgerConsistent)를 교차검증한다 — 두 표현이 어긋나면 비-원자 이동이 있었다는 뜻. 또 belief 기준 `maxItemBeliefOwners==1`(어떤 아이템도 두 클라가 동시에 소유 믿지 않음)로 split-brain 을 잡는다.

---

## 4. 쌍 거래(release+acquire) — 존 핸드오프의 아이템 판

**정의.** 아이템 이동(give)은 *한 onMsg 안에서* sender release(`byOwner[from].delete(id)`)와 receiver acquire(`ledger.set(id,to)` + `byOwner[to].add(id)`)를 *원자적으로* 수행한다. 둘이 분리되면 공백(무소유)이나 중복(이중 소유)이 생긴다.

**왜 중요한가.** 이건 새 개념이 아니라 *이미 존 권위 핸드오프*(0006)에서 본 원리다 — "권위 이동은 release+acquire 쌍 거래(닫힌 장부의 netcode 판)". 존 사이 엔티티 이동도, 가방 안 아이템 이동도, *같은 불변*(매 시점 소유자 정확히 1)을 같은 방식(원자 쌍 거래)으로 지킨다. step-0014 는 그 패턴이 *시뮬 밖 서비스*에서도 똑같이 성립함을 보인다.

**이 step 에서.** give 의 조건(`owner==from && to && to!=from`)이 미소유·이미이동·자기자신을 거부(failedOps)한다 → phantom·중복 이동 0.

---

## 5. 보존·멱등 이동 — 전송 열화에도 원장이 버티는 이유

**정의.** *보존(conserved)* = 아이템 총수가 불변(ledger.size == minted, 소멸 없이 이동만). *멱등 이동(idempotent transfer)* = 같은 give 를 두 번 적용해도 결과가 같음 — 두 번째는 owner 가 이미 바뀌어(owner≠from) *no-op fail* 이 된다.

**왜 중요한가.** 실 네트워크는 메시지를 잃고·중복 보낸다(0012/0013 의 redundancy/loss). 가방 홉(gateway↔inventory)을 열화하면 item_req 가 중복 도착할 수 있다. 멱등 이동이 아니면 중복 give 가 아이템을 복제하거나 잃는다. 멱등이면 중복이 와도 *원장 보존*.

**이 step 에서.** `ownership` 모드가 가방 홉을 redundancy 3·loss 0.2 로 열화하고도 원장이 *보존·정합*함을 단언한다(열화 컬럼). 이는 0008 의 ack/재전송, 0012 의 reqId 멱등이 준 안전을 *애플리케이션 트랜잭션 의미* 층에서 다시 얻은 것 — 트랜잭션의 멱등이 전송의 멱등과 만난다.

---

## 6. 비-침습 — 새 박스가 기존 세계를 비트 단위로 안 건드린다

**정의.** *비-침습(non-invasive)* = 가방을 켜도(ON) 끈(OFF) 것과 비교해 *월드 시뮬 상태가 비트 동일*(worldDigest 불변). 가방은 존 net.log·존 ents·클라 AOI 뷰 어느 것도 바꾸지 않는다.

**왜 중요한가.** 회귀 0(reg)은 "새 기능을 *끄면* 직전 step 과 비트 동일"을 본다 — 가산이 기존 동작을 안 깼는지. 비-침습은 한 발 더 — "새 기능을 *켜도* 기존 *월드*는 비트 동일"이다. 가방이 시뮬과 진짜로 분리됐다면, 가방을 켜든 끄든 존 시뮬은 똑같이 굴러야 한다.

**이 step 에서.** 비-침습의 *비결*은 두 가지였다(의외의 발견): ⒜ 아이템 메시지가 존에 *안 닿음*(존 우회) ⒝ 클라 아이템 행동이 *별도 RNG 스트림*(itemRng 0x17E1, move rng 0xC11E 와 분리)을 씀 → move 시퀀스 무오염. ⒝가 없으면(같은 rng 공유) 가방 on/off 가 move 를 어긋나게 해 월드가 갈린다. "비-침습"은 단순히 메시지 격리가 아니라 *결정론 스트림의 격리*까지 포함한다.

---

## 7. belief 수렴 — 아이템에도 desync 0

**정의.** 클라는 아이템을 *낙관적으로* 바꾸지 않고 *서버 결과*(item_result/item_recv)로만 `items` 를 갱신한다. 그래서 클라의 믿음(belief)은 서버 원장 진실로 *수렴*한다(itemDesync 0 = 모든 클라 belief == 원장의 자기 소유분).

**왜 중요한가.** "수렴(desync 0)"은 netcode 불변이다(클라 예측 뷰는 권위 재현으로 수렴). AOI 뷰(0005~)가 존 권위로 수렴하듯, 아이템 belief 도 가방 권위로 수렴해야 한다. 서버 권위로만 belief 를 갱신하면 보수적(과대 소유 안 함)이라, 도중 give 가 fail 나도 belief 가 새지 않는다.

**이 step 에서.** `ownership`·`e2e` 가 행복 경로에서 itemDesync 0 을 단언한다 — 충분한 꼬리 tick 후 모든 클라 belief 가 원장과 정확히 일치.

---

## 요약 — step-0014 가 더한 한 조각

SPINE 계층 3(게임 서비스)의 **첫 박스**(가방)를 세워, founding belief 인 *신성한 tick*("시뮬 tick 엔 시뮬만")을 처음으로 수치 실증했다. 가방은 *tick 무관 순수 반응형 서비스*(onTick 0)·자기 OS 프로세스·버스 구독자이고, 아이템 이동은 존 권위 핸드오프와 같은 *쌍 거래*(release+acquire 원자)다. 가방은 존을 우회하므로 *비-침습*(월드 비트 동일)이며, 단일 소유·보존·정합·멱등 이동·belief 수렴·은닉·헤드리스를 전 시드 통과했다. 가방 OFF 면 0013 비트 동일(회귀 0).
