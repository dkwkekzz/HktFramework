# L2 — 도구 절반 2단계: Region 작성기 (기반 층 2 · 도구 절반 부속)

상태: **확정** (Human — "새로 만들어야 한다 · 순서를 명확히"). [L2-World-Tool.md](L2-World-Tool.md)(도구 절반 1단계 — 문법과
컴파일러)의 다음 단계다. 세계가 아니라 **세계를 쓰는 도구**이므로 새 층이 아니고, ENGINE 레인 B(T1~T6 · §3)와 컨텐츠 Play 하나
(HundredRooms · §5)로 선다. **이 저장소 안에서 새로 짓는다** — 다른 트랙(HktGameplayGenerator 등)을 쓰지 않는다.

이 문서가 있는 이유는 한 질문이다 — *"지역을 하나 더할 때마다 2층 공정을 다시 타야 하는가? 수없이 많은 컨셉을
어떻게 만들 것인가?"* 답은 **아니다 · 도구가 만든다** 이고, 그 답이 어디에도 할 일로 적혀 있지 않았다.

```text
이 문서가 소유한다      새 지역의 세 등급 판정 · Region 작성기가 하는 일과 하지 않는 일 · 완료 조건("방 백 개") ·
                      언제 짓는가
이 문서가 소유하지 않는다  지역의 세계 사실(컨텐츠 행) · 규칙 코드 · 재미의 판정(Human)
```

---

## 1. 왜 — 이미 약속된 것

| 약속 | 어디 |
|---|---|
| 컨텐츠 공간 = **선 축들 × 미지들**. 미지가 하나 늘 때마다 모든 축과 곱해진다 — 확장성은 여기서 나온다 | [README.md](README.md) §1 |
| 방과 Connector 는 **데이터**다. 총 수에 상한이 없고 수십~수백을 전제한다. 규칙 코드는 이름을 모른다 (R13) | [L2-World-Region.md](L2-World-Region.md) §2.1 · Rooms 확정 8 |
| "수백 개를 사람이 쓰는 것은 데이터가 아니라 노동이다. **여기서부터 도구가 그 자리를 받는다**" | Region §2.1 ② |
| 이름 짓기는 위임됐다 — 짓는 **방식**(사람 · 생성기)은 그 규모를 실제로 다루는 Play 가 정한다 | Region §5.5 |
| 폴리싱은 데이터로 — 방을 더하고 문을 열고 색을 바꾸는 것이 코드 diff 0 (실측) | RegionGraphRooms C004 |
| 지역 하나를 쓰는 공식은 고정돼 있다 — Concept §17 일곱 질문 · Region §15 12단계 · 재료 계약 표 다섯 · 철 덧씌움 넷 · 생명 계약(탄생지 · 개체군 · 관계) · 검사 ①~㉝ | ① ② ②-부속 셋 |

공식이 고정됐다는 것은 **생성기가 돌릴 수 있다**는 뜻이다. 기획 여섯이 무거웠던 이유는 그것이 지역이 아니라 **문법**이었기
때문이고, 문법은 이제 닫혔다. 생명 계약([L2-World-Life.md](L2-World-Life.md) §3.5)이 이 공식에 마지막으로 든 항이다 —
그것이 없으면 도구가 짓는 방 백 개에 생명이 없다.

## 2. 새 지역의 세 등급 — 미지가 오면 먼저 가른다

| 등급 | 조건 | 공정 | 예 |
|---|---|---|---|
| **A. 데이터만** | Global Rule + 공통 계약(재료 · 철 · 생명 · 위험 태그 · 안전 조건)으로 성립한다 | Play 없음 · Cycle 없음. RegionSpec 하나(space + resourceEcology + phases + ecology) + graph 한 줄 + view 표 한 줄. 검사 ①~㉝ 통과 · Human 판정 | 가스로 가득 찬 마을 — hazard/climate(독성) + settlement(왜 사는가) + 재료 생태(가스 → 무엇이 남는가) + 생명(가스에서 무엇이 태어나고 무엇을 먹고 무엇을 남기는가 — 원인 없는 생물 금지 · Life F2) |
| **B. 규칙 하나** | 그 지역만의 Region Rule 이 필요하다 | **Cycle 하나**(시스템 하나). Play 아님. 둘째 규칙부터 Rule Primitive 를 뽑아(RuleBoundRoom E5) 그다음은 조합 | 유령이 돌아다니는 도시 — "죽은 생물이 기억을 남긴다"(Concept §13 정식) 규칙 하나. 유령의 행동은 3층, "남은 기억이 자리에 있다"는 2층 |
| **C. 새 축** | 지금 없는 층의 의미를 요구한다 | 컨텐츠 행이 아니다 — 기반 층의 그 행을 기다린다 (README §1) | 마법도시 — 마법은 6층(능력), 도시의 사람들은 3층(주체). 축이 서면 A 로 온다 |

