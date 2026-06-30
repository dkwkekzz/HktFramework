# microcosm — 하나의 규칙으로 굴러가는 게임 월드 (web)

하나의 규칙에서 게임 세계를 **창발**시키는 프레임워크. 순수 JS·HTML5 Canvas,
외부 라이브러리 없음. 브라우저로 열면 바로 돈다.

캐릭터·파이어볼·벼락·물·바위·나무·개체는 서로 다른 물리가 아니다. 모두 같은
기질 위에 단위(unit)를 다르게 배치한 **레시피**일 뿐이고, 거시 행동은 그
배치에서 저절로 떠오른다.

```
ẋ_i = f(x_i) + Σ_j W_ij g(x_i, x_j) + I_i − γ x_i
       (자체동역학)  (상호작용=장)        (흐름)   (소산)
```

| 6칸 보편 문법 | 코드 |
|---|---|
| 단위 | `World` 의 상태 배열 (`px,py,vx,vy,T,M,hp,kind…`) |
| 경계 | `kind` 태그 + `fixed` + 지형/월드 벽 |
| 상호작용 | `step()` 안의 장들 (열확산·반발·물응집·결합·지지) = `W_ij g` |
| 흐름 | `spawn(...)` 의 초기 에너지·속도, 물붓기·소환 입력 `I` |
| 피드백 | 항상성(음성), 결합·연소 폭주(양성) |
| 창발 | `Forms` 레시피 → 거시 행동이 떠오름 |

출처 문서: *하나의 규칙, 여덟 층위 — 미시 세계에서 우주까지* (`systems.pdf`).
한 규칙이 차원·층위를 가로질러 같은 수학으로 환원된다는 것이 핵심.

## 실행

설치 불필요. 파일을 브라우저로 열기만 하면 된다.

```
world/index.html     ← 2D 인터랙티브 게임 월드 (Canvas, 외부 라이브러리 없음)
world/index3d.html   ← 3D 게임 월드 (Three.js r128) — 같은 규칙을 R³에서 시뮬·렌더
```

3D는 좌드래그로 시점 회전, 휠로 줌, 지면을 조준해 도구를 사용한다. 2D·3D 모두
같은 엔진 로직을 공유한다 — 규칙이 차원에 무관하다는 증거다.

로컬 정적 서버로 열어도 좋다:

```bash
cd microcosm_web && python3 -m http.server 8000   # http://localhost:8000/world/
```

## 조작

- 상단에서 **도구 선택**: 물 💧 · 바위 🪨 · 나무 🌲 · 개체 🐾 · 캐릭터 🧍 · 얼음 🧊 · 파이어볼 🔥 · 벼락 ⚡
- **클릭** = 선택한 도구를 마우스 위치에 사용. **드래그** = 물 연속 붓기.
- 우측 대시보드에 **창발 계측**(생명 지수·질서변수 φ·총 열에너지·연결망 결합·엔트로피 방출)이 실시간 표시.

## 요소가 창발하는 원리

- **캐릭터/개체** = 결합 + 항상성. 단위들이 묶여 하나의 응집체로 움직이고
  교란이 와도 평형으로 복귀한다 → '몸'. 개체는 방랑 추진력(자율 에이전트)을 더한다.
- **파이어볼** = 고온 비결합 패킷 + 열장. 열이 퍼지고, 뜨거우면 떠오르고, 복사로 식는다.
- **벼락** = 확률적 하향 분기 보행 → **프랙탈** 채널. 경로 위 단위에 가열·HP 피해.
- **나무** = 뿌리 고정 분기 골격(프랙탈). 불에 결합이 **융해**되면 쓰러진다.
- **바위** = 강결합·고융점 덩어리(네트워크). 물 = 표면장력 응집으로 고이는 유체.

## 상호작용

- 파이어볼이 나무·잎에 닿으면 결합이 융해되어 붕괴한다.
- 벼락이 개체/캐릭터를 때리면 HP 피해, 0이면 단위가 소멸한다.
- 불은 식으면 소산되어 사라진다(엔트로피). 물을 부으면 불을 끈다. 얼음은 더우면 녹는다.

## 구조

```
world/
  engine.js     World(2D) — 단위 상태·장·결합·레시피. DOM 비의존 → Node 검증.
  index.html    2D 게임 UI·Canvas 렌더·입력·창발 대시보드 (engine.js 로드).
  engine3d.js   World(3D) — 같은 규칙을 R³로. 높이장 지형·3D 결합/지지·3D 벼락.
  index3d.html  3D 게임 UI·Three.js 렌더·궤도 카메라·조준 (engine3d.js 로드).
  artrender.js  SDF/메타볼 통일 아트 렌더러 — 정적 씬(지형·바다·나무·캐릭터)을 한 스타일로.
                DOM 비의존 코어(renderScene) → Node 검증. (artrender.py 이식)
  art.html      아트 스튜디오(정적 씬) — 통일 씬을 SDF 아트로 렌더하고 PNG 로 베이크.
  grow.js       성장(공간식민화) 엔진 — 어트랙터 구름에서 가지가 자라 매 시드 다른 나무.
                Murray 반경 테이퍼. DOM 비의존 → Node 검증.
  plantrender.js 에셋급 식물 렌더러 — 테이퍼 줄기 + 볼륨 캐노피 + 접지 그림자(grow.js 소비).
  grow.html     성장 갤러리 — 같은 규칙·다른 시드로 12그루를 렌더하고 고해상 PNG 로 베이크.
web/
  microcosm.html        2D 전투(캐릭터·파이어볼·벼락·사슬갑옷)
  microcosm3d.html      3D 빌드 (Three.js r128) — 규칙이 차원에 무관함을 보임
  microcosm_world.html  생태 월드 단일 파일 버전
```

