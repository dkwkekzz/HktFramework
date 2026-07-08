# tools/world-extract — 이미지 컨셉 → 월드 게놈 (W 트랙)

컨셉 이미지 한 장의 *인상*을 월드 게놈(JSON)으로 **번역**한다. 복원이 아니라 번역이다
(설계 근거: [../../Docs/PLAN-WorldFromImage.md](../../Docs/PLAN-WorldFromImage.md)). 게놈은
`js/env/terrain-gen.js` 의 `world(genome)` 이 소비하는 데이터 — 지형·바이옴·수역 층(W1 데이터화 완료).

## 현황

- **W4 자동 추출기**: `extract.js` — 이미지 → Anthropic vision(`claude-opus-4-8`) → 게놈 JSON. 스타일
  프로파일(W2)을 프롬프트 제약으로 주고, 반환 게놈을 `validate` 로 검증해 벗어나면 위반을 되먹여
  재시도(최대 3회, 클램프 아닌 반려·재추출). 라이브 실행은 `ANTHROPIC_API_KEY` 필요.
- **W4 v0 (수동)**: 키 없이도, LLM vision 이 이미지를 읽어 게놈 JSON 을 손으로 작성할 수 있다
  (`genomes/breeze-meadow.json` 이 그 예). 자동/수동 모두 같은 프로파일 울타리를 통과한다.
- **검증 (W2 완료)**: 게놈은 `js/env/world-profile.js` 의 `validate(genome)` 를 통과해야 확정. 벗어난 값은
  클램프가 아니라 반려(재추출). `preset-shot.js`·`concept-shot.js` 가 JSON 게놈을 렌더 전 자동 검증한다.

## 자동 추출 사용

```
# 라이브: 이미지 → 게놈 (키 필요)
ANTHROPIC_API_KEY=... node tools/world-extract/extract.js concept.jpg genomes/my-world.json 7

# 목 모드: API 없이 파이프라인(파싱·검증·재시도·기록) 검증
HKT_EXTRACT_MOCK=some-genome.json node tools/world-extract/extract.js dummy.jpg out.json

# 검증 하니스(순수 Node, 목): 통과·반려 경로
node test/world-extract.js
```

## 워크플로 (현재)

```
컨셉 이미지 1장
  │  ① 인상 추출: 지배 팔레트 · relief 성격 · 물 유무 · 바이옴 혼합  (LLM vision)
  ▼
게놈 JSON (genomes/*.json) — _meta 에 출처·번역 근거 기록
  ▼
렌더 대조: node test/preset-shot.js tools/world-extract/genomes/<name>.json out.png [seed]
  ▼
후보정: JSON 노브 ≤5개 조정 재렌더 (waterY·ampMul·바이옴 중심·팔레트)
```

## 걷는 월드로 (T2 스트리밍)

게놈은 파노라마 대조뿐 아니라 **걷는 타일 월드**로도 흐른다 (`world(genome)` → T2):

```
# 하니스: 게놈 월드를 +x 로 팬하며 타일 스트리밍 판정 + 사진
node test/world-pan-shot.js out.png 7 tools/world-extract/genomes/breeze-meadow.json

# 앱: 딥링크로 걷는 월드 자동 시작 (index.html)
index.html?tilesGenome=/tools/world-extract/genomes/breeze-meadow.json
```

## 게놈 목록

| 파일 | 출처 | 인상 요약 |
|---|---|---|
| `genomes/breeze-meadow.json` | 스타일라이즈드 오픈월드 컨셉 (원신/BotW 계열) | 선명한 초록 초원 지배 + 회청 암석대지 + 청록 호수. 후보정 1회(green 우세·물 확대·대지 증폭) |

## 게놈 스키마 (지형·바이옴·수역 층)

`world(genome)` 이 읽는 필드 (없으면 기본 프리셋 폴백):

- 전역 relief: `seed, amp, scale, octaves, base, warpAmp, warpScale, biomeScale, biomeSharp`
- 수역: `waterY`, `water: { shallow:[r,g,b], deep:[r,g,b] }`
- 바이옴: `biomeSet: [{ id, key, name, temp, humid, ampMul, scaleMul, ridged, warpMul, lo:[r,g,b], hi:[r,g,b] }]`
  - `temp/humid`: 온·습도 평면의 바이옴 중심 (소프트맥스 경계 보간, `biomeSharp` 로 날카로움)
  - `ampMul/scaleMul/ridged/warpMul`: relief 성격 (진폭·파장·능선 비중·워프)
  - `lo/hi`: 저지대→고지대 색 램프 (수역 색은 `water`)

`_` 로 시작하는 키(`_meta` 등)는 렌더가 무시한다 — 출처·번역 근거 기록용.

## 남은 것 (W 트랙 로드맵)

- ~~**W2**: 스타일 프로파일 + `validate(genome)`~~ ✅ `js/env/world-profile.js` — 렌더 전 검증.
- ~~**W3**: `test/concept-shot.js` 정식화~~ ✅ 원본 이미지 + 생성 파노라마 2패널 대조 카드.
- ~~**W4 자동화**: 이미지 → vision API → 게놈 (프로파일 제약 + validate 반려 재추출 루프)~~ ✅ `extract.js`
  (파이프라인 목 검증 완료 · 라이브 실행은 `ANTHROPIC_API_KEY` 필요).
- **W5/W6**: 생명 스캐터(나무·바위·마을)·대기(하늘·안개·물 무드) — 이미지의 나머지 절반. T4·T5 합류 후.
- **W5/W6**: 생명 스캐터(나무·바위·마을)·대기(하늘·안개·물 무드) — 이미지의 나머지 절반. 현재 게놈은
  지형만 담고, 스캐터·하늘은 T4·T5 합류 후.