빙결 협곡(M5)이 Play 셋을 가진 것은 **B 의 첫 사례**이자 "두 번째 갈래" 의 계약 일반화(관찰 범위의 area 조건 · 물질 접촉 표시 ·
Region 사이 덧씌움)였기 때문이다. 그 셋이 서면 다음 협곡류는 A 다.

## 3. 순서 — 여섯 단계 (T1~T6 · ENGINE 레인 B)

한 단계 = 커밋 하나(또는 몇)이고, 각 단계는 앞 단계 위에만 선다. 게임 명사가 없는 것은 `engine/` 과 `tools/` 에,
있는 것(템플릿 · 프롬프트)은 `content/authoring/` 에 둔다 — 경계 규칙은 그대로다 (engine 은 content 를 import 하지 않는다 ·
컨텐츠가 계약으로 자신을 등록한다 — CLAUDE.md 원칙 5).

| # | 무엇을 | 어떻게 | 완료 조건 | 기다리는 것 |
|---|---|---|---|---|
| **T1** | **검사기를 독립 명령으로** — `world:check` | 지금 `world:observe --report` 안의 ①~⑨ 를 뽑아 하나의 명령으로. 결과는 **기계가 읽는 JSON**(통과/실패 · 항목 · 참조). C014 의 ⑩~㉒, C018 의 ㉓~㉖, C022·C025 의 ㉗~㉝ 은 생기는 대로 같은 명령에 붙는다 | `npm run world:check` 가 JSON 을 내고 `npm test` 에 붙는다. 실패 항목 하나를 일부러 만들어 잡히는 것을 본다 | — |
| **T2** | **여덟 답의 형(RegionBrief)** | Concept §17 일곱 질문의 답 + **여덟째 — 무엇이 태어나는가**(어떤 재료에서 · 무엇을 소비하며 · 무엇을 남기고 · 무엇을 부르는가 — Life §3.5) + 이름 · 갈래(hazard 태그) · 이웃(어느 Region 에 어떤 Connector 로 잇는가) · 요구(필요한 규칙/축이 있으면 적는다)를 **JSON schema(zod)** 로. 필드명은 일반명(특별함 · 원인 · 거주 · 위험 · 귀함 · 발견 · 열림 · 탄생)이라 engine 에 둔다 | 지금 있는 방 아홉을 이 형으로 **손으로 역기술**해 전부 검증을 통과한다 — 형이 현실을 담는지의 증명 | 없음 |
| **T3** | **뼈대 생성기** — `world:author <brief.json>` | brief → RegionSpec(space op · resourceEcology · phases · ecology) + `graph.ts` 한 줄 + view 표 한 줄. **결정론**(seed = brief 의 hash). 템플릿(갈래별 op 묶음 · Source 역할별 기본형 · 철 덧씌움 기본형 · 탄생 방식별 기본형)은 `content/authoring/templates/` — 게임 명사가 있으므로 content 다 | 손으로 쓴 brief 하나 → 방 하나가 T1 을 통과하고 **관찰자가 걸어 흔적 → 원천을 본다**. 코드 diff 0 (등급 A 실측) | phases 형은 **C016** 뒤 · ecology 형은 **C022** 뒤. 그 전엔 space + graph + resourceEcology 까지 |
| **T4** | **등급 판정기** | brief 의 "요구" 와 세계 사실을 계약 목록(layer · tag · 규칙 · 축)과 대조 → **A / B / C** + 빠진 것을 GAP 형식(Required · Missing · Reason · Return To)으로 | brief 셋 — 가스 마을 · 유령 도시 · 마법도시 — 가 **A · B · C** 로 갈리고 B/C 의 빠진 것이 정확히 적힌다 | T2 |
| **T5** | **초안기(LLM)** — `world:draft "<미지 한 줄>"` | `@anthropic-ai/sdk` · 모델 `claude-opus-5` · **구조화 출력**(`output_config.format` = T2 의 schema — 자유 문장이 아니라 brief 가 나온다). 컨텍스트 = L0 · L2 문서 다섯 + 현재 Region Graph + T1 결과. 나온 brief 를 T3 → T1 에 넣고 **실패 보고를 되먹여** 재시도(상한 N). 결과는 **파일로 굳혀 커밋** — 초안은 비결정이어도 굳은 파일이 원본이고 세계는 결정론이다. 키는 `ANTHROPIC_API_KEY` 또는 `ant auth login` 프로필 · 세계 실행에는 필요 없다(도구만 부른다) | 미지 한 줄 → brief → 방 하나가 **사람 손 없이** T1 을 통과한다. 지어낸 세계 사실이 있으면 T4 가 잡아 UNRESOLVED 로 돌려보낸다 | T3 · T4 |
| **T6** | **판정 표면과 대량** | lab 페이지에 후보 방을 나란히 — top view · 여덟 답 · 편중 요약(⑲ ⑳ ㉒ ㉕ ㉖ ㉚ ㉝) — 승인/반려. 승인만 `content/regions/` 에 들어간다. `world:draft --batch <미지 목록>` 으로 백 줄 | **Play HundredRooms** (§5) | T5 · Life(C025)까지 데이터로 선 것을 본 뒤 — 여덟째 답과 ㉚ ㉝ 이 그때 생긴다 |

