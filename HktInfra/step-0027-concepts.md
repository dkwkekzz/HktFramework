# step-0027 개념 — PersistStore failover: 이중쓰기와 단일점 제거

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|-------------------|
| 단일점(Single Point of Failure) | 그것이 죽으면 전체가 무너지는 컴포넌트 | PersistStore = 이전 단일점. 이 step 이 제거 |
| 이중쓰기(Dual Write) | 동일 데이터를 두 스토어에 동시 기록 | `_journal()` 에서 primary + backup 에 동시 발신 |
| 데이터 계층(Data Layer) | 세션보다 오래 사는 내구 박스 | PersistStore 두 인스턴스 모두 세션 독립 |
| 복구원 선택(Recovery Source Selection) | crash 시 어느 스토어에서 replay 할지 결정 | `invRestart` 가 persistRestart 여부로 persist vs persist2 선택 |

## 핵심 통찰: "데이터 계층도 죽는다"

0023~0026 에서 write-behind 신뢰성 체인을 완성했다 — 저널 홉 손실(중간/tail), in-flight give/mint 손실을 모두 커버. 하지만 한 가지를 가정했다: **PersistStore 자체는 안 죽는다**고.

PersistStore 가 진짜 죽으면 어떻게 되는가?

```
InventoryService → (journal) → PersistStore  ← crash!
                                     │
                              journal = []  (RAM 소실)
                                     │
invRestart → inventory.replay([])   # 원장 재현 불가 → 소실
```

이것은 0016 이전의 "persist 없음" 대조군과 동일한 결과다. 0016~0026 의 모든 노력이 PersistStore 한 박스의 죽음으로 무너진다.

## 이중쓰기 패턴

**가장 단순한 단일점 제거**: 같은 저널 항목을 두 박스에 동시 발신.

```
_journal(entry):
  full = { ...entry, seq }
  net.send(→ persist,  { type:'journal', entry:full })   // primary
  net.send(→ persist2, { type:'journal', entry:full })   // backup  ← 이 step
```

`persist2` 는 PersistStore 의 두 번째 인스턴스 — 완전히 독립된 박스(다른 주소, 다른 프로세스). `primary` 가 죽어도 `persist2` 는 전체 저널 사본을 갖고 있다.

복구:
```
persist.crash()   // primary 죽음 시뮬

invRestart:
  recoveryPersist = persist2   // backup 선택
  inventory.replay(persist2.journal, persist2.snapshot)   // 완전 복구
```

## 왜 fire-and-forget 이중쓰기인가?

write-behind 의 핵심: **결과 ack 는 영속 ack 를 기다리지 않는다**. 이 원칙은 이중쓰기에도 적용된다 — backup 발신도 fire-and-forget.

단점: primary 에는 도달했는데 backup 에는 못 도달한 경우? 0023 신뢰 전달이 primary 를 커버하듯, backup 도 동일 신뢰 경로로 커버할 수 있다. 이 step 에서는 퀴에스신트 재시작(저널 drain 완료 후)을 가정해 단순화 — 복잡한 동기화는 이후 step.

## 데이터 계층의 이중화 vs 서비스 이중화

세션 계층(InventoryService)의 failover 는 0017~0026 에서 다뤘다 — 서비스가 죽어도 *데이터 계층*이 살아 replay 로 복구. 이제 **데이터 계층 자체의 이중화**.

| 계층 | failover 방법 | 이 step |
|------|-------------|---------|
| 서비스(InventoryService) | crash → PersistStore replay | 0017 |
| 데이터(PersistStore primary) | crash → PersistStore backup replay | **0027** |

이것은 SPINE 데이터 계층("세션보다 오래 사는")의 내구성을 **구조적으로** 보장한다 — 단일 인스턴스 신뢰에서 이중화 신뢰로.

## 이 패턴의 한계

- **이중쓰기 정합성 윈도**: primary 에 도달하고 backup 에 도달 못 한 순간 primary 가 죽으면 backup 저널이 partial. 이 step 은 퀴에스신트 재시작으로 회피 — 모든 in-flight 발신이 drain 된 후에만 crash.
- **단방향 복제**: 현재는 primary → backup 단방향. backup 이 죽으면 다시 단일점. N-replica 는 이후 step.
- **클라 미인지**: 클라는 `persist2` 존재를 모른다 — 은닉 유지. failover 는 순수 서버간 choreography.

## write-behind 신뢰성 전체 지도

```
저널 항목 발신
      │
      ├─ 중간 손실? → 0023 NAK 재전송
      ├─ tail 손실? → 0024 heartbeat NAK
      ├─ in-flight give 손실? → 0025 클라 give-resend
      ├─ in-flight mint 손실? → 0026 id-reconciliation
      └─ PersistStore 죽음? → 0027 이중쓰기 backup ← 여기

모든 단일점 해소 완료.
```
