# [05·2.7] 솔버 구조 — 전체 조립 (Solver Structure)

> 지금까지의 조각(접촉 모델·자코비안·SI·TGS·PBD)이 한 물리 스텝에서 어떻게 묶이는가 — **island**(병렬·sleeping 단위), **manifold 연결**(구속 입력), **warm start 캐시**, **반복 예산**, **순서 의존성**. 솔버를 *시스템* 으로 보는 문서.
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-sequential-impulse](03-sequential-impulse.md) · [04-collision-detection](../04-collision-detection.md) (manifold·id) · [13-performance-parallelism](../13-performance-parallelism.md) (병렬)

---

## 구성 요소

- **Island(섬)** — 구속(접촉/조인트)으로 연결된 강체들의 연결 성분(connected component). island끼리는 *서로 영향이 없으므로* 병렬 풀이·독립 sleeping이 가능하다([13]). 한 island를 한 솔버 단위로 돌린다. 큰 더미 하나가 한 island, 멀리 떨어진 두 물체는 별 island.

- **Manifold 연결** — [04]가 준 접촉 manifold(접촉점·법선·feature id)가 구속의 입력이다. **feature id 안정성** 이 warm start 적중률을 결정한다 — 같은 접촉이 프레임 간 같은 id로 와야 캐시한 `λ` 가 맞는다.

- **Warm start 캐시** — 접촉/조인트별 `λ` 를 프레임 간 보존한다(키 = 바디쌍 + feature id). manifold가 바뀌면(접촉 사라짐/새 접촉) 해당 항목 무효화. [03a-pgs-convergence](03a-pgs-convergence.md) §4가 설명하듯, 이 캐시가 PGS의 느린 저주파 수렴을 우회하는 핵심.

- **반복 횟수 트레이드오프** — **속도 반복(velocity iters)** 은 침투 응답/마찰을, **위치 반복(position iters)** 은 침투 제거를 담당. 늘리면 안정·비용↑. TGS는 substep으로 이 예산을 시간축에 분산한다([05-tgs-substepping](05-tgs-substepping.md)).

- **순서 의존성** — PGS는 구속을 *푸는 순서* 에 결과가 의존한다(Gauss–Seidel 특성, [03a-pgs-convergence](03a-pgs-convergence.md) §5). 결정론을 위해선 순서를 안정 키로 **완전히 고정** 해야 한다.

## 전형적 솔버 한 스텝

```
1. island 수집 + 접촉/조인트 모음
2. warm start: 캐시된 λ 적용 (속도에 미리 반영)
3. for it in 1..velocity_iters:        # PGS, 구속 순회
4.     각 구속 Δλ 풀이 + 누적 클램핑 + 속도 갱신
5. 위치 적분 (또는 substep 루프 내 갱신)
6. for it in 1..position_iters:        # 침투/드리프트 제거(Baumgarte 대안)
7.     위치 보정(pseudo-velocity / NGS)
8. λ 캐시에 저장 (다음 프레임 warm start)
```

TGS 솔버라면 이 전체가 substep 루프 안으로 들어가 위치를 substep마다 갱신한다([05-tgs-substepping](05-tgs-substepping.md)).

## Sleeping과 island 생명주기

오래 거의 안 움직인 island는 **잠재운다(sleep)** — 솔버에서 빼 비용을 아낀다. 인접 island가 깨거나 외력이 들어오면 다시 깨운다(wake). 경계에서의 깜빡임을 막으려면 **히스테리시스**(sleep 임계 < wake 임계, 서로 다른 값)를 둔다.

## 실무 노브 (UE Chaos 기준)

solver iteration / position iteration 카운트, joint stiffness/compliance, contact offset(speculative margin) 같은 노브가 안정성을 좌우한다. 저장소 컨벤션대로라면 이런 임계값·반복수는 매직넘버로 박지 말고 `hkt.Physics.Solver.*` 형태의 CVar로 노출한다 — **단, 결정론에 영향을 주는 값(substep 수 등)은 헤더 상수로 고정** 하거나 결정론 경로에서 잠근다([12]).

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **순서 의존성**: island 수집·구속 정렬을 포인터 주소로 하면 비결정. 바디쌍+feature id 안정 키로 정렬.
- **Warm start 캐시 오염**: feature id가 프레임 간 안 맞으면 잘못된 λ 적용 → 튐. [04] id 안정성 필수.
- **sleeping 경계 깜빡임**: 단일 임계면 sleep/wake가 떨린다 → 히스테리시스.
- **island 분배 비결정**: 멀티스레드 분배·컬러링 순서도 재현 가능해야([13]).

**다음**: 허브로 — [05-constraint-solving](../05-constraint-solving.md). 또는 [06-joints-articulation](../06-joints-articulation.md) — 같은 솔버를 공유하는 조인트.
