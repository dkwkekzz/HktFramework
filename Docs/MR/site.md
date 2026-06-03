# MR 뷰어 (index.html) — 설계

> 실행물: [index.html](index.html) · 공개 주소(push 후): `https://dkwkekzz.github.io/HktFramework/Docs/MR/`

## 목표

각 step의 시연(`step-NNNN.html`)과 문서(`step-NNNN.md`)를 **하나의 메인 페이지**에서 본다.
`Docs/intents/site.html`과 같은 방식 — git에 올리면 GitHub Pages로 어디서든 열리고, 로컬 더블클릭으로도 동작한다.
step이 추가되어도 메인 페이지 수정 없이(또는 폴백 한 줄로) 자동 반영된다.

## 구조 (단일 파일, 의존성 0)

```
index.html
├─ 랜딩: step 카드 그리드 (id · 제목 · 요약 · 시연/문서 유무)
├─ 뷰어: [시연] iframe(step-NNNN.html, 상대경로)
│        [문서] step-NNNN.md fetch → 내장 마크다운 렌더러
│        [GitHub ↗] blob 링크
└─ 해시 라우팅: #step-0003/demo, #step-0003/doc — 새로고침·공유 가능
```

intents/site.html과 같은 다크 팔레트. CDN·외부 스크립트 없음 — 오프라인 더블클릭에서도 깨지지 않는다.

## step 발견 — 2단계 (결정: API 자동 + 내장 폴백)

1. **라이브**: GitHub API `GET /repos/dkwkekzz/HktFramework/contents/Docs/MR` 로
   `step-\d{4}\.(html|md)` 를 나열. push만 하면 새 step이 자동으로 카드에 뜬다.
   무인증 60 req/h — 열람용으로 충분. 카드 제목·요약은 같은 출처의 md 첫 줄에서 읽는다
   (Pages에선 상대경로 fetch, 실패 시 raw.githubusercontent).
2. **폴백**: API 실패(오프라인·rate limit·`file://`에서 md fetch 불가) 시
   index.html 안의 `FALLBACK_STEPS` 매니페스트 사용. 로컬 더블클릭에서는
   목록·제목은 폴백에서 오고, **시연 iframe은 상대경로라 그대로 동작**한다.

`file://`의 한계: 브라우저가 로컬 파일 fetch를 막으므로 문서 탭은 로컬에서 렌더되지 않는다
→ 문서 탭이 GitHub 링크로 대체된다. 시연 탭은 영향 없음.

## 문서 렌더링

내장 미니 마크다운 렌더러 (헤딩 · 인용 · 목록 · 표 · 코드펜스 · 인라인 코드/굵게/링크).
step md 안의 상대 링크는 재작성한다:

- `step-NNNN.md` → 앱 내 해시 `#step-NNNN/doc`
- `step-NNNN.html` → 앱 내 해시 `#step-NNNN/demo`
- 그 외 상대경로(`step-0001/03-law.md` 등) → GitHub blob URL (새 탭)

## 규약 (step을 닫을 때)

- `index.html`의 `FALLBACK_STEPS`에 새 step 한 줄 추가(id·제목 한 줄) — 오프라인 폴백용.
  push된 뒤에는 API가 우선이므로 깜빡해도 온라인에서는 자동 표시된다.
- 그 외 index.html은 손대지 않는다. step 쪽 파일명 규약(`step-NNNN.html`/`step-NNNN.md`)만 지키면 된다.

## 정직한 한계

- 무인증 API는 IP당 60 req/h — 초과 시 폴백 목록으로 내려간다(시연은 계속 동작).
- 문서 탭의 마크다운 렌더러는 미니 구현 — 각주·중첩 표 등은 GitHub 링크로 본다.
- `Docs/MR`이 아직 원격에 push되지 않았다(2026-06-04 기준 원격 Docs에 MR 없음). 첫 push 전까지 공개 주소는 404.
