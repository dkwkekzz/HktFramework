# 3D Cellular Automata (Multi-state)

`index.html` 하나로 동작하는 3D 셀룰러 오토마타 데모. 별도 빌드/서버 불필요 — 파일을 브라우저로 열기만 하면 된다(Three.js·OrbitControls는 CDN 로드).

## 실행

```
Docs/CellularAutomata3D/index.html  →  브라우저로 열기
```

조작: 드래그=회전, 휠=줌, 우클릭 드래그=이동. 좌측 패널에서 규칙/컬러/격자/속도 변경, 재생·스텝·리셋.

## 규칙 표기법

Softology(Jason Rampe)가 정리한 다상태 3D CA 표준 표기를 그대로 쓴다:

```
Survival / Birth / States / Neighbourhood
```

- **Survival(S)** — 살아있는 셀이 생존을 유지하는 "살아있는 이웃 수" 집합
- **Birth(B)** — 죽은 셀(state 0)이 태어나는 "살아있는 이웃 수" 집합
- **States** — 셀이 가질 수 있는 상태 수. `State-1`이 완전히 살아있는 상태이고,
  생존에 실패하면 즉사하지 않고 state를 1씩 감소(refractory)시키며 0까지 서서히 소멸한다.
  `States > 2`일 때만 "잔상/꼬리"가 생긴다.
- **Neighbourhood** — `M` = Moore(26 이웃), `N` = von Neumann(6 이웃)

"살아있는 이웃"은 `state == States-1`인 셀만 집계한다(죽어가는 셀은 제외). 경계는 기본 비순환(out-of-bounds = dead), `445 (wrap)` 프리셋만 순환 토러스.

## 수록 규칙 예시

| 규칙 | S / B / States / N | 특징 |
|---|---|---|
| 445 | 4 / 4 / 5 / M | 가장 유명한 3D CA. 깔끔한 결정질 성장 |
| Clouds 1 | 13-26 / 13,14,17-19 / 2 / M | 응결·소멸 반복하는 구름 |
| Amoeba | 9-26 / 5-7,12,13,15 / 5 / M | 꿈틀대는 유기적 확산 |
| Pyroclastic | 4-7 / 6-8 / 10 / M | 끓어오르는 화쇄류 |
| Crystal Growth | 0-6 / 1,3 / 2 / N | 6-이웃, 축을 따라 뻗는 결정 |

## 구현 메모

- 렌더링: `THREE.InstancedMesh` — 수십만 셀도 단일 draw call.
- 시뮬레이션: `Uint8Array` 더블 버퍼, 프레임 독립 고정 스텝(최대 4스텝/프레임 캐치업).
- 컬러 모드: state(쇠퇴 그라데이션) / position(XYZ→RGB) / radius(중심 거리 heat).

## 참고

- Softology, "3D Cellular Automata" — https://softologyblog.wordpress.com/2019/12/28/3d-cellular-automata-3/
- S. Wolfram, *A New Kind of Science* — 1D/2D CA 분류 및 창발성.
