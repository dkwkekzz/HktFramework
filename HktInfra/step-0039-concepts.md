# step-0039 concepts — Bounding the bus-failover replay buffers (sliding K-window)

> 정식 기록: [step-0039.md](step-0039.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| Producer replay 버퍼 | failover 시 재발행하려 producer 가 발신 항목을 보관하는 큐 | 0036 가방 `outBuffer`(결과)·0037 게이트웨이 `inBuffer`(요청) |
| 무계 성장 | 보관 큐가 발신 수에 비례해 무한히 커지는 자원 한계 | 두 버퍼가 "전 항목" 을 쌓아 장기 가동 시 메모리 폭발 |
| 슬라이딩 K 창 | *최근 K 개*만 유지하는 유계 버퍼(push 후 초과분 shift) | `busWindow=K` — 메모리 O(K) 상한 |
| Gap(failover 창) | crash→재구독 사이 드롭된 항목 구간 | replay 가 메워야 할 *유일한* 손실 — 버퍼는 이만큼만 덮으면 됨 |
| Load-bearing 바운드 | K 가 gap 을 덮어야 무손실, 못 덮으면 손실하는 *작동하는* 한계 | K≥gap 무손실·K<gap 손실(tiny 대조군) |

## 1. 왜 replay 버퍼를 묶는가 — 무손실의 *숨은 비용*

0034 에서 버스가 죽으면(`bus.crash()`) 라우팅이 소실되고, 복구는 소비자 재구독뿐이다. 그런데 재구독은 *라우팅*만 되살린다 — crash 와 재구독 사이(**gap**)에 발행된 메시지는 영영 사라진다(버스는 영속 0 인 살아 돌아온 새 박스). 0036·0037 은 이를 **producer replay** 로 메웠다: *발신자가* 자기가 보낸 걸 보관했다가 버스 복구 시 다시 발행한다. 가방은 결과(`svc.item.out`)를 `outBuffer` 에, 게이트웨이는 요청(`svc.item`)을 `inBuffer` 에 쌓는다.

문제: 두 버퍼는 발신한 *전* 항목을 무계로 쌓았다. 70 tick 데모에선 60개지만, 며칠 도는 운영 서버라면 수백만 개 — **메모리 무한 성장**. 무손실의 대가가 무계 자원이라면 그 무손실은 운영에서 깨진다. 이 step 은 "보관을 *얼마나* 해야 충분한가" 를 묻는다.

## 2. 핵심 통찰 — 버퍼는 *gap 만* 덮으면 된다

failover 가 메우는 손실은 오직 **gap 구간**(crash→재구독)에 떨군 메시지다. gap 밖(crash 전 도달분)은 이미 소비자에게 갔다 — 재발행해도 dedup/멱등으로 무해할 뿐 *필요* 없다. 따라서 버퍼는 *전 이력*이 아니라 *gap 을 덮을 최근 구간*만 있으면 된다.

버퍼가 push-순서(FIFO)라는 점이 결정적이다: gap 항목은 재구독 시점 기준 *가장 최근* 항목들이다. 그래서 가장 오래된 것부터 버리는 **슬라이딩 창**(`busWindow=K` → push 후 `length>K` 면 `shift`)이 정확히 gap 항목을 보존한다. K≥|gap| 이면 전 gap 항목이 남아 무손실, 메모리는 O(K) 로 묶인다.

이것이 0032 `wfWindow` 의 *버스 판*이다 — 0032 는 정합성 윈도 sweep 을 미끄러지는 K 창으로 묶어 per-sweep 비용을 상한했다. 여기선 replay 버퍼를 미끄러지는 K 창으로 묶어 per-producer 메모리를 상한한다. 같은 패턴(유계 창이 무계 자원을 묶되 덮어야 할 구간은 보존), 다른 자원.

## 3. 바운드가 *load-bearing* 임을 어떻게 증명했나

유계화가 "동작에 무해"(투명)함과 "그래도 진짜 한계"(아무 K 나 되는 게 아님)를 *동시에* 보여야 한다. 세 변형 비교로:

- **unbnd (K=0·무계)**: 무손실(minted==base·desync 0)이지만 버퍼 60(무계 성장).
- **bnd (K=24≥gap 18)**: 버퍼 ≤24(40% 로 유계) *그리고* unbnd 와 같은 결과(minted==base·desync 0) → 유계화 **투명**.
- **tiny (K=8<gap 18)**: 버퍼 ≤8 이지만 가장 오래된 gap 항목 evict → minted<base(−10)·desync 4 → 손실 재현 = 바운드 **load-bearing**.

tiny 의 손실이 바운드가 거짓 안전(아무 작은 K 나 OK)이 아님을 증명한다 — K 는 *gap 을 덮어야* 한다. 그리고 minted 손실이 K 에 매끄럽게 비례(gap 항목 하나당 mint 하나)함이 임계가 시간(2 tick)이 아니라 *그 창의 발신 수*(18)임을 드러낸다. 운영의 교훈: K = 최대 예상 다운타임 × 최대 발신율(적응형 K 는 후속).

## 한 줄 요약

0036/0037 의 무손실 producer replay 버퍼를 *최근 K 개* 슬라이딩 창(`busWindow`)으로 묶어 — K≥gap 이면 메모리 O(K) 유계 + 동작 투명(minted==base·desync 0), K<gap 이면 손실 재현(바운드 load-bearing) — 0032 wfWindow 를 버스 failover replay 에 적용했다.
