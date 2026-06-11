# step-0028 개념 — N-replica 와 quorum: 정족수로 단일점을 일반 해소하다

> 정식 기록: [step-0028.md](step-0028.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| N-replica | 같은 데이터를 N+1 개 독립 스토어에 복제 | `_journal()` 이 primary + 복제 N 에 fan-out |
| Quorum read | 단일 사본이 아니라 *생존 사본 여럿을 합쳐* 읽음 | `quorumMergeJournals` — 생존 저널 seq union |
| Replication factor (N) | 견딜 수 있는 동시 사망 수를 정하는 복제 수 | `persistReplicas: N` → N+1 사본 → 최대 N 사망 견딤 |
| 부분 쓰기(Partial write) | 전송 손실로 각 복제가 서로 다른 일부만 받음 | XREPLICALOSS: 복제 k 가 `seq%R==k` 떨굼 |
| 정족수 경계(Quorum bound) | 생존이 충분치 않으면 어떤 사본에도 없는 항목이 생김 | ⒞ 생존 1 → 일부 seq 손실 |

## 핵심 통찰: "2복제로는 부족하다"

0027 이 이중쓰기 backup 하나로 PersistStore 단일점을 없앴다. 하지만 정직한 한계가 있었다:

```
primary → backup  (2복제)
   ✗         ?     primary 죽으면 backup 으로 복구 (0027)
   ?         ✗     backup 도 죽으면? → 다시 단일점!
```

복제가 2개면 *둘 다 죽는 순간* 0016 이전과 같다. 이건 "단일점 제거"가 아니라 "단일점을 하나 미룬 것". 진짜 해소는 **복제 수를 일반화**하고, 복구를 **한 사본 고르기**가 아니라 **생존 사본 합치기**로 바꾸는 것이다.

## N-replica fan-out

```
_journal(entry):
  full = { ...entry, seq }
  net.send(→ persist,   ...)              // primary
  for k in 2..N+1:
    net.send(→ persist{k}, ...)           // 복제 N개  ← 이 step
```

`persistReplicas: 3` 이면 `persist2`·`persist3`·`persist4` 세 독립 박스 + primary = **4 내구 사본**. 0027 의 이중쓰기는 이 일반화의 N=1 특수 경우다.

## Quorum read — 왜 "고르기"가 아니라 "합치기"인가

순진한 복구는 "살아있는 복제 하나를 골라 replay" 다. 하지만 **각 복제가 전송 손실로 서로 다른 부분만 갖고 있다면** 어느 하나도 완전하지 않다.

```
복제2: [    1 2   4 5   7 8 ...]   (seq%3==0 빠짐)
복제3: [0     2 3   5 6   8 ...]   (seq%3==1 빠짐)
복제4: [0 1     3 4   6 7   ...]   (seq%3==2 빠짐)
       ────────────────────────
union: [0 1 2 3 4 5 6 7 8 ...]    ← 합치면 완전!
```

복구를 **생존 복제들의 저널 union(seq dedup)** 으로 하면, *어떤 seq 든 ≥1 생존 복제에 있기만 하면* 메워진다. 이것이 quorum read 의 힘 — 단일 사본보다 강하다.

검증(⒝): 각 복제가 ~2/3(38~40 / 57~60)만 보유하는데도 union 복구 invDigest == 무손실 base.

## 정족수에는 경계가 있다

merge 가 만능은 아니다. 생존이 **정족수 미만**이면(⒞: 생존 복제 1) 그 복제가 떨군 부분은 어디에도 없다 → 손실.

```
생존 복제2 하나만: [  1 2   4 5 ...]   (seq%3==0 영구 손실)
→ invDigest != base
```

즉 "merge 는 단일 복제보다 강하되, 모든 항목이 ≥1 생존 사본에 있을 만큼은 살아야 한다." 실 분산 시스템의 정족수 공식(W+R > N)이 이 경계를 보장한다 — 이 step 은 경계의 *존재*를 시연하고, 공식 튜닝은 후속.

## 죽은 스토어는 자연히 빠진다

`crash()` 가 저널을 비우므로, merge 입력에 죽은 스토어를 넣어도 `journal=[]` 이라 union 에 0 기여한다. 별도 "생존자 추적" 없이 `[primary, ...replicas]` 전부를 합치면 자동으로 "생존 복제만 merge" 가 된다 — 코드가 단순해진다.

## 데이터 계층 내구성의 진화

| step | 데이터 계층 내구성 |
|------|-------------------|
| 0017 | 단일 PersistStore (서비스 죽어도 데이터 산다) |
| 0027 | 2복제 이중쓰기 (primary 죽어도 backup) |
| 0028 | **N복제 + quorum-merge** (N 죽음·부분쓰기에도 생존 union) |

단일 인스턴스 신뢰 → 이중화 → **정족수 기반 내구성**. SPINE 데이터 계층("세션보다 오래")이 구조적으로 단단해진다.

## 이 패턴의 한계 (정직)

- **quorum *read* 만 — quorum *write* ack 는 아직**: 복구(read)는 union 하지만, 쓰기는 여전히 fire-and-forget. W개 복제 ack 를 기다려 durable 선언하는 write quorum 은 후속(0027 정합성 윈도의 일반화).
- **복제 RAM·디스크 fsync 0·anti-entropy 0**: 복제 간 재동기·디스크 영속은 미착수.

## 한 줄 요약

복제를 N개로 일반화하고 복구를 *생존 사본 union(quorum read)* 으로 바꾸면, primary 포함 최대 N 사망·부분쓰기에도 무손실 — 단, 생존이 정족수를 넘어야 한다.
