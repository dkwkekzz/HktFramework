# contracts — 모듈 계약(V0) 과 완료 증거(V4)

- `<모듈ID>.yaml` — 모듈 계약. 서식은 [../../../modules/MODULE-TEMPLATE.yaml](../../../modules/MODULE-TEMPLATE.yaml).
  모듈 구현에 착수할 때 **먼저** 작성한다 (WORKFLOW §5 3단계).
- `evidence/<모듈ID>.json` — 완료 증거. 손으로 쓰지 않고 검증 스크립트가 생성한다.
  증거 파일 없이는 `status: VERIFIED` 로 올릴 수 없다 (WORKFLOW §5 7단계).

V0 레지스트리·V4 생성기가 구현되기 전까지는 모듈별 `verify/` 스크립트가 증거를 만든다.
V0/V4 완성 시 여기 쌓인 계약과 증거를 소급 등록·재검증한다.
