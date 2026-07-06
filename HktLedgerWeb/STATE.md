# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 규칙·절차는 [CLAUDE.md](CLAUDE.md) · 방향·arc 는 [SPINE.md](SPINE.md) · 각 step 상세는 `steps/step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~4 는 step 닫을 때 바뀐 절만 **덮어쓴다**(누적 금지·절 단위 Edit) · §5 INDEX 만 **literal 1줄** append. 발견·한계 전문은 step 문서. 전체 ≤ 12KB. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그.

---

## 1. NOW

- **닫힌 step**: [step-0004](steps/step-0004.md) — **A3 영속화 완료**: `EnergyLedger.serialize/load` + `GameServer.snapshot/#restore`. 원장 잔고만 저장하고 배치는 시드 재유도 → 재시작(스냅샷 로드) 후 지역 체크섬 일치·총합 불변.
- **한 줄 상태**: `npm test` 21/21 OK · 스냅샷 복원 후 총 10⁹·전 지역 체크섬 일치 · 조작봇 감사 전건 적발.

## 2. NEXT — 가설 (다음 조각의 권위는 이 절)

> 🎯 **A4 바이너리 tx** ([SPINE](SPINE.md) §1) — JSON 인코딩을 tx 만 16B 바이너리로 교체해 대역폭을 줄인다. 인코딩은 `shared/protocol.js` 한 곳 — `encode/decode` 를 tx op 에 한해 고정폭 바이너리(seq·from·to·amount·cause 를 정수 필드로)로 바꾸고, 나머지 메시지는 JSON 유지. 클라 `net.js` 계측으로 절감 실측.
> 완료 판정(SPINE §1): 봇 8기 시뮬 실측 B/s 절감 수치 — 기존 300~400 B/s(JSON) 대비 감소를 `net.js` 대역폭 계측으로 확인.

**백로그**: A2 판정 감사 · A3 영속화 · A4 바이너리 tx · A5 몬스터 권위 이관 (각 완료 판정은 SPINE §1 표).

## 3. OPEN GAPS — 열린 격차

| 마커 | 격차 | 상태 |
|---|---|---|
| ✅ | 보존·중재·검증·미러 정합 (핵심 불변식 4종) | step-0000 — test 13종 |
| ✅ | A1 필드 확산 | step-0002 — `SOURCE→셀→노드`+`셀↔셀 diffuse`, test 5종(field 3·game 2) |
| ✅ | A2 판정 감사 | step-0003 — 위임 데미지 판정 25% 표본 재시뮬, 조작 전건 적발 |
| ✅ | A3 영속화 | step-0004 — 원장 serialize/load + snapshot/restore, 복원 후 체크섬 일치 |
| ⬜ | A4 바이너리 tx | JSON 인코딩 그대로 |
| ⬜ | A5 몬스터 권위 이관 | 서버 정적 배치 — "서버 무시뮬" 원칙의 마지막 예외 |

## 4. DURABLE CONSTRAINTS — 반복 참조 수치 (원칙의 권위는 CLAUDE.md)

- 창세 `W:SRC` = 10⁹ · 에너지 전부 정수 · 서버 틱 10Hz · 비콘 5Hz(양자화) · 지역 체크섬 3초.
- 이동 50px 당 에너지 1 (`플레이어→소실`) · 전투 기본 데미지 = 결정론 롤 30±10(위임 가능·25% 표본 감사) → 50% 흡수(`피격자→공격자`) + 50% 소각(`피격자→소실`) · 노드 재충전 5초 주기(`SOURCE→셀→노드`) · 사망 = 잔고 0 → 드랍 + `세계→플레이어` 리스폰 인출.
- 틱 플러시 순서 LEAVE→OPS→ENTER · 서버 처리 순서 리스폰→인텐트 FIFO→재충전→플러시.

## 5. INDEX — step 당 literal 1줄 append

```
0000 | baseline 프로토타입 v0 동결 | test 13/13 · 300~400 B/s
0001 | A1 필드 확산 프리미티브(shared/field.js diffuseTick) | test 16/16 · 확산 200틱 총합 불변
0002 | A1 필드 확산 서버 배관(SOURCE→셀→노드+diffuse) | test 18/18 · 봇 8기 총 10⁹ 불변·체크섬 OK
0003 | A2 판정 감사(위임 데미지 25% 표본 재시뮬) | test 19/19 · 조작봇 감사표본 전건 적발·정직봇 오탐 0
0004 | A3 영속화(원장 serialize/load + snapshot/restore) | test 21/21 · 복원 후 총 10⁹·전 지역 체크섬 일치
```
