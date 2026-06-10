# scenarios/ — 레코더·검증 공유 시나리오 (TESTBED.md §5-3 · §10-4)

`node run.js report <file>.json` 으로 현재 step 을 *재현 가능하게* 녹화하고,
`node run.js scenario <file>.json` 으로 *같은 입력*을 검증(trace 4기둥 단언)한다.
시드+타임드 명령이라 라이브 노브보다 **결정론적**이며, 레코더(report)와 검증(scenario)이 *같은 번역기(`loadScenario`)·같은 net-core 실행*을 공유한다 —
"레코더에서 이상 발견 → 이 폴더로 export → `scenario` 검증으로 회귀 케이스 굳힘" 한 고리(§5-3·§5-4).

## 형식

```json
{
  "name": "kill-zone2",          // report 헤더 라벨(생략 시 파일명)
  "seed": 7,                      // 의사난수 시드 (생략 시 42)
  "ticks": 60,                    // 녹화 길이 (생략 시 48)
  "transport": { "delayMin":0, "delayMax":2, "loss":0.2, "redundancy":1, "seed":7 },
  "opts": { "clients":6, "zones":2, "radius":4, "grid":16, "incremental":true, "recovery":true },
  "cmds": [
    { "tick": 30, "kill": "zone1" },          // 지원: deathTick/killZone 으로 번역(failover 켬)
    { "tick": 10, "inject": { "client":3, "move":[5,2] } }  // 미지원(net-core seam 대기) — 무시·경고
  ]
}
```

- `transport` 생략/`null` = 무손실·즉시(행복 경로). 객체면 0004 전송 모델(지연·손실·재정렬·중복) 적용.
- `opts` 는 현재 step `net-core.js` 의 `run()`/`runMulti()` 파라미터로 그대로 전달된다.

## 현재 지원 상태

| 명령 | 상태 | 번역 |
|---|---|---|
| `kill@t` | ✅ | `deathTick=t · killZone=<zone> · failover=true` |
| `transport` | ✅ | 전송 모델 파라미터 |
| `opts.*` | ✅ | run/runMulti 파라미터 패스스루 |
| `inject` | 🟡 대기 | intent 주입 = net-core 의 *클라 write-seam* 필요. 동결 0012 엔 없음 → 다음 net-core 복사전진에서 활성(onTick 선례 §10-1). 경고 후 무시. |

## 검증 브리지 (`scenario` 모드 — §10-4 실현)

`node run.js scenario <file>` 이 같은 `loadScenario` 번역기로 시나리오를 돌려 trace 4기둥을 *프로그램적으로* 단언한다:
① 권위 단일 소유(매 tick =1) ② 수렴 desync 0 ③ (kill 시나리오면) failover 승격 ≥1 ④ 멀티프로세스(runMulti) 와 logDigest 비트 동일. exit 0/1.

> **왜 verify.js 가 아니라 run.js 인가**: §10-4 초안은 "verify 에 `scenario` 모드 추가"였으나, verify.js 는 *동결 step* 안이라 수정 불가다. 대신 라이브 단일 진입점 `run.js` 가 *같은 번역기를 공유*하며 trace 를 단언한다 — 이는 §5-4("에이전트도 trace 를 직접 단언, 한 데이터·두 소비")의 직접 실현이고, "report 와 verify 가 같은 번역기 공유(중복 0)" 목표도 그대로 충족한다(둘 다 `run.js` 의 `loadScenario`).
> report.html 은 생성물(루트 `.gitignore`).