핵심 분리: **엔진(engine.js) 은 "무엇이 가능한가"를, 레시피(Forms) 는 "무엇을
만들 것인가"를** 담당한다. 새 요소를 추가할 때 엔진은 건드리지 않는다.

## 일관된 스타일로 아트 리소스 생성 (art.html)

손으로 그리지 않고 **기질에서 아트를 뽑는다**. 아트 폼(`art_tree`·`skeleton`)이 입자+본드로
형태를 *창발*시키고, `artrender.js` 의 **하나의 SDF/메타볼 렌더러**가 그 배치만 읽어
지형·바다·나무·캐릭터를 **같은 재질 팔레트·같은 광원·같은 외곽선**으로 그린다 — 전혀 다른
네 자산이 통일 스타일로 합쳐진다(`world/art.html`). "프로토타입 검증 후 베이크" 의 베이크
단계로, **PNG 아트 리소스로 내보낸다**.

```
뼈/가지/줄기 = capsule SDF (선분+반경) + smooth-min 관절 융합
머리/캐노피  = blob (입자 metaball)
바다         = 물 입자 metaball → 임계 표면
지형         = 높이함수 아래 재질 밴드
셰이딩       = sdf 기울기로 노멀 추정 → 람베르트 + 가장자리 그늘(AO) + 외곽선
```

색은 자산이 아니라 **재질**(skin·cloth·hair·bark·leaf·rock·water)에 묶이므로, 새 폼을
추가해도 자동으로 같은 톤으로 합쳐진다 — 이것이 *일관된 스타일*의 근거다. 코어
`renderScene` 은 DOM 비의존이라 브라우저 없이 검증된다:

```bash
node -e "const MC=require('./world/engine.js'),R=require('./world/artrender.js');
  const w=new MC.World({W:170,H:95}); w.ground=x=>24-13*Math.exp(-Math.pow((x-42)/15,2));
  MC.Forms.water(w,42,70,9,w.ground(42)+24); for(let s=0;s<400;s++) w.step(0.02);
  MC.Forms.art_tree(w,118,{scale:1.7}); MC.Forms.skeleton(w,88,{scale:1.5});
  const r=R.renderScene(w,{scale:4,supersample:1});
  console.log('px',r.pxw+'x'+r.pxh,'skins',w.skins.length);"
```

## 형태가 자라는 트랙 — 성장 나무 (grow.html)

위 정적 씬의 `art_tree`·`skeleton` 은 좌표를 손배치한다 — 시드를 바꿔도 형태가 거의 같다.
**성장 트랙은 그 한계를 넘는다**: 형태가 *규칙에서 자라난다*.

`grow.js` 의 **공간식민화(space colonization)** 는 어트랙터(빛) 구름을 크라운에 뿌리고,
가지가 인지반경 `di` 안의 가장 가까운 어트랙터 쪽으로 중력굴성을 더해 한 스텝 `D` 자라며,
킬반경 `dk` 안의 어트랙터를 소비한다. 줄기 굵기는 Murray 법칙 `r^e=Σ자식 r^e` 로 팁→루트
자동 결정. **같은 규칙이라도 시드(어트랙터 배치)가 다르면 매번 다른 나무가 창발**한다 —
손배치가 아니라 형태가 수식에서 나온다. `plantrender.js` 가 테이퍼 줄기 + 볼륨 캐노피 +
접지 그림자로 에셋급 렌더하고 고해상 PNG 로 베이크한다(`world/grow.html`, 12그루 갤러리).

```
가지 성장 = normalize(Σ pull(di) + 중력굴성·up) · D,  닿은 어트랙터(dk) 소비
줄기 반경 = Murray  r^e = Σ child r^e  (e≈2.3),  팁 r0 → 루트 후처리
캐노피    = 팁마다 작은 잎 메타볼 다수 + 수직 광 그라디언트(볼륨)
```

`grow.js`·`plantrender.js` 둘 다 DOM 비의존 — 브라우저 없이 검증된다:

```bash
node -e "const G=require('./world/grow.js'),P=require('./world/plantrender.js');
  const a=G.grow(G.mulberry32(1),{baseX:35,baseY:7}), b=G.grow(G.mulberry32(2),{baseX:35,baseY:7});
  const r=P.renderScene(a,{seed:1,scale:5,supersample:1});
  console.log('seed1',a.nNodes,'seed2',b.nNodes,'다름',a.nNodes!==b.nNodes,
    'rootR>tipR',a.radius[0]>a.radius[a.nNodes-1],'px',r.pxw+'x'+r.pxh);"
```

## 엔진 검증 (Node)

엔진은 DOM 비의존이라 브라우저 없이 검증된다:

```bash
node -e "const MC=require('./world/engine.js');
  const w=new MC.World(); MC.Forms.terrain(w);
  MC.Forms.tree(w,92); MC.Forms.creature(w,110,100);
  for(let s=0;s<400;s++) w.step(0.02);
  console.log(w.metrics());"
```

## 새 요소 추가법 (확장의 핵심)

엔진을 손대지 않고 `Forms` 에 레시피 하나만 더한다 — 같은 `spawn`/`addBond`
API 로 단위를 배치하면 거시 거동이 창발한다. 새 *물리*가 필요하면 `step()` 의
장 루프에 항을 하나 추가한다.

## 골격의 한계 (의도적 단순화)

- 단위 **삭제 없음**(결합 인덱스 안정성 우선). 소멸은 `alive` 플래그로 표현.
- 쌍 상호작용이 **O(n²)** — 수천 단위까지 적합. 대규모는 공간 격자/이웃탐색 필요.
- 적분은 **명시적 오일러** — 매우 강한 결합은 작은 `dt` 필요.
