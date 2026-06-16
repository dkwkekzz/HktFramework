# [03·2.8] 고정 timestep 루프 — accumulator · substep · 렌더 보간 (Fixed Timestep Loop)

> 가변 프레임시간을 받아 **항상 같은 고정 dt** 로 물리를 굴리고, 남는 시간은 렌더 보간으로 메우는 루프. 결정론·안정성·부드러운 렌더링이 전부 여기서 결정된다.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-euler-family](03-euler-family.md) · [01-kinematics.md](../01-kinematics.md)

---

적분기를 골랐어도, *어떤 dt 로 부르는가*가 안정성·결정론을 다시 좌우한다. 고정 timestep 루프는 게임 물리에서 **가장 중요한 실무 결정**이다.

## 왜 가변 dt 가 위험한가

- **결정론 파괴**: dt 가 프레임마다 다르면 같은 입력도 다른 결과를 낳는다 → lockstep/rollback 네트워킹([12-determinism-networking.md](../12-determinism-networking.md)) 불가, 리플레이 깨짐.
- **안정성 파괴**: 모든 안정 한계가 dt 의 함수다([07-stability-energy](07-stability-energy.md)). 프레임 드랍으로 dt 가 갑자기 커지면 그 한 프레임이 explicit 안정 영역을 넘어 *폭발*할 수 있다. ("스파이럴 오브 데스" — 느려진 프레임 → 큰 dt → 더 불안정/무거움 → 더 느려짐.)
- **Verlet 오류**: position Verlet 식 자체가 dt 일정을 가정([04-verlet](04-verlet.md)) → 가변 dt 면 부정확.

## 해법 — accumulator 패턴

렌더 프레임시간을 누적해, **항상 같은 고정 dt** 로 물리를 0회 이상 스텝한다.

```pseudo
const FIXED_DT = 1.0 / 60.0     // 결정론·안정성의 기준 상수
accumulator += min(frameTime, MAX_FRAME_TIME)   // clamp: spiral of death 방어

while (accumulator >= FIXED_DT) {
    prevState = currentState           // 보간용 직전 상태 보관
    currentState = integrate(currentState, FIXED_DT)
    accumulator -= FIXED_DT
}

alpha = accumulator / FIXED_DT          // [0,1) 남은 비율
renderState = lerp(prevState, currentState, alpha)   // 렌더 보간
```

핵심 구성요소:

- **MAX_FRAME_TIME 클램프**: 한 프레임이 너무 느려도 물리 스텝 횟수를 상한으로 묶어 spiral of death 를 막는다(물리가 슬로우모션이 될 뿐 안 터짐). 클램프가 없으면 디버거에 멈췄다 재개할 때 거대한 frameTime 이 들어와 즉시 폭발한다.
- **렌더 보간(state interpolation)**: 물리는 60Hz 인데 렌더는 144Hz 일 수 있다. 마지막 물리 스텝과 직전 스텝 사이를 `alpha` 로 보간해 **부드러운 렌더링**을 만든다. 위치는 lerp, 회전은 slerp(quaternion). 운동학 보간 상세는 [01-kinematics.md](../01-kinematics.md). 이게 없으면 물리/렌더 주파수 차이로 미세 떨림(judder)이 보인다. **단 보간값은 렌더 전용 사본**이며 — 시뮬레이션 상태 자체를 보간값으로 덮어쓰면 결정론이 깨진다.
- **고전 레퍼런스**: Glenn Fiedler "Fix Your Timestep!" — 이 패턴의 사실상 표준 설명.

## Substepping (서브스텝)

한 프레임 dt 를 `N` 개의 더 작은 스텝으로 쪼개 적분한다(`dt/N` × N회).

- **용도**: 빠른 물체의 터널링 완화, 빳빳한 구속/스택의 안정화, 고속 차량/탄환.
- 고정 timestep 의 *내부* 세분화로 보면 된다 — 외부 결정론은 유지하면서 정확도/안정성을 산다(비용은 N배).
- PhysX/Chaos 등은 substep 수를 노출한다. **결정론을 위해선 substep 수도 고정**해야 한다 — substep 수가 바뀌면 결과가 바뀐다.

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **가변 dt 를 적분에 직접 넣지 말 것** — 결정론·안정성을 동시에 깬다. 항상 accumulator 로 고정 dt 화.
- **MAX_FRAME_TIME 클램프 누락** — spiral of death 의 직접 원인. 디버거 멈춤 후 재개 시 즉시 폭발.
- **substep 수를 결정론 변수로 노출** — 멀티플레이에선 고정. 바뀌면 결과가 갈린다.
- **렌더 보간 생략 / 시뮬 상태를 보간값으로 덮어씀** — 전자는 judder, 후자는 결정론 파괴. 보간은 렌더 전용 사본으로만.

**다음**: 허브로 — [03-time-integration §4 실무](../03-time-integration.md#4-실무-엔진은-무엇을-쓰는가) 에서 엔진별 적용을 본다.
