# vendor/spark — 무대(stage) 렌더 전용 서드파티 (S 트랙)

| 파일 | 출처 | 버전 |
|---|---|---|
| `spark.module.min.js` | npm `@sparkjsdev/spark` `dist/spark.module.min.js` | 2.1.0 |
| `three.module.min.js` + `three.core.min.js` | npm `three` `build/` | 0.180.0 (Spark peer 최소 0.180) |
| `Pass.js` | npm `three` `examples/jsm/postprocessing/Pass.js` | 0.180.0 |

- **무대 렌더 전용** — `js/stage.js` 만 import 한다. 생명 렌더·시뮬 경로 반입 금지.
- 루트 `vendor/three.min.js`(r147 UMD, FBX 전용)와 **혼용 금지** — 이쪽은 ESM 이라 모듈
  스코프로 격리되며, index.html 의 import map 이 유일한 배선이다.
- Spark 의 외부 의존은 `three` 와 `three/addons/postprocessing/Pass.js` 뿐 (정렬 워커는
  Blob 으로 인라인, fflate 도 번들에 포함). sourceMappingURL 주석은 제거했다 (.map 미포함).
- 갱신 절차: npm tarball 에서 위 파일들을 복사 → sourceMappingURL 줄 제거 → 이 표의 버전 갱신.
