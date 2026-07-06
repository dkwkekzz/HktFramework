# DESIGN — HktSplatGenesis 설계 근거·구조

목표·원칙은 [../CLAUDE.md](../CLAUDE.md), 현황·다음 단계는 [ROADMAP.md](ROADMAP.md), 세션 진행
방식은 [../SKILL.md](../SKILL.md). 이 문서는 **어떻게 짜였나**(아키텍처·코드 지도)와
**왜 이렇게 했나**(되돌리면 안 되는 결정의 근거)를 담는다 — 새 결정·함정은 여기에 쌓는다.

## 아키텍처

```
grid clear/build(64³, 셀당 16슬롯, 전 개체 공유, 원점 = 카메라 타깃 추종 시뮬 버블) → sim(compute: L1 자율 + L2 이웃 + L4 성장/연소/낙재 + L5 발열 + L6 뼈대 살)
→ cluster(L3: 워크그룹=클러스터 256스플랫, shape matching + 본드 파단/재흡수)
→ key(뷰 깊이→단조 uint) → bitonic sort → EWA 인스턴스드 쿼드 (+ L6 뼈대 오버레이 라인/관절)
```

L4 나무는 sim 안의 조기 경로(`E.growRate > 0`): rest 버퍼가 (부착점, birth) 골격을 담고,
`misc.z/w` 가 (heat, fuel) 연소 상태. fuel 채널 도입으로 모든 init 은 `misc.w = 1` 필수
(0 이면 렌더가 재로 해석해 어두워진다).

L5: 유전자는 유니폼이 아니라 **Entity 테이블**(storage, 144B×8) — 스플랫 풀을 균등
슬라이스로 개체에 배정(`eid = i / sliceSize`, sliceSize 는 256 의 배수 필수 — CLUSTER 의
워크그룹 균일 조기 return 전제). 격자가 전 개체 공유라 다른 개체의 스플랫이 이웃으로
잡힌다 — `heatEmit` 유전자(불 정령)가 나무의 연소 전파 규칙에 그대로 물리는 이유.
격자 셀 크기는 전역 GRID_CELL(0.15) 고정, 개체 reach 는 이하로 클램프.

L6 히키토(hikito-flesh 이식): 살은 **뼈대의 순수 함수**. skeleton.js 의 뼈대(built-in FK 리그
+ FBX `ExternalSkeleton`, 이름 기반 살 문법)가 매 프레임 taper 캡슐 세그먼트(≤128)를 bones
storage 로 올리고, form 3 스플랫은 뼈 친화(rest.w) + 시드 성장 자리(축 t·방위 θ·깊이 u)를
*현재 포즈에서 유도*해 스프링 추종한다 — L4 rest 부착점과 같은 원리, 스키닝 없음. 세그먼트
**순서**가 친화 인덱스의 기준이라 모션 소스(built-in↔FBX)가 바뀌면 재시드 필수. 세부·설계
근거는 wgsl.js SIM L6 블록·skeleton.js·app.js 주석이 원본.

### 코드 지도

- `js/wgsl.js` — 셰이더 8종(+뼈대 오버레이). `Splat`(48B)=`SPLAT_STRIDE`(12 float), `SimParams`(64B, 전역만),
  `Entity`(144B)=`ENTITY_STRIDE`(36 float), `Cluster`(96B)=`CLUSTER_STRIDE`(24) — engine.js 와
  바이트 일치 필수. 격자 상수(GD=64, SLOTS=16)·클러스터 크기(K=256=CLUSTER_K)도 동기.
- `js/engine.js` — 버퍼/파이프라인/프레임 인코딩. 정렬 단계 (k,j) 는 256B 슬롯 테이블 + 동적 오프셋 (WebGPU 는 push constant 없음).
- `js/presets.js` — 유전자 스키마(`GENE_DEFS`)·프리셋(`PRESETS`)의 유일한 원본 (app.js 와 test/ 가 공유 — 드리프트 방지).
- `js/app.js` — UI·부트·루프. 유니폼 레이아웃 변경 시 wgsl.js/engine.js 양쪽 동기화.
- `js/math.js` — WebGPU 클립 규약(z∈[0,1]) 카메라. `HktGaussianSplatWeb` 의 GL 버전과 혼동 주의.
- `js/skeleton.js` — L6 뼈대: Skeleton IR + 절차 클립 FK + 살 문법 + ExternalSkeleton(FBX).
  살 힘은 wgsl.js SIM 의 fleshK 규칙 — 이 파일은 세그먼트라는 *입력* 만 만든다. C1: `pose(...,genome)`
  5번째 인자로 세그먼트 반지름에 게놈 배율을 곱한다(`radiusG` = 기본 문법 × fat × 게놈 배율).
