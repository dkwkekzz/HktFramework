# Design — Intent Management Phase 2 (SQLite + 로컬 서버)

본 문서는 **Intent 편집 시스템의 Phase 2 설계도**다. Phase 1은 GitHub API 기반 정적 SPA로 동작하며, Phase 2는 그 위에 **로컬 dev 서버 + SQLite**를 어댑터로 추가하여 실시간성·검색·세션 관리를 강화한다. 본 문서는 설계만 담고 코드는 포함하지 않는다.

---

## 1. 배경 및 목표

### 1.1 Phase 1 한계
- GitHub API 폴링: 변경 반영 5–10초 지연
- 토큰(PAT) 입력 UX 부담
- 풀텍스트 검색·집계 쿼리 불가 (모든 `.md` 다운로드 후 클라 처리)
- 동시 편집 잠금 없음 (낙관적 충돌만 감지)
- 모든 키스트로크가 잠재적 커밋 — 명시적 [Save] + debounce에 의존

### 1.2 Phase 2 목표
- **즉시 반영** — SSE 푸시로 ≤1s 반영
- **검색·집계** — FTS5 풀텍스트, 태그/상태 필터, 자식/부모 카운트
- **편집 세션** — soft-lock으로 같은 Intent 동시 편집 충돌 사전 차단
- **변경 로그** — 누가 언제 무엇을 바꿨는지 audit trail
- **`.md` 진실성 유지** — git/PR 리뷰 흐름은 그대로
- **Phase 1과 공존** — 모바일·외부 환경에서는 GitHub 모드로 fallback

### 1.3 비목표 (의도적 제외)
- 다중 사용자 실시간 OT/CRDT 협업
- 외부 노출·공인 인증 (loopback 전제로 시작)
- mongo·Postgres 같은 별도 DBMS 프로세스
- `.md`를 export 산출물로 강등시키는 모델 (Model A) — 본 단계에서는 다루지 않음

---

## 2. 데이터 소유 모델

> **`.md` 파일이 source of truth, SQLite는 협조(coordination) 데이터·인덱스·캐시를 담는다.**

| 데이터 | 소유처 | 비고 |
|---|---|---|
| Intent 본문·관계 (`parents`, `children`, `intent`, `status` …) | **`.md` (git)** | 최종 진실 |
| Intent 인덱스 (id → row) | SQLite | `.md`에서 파생 |
| FTS5 검색 인덱스 | SQLite | `.md`에서 파생 |
| 다음 ID 카운터 | SQLite | atomic 발급. 부팅 시 `.md`로 재계산 가능 |
| 편집 세션·soft-lock | SQLite | 휘발 (서버 재시작 시 모두 만료) |
| 변경 로그 (audit) | SQLite | 영속 (선택적으로 git으로 export) |
| 사용자 환경 설정 | SQLite | 휘발성/로컬 |

### 2.1 SQLite를 쓰는 이유 (mongo 대비)
- **임베디드** — 별도 프로세스 없음. 서버 바이너리 1개로 끝
- **단일 파일** — `.cache/intents.db` 하나. 백업·삭제·재생성 단순
- **읽기 빠름** — `.md` 100~1000건 규모에서 인메모리 + WAL이면 충분
- **장애 시 재구축 간단** — DB 파일 삭제 → `.md` 재인덱싱으로 복구
- **트랜잭션·FTS5** — 필요한 기능은 모두 지원

### 2.2 일관성 규칙
1. **시작 시 동기화** — 서버 부팅 시 `.md` → SQLite 일방 인덱싱
2. **충돌 시 `.md` 채택** — 외부 git pull로 `.md`가 바뀌면 watcher가 SQLite를 갱신
3. **쓰기 순서 고정** — `.md` 임시 파일 → 검증 → atomic rename → SQLite 업데이트 → SSE 푸시
4. **SQLite는 진실 아님** — DB 파일 손상 시 삭제하고 재인덱싱하면 끝

---

## 3. 아키텍처

### 3.1 컴포넌트 구성

