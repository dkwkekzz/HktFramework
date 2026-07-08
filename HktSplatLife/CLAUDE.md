# CLAUDE.md — HktSplatLife

HktSplatGenesis 에서 분리한 **생명(캐릭터=동적)** 단독 프로젝트 — **WebGPU 전용**, 무대(Spark) 없음.
설계 원칙·근거·코드 지도는 [../HktSplatGenesis/](../HktSplatGenesis/CLAUDE.md) 를 원본으로 삼는다
(여긴 그 생명 절반의 자립 실행판). 현황·실행·검증은 [README.md](README.md).

## 지켜야 할 사항

- **절대 원칙 1**: 렌더 속성(공분산·색·불투명도) 직접 생성 금지 — 반드시 시뮬 상태(pos/vel/energy)
  + 유전자로부터 셰이더에서 유도한다.
- **불변**: 스플랫 수 N = **2의 거듭제곱**, 슬라이스 256 배수. 셰이더↔엔진 **바이트 일치**
  (`Splat` 48B=`SPLAT_STRIDE` 12 float · `Entity` 144B · `Cluster` 96B, wgsl.js↔engine.js 동기).
- **WebGPU 전용** — 무대(Spark)·렌더 조정층(director) 코드 없음. three 는 FBX 파싱 전용이며 이
  단독 프로젝트에는 미포함(built-in 스켈레톤만).
- 무-빌드 classic `<script>` 전역 네임스페이스, 주석 한국어.
