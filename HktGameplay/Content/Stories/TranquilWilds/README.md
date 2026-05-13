# TranquilWilds — SEED 01 Prototype

`Docs/Concept01_TranquilWilds/` 의 시드 스토리를 실제 데이터 파일로 옮기는 첫 prototype.

본 디렉토리의 목적은 **두 가지 파일 양식의 결합 방식을 굳히는 것**이다.

1. 기존 `Story_*.json` VM 스크립트 — 한 진입점의 실행 본체 (재사용)
2. 신규 `Beat_*.json` 컨테이너 — 시드 전체 구조 + 단계 전이 (양식 prototype)

워크플랜: [`Docs/Concept01_TranquilWilds/10-implementation-workplan.md`](../../../../Docs/Concept01_TranquilWilds/10-implementation-workplan.md).

---

## 현재 상태 — Wave 0 (양식 추출)

| 산출물 | 파일 | 상태 |
|---|---|---|
| 진입점 A 본체 (회복) | `Story_WoundedTraveler_Heal.json` | 작성됨, spec 첨부 |
| 진입점 A spec       | `Story_WoundedTraveler_Heal.spec.json` | 4 시나리오 |
| SEED 01 Beat 컨테이너 | `Beat_RuinUpstream_01.json` | **신규 양식 prototype** (파서 미인식) |
| 진입점 B 본체 (정상 조망) | (예정) | TBD |
| 진입점 C 본체 (시신 조사) | (예정) | TBD |

---

## 신규 양식: Beat 컨테이너

`Beat_<seedId>.json` 은 현재 `HktStoryJsonParser` 가 **인식하지 않는다**. 이 파일은 향후 도입될 **Beat Manager** 가 소비할 데이터 양식의 첫 안이다. 본 prototype 의 역할:

- 시드 한 개를 표현하는 데 어떤 필드가 필요한지 실제 변환으로 발견
- 기존 `Story_*.json` VM 과의 결합 인터페이스 (`entries[].triggerBody`) 시연
- 미해결 질문(`_pending_schema_questions`) 누적

### 본 prototype 이 가정하는 결합

```
[플레이어 액션]
    ↓ ApplyEffect / Interact
[Story.Event.Interact.Heal]  ←── Story_WoundedTraveler_Heal.json 실행
    ↓ steps 끝에서 DispatchEventFrom
[Story.Event.Beat.RuinUpstream.EntryA]  ←── Beat Manager 가 수신
    ↓ Beat_RuinUpstream_01.json 의 transitions 평가
[Whisper → Tremor 전이]
    ↓ effects 적용
[EnvModifier: 강 상류 FogWeight +30]
[Codex.Hint.UpstreamDirection 등록]
```

→ Story VM 은 **로컬 효과 + 이벤트 발행**만 책임. 시드 전역 상태(단계·환경·진행)는 Beat Manager 가 별도로 관리.

### 미해결 (Beat 파일의 `_pending_schema_questions` 참조)

- 단계 전이를 Story VM 으로 표현할지 vs Beat Manager polling 할지
- `onResolve.children` 의 Token/Codex/Naming 저장소 구현체 (Track C5)
- `anchor.placement` 의 실제 좌표 결정자 (Track C1·C2)
- `transitions[].when` 술어 어휘 확장

---

## 다음 단계

1. **Story_WoundedTraveler_Heal.spec.json 의 자동화 테스트 실행** — `HktCore.Story.Spec.Story_Event_Interact_Heal.*` 가 통과하는지 확인. 실패 시 op·태그 alias 정합 수정.
2. **진입점 C (`Story_CorpseInvestigate.json`) 작성** — 진입점 양식이 일관되는지 두 번째 사례로 검증.
3. **Beat Manager 의 최소 인터페이스 설계 메모** — `Beat_RuinUpstream_01.json` 을 실제로 소비하기 위한 C++ 측 진입점. 현재는 파일 양식만 있고 소비자는 없음.
4. **Wave 1 Track C1 시작** — `Region.TranquilWilds.*` region 정의를 별도 데이터 파일로 분리. Beat 의 `anchor.region` 참조가 실제 region 데이터를 가리키도록.
