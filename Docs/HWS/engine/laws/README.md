# engine/laws — 법칙 도메인 파트 (진실 원천)

`engine/hws-laws.js` 는 **이 디렉터리에서 `../build-laws.js` 가 생성**하는 단일 번들이다(브라우저 셸이 로드 — 번들러 없음·닫힌 step 셸 불변). **`hws-laws.js` 를 직접 편집하지 말 것** — `verify-sim-engine.js` 의 `sync` 게이트가 막는다.

## 파트 (조립 순서 = build-laws.js MANIFEST)

| 파트 | 내용 |
|---|---|
| `head.js` | IIFE open + 커널 핸들 `K` |
| `defaults.js` | `DEFAULTS` — 전 노브(단일 flat 객체, panel/verify 가 의존) |
| `flow.js` | diffuse(+aggK)·evaporate·drive·crystallize — E 흐름·결정화 |
| `star.js` | ignite(+STAR_DIR)·combust — 별(소산 극단)·연소 FSM |
| `gene.js` | replicate(+GENE_VN)·inherit — R-주형 복제·생명 유전 |
| `life.js` | move·crowd·metabolize·reproduce — 생명 동역학 |
| `social.js` | adhere(+adhScore)·couple·share(+rescue)·pubgood — 개체·사회 |
| `measure.js` | flux — 활성도 계량(맨 끝) |
| `order.js` | `LAW_ORDER`(순서 단일 출처) + `api` + IIFE close |

> 파트는 한 IIFE 스코프로 이어붙는다 — 함수 선언은 호이스팅, 모듈 const(aggK·GENE_VN 등)는 평가 시 할당, 법칙은 step() 때 호출. **그래서 파트 내·파트 간 텍스트 순서는 동작과 무관**(런타임 순서는 `LAW_ORDER` 만 결정). 파트는 단독 실행용이 아니다(런 단위는 step 의 verify.js).

## 새 법칙 추가 (step 작성법)

1. `defaults.js` 에 노브 1개(기본 0 = 회귀).
2. 해당 도메인 파트에 법칙 함수 1개(자기 노브=0 → early-return).
3. `order.js` 의 `LAW_ORDER` 올바른 자리 + `api` 한 줄.
4. `node engine/build-laws.js` 로 `hws-laws.js` 재생성.
5. `node engine/validate/verify-sim-engine.js` — `sync`·회귀 0·골든 해시 통과해야 닫는다.
