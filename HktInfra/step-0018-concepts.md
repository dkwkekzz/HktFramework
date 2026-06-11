# step-0018 concepts — Journal Snapshot Compaction (log + checkpoint)

> 정식 기록: [step-0018.md](step-0018.md) · 현재 위치: [STATE.md](STATE.md)

이 문서는 step-0018 이 다루는 *핵심 개념*을 풀어 설명한다(정식 기록·수치는 [step-0018.md](step-0018.md)).

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| Event sourcing 의 무한 성장 | 효과 로그(저널)는 append-only 라 영원히 자란다 | 0017 가방 저널의 한계 ⓑ — 이 step 이 닫는 문제 |
| 스냅샷(체크포인트) | 어느 시점의 *상태 전체*를 한 장으로 굳힌 것 | 가방이 N항목마다 원장 스냅샷을 persist 로 발신 |
| 압축(compaction) | 스냅샷이 담은 헤드 로그를 폐기해 저장을 유계화 | PersistStore 가 upToSeq 이하 저널 폐기 |
| 스냅샷+tail replay | 복구 = 스냅샷 베이스 + 그 뒤 로그(tail)만 재생 | `replay(journal, snapshot)` — 전체 replay 와 비트 동일 |
| 무손실 압축 | 압축 후 복구가 압축 전 복구와 *비트 동일* | 가설의 핵 — 세 복구 경로가 같은 invDigest |
| 완전성의 진실 = writes | 영속된 변이 *누적* 수(압축에 불변) | `journalComplete` 를 length→writes 로 |

## 1. 왜 저널을 압축하는가 — event sourcing 의 무한 성장

0017 은 가방 원장을 *효과 저널*(event sourcing)로 영속화했다: `pickup`→mint, `give`→xfer 의 모든 변이를 `[{seq,kind,...}]` 로 append. 복구는 그 저널을 처음부터 끝까지 replay 해 원장을 재현한다(상태 전송 아님 = §4 "복제=재현").

문제: **저널은 append-only 라 영원히 자란다.** 100만 번의 거래는 100만 개의 항목이 되고, 복구는 그 100만 개를 전부 재생해야 한다 — 저장도 복구 시간도 *무계(unbounded)*. 이것이 0017 의 정직한 한계 ⓑ("저널 무한 성장·스냅샷 압축 없음")였다.

해법은 데이터 시스템의 정전(canonical) 패턴 — **"intent 로그 + 주기 스냅샷"**(§4 DURABLE·SPINE 에 못박힌 데이터 3분할 ①). 로그를 끝없이 쌓는 대신, *주기적으로 상태 전체를 한 장(스냅샷)으로 굳히고 그 이전 로그를 버린다.* Redis 의 RDB+AOF, Kafka 의 log compaction, LSM-tree 의 컴팩션, Raft 의 snapshot 이 모두 같은 골격이다.

## 2. 스냅샷 — "어디까지를 한 장으로 굳혔는가"

스냅샷은 *어느 seq 까지의 효과를 모두 반영한 원장 상태*다. 가방은 저널 N항목마다(`journalSeq % N === 0`) 현재 원장을 통째로 직렬화해 persist 로 보낸다:

```
snap = { upToSeq, ledger:[[itemId,owner]...], mintTotal, minted, transfers }
```

`upToSeq` 가 핵심 — "이 스냅샷은 seq ≤ upToSeq 인 모든 효과를 *이미 담고 있다*"는 계약이다. 스냅샷 발신은 *op 처리 중*(반응형, onTick 0) 일어난다 — 존 tick 과 무관(신성한 tick 밖). 그리고 라이브 원장은 *건드리지 않는다* — 스냅샷은 원장의 *사본*을 persist 로 보낼 뿐이라, 가방의 동작·invDigest 는 압축 ON/OFF 에 불변이다.

## 3. 압축 — 스냅샷이 담은 헤드 로그를 버린다

PersistStore 가 스냅샷을 받으면 *upToSeq 이하의 저널을 폐기*한다:

```
journal = journal.filter(e => e.seq > snap.upToSeq)   // tail 만 보존
```

스냅샷이 seq≤upToSeq 의 효과를 *전부 담았으니* 그 로그는 더 이상 복구에 필요 없다 — 버려도 무손실. 그 결과 저널은 **(스냅샷 1개 + 짧은 tail)** 로 유계화된다. 검증에서 저널이 60→0·59→5 로 92~100% 줄었다.

핵심 미묘점 — `writes`(영속 수신 누적)는 *안 줄인다*. 압축은 *보관(journal.length)* 을 줄일 뿐 *영속된 변이의 수*를 줄이는 게 아니다. 그래서 "저널이 수락 변이를 전부 담았는가"(완전성)의 진실은 압축 불변인 `writes` 다 — `journalComplete` 를 `journal.length` 에서 `writes` 기준으로 옮기니 0017(압축 OFF·writes==length)·0018 양쪽에서 성립한다.

## 4. 스냅샷+tail replay — 압축이 무손실임을 증명한다

복구는 이제 두 조각을 합친다: **스냅샷 원장을 베이스로 깔고(폐기된 헤드 로그를 대신), 그 뒤 tail(seq>upToSeq)만 적용**한다.

```
replay(journal, snapshot):
  스냅샷 있으면 → ledger=snapshot.ledger, maxMintId=mintTotal-1, maxSeq=upToSeq
  tail(seq>upToSeq)만 mint/xfer 적용
  스냅샷 없으면 → 0017 전체 저널 replay (비트 동일 휴면)
```

가설의 핵 = **세 복구 경로가 같은 원장**: ① 스냅샷+tail(압축 ON) ② 전체 저널(압축 OFF) ③ 무재시작 원장 — 전부 같은 invDigest(42=0x7a122947…). 압축이 복구를 *한 비트도* 안 바꾼다 = 무손실. 이것이 "압축은 안전하다"의 수치 증명이다.

극한 사례(발견): tail 이 마침 0이 되는 시드(스냅샷 경계에 마지막 op 가 떨어짐)에서도 `replay([], snapshot)` = *순수 스냅샷만으로* 원장을 재현 — 저널 0항목으로도 복구 투명.

## 5. 왜 비-침습인가 — 압축은 persist-측/제어 평면의 일

압축은 ⒜ 라이브 원장을 안 건드리고(invDigest 불변·월드 비트 동일) ⒝ 복구 안무는 제어 평면(net.log 비-기여)이라 — 인프로세스/멀티프로세스가 비트 동일(E2E), 클라엔 누설 0(hide). multiproc 에서도 60항목이 스냅샷으로 압축되고, 가방 진짜 kill 후 *스냅샷 베이스*로 복구된다(저널 tail 0). 압축은 *데이터 계층 내부*의 최적화 — 위 계층 어디에도 그림자를 안 드리운다.

## 한 줄 요약

가방 저널을 (주기 스냅샷 + 짧은 tail)로 유계화하되 — **스냅샷+tail replay 가 전체-저널 replay 와 비트 동일**(무손실)함을 증명해, event sourcing 의 무한 성장을 닫았다. 압축은 라이브 원장·월드·E2E 에 비-침습(invDigest 불변)이고, 완전성의 진실은 압축 불변인 누적 `writes` 다.
