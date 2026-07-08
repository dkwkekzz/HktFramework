# HktSplatEnv — 정적 오픈월드 무대

정적 오픈월드(돌·나무·언덕·구름 등)를 3DGS 로 그리는 **단독 프로젝트**. **Spark(WebGL2) 전용** —
캐릭터·생명(동적) 경로가 전혀 없다. 절차 월드 함수(terrain-gen)로 지형·바이옴·수역·하늘을
평가하고, Bake 식생(나무·바위)을 얹어 무한 타일 스트리밍으로 로드한다. "무대는 로드/생성한다".
무-빌드(classic `<script>` + Spark ESM), 주석 한국어. 목표·규칙은 [CLAUDE.md](CLAUDE.md), 진행
현황·명제는 [STATE.md](STATE.md).

## 실행

```bash
./run.sh            # http://localhost:8210 — 브라우저에서 index.html 열기
```

```bat
run.bat             :: Windows — 로컬 서버 + 브라우저 자동 열기
```

WebGL2 브라우저. 좌드래그 회전 · 우/Shift드래그 이동 · 휠 줌 · `?seed=N` 으로 월드 시드 변경.
카메라 타깃을 따라 근접 링(풀 밀도+식생)·외곽 링(저밀도)이 스트리밍된다.

## 구조

| 파일 | 역할 |
|---|---|
| `js/stage.js` | 무대 렌더러 — Spark(WebGL2) 타일 스트리밍·수면·하늘 돔·sky/fog 톤 (ES module) |
| `js/terrain-gen.js` | 순수 무한 도메인 월드 함수 `world(x,z)` → 지형·바이옴·수역 + 타일/파노라마 PLY |
| `js/vegetation.js` | Bake 식생 — 나무·바위 정적 스플랫 PLY (지면 명암 f_dc 에 굽기) |
| `js/scatter.js` | 결정론 스폰 규칙 `candidates` + 승격 계약 `PROMOTE_CFG` (좌표·시드 해시) |
| `js/world-profile.js` | 월드 게놈 스타일 프로파일 검증 |
| `js/math.js` | 오빗 카메라 (뷰 파라미터만 무대에 미러) |
| `js/env-app.js` | 부트/루프 드라이버 (생명·조정층 없음) |
| `vendor/spark/` | Spark 2.x + three r180 ESM (무대 렌더 전용, import map 격리) |

## 검증

```bash
cd test && npm install          # playwright (최초 1회)
CHROMIUM_PATH=/path/to/chromium node env-shot.js out.png 7
```

`env-shot.js` — 실제 index.html 로 절차 타일 월드를 스트리밍하고 무대 캔버스를 캡처해 ① 타일
메시 로드 ② Bake 식생 타일 ③ 지형 픽셀 임계 + 콘솔 오류 0 을 판정한다.
