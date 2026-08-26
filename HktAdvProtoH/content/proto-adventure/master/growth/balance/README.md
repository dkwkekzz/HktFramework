# growth/balance/ — 그 값이 치른 것과 맞는가

성장 하나의 **비용과 보상**을 적는 자리다. 파일 하나 = 성장 하나 (`GBC-*.yaml`).
원본은 GB = `content/proto-adventure/design/Design-Growth-Balance-R0.md` §31,
형식의 단일 출처는 [../../SCHEMA.md](../../SCHEMA.md) 다.

Human 이 이 세 번째 자리를 세웠다 (HISTORY Q58(c)). 앞선 두 자리와 축이 다르다.

```text
overlay.md              그 의미가 세계에 구현되어 있는가       있는가 / 없는가
../growth-graph.md      세계 안에서 얻는 경로가 있는가         가질 수 있는가 / 없는가
여기                    그 값이 치른 것과 맞는가               값이 맞는가 / 어긋나는가
```

## 왜 노드 안이 아니라 여기인가

Master 노드에 칸을 더하지 않은 이유는 둘이다. 하나는 이 파일들이 담는 것이 **판정의
형태**여서 "Master 에는 플레이 의미를, Cycle 에는 판정을" 과 부딪히기 때문이고
(CLAUDE.md 원칙 18), 다른 하나는 밸런스가 **비교**로만 성립하기 때문이다 — 한 노드
안에 적힌 값은 다른 성장과 견줄 수 없고, 견주지 못하는 점수는 GB §16 이 요구하는
Dominance 검사를 돌리지 못한다.

그래서 이 자리는 **성장들을 나란히 놓는 자리**다. 여기 파일이 둘 이상이 될 때부터
`static` 검사가 의미를 갖는다.

## 무엇이 여기 없는가

```text
Benchmark 장면과 측정      Cycle 의 08-verification.md 와 검증 도구 (GB §26~§28)
세계의 수치·공식           Cycle 의 03-world-semantic.md (정책 §7.2)
그 성장이 무엇인가          graph/capabilities.yaml 의 노드 (semantic · world_shape)
그것을 어떻게 얻는가        ../growth-graph.md 와 frontier 의 후보
```

이 파일이 담는 것은 **무엇을 선언했는가**와 **그 결과가 무엇이었는가**뿐이다.

## 지금 서 있는 것

| Contract | 성장 | Tier | validation |
|---|---|---|---|
| [GBC-GAIN-LEVEL.yaml](GBC-GAIN-LEVEL.yaml) | 한 일이 몸을 키운다 (MC-GAIN-LEVEL) | GT1 | static PENDING (비교 집합 N=1) · benchmark N/A · human REQUIRED |

첫 항목 하나뿐이라 아직 견줄 상대가 없다. 두 번째가 서면 그때부터 Dominance 를 잰다.
