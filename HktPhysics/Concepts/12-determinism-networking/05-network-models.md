# [12·2.5] 네트워크 모델 (Network Models)

> 물리 동기화는 "전체 결정적 시뮬을 공유"부터 "상태를 복제"까지의 스펙트럼이다. 어디에 서느냐가 결정론 요구·대역폭·권위 구조를 결정한다.
> **상위 노드**: [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-determinism](01-determinism.md)

---

물리 동기화 방식은 "**전체 결정적 시뮬을 공유**" vs "**상태를 복제**"의 스펙트럼이다. 왼쪽은 입력만 보내고 각자 시뮬을 돌려 결정론에 전적으로 의존한다. 오른쪽은 상태(transform)를 직접 보내 결정론이 거의 필요 없다.

```
입력만 전송 ◀──────────────────────────────────────▶ 상태(transform) 전송
deterministic lockstep   rollback/GGPO   snapshot interp.   server-authoritative
  (RTS/MMO)               (격투)          + prediction        (슈터/MMO)
  결정론 ★★★★★            결정론 ★★★★★      결정론 ☆            결정론 ☆
```

## (a) Deterministic lockstep

모든 피어가 입력을 교환하고, 모두가 입력을 받은 *확정 프레임* 에서만 동시에 step. 대역폭 = 입력 크기(유닛 수 무관) → RTS 의 수천 유닛에 이상적. 단점: **가장 느린 피어가 전체를 묶고**(입력 지연 = RTT), 단 한 곳의 desync 가 치명적. 결정론 필수([01-determinism](01-determinism.md) 의 cross-platform 또는 same-binary bit-exact).

지터 흡수에는 **링 버퍼 입력 큐 + 입력 지연(input delay)** 을 쓴다 — RTT 만큼 입력을 앞당겨 예약해 도착 지연을 숨긴다.

## (b) Rollback (GGPO 계열)

상대 입력을 기다리지 않고 *예측 입력* 으로 즉시 진행. 실제 입력 도착 시 예측이 틀렸으면 그 프레임으로 **rollback** 후 진짜 입력으로 **re-simulate**. 입력 지연을 숨겨 격투 게임의 반응성을 확보. 재시뮬이 bit-exact 여야 하므로 결정론 + 빠른 상태 save/restore(스냅샷) + 가벼운 step 이 전제.

> 📐 **심화: rollback 의 예측·재시뮬 메커니즘** — "예측이 왜 거의 맞는가", "되감고 다시 돌리는데 왜 화면이 안 튀는가", "save/restore 에 무엇을 담아야 하는가(숨은 캐시 누락이 왜 치명적인가)"를 타임라인과 함께 끝까지 푼 전용 문서 → [05a-rollback-netcode](05a-rollback-netcode.md).

## (c) Snapshot interpolation + 보간/예측

서버가 주기적 **스냅샷(상태)** 을 보내고, 클라는 과거 시점 두 스냅샷 사이를 **보간(interpolation)** 해 부드럽게 표시(원격 객체). 자기 객체는 입력 즉시 반영하는 **예측(prediction)**. 결정적 시뮬 불필요 — 상태가 직접 오기 때문. Source 엔진(Quake/Half-Life 계보)의 고전.

## (d) Server-authoritative + client prediction/reconciliation

서버가 **유일한 권위(authority)**. 클라는 입력을 보내며 동시에 로컬에서 예측 실행(prediction). 서버의 권위 상태가 오면 예측과 비교해 어긋나면 **reconciliation**(서버 상태로 보정 후 미확인 입력 재적용). 치트 저항·일관성에서 최강. 대부분의 경쟁 슈터·MMO 의 표준. 결정론 요건은 느슨(서버가 진실).

> 직관 정리: (a)·(b) 는 *입력* 을 공유하고 시뮬을 각자 돌리므로 결정론이 **생명선**이다. (c)·(d) 는 *상태* 를 받아 그리므로 결정론이 거의 필요 없는 대신 대역폭이 객체 수에 비례한다. 어느 쪽이 맞는지는 장르가 가른다 → [06-sync-genre-mapping](06-sync-genre-mapping.md).

---

**관련 함정** (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트)):
- **lockstep 의 단일 desync** — 한 피어만 갈려도 전체가 붕괴. 상태 해시로 *발생 프레임* 에서 잡아야 한다.
- **결정론은 사후 추가 불가** — 네트워크 모델을 *프로젝트 초기* 에 확정하라. 모델이 결정론 등급·자료구조·메모리 레이아웃을 전부 규정한다.

**다음**: [05a-rollback-netcode](05a-rollback-netcode.md) — rollback 의 예측·재시뮬 깊이 파기. 또는 [06-sync-genre-mapping](06-sync-genre-mapping.md) — 장르별 선택.
