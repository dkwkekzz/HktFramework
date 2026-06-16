# [07·2.5] Shape Matching 과 기타 (Shape Matching · Plasticity · Tearing)

> 메시 없이 변형체를 표현하는 또 다른 길 — rest 형상으로의 최적 강체변환을 매 스텝 구해 끌어당긴다 — 과, 영구 변형(plasticity)·찢김(tearing) 같은 토폴로지 주제.
> **상위 노드**: [07-deformable-bodies.md](../07-deformable-bodies.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-pbd-xpbd](02-pbd-xpbd.md) · [04-fem](04-fem.md)

---

**Shape matching (Müller 2005).** 메시·구속망 없이 변형체를 표현하는 또 다른 길. 질점 구름의 현재 위치에서 rest 형상에 가장 잘 맞는 **최적 강체 변환(rotation R + translation)** 을 매 스텝 구하고(공분산 행렬의 극분해로 R 추출), 각 질점을 그 "목표 위치(goal position)"로 끌어당긴다.

```
R, c = best_rigid_transform(rest_pts, current_pts)   # 극분해로 R
g_i  = R*(x_i^rest - c_rest) + c_current              # 목표 위치
x_i ← x_i + stiffness * (g_i - x_i)                   # goal 로 보간
```

발상: "구속을 풀지 말고, rest 형상을 현재 구름에 **최적으로 겹쳐 놓은** 자리로 각 질점을 당겨라". R 을 극분해로 뽑으므로 회전이 커도 안 폭발한다([04a-fem-continuum](04a-fem-continuum.md) 의 co-rotational 과 같은 "회전을 떼어내는" 직관). `stiffness` 로 단단함을 조절하고, R 과 affine 변환을 섞으면 더 유연한 변형을 낸다. 빠르고 폭발하지 않아 게임 soft prop(부딪히면 출렁이는 소품)에 쓰인다 — 단 큰·국소적 변형 표현엔 한계.

**부피/형상 보존.** PBD volume constraint([02](02-pbd-xpbd.md)), shape matching, FEM 의 푸아송비 ν([04-fem](04-fem.md))는 모두 "찌그러져도 부피·형태가 유지되는" 느낌을 서로 다른 방식으로 담당한다 — 위치 구속 / 강체 goal / 연속체 물성.

**소성 (plasticity).** 지금까지는 모두 **탄성(elastic)** — 힘을 떼면 rest 로 돌아온다. 소성은 변형이 일정 임계를 넘으면 **rest 형상 자체를 갱신**해 **영구 변형**으로 남긴다(찌그러진 캔은 손을 떼도 안 펴진다). FEM 에서는 변형 구배를 탄성·소성으로 분해한다:

```
F = F_e F_p      # F_p(소성)가 새 rest 가 되고, F_e(탄성)만 복원력을 냄
```

임계를 넘은 변형분이 `F_p` 로 "흡수"되어 영구화된다.

**찢김 (tearing).** 요소·구속의 변형/응력이 임계를 넘으면 **토폴로지를 변경**한다 — 구속을 끊거나(PBD), 요소 경계를 따라 메시를 분리한다(FEM). 토폴로지가 런타임에 바뀌므로 자료구조·결정론·메모리가 까다롭다. 매 스텝 노드/구속이 추가·삭제되면 재할당과 순회 순서가 흔들려 결정론을 깨기 쉽다 — 그래서 사전 fracture 패턴 + 구속 끊기로 제한하는 편이 안전하다.

---

**관련 함정** (전체 체크리스트는 [07-deformable-bodies §5](../07-deformable-bodies.md#5-함정--결정론-체크리스트)):
- **shape matching 변형 한계**: 강체 goal 기반이라 크고 국소적인 변형 표현이 약하다 — affine/클러스터로 보강하거나 PBD/FEM 선택.
- **tearing 의 토폴로지 변경**: 런타임 메시/구속 변경은 결정론·메모리·재할당을 깨기 쉽다 → 사전 fracture 패턴 + 구속 끊기로 제한.
- **plasticity 의 rest 갱신**: `F_p`(또는 rest length) 갱신 시점·임계가 결정론 상수 — 헤더 고정([12](../12-determinism-networking.md)).

**다음**: 허브로 돌아가 [07-deformable-bodies §4 실무](../07-deformable-bodies.md#4-실무-엔진은-무엇을-쓰는가) 로 엔진별 선택을 확인하라.