```
┌──────────────────────────────────────────────────────────┐
│ Browser (site.html)                                      │
│   ├─ IntentStore 인터페이스 (UI ↔ Store 단일 접점)       │
│   ├─ HttpStore         ◀── Phase 2 추가                  │
│   └─ GitHubStore       ◀── Phase 1 유지 (fallback)       │
└──────────────────────────────────────────────────────────┘
              │ REST + SSE (loopback)
              ▼
┌──────────────────────────────────────────────────────────┐
│ Local Server  (FastAPI, single process)                  │
│   ├─ HTTP Layer  /api/intents, /api/events (SSE)         │
│   ├─ IntentRepository  (.md ↔ SQLite 동기화)             │
│   ├─ Validator (DAG, schema, 사이클)                     │
│   ├─ FileWatcher (watchfiles, 외부 편집 감지)            │
│   ├─ SessionManager (soft-lock, audit)                   │
│   └─ EventBus  → SSE clients                             │
└──────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
        ┌──────────┐                  ┌──────────────┐
        │ .md files│ (source of truth)│ intents.db   │ (cache/coord)
        │ in git   │                  │ SQLite + WAL │
        └──────────┘                  └──────────────┘
```

### 3.2 모드 전환 (브라우저 측)

```
페이지 로드
  ├─ GET /api/health (timeout 500ms)
  │     ├─ 200 OK     → HttpStore   (Phase 2 모드)
  │     └─ 실패       → GitHubStore (Phase 1 모드)
  └─ 사용자가 수동 토글 가능 (?mode=github 강제)
```

UI 코드는 `IntentStore` 인터페이스만 본다. 모드 전환은 store 인스턴스 교체로만 발생.

---

## 4. 추상화 경계 (Phase 1과 공유)

UI ↔ Store 사이에 다음 인터페이스만 노출. **Phase 1·2 양쪽이 동일 시그니처를 구현**한다.

### 4.1 IntentStore

| 메서드 | 시맨틱 |
|---|---|
| `list()` | 전체 Intent 반환 |
| `get(id)` | 단건 조회 |
| `create(input)` | **ID 미포함 입력**, 응답에서 ID 받음 |
| `update(id, patch, baseVersion)` | 낙관적 잠금. 토큰 불일치 시 409 |
| `remove(id, baseVersion)` | 자식 존재 시 409. `cascade` 옵션은 별도 |
| `subscribe(onChange)` | 변경 이벤트 구독. unsubscribe 함수 반환 |

### 4.2 baseVersion 시맨틱

| 모드 | 토큰 의미 | 충돌 검출 |
|---|---|---|
| Phase 1 (GitHub) | git commit SHA | GraphQL `expectedHeadOid` |
| Phase 2 (Http)   | row `updated_at` 또는 `version` int | 서버 검사 → 409 |

UI는 토큰을 **불투명 string**으로 다룬다. 의미를 알지 못해야 함.

### 4.3 ChangeEvent

```
{
  type: 'create' | 'update' | 'delete',
  id: number,
  by?: string         // Phase 1 비움. Phase 2 세션 ID/사용자명
  occurredAt: ISO8601
}
```

### 4.4 Validator

순수 함수. 입력 = Intent 배열, 출력 = ValidationError 배열.
- Phase 1: 클라 단독 호출 (저장 전)
- Phase 2: 클라 단독 호출 (즉시 피드백) + 서버 동일 알고리즘 재검사 (권위)
- **검증 규칙은 JSON 데이터로 기술**해 양 진영이 같은 룰을 읽도록 한다 (`Tools/intent-system/intentsys/rules.json` 등 단일 출처)

---

## 5. 서버 API 명세

### 5.1 REST

| 메서드 | 경로 | 설명 | 응답 |
|---|---|---|---|
| GET | `/api/health` | 헬스체크 | `{ ok: true, version }` |
| GET | `/api/intents` | 전체 목록 | `[Intent...]` (ETag 지원) |
| GET | `/api/intents/{id}` | 단건 | `Intent` |
| POST | `/api/intents` | 생성 (ID 미포함) | `201 Intent` |
| PUT | `/api/intents/{id}` | 수정 (`If-Match: <baseVersion>`) | `200 Intent` / `409` |
| DELETE | `/api/intents/{id}` | 삭제 (`If-Match`, `?cascade=0|1`) | `204` / `409` |
| POST | `/api/intents/{id}/lock` | soft-lock 획득 (TTL 60s, 자동 갱신) | `200 { token }` / `409` |
| DELETE | `/api/intents/{id}/lock` | lock 해제 | `204` |
| GET | `/api/search?q=...&status=...` | FTS5 검색 | `[Intent...]` |
| GET | `/api/audit?id=...&limit=...` | 변경 로그 조회 | `[ChangeRecord...]` |

### 5.2 SSE

`GET /api/events` — 단방향 푸시 채널.

