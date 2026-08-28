# scripts — 실행 스크립트

더블클릭 한 번(Windows `.bat`) 또는 `./scripts/<이름>.sh`(macOS · Linux)로 도는 것들.
저장소 루트를 비워 두기 위해 여기 모아 두었고, 어느 것을 실행하든 스스로 프로젝트
루트로 이동한 뒤 `npm` 스크립트를 부른다 — 실행 위치를 신경 쓰지 않아도 된다.

| 스크립트 | 무엇을 하는가 | 같은 일을 하는 npm |
|---|---|---|
| `run.bat` · `run.sh` | 세계 + 클라이언트를 한 프로세스에서 띄우고 브라우저를 연다 | `npm run dev -- --open` |
| `run-world.bat` · `run-world.sh` | 세계(서버)만 — 접속자가 없어도 자기 시계로 돈다 (`PORT`, 기본 5180) | `npm run world` |
| `run-client.bat` · `run-client.sh` | 클라이언트만 — 이미 도는 세계에 붙는다 (`HKT_WORLD_URL`) | `npm run client -- --open` |
| `run-split.bat` · `run-split.sh` | 위 둘을 각각 다른 창/프로세스로 한 번에 — 분리를 눈으로 본다 | 위 둘을 동시에 |
| `scan-motions.bat` · `scan-motions.sh` | 모션 시트를 훑어 `view/motion-atlas.generated.ts` 를 다시 만든다 | `npm run motions:scan` |

모션 시트 분석은 평소 손으로 돌릴 필요가 없다 — `run` 이 띄우는 개발 서버가 시작할 때,
그리고 `motions/` 가 바뀔 때마다 스스로 돌린다.

실험실용 스크립트는 여기 두지 않는다 — 자기 도구 폴더에 산다 (`tools/fx-lab/run.sh`).
