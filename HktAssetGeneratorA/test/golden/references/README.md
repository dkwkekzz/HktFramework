# test/golden/references — 실사진 수동 평가 세트 (07-phase5 §5.5)

검 20종 참조 이미지의 수동 어노테이션(referenceSpec.json)을 여기에 축적한다.
완료 조건: 평균 실루엣 IoU ≥ 0.9 — **수동 어노테이션 포함 기준** (07-phase5 §목표).

- 파일 형태: `<이름>.referenceSpec.json` (뷰어 "spec 저장" 산출물 — 마스크는 RLE).
- 원본 사진 자체는 커밋하지 않는다(저작권) — spec 의 RLE 마스크 + 랜드마크만으로
  `buildTargetSpec` → `optimizeSword` 재현이 가능하다.
- 자동 게이트가 아니라 **수동 평가 세트**다: 합성 참조 라운드트립(자기 일관성)은
  `test/optimize.test.js` 가 자동으로 지킨다.