이벤트 종류:
- `intent.changed` — `{ type, id, by, baseVersion }`
- `intent.lock` — `{ id, holder, expiresAt }` / `{ id, released: true }`
- `validation.failed` — `{ id, errors }` (서버 사후 검증 실패 — 배경 검사용)
- `system.reindex` — `{ reason }` (외부 git pull 후 등)

### 5.3 검증·잠금 흐름

```
PUT /api/intents/5
  Headers: If-Match: <baseVersion>
            X-Lock-Token: <optional>
  ↓
[1] Lock 검사 — 다른 세션이 hold 중이면 409 LOCKED
[2] baseVersion 검사 — 불일치 시 409 STALE
[3] Validator — DAG/스키마 위반 시 422 INVALID
[4] .md 임시 파일 작성 → atomic rename
[5] SQLite UPDATE intents, INSERT audit
[6] EventBus → SSE 푸시
[7] 200 응답 (새 Intent + 새 baseVersion)
```

---

## 6. SQLite 스키마

> 본 절은 의도(intent)만 명시한다. 정확한 DDL은 구현 시 확정.

### 6.1 테이블

- `intents` — id (PK), title, status, intent_text, parents_json, children_json, frontmatter_json, file_path, file_mtime, version (낙관적 잠금용 카운터), updated_at
- `intents_fts` — FTS5 가상 테이블 (title, intent_text)
- `id_counter` — `next_id` 단일 행
- `edit_locks` — id (PK), holder_token, holder_label, acquired_at, expires_at
- `audit_log` — auto-pk, intent_id, op, by, at, before_json, after_json
- `meta` — 키-값 (스키마 버전 등)

### 6.2 인덱스
- `intents.status`, `intents.updated_at`
- 트리거로 `intents` 변경 시 `intents_fts` 동기화

### 6.3 휘발성 정책
- 부팅 시 `edit_locks` 전부 삭제
- `intents`/`intents_fts` 비교 후 `.md` 변경분 재인덱싱
- `audit_log`는 영속 (필요 시 N개월 후 archive)

---

## 7. 동시성 시나리오

### 7.1 두 사용자가 같은 Intent 편집
```
A: GET /api/intents/5  → version=12
B: GET /api/intents/5  → version=12
A: PUT (If-Match: 12) → 200, version=13, SSE 푸시
B: PUT (If-Match: 12) → 409 STALE
B: 토스트 "외부 변경됨, 새로고침" → GET → version=13 → 사용자 재편집
```

### 7.2 Soft-lock 흐름
```
A: 카드 편집 시작 → POST /api/intents/5/lock → 200 (60s TTL)
B: 같은 카드 진입 → SSE 'intent.lock' 수신 → 헤더에 "A 편집 중" 표시,
   편집 UI는 read-only (강제 해제 버튼은 있음)
A: 편집 중 30s마다 lock 갱신 (heartbeat)
A: 저장 완료 → DELETE lock
```

### 7.3 외부 git pull
```
$ git pull   # .md 다수 변경
FileWatcher: 변경 감지 → IntentRepository.reindex()
  → 영향 ID 집합 계산
  → SQLite UPDATE/INSERT/DELETE
  → SSE 'intent.changed' bulk 푸시
브라우저: 영향 카드만 재렌더
```

### 7.4 `.md` 직접 편집 (VSCode 등)
7.3과 동일 경로. 외부 에디터와 사이트가 자연스럽게 공존.

---

## 8. 마이그레이션 시퀀스

### 8.1 Phase 1 → Phase 2 전환 (점진적)

```
[Step 1] Phase 1 출시 — IntentStore 추상화 + GitHubStore 구현 + JS validator
[Step 2] Phase 1.5 — 검증 규칙을 rules.json으로 데이터화 (JS/Python 공유)
[Step 3] Phase 2-A — 로컬 서버(`intentsys serve`) 구현
         · FastAPI + watchfiles
         · SQLite 인덱스 + audit
         · HttpStore 추가
         · 모드 자동 감지 (/api/health)
[Step 4] Phase 2-B — soft-lock + FTS5 검색 UI
[Step 5] Phase 3 (선택) — LAN/터널 노출 + 인증
```

각 단계는 **독립 release 가능**. UI 코드 변경은 모드 자동 감지 한 줄 추가뿐.

### 8.2 데이터 마이그레이션
- **없음**. SQLite는 부팅 시 `.md`에서 항상 재구축 가능
- baseVersion 토큰 시맨틱은 모드 전환 시점에 무효화 → 첫 PUT 직전 force-refresh

### 8.3 Rollback
- Phase 2 서버 중단 → 자동으로 Phase 1 모드 fallback
- SQLite 파일 삭제 가능 (재시작 시 재인덱싱)
- `.md`/git에는 어떤 영향도 없음