- `js/genome.js` — C 트랙 캐릭터 게놈(`HktGenesisGenome`). ① 형태(morph): 뼈 이름 → 부위 그룹
  (`groupForName`, 이름 기반 rig-agnostic) → 배율. morph 엔트리는 숫자(반지름만, C1) 또는
  `{r, l}`(반지름·길이, C2). `radiusScale`/`lengthScale` 가 각각 스타일 프로파일
  (`PROFILE.radiusMul` 0.5~2.2, `lengthMul` 0.5~1.8)로 스냅, 미지정 부위는 항등(1)이라 회귀 0.
  `GENOMES`(덩치/호리호리) = 수동 게놈. ② 채색(palette): 부위 그룹 → 램프 양 끝
  (`groupColors(genome, defA, defB)` → GPU 버퍼, `GROUP_IDS` 순서 = engine `GROUP_COUNT` 동기).
  게놈은 데이터(JSON)일 뿐 — skeleton/engine 은 소비만 한다. ③~④(재질/부속)는 C6~ 확장 지점.
- **C3 렌더 채색 경로**: 렌더 VS 에 `rest`(binding 6)+`boneGroup`(7, 뼈→그룹 id)+`groupColors`(8,
  그룹 램프) 추가. 살(`E.fleshK>0`)만 `rest.w`(뼈 친화)→`boneGroup`→`groupColors` 로 램프 양 끝을
  갈아끼우고, 비-살은 개체 `colorA/colorB` 그대로. wgsl.js 렌더 바인딩 ↔ engine `_buildRenderBG`
  엔트리 ↔ genome `GROUP_IDS` 길이(=engine `GROUP_COUNT`=10) 3자 동기 필수. `boneGroupBuf`는
  bones 와 함께, `groupColorBuf`는 매 프레임 살 개체 기본색 + `genes.genome.palette` 로 채운다.
- `js/stage.js` — S 트랙 무대(ES module, import map 배선): Spark(WebGL2)로 외부 3DGS 월드를
  생명 캔버스 아래 별도 캔버스에 렌더, 오빗 카메라 뷰 파라미터만 미러(투영 행렬 공유 금지 —
  클립 규약이 다르다). 생명→무대 데이터 흐름 없음. T2: 절차 월드 타일 스트리밍 관리(타일
  Map·링 정책·SplatMesh 부착/폐기, `startTileWorld`/`updateTileCenter`/`tileStats`, `?tiles=`).
- `js/heightfield.js` — S2 충돌 지형: collider GLB(비압축) 파싱 + heightfield 베이크
  (three 무의존 — 생명 쪽 입력이라 vendor three 반입 금지). 시뮬은 무대를 이 텍스처로만 안다.
  T3: `bakeFn`(height 함수 직접 베이크 — 절차 월드, O(창)) + `buildIndex`/`bakeIndexed`
  (실에셋 삼각형 XZ 버킷 인덱스 — 창에 걸린 것만, O(창)). Node require 가능(하니스 검증용).
- `editor.html` + `js/editor.js` — E 트랙 에디터(별도 진입점, index.html 데모 불변):
  지형 생성·오브젝트 배치·애니메이션 타임라인. 엔진/셰이더 무수정 — 시뮬 *입력*만 만진다.
  개체 수 2^k 제약은 무(void) 개체(opacity 0 = VS 컬, emitter y=64 = 격자 밖) 패딩으로 흡수.
- `js/terrain-gen.js` — 절차 지형 (T1): 순수 무한 도메인 `world(x,z)` → 무대 PLY + collider
  삼각형 수프. `world(params)` 는 바이옴 2채널(온·습도) + domain warp + ridged 혼합 + 팔레트
  + `waterY` 를 좌표·시드만으로 평가(`heightAt`/`biomeAt`/`colorAt`). `create(params)` 는
  월드의 한 창(`cx,cz` 중심) — 창 좌표=월드 좌표라 원점 무관 연속. 창 `height()` 는 시뮬
  격자 바닥용 -0.72 클램프 유지, `world.heightAt()` 은 순수(클램프 없음).

## L6 의 구조 (hikito-flesh 3층 매핑)

hikito-flesh 는 살을 SDF **레이마칭으로 그리고**, 여기서는 같은 round-cone 부피를
스플랫 세포의 **성장 자리로 매개변수 샘플**한다 — 절대 원칙 1(렌더 속성 직접 생성 금지) 유지.

