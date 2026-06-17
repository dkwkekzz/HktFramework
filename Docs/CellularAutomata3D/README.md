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

## 수록 규칙 (검증된 정의)

정의는 Softology 블로그/재구현 리포에서 확인한 값. 모두 그대로 구현되어 있다.

| 규칙 | S / B / States / N |
|---|---|
| 445 | 4 / 4 / 5 / M |
| Amoeba | 9-26 / 5-7,12,13,15 / 5 / M |
| Pyroclastic | 4-7 / 6-8 / 10 / M |
| Clouds 1 | 13-26 / 13,14,17-19 / 2 / M |
| Architecture | 4-6 / 3 / 2 / M |
| Construction | 0-2,4,6-11,13-17,21-26 / 9,10,16,23,24 / 2 / M |
| Builder 1 | 2,6,9 / 4,6,8,9 / 10 / M |
| Builder 2 | 5-7 / 1 / 2 / M |
| Slow Decay 1 | 13-26 / 10-26 / 3 / M |
| Slow Decay 2 | 1,4,8,11,13-26 / 13-26 / 5 / M |
| Crystal Growth 1 | 0-6 / 1,3 / 2 / N |
| Crystal Growth 2 | 1,2 / 1,3 / 5 / N |
| Pulse Waves | 3 / 1-3 / 10 / M |
| Spiky Growth | 0-3,7-9,11-13,18,21,22,24,26 / 13,17,20-26 / 4 / M |

> Softology의 전체 규칙 라이브러리(수십 종)를 프리셋으로 다 넣지는 않았다.
> 대신 **엔진이 임의의 규칙을 그대로 실행**하므로, 패널의 `✎ Custom rule…` 에서
> `Survival / Birth / States / N` 문자열(예: `9-26/5-7,12,13,15/5/M`, 끝에 `/W`=wrap)을
> 입력하면 어떤 규칙이든 돌릴 수 있다.

## 구현 메모

- 렌더링: `THREE.InstancedMesh` — 수십만 셀도 단일 draw call.
- 시뮬레이션: `Uint8Array` 더블 버퍼, 프레임 독립 고정 스텝(최대 4스텝/프레임 캐치업).
- 컬러 모드: state(쇠퇴 그라데이션) / position(XYZ→RGB) / radius(중심 거리 heat).

## 참고

- Softology, "3D Cellular Automata" — https://softologyblog.wordpress.com/2019/12/28/3d-cellular-automata-3/
- S. Wolfram, *A New Kind of Science* — 1D/2D CA 분류 및 창발성.