---

## 9. 파일·모듈 레이아웃 (제안)

```
Tools/intent-system/
├── intentsys/
│   ├── __main__.py
│   ├── cli.py                  # build / serve / validate / reindex
│   ├── parser.py               # .md ↔ 모델 (Phase 1과 공유)
│   ├── sitegen.py              # 정적 사이트 (Phase 1)
│   ├── rules.json              # ★ 검증 규칙 단일 출처
│   ├── validator.py            # rules.json 해석 (서버 측)
│   └── server/                 # ★ Phase 2 신규
│       ├── app.py              # FastAPI 라우터
│       ├── repo.py             # IntentRepository (.md ↔ sqlite)
│       ├── db.py               # SQLite 스키마/마이그레이션
│       ├── locks.py            # SessionManager
│       ├── watcher.py          # watchfiles 래퍼
│       └── events.py           # EventBus + SSE
└── tests/

Docs/intents/
├── site.html                   # IntentStore 인터페이스 + 두 구현체
├── store/                      # ★ Phase 2 시점에 분리 권장
│   ├── github.js
│   ├── http.js
│   └── validator.js            # rules.json 로더 + 동일 알고리즘
└── I-XXXX.md                   # source of truth (변동 없음)

.cache/
└── intents.db                  # SQLite 파일 (gitignore)
```

---

## 10. 위험 및 결정 사항

### 10.1 위험 매트릭스

| 위험 | 영향 | 완화 |
|---|---|---|
| `.md`/SQLite 동기화 어긋남 | 데이터 혼란 | `.md` 진실 원칙 + 부팅 시 재인덱싱 + 충돌 시 `.md` 채택 |
| 자동 커밋 노이즈 | git 이력 더러움 | 명시적 [Save] + 30s debounce + squash 정책 (Phase 1 정책 유지) |
| Lock 좀비 | 다른 사용자 차단 | TTL 60s + heartbeat. 강제 해제 버튼 |
| FileWatcher 미스 | 외부 편집 미반영 | 주기적 reconcile (5분) 백그라운드 작업 |
| baseVersion 시맨틱 변화 | 모드 전환 직후 false 409 | 전환 직후 force-refresh 1회 |
| SQLite 파일 손상 | 서버 동작 불가 | 파일 삭제 → 재시작 → 재인덱싱 |
| 검증 규칙 JS/Python 분기 | 서버/클라 결과 불일치 | rules.json 단일 출처 + 같은 알고리즘 |

### 10.2 미결정 (구현 전 확정 필요)
- **brand 결정** — `intentsys serve` CLI vs 별도 바이너리
- **포트 기본값** — 8765 / 환경변수 `INTENTSYS_PORT`
- **인증 도입 시점** — Phase 2-B 또는 Phase 3
- **audit_log 보존 기간** — 무제한 / 90일 / 사용자 설정
- **외부 publish 흐름** — Phase 2 서버가 자동 git commit 할지, 사용자가 수동 commit 할지

---

## 11. 향후 확장 경로

본 설계는 **Model B (SQLite = 캐시·협조 데이터)** 위에 세워졌다. 필요해지면 다음으로 진화 가능:

- **Model C (하이브리드)** — draft는 SQLite, [Publish]만 `.md` + git commit. 본 설계의 `audit_log` + `edit_locks`를 확장하면 자연스럽게 도달
- **다중 사용자** — Phase 3에서 LAN/터널 + 토큰 인증 추가
- **Postgres·Mongo로 승격** — 운영 데이터(텔레메트리·세션 분석)가 폭증할 때만. SQLite 인터페이스를 Repository 추상화 뒤에 두면 교체 가능
- **CRDT 협업** — 본 설계의 soft-lock 모델 한계가 명확해질 때만 검토

---

## 12. 요약

- Phase 1의 `IntentStore`/`baseVersion`/`subscribe`/`validate` 4개 추상화 슬롯을 그대로 재사용한다
- Phase 2에서 추가되는 것은 **로컬 서버 1개 프로세스 + SQLite 1개 파일 + HttpStore 1개 클래스**
- `.md`는 양 단계 모두에서 source of truth — git/PR 리뷰 흐름 무손실
- SQLite는 인덱스·검색·잠금·감사 로그 담당. 손상돼도 `.md`로 재구축
- 서버가 죽어도 사이트는 GitHub 모드로 자동 fallback — 모바일·외부 환경 대응 유지
