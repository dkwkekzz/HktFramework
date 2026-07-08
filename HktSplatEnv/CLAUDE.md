# CLAUDE.md — HktSplatEnv

HktSplatGenesis 에서 분리한 **환경(정적=무대)** 단독 프로젝트 — **Spark(WebGL2) 전용**, 생명(WebGPU)
없음. 설계 원칙·근거·코드 지도는 [../HktSplatGenesis/](../HktSplatGenesis/CLAUDE.md) 를 원본으로
삼는다 (여긴 그 무대 절반의 자립 실행판). 현황·실행·검증은 [README.md](README.md).

## 지켜야 할 사항

- **무대는 로드/생성한다**: 절차 월드 함수(terrain-gen)로 지형을 생성해 Spark 로 렌더 — 생명이
  아니므로 절대 원칙 1(렌더 속성 유도)의 대상이 아니다(지형·식생 명암은 생성 시 f_dc 에 굽는다).
- **월드는 순수 함수** `world(x,z)→{height,biome}`, 타일은 그 창 — 시드+월드좌표만으로 어느 창이든
  독립 생성, 창 경계 연속성 자동(봉합 코드 불필요). 타일 이음새 = 전역 셀 격자 + 셀 내부 지터.
- **스폰 결정론**: 식생·개체 스폰은 좌표·시드 해시(`scatter.candidates`), `Math.random` 금지
  (스트리밍 연속성). 승격 계약 상수는 `scatter.PROMOTE_CFG` 단일 원본.
- **three 사본**: `vendor/spark/`(three r180 ESM)는 무대 렌더 전용, 모듈 스코프 격리 — 밖으로
  three 객체를 내보내지 않는다(노출 API 는 숫자/문자열/콜백뿐).
- 무-빌드 classic `<script>` + Spark ESM(import map), 주석 한국어.
