# genome-extract — 이미지 → 게놈 추출기 v0 (C5)

컨셉 이미지 몇 장을 **캐릭터 게놈(JSON, 수 KB)** 으로 번역한다. 목표는 복원이 아니라
**번역** — 이미지의 인상(비율·색·재질·부속)을 게놈 어휘로 옮기고, 스타일 프로파일이
울타리를 친다. 확정된 게놈 JSON 이 원본이고 이미지는 참고물로 남는다.

```
컨셉 이미지 2~4장 (정면 필수, 측면 권장 · T포즈 유사 · 단색 배경 권장)
   → LLM vision (스타일 프로파일 = 프롬프트 제약, structured outputs = 게놈 스키마)
   → 프로파일 검증 (벗어나면 클램프가 아니라 반려·재추출)
   → 게놈 JSON  →  index/editor 에서 배양 (walk/idle/wave 무수정 재생)
```

## 사용

```bash
# 실호출 — ANTHROPIC_API_KEY (또는 ANTHROPIC_AUTH_TOKEN) 필요
node tools/genome-extract/extract.js front.png side.png --out newt.genome.json --name "이끼 뉴트"

# 오프라인/CI — 준비된 응답(게놈 JSON)으로 같은 검증·저장 경로를 태운다
node tools/genome-extract/extract.js front.png --mock tools/genome-extract/fixtures/mock-newt.json --out newt.genome.json
```

- 모델 기본값 `claude-opus-4-8` (`--model` 로 변경). 프록시 뒤에서는 `NODE_USE_ENV_PROXY=1`.
- 반려(exit 2) 시 사유 목록이 출력된다 — 재추출 프롬프트에 그대로 되먹일 수 있는 문장이다.
- 검증기는 단독 사용 가능: `require('./validate').validate(genome)` → `{ok, errors}`.

## 게놈을 화면에 올리기

```js
const genome = JSON.parse(fs.readFileSync('newt.genome.json'));
const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
HktGenesisGenome.applyMatter(genes, genome); // ③ 재질 차분
genes.genome = genome;                       // ①②④ 형태·채색·부속 (engine/skeleton 이 소비)
genes.bindBones = skeleton.pose('idle', 0, 1, 1, genome); // 부속 포함 친화 시드
```

검증 하니스: `node test/genome-extract-shot.js` — 합성 컨셉 이미지 생성 → 추출(키 없으면
mock) → 검증 → 3클립(walk/idle/wave) 사진 판정.

## 울타리(스타일 프로파일)의 원본

| 축 | 어디에 | 값 |
|---|---|---|
| 형태(반지름·길이 배율)·부속(체인·마디·치수) | `js/genome.js` `PROFILE` — 런타임 스냅과 동일 울타리 | 0.5~2.2 / 0.5~1.8 / 체인≤4·마디≤8 |
| 채색(채도·명도 밴드)·재질(유전자 범위) | `validate.js` `EXTRACT` — 추출기 전용 | 채도 0.1~0.9 · size 0.02~0.06 등 |

울타리 값을 바꾸는 것 = 아트 바이블을 바꾸는 것. 가볍게 만지지 않는다.