- **Skeleton IR** = `Skeleton`(built-in 53관절 FK) / `ExternalSkeleton`(Mixamo FBX) — 소스가 달라도 같은 세그먼트 스트림.
- **Flesh grammar** = `radiusForName(name)` — 이름 기반 반지름. 이것이 "일관된 스타일"의 정의. grammar 가 같으면 리그가 달라도 스타일이 같다.
- **살 성장** = 스플랫마다 (뼈 친화 rest.w, 시드 성장 자리 축 t·방위 θ·깊이 u)를 *현재 포즈에서 매 프레임 유도* → 스프링 추종. L4 나무 rest 부착점과 같은 원리.
- **Evaluator** = 미구현 (ROADMAP R2) — hikito 도 동일하게 미구현.

## 설계 결정 (되돌리지 말 것)

| 결정 | 이유 |
|---|---|
| 살은 뼈대의 함수 — 메시/웨이트 손 바인딩 금지 | 모델링·리깅·스키닝 붕괴가 프로젝트 존재 이유 |
| 게놈 = 데이터, 기본 문법(radiusForName)은 코드로 유지 (C1) | grammar 는 "일관된 스타일의 정의"라 데이터화하면 스타일 기준이 사라진다 — 게놈은 그 위에 곱하는 개체별 *배율*(형태)만 데이터로. 항등 게놈 = 기본 문법 그대로라 회귀 0 (genome-shot 세그먼트 bit-exact). "정체성=게놈, 스타일=문법×프로파일" |
| 회귀 0 검증은 GPU 사진이 아니라 CPU 세그먼트 동일성 (C1) | swiftshader 는 device 인스턴스마다 미세 변동(격자 atomic 순서 등)이 있어 같은 입력도 픽셀·스플랫 수가 달라진다 — "항등 게놈 = 현행" 은 `pose(없음)≡pose(항등)` 세그먼트 bit-exact 로 증명하고, 사진은 실루엣 *차이*(head 1.6×) 판정에만 쓴다 |
| 길이 배율은 FK offset 에 곱, 힙 보정으로 접지 (C2) | 클립은 로컬 회전이고 FK 는 `offset × 길이배율` 에 회전을 곱하므로 회전 데이터가 무수정 적용된다(애니메이션 보존). 다리 길이가 바뀌면 발이 뚫리거나 뜨므로 대표 발→루트의 `offset.y×(1−배율)` 누적으로 루트 y 를 보정 — rest 포즈 근사지만 walk/idle/wave 접지에 충분(genome-body-shot: 발 최저 y 지면 근방). FBX 외부 리그는 offset 을 소유하지 않아 길이 배율 미적용(반지름만) |
| 채색은 그룹 램프 *양 끝*만 게놈, 보간은 유도 유지 (C3) | 절대 원칙 1 — 렌더 속성 직접 생성 금지. 부위색을 픽셀에 칠하지 않고, 뼈 그룹별 `mix(colorA,colorB,heat)` 램프의 *양 끝*만 게놈이 정한다. 보간 factor(heat=속도·변형률)는 그대로라 속도 팔레트 유도가 살아 있다(genome-color-shot: 무팔레트 밴드 hue 동일=0.01, palette 밴드 hue 크게 구분). 회귀 판정은 hue 로 — 밝기는 속도로 정당히 변하므로 RGB 거리는 부적합 |
| 그룹 램프는 전역 1벌, 개체별 팔레트는 아직 (C3) | groupColors 버퍼가 장면 공용이라 살 개체가 둘 이상이면 팔레트가 섞인다. 단일 캐릭터엔 충분하고, 개체별 팔레트(버퍼를 개체×그룹으로)는 C7 다개체에서 함께 — 지금 확장하면 안 쓰는 버퍼만 커진다 |
| 부속은 가상 뼈 스프링 체인, 실뼈 *뒤* 고정 append (C4) | 클립 자산에 꼬리 트랙을 넣는 순간 "모든 클립 무수정"이 깨진다 — 부속 움직임은 물리(강체 목표 스프링 + 마디 길이 구속, 감쇠 기본 임계 2√k)만으로 만든다. 세그먼트 순서 = 뼈 친화(rest.w) 인덱스 규약 때문에 부속은 항상 실뼈 뒤 고정 순서 append, 부속 정의 변경(세그 수 변화)은 bindBones 재계산 = 재시드 필수. built-in 클립은 절대 시간이라 pose 간 dt 를 유도하는데 bindBones 용 `pose(t=0)` 가 구동 루프와 섞이면 시간이 역행한다 — 역행은 체인 재시드(강체 목표에 정지 배치)로 결정론 유지 (genome-append-shot: 실뼈 bit-exact + 이탈각 요동) |
| GROUP_IDS 확장은 'other' 직전 삽입 (C4) | engine 의 그룹 미상 폴백이 `GROUP_COUNT-1`('other') 인덱스라 'other' 는 항상 마지막. 새 그룹은 그 직전 삽입 — 기존 그룹(0~8) 인덱스 보존, `GROUP_COUNT`(engine) ↔ `GROUP_IDS.length`(genome) 동기 필수 |
| 추출은 번역, 검증은 반려 (C5) | 이미지→게놈은 픽셀 복원이 아니라 인상(비율·색·재질·부속)의 번역 — 그래서 몇 장으로 충분하고 스타일이 통일된다. 프로파일 밖 값은 클램프가 아니라 *반려*(사유를 재추출 프롬프트에 되먹임) — 클램프는 위반을 조용히 삼켜 스타일 드리프트를 숨긴다. 추출은 비결정이어도 확정된 게놈 JSON 이 원본 (재추출은 신규 제작). 하니스는 `--mock` 고정본으로 실호출 없이 같은 검증·저장 경로를 태운다 |
| 재질(③)은 applyMatter 허용 키만 차분 (C5) | 게놈 matter 를 개체 유전자에 통째로 덮으면 결정론·시뮬 안정 노브(damping/binding 등)까지 이미지가 흔든다 — size/stretch/opacity/luminosity/fleshK 부분집합만 허용(`MATTER_KEYS`), 나머지는 프리셋 소관 |
| 번역은 과감하게, 옷은 색 구획으로 (C5) | 소극적 배율(±10%)은 스플랫 살의 퍼짐에 묻혀 배양 후 티가 나지 않는다 — 프롬프트가 배율 끝값 사용을 지시(다리 l 0.55 → 키 ×0.86 이 사진에서 보이는 수준). 옷/장비의 1차 인상은 부위 그룹 램프의 *색 경계*(상의=torso/shoulder, 하의=leg)로 충분히 성립 — 무늬·직물 질감·로고는 C6 결정화/R3 detail 소관이라 C5 는 번역하지 않는다. 사진 판정은 부위 대표점(관절 world→스크린 투영) 주변 *중앙값* 색상으로 — 평균은 이웃 부위/꼬리 픽셀 오염에 끌린다 |
| grammar 는 이름 기반, 특정 리그 하드코딩 금지 | 임의 리그(FBX 드롭)가 깨지지 않아야 스타일=grammar 가 성립 |
| 살 힘 = 성장 자리 스프링 (전역 SDF 최근접 추종 아님) | 전역 최근접은 축 방향 힘 0 → 중력에 뼈당 방울 하나로 붕괴 (검증 사진으로 확인) |
| 히키토 프리셋 binding 0 | L2 인력(표면장력)이 자리 스프링을 이기면 방울 재발 |
| damping ≈ 임계 감쇠 2√fleshK | 미달 시 자리 주위 궤도 진동(밝은 블롭) |
| `pose()` 는 항상 전체 세그먼트를 같은 순서로 (필터 금지) | 순서가 뼈 친화 인덱스의 기준 — 소스 전환 시엔 재시드 |
| vendor three 는 FBX 파싱/FK 전용 | 렌더·시뮬은 자체 WebGPU — three 는 뼈대라는 입력만 만든다 |
| 무대는 로드, 생명은 배양 (2층 세계) | 절차 노이즈만으론 Marble 급 지형 충실도 불가 — 무대(정적 지형)는 외부 생성물을 Spark 으로 로드, 생명 원칙은 불변 (2026-07 사용자 결정) |
| 무대 렌더러 = Spark(WebGL2, 별도 캔버스) — WebGPU 재구현 금지 | LoD 트리·.RAD 스트리밍·포맷 파서 재작성 비용 > 2-캔버스 합성 비용. 시뮬은 무대를 collider 베이크 heightfield 로만 안다 |
| 스플랫 수 2^n, 슬라이스 256 배수 | bitonic 정렬·CLUSTER 워크그룹 균일성 전제 |
| 에디터는 별도 진입점(editor.html) — 엔진/셰이더 무수정 | 데모(index.html)는 불변 레퍼런스, 에디터는 시뮬 *입력*(유전자·emitter·뼈대·heightfield)만 만든다 |
| 에디터 개체 수 2^k 패딩 = void 개체 (opacity 0 + emitter y=64) | opacity 0 은 렌더 VS 조기 컬(alpha<0.004)로 완전 불가시, y=64 는 격자 밖이라 이웃 규칙 오염 없음 — 엔진 슬라이스 제약을 셰이더 수정 없이 흡수 |
| 에디터 생성 지형도 "무대는 로드" 원칙의 연장 | 절차 PLY 를 Spark 무대로 로드하고 같은 height 의 collider 로 시뮬 바닥을 굽는다 — 생명 원칙(속성 유도) 불변, fixture 와 동일 논리 |
| 월드는 순수 함수 `world(x,z)→{height,biome}`, 청크는 그 창 (T1) | 시드+월드좌표만으로 어느 창이든 독립 생성 → 창 경계 연속성이 *자동* 보장(봉합 코드 불필요). `create` 창의 `height()` 가 곧 `world.heightAt` 이라 원점이 달라도 겹침 diff 0 (biome-shot ① 로 확인). 청크 스트리밍(T2)의 전제 |
| 바이옴 = 온·습도 평면의 소프트맥스 경계 보간 (T1) | 바이옴별 relief(진폭·ridged 비중)·팔레트를 가중 혼합하면 경계에서 지형 성격과 색이 *함께* 매끄럽게 바뀐다 — 하드 경계는 이음새를 만든다. 수역은 별도 채널이 아니라 `height<waterY` 판정(습도 연동은 T5) |
| Spark 스플랫은 로드 후 렌더 몇 프레임 뒤 GPU 패킹 완료 | `mesh.initialized`(파싱 완료) 후에도 첫 수 프레임은 빈 화면 — 하니스는 캡처 전 워밍업 프레임 필요 (biome-shot 6프레임). stage-shot 이 안 걸린 건 30프레임 구동 덕 |
| 타일 이음새 = 전역 셀 격자 + 셀 내부 지터 (T2) | 타일을 창-상대 격자로 굽으면 경계에서 셀이 어긋나 겹침/틈이 생긴다. 스플랫을 전역 셀(=`round(x0/cell)+i`)에 놓고 지터를 셀 인덱스 해시로 셀 폭의 0.8 안에 가두면, 이웃 타일이 같은 전역 셀을 공유하지 않으면서도 셀이 정확히 맞닿는다 — 같은 밀도 타일끼리 봉합 코드 없이 이음새 0. 스플랫 크기는 셀 크기 비례라 외곽 저밀도 타일도 커버리지 유지 |
| 타일 관리는 stage.js(rig/Spark 소유), 월드는 window 전역에서 참조 | 타일 SplatMesh 부착/폐기·링 정책은 rig 를 가진 stage 모듈에 둔다. PLY 원본(terrain-gen)은 classic 전역이라 `window.HktGenesisTerrainGen` 로 참조 — 모듈 격리(three 사본) 유지하며 결합 최소화. `frame()` 이 카메라 타깃으로 링을 fire-and-forget 갱신(중심 타일 불변 시 즉시 반환) |
| 버블 y 를 지형 높이에 추종, height 클램프는 폐기(T3) | 격자 y 는 [gc.y-1.6, gc.y+8] 로 9.6m 창. gc.y=지형높이+0.8 이면 지형이 격자 바닥 0.8m 위에 놓여 어느 고도에서도 생명이 격자 안에 산다. 그래서 "골짜기를 절대 격자 바닥 위로 눌러두던" -0.72 클램프가 불필요 — 느슨한 안전 하한(-3)만 남기고 고저차 큰 지형을 허용한다. 평면(heightfield 없음)은 타깃 y 그대로라 기존 거동 불변 |
| L2 생존 지표 = 확산(RMS 반경), nn 아님 (T3 하니스) | 분지에 갇힌 슬라임은 밀집 코어 때문에 최근접 이웃(nn)이 버블 유무와 무관하게 작다. L2 의 분리력은 *부피 유지*로 드러난다 — 격자 밖(L2 꺼짐)이면 응집만 남아 한 점으로 붕괴(작은 RMS), 살아 있으면 웅덩이로 퍼진다(큰 RMS). terrain-bubble-shot 은 무게중심 RMS 반경으로 판정 |

## 검증 방법

`test/` 하니스로 눈 검증을 재현한다 (헤드리스 컴포지터가 WebGPU 표면을 못 잡는 환경 대응 —
스왑체인 텍스처 readback 으로 PNG 촬영). 사용법: [test/README.md](../test/README.md).
행동 검증(응축 수렴 등)은 스플랫 버퍼 readback 통계로 — 위치 분포만으론 방울 뭉침을
못 잡으니(전부 "표면 근접"으로 나옴) 반드시 사진도 함께 볼 것.