```text
T1 ── T2 ── T3 ─┬─ T5 ── T6 ── HundredRooms
                └─ T4 ─┘
T5 는 지금 — ENGINE 레인이라 Cycle 실주행과 병행한다.
```

### 3.1 자리

```text
engine/world-authoring/check.ts        검사 ①~㉝ (게임 명사 없음 — 참조와 계약만 본다)
engine/world-authoring/brief.ts        RegionBrief schema (zod) — T2
content/authoring/briefs/              방마다 brief 하나 (`<REGION_ID>.json`) — 사람이 적고 T3 가 읽는다 (게임 명사)
content/authoring/examples/            세계에 들이지 않은 본보기 brief 셋 — 등급 A · B · C 의 예 (T3 · T4 의 시험이 쓴다)
content/authoring/contracts.ts         이 세계가 이미 가진 것들 (어휘 · 방 · 경계 · 규칙) — T4 가 대조한다 (게임 명사)
engine/world-authoring/author.ts       brief + templates → RegionSpec · graph · view 행 — T3 (템플릿은 주입받는다)
engine/world-authoring/grade.ts        등급 판정 — T4 (계약 목록도 주입받는다)
content/authoring/templates/           갈래별 op 묶음 · Source 역할별 기본형 · 철 덧씌움 기본형 — T3 (게임 명사)
content/authoring/prompts/             초안기의 시스템 프롬프트 = L0 · L2 문서를 그대로 잇는다 — T5
content/authoring/index.ts             templates · contracts · prompts 를 engine 에 등록하는 유일한 자리 (원칙 5)
tools/world-editor/                    world:check · world:author · world:draft · lab 의 판정 표면 — T1 · T3 · T5 · T6
```

`content/authoring/` 은 `content/regions/` 를 **쓰는** 쪽이지 읽히는 쪽이 아니다 — regions 는 여전히 engine 만 import 한다 (경계 규칙 4).

## 4. 하지 않는 일

```text
문법을 넓히지 않는다     새 layer · 새 op · 새 규칙 · 새 축은 작성기의 것이 아니다 — T4 가 B·C 로 판정해 돌려보낼 뿐
재미를 판정하지 않는다   편중을 보이게 할 뿐, 좋고 나쁨은 Human (T6 의 승인/반려)
세계 사실을 지어내지 않는다 — 이름 짓기(§5.5)와 "그것이 무엇인지에서 나오는 것" 만 채운다. Human 이 준 사실은 정식이고 흔들지 않는다.
                        T5 가 그 밖의 사실을 지어내면 T4 가 잡는다
세계 실행이 LLM 에 기대지 않는다 — 초안은 도구 시간의 일이고, 굳은 파일만 세계에 들어간다
```

## 5. 완료 조건 — "방 백 개" (컨텐츠 Play 하나 · 제안)

```text
Play    HundredRooms — 이름 있는 미지 백 줄(대부분 A · 몇은 B/C 로 판정되어 돌아온다)을 넣어 방 백 개가
        검사 ①~㉝ 을 통과하고, 관찰자가 그중 임의의 열 곳을 걸어 각각 흔적 → 원천 → 철 덧씌움 → 탄생지를 본다.
        코드 diff 0 (B 판정 것은 제외 · 그것은 Cycle 로).
증명    "세계가 커지는 것은 값이 느는 일이지 규칙이 느는 일이 아니다" (R13) 를 백 배 규모에서 실측한다.
        Region §2.1 의 벽 셋(한 방의 출구 수 · 손으로 짓는 것 · 사람이 읽는 보고) 중 둘째와 셋째가 여기서 닫힌다
Cycle   번호는 승인 때 — 앞 레인(Life C025) 뒤
```

## 6. 언제 — 레인과 순서

```text
ENGINE 레인 B   T5 는 지금. T3 의 나머지(phases)는 C016 뒤 · ecology 는 C022 뒤.
               T4 는 T2 뒤. T5 는 T3 · T4 뒤. T6 은 T5 뒤이고 Frost(C021)가 데이터로 선 것을 본 뒤 —
               두 갈래가 정말 같은 계약 위에 있는지 실주행으로 확인돼야 템플릿이 맞다
컨텐츠 Play     HundredRooms — T6 뒤. Cycle 번호는 그때 (앞 레인 뒤)
말할 것         "T1 진행" 처럼 단계 하나를 부른다 — ENGINE 레인이므로 Cycle 번호가 없고 브랜치는 engine/<T#>
```

## 7. 다음

```text
T5 초안기(LLM)  착수 가능 — T3 · T4 가 섰다. 미지 한 줄 → 구조화 출력으로 brief →
               T3 → T1 에 넣고 실패 보고를 되먹인다. 굳힌 파일만 세계에 들어간다.
               STATE §1 의 ENGINE B 레인이 "지금 할 수 있는 것" 으로 든다
HundredRooms   T6 이 서면 advprotoi-design 이 Play 로 쓴다 (승인 1회)
```
