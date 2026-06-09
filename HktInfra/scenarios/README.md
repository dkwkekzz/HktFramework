# scenarios/ — 레코더·검증 공유 시나리오 (TESTBED.md §5-3 · §10-4)

`node run.js report <file>.json` 으로 현재 step 을 *재현 가능하게* 녹화한다.
시드+타임드 명령이라 라이브 노브보다 **결정론적**이며, 같은 입력을 그대로 verify 에 투입하는 다리가 된다.

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
    { "tick": 10, "inject": { "client":3, "move":[5,2] } }  // 미지원(후속) — 무시·경고
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
| `inject` | ⬜ 후속 | intent 주입 경로(§5-3) — verify 브리지(§10-4)와 함께 |

> verify `scenario <file>` 모드(같은 번역기 공유, §10-4)는 동결 step 의 verify.js 수정이 필요해 후속 작업으로 둔다.
> 현재는 레코더(report) 전용. report.html 은 생성물(루트 `.gitignore`).
