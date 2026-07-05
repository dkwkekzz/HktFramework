# assets/worlds — 무대(stage) 월드 에셋

외부 생성 3DGS 월드 파일을 여기에 둔다. **repo 에는 커밋하지 않는다** (수백 MB — .gitignore 처리).
버전 관리 대상은 이 안내와 정합값 사이드카뿐이다.

## worldlabs Marble 에서 받기

1. [marble.worldlabs.ai](https://marble.worldlabs.ai) 에서 지형 월드 생성 (텍스트/이미지 프롬프트).
2. Export 에서 받을 것:
   - **Splats (.spz 또는 .ply)** — 무대 비주얼. 저해상 500k 로 먼저 정합을 잡고 고해상으로 교체.
   - **Collider Mesh (.glb)** — S2 heightfield 베이크용 (즉시 다운로드).
3. 파일을 이 폴더에 놓고, 앱 우측 패널 **무대 탭**에서 드롭하거나
   `?world=assets/worlds/<파일명>` 으로 딥링크.
4. 정합(오프셋/스케일/회전/뒤집기) 슬라이더로 생명 월드(바닥 y=0, 반경 ~5u)에 맞춘 뒤,
   그 값을 `<파일명>.json` 사이드카로 이 폴더에 기록해 둔다 (예: `valley.spz.json`).

라이선스: Marble 생성물의 사용 조건은 worldlabs 약관을 따른다 — 배포 전 확인.

## Marble 없이 확인

- 무대 탭의 **[샘플 지형]** 버튼 — repo 동봉 `sample-terrain.{ply,glb}` 를 무대+collider 로
  한 번에 로드 (오프라인 동작). 재생성: `node tools/gen-sample-terrain.js`.
- `test/stage-shot.js` — 합성 파이프라인 검증용 절차 지형 fixture 를 즉석 생성.
