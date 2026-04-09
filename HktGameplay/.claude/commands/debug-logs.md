# HKT Event Log 디버깅

런타임에서 HKT_EVENT_LOG 매크로로 기록된 이벤트 로그를 읽고 분석합니다.

## 로그 파일 위치

이벤트 로그 덤프 파일은 프로젝트의 `Saved/Logs/HktEventLog.log` 에 저장됩니다.
사용자가 에디터에서 콘솔 명령 `hkt.EventLog.Dump` 를 실행하면 현재 버퍼의 로그가 해당 파일에 출력됩니다.

## 지시사항

1. `Saved/Logs/HktEventLog.log` 파일을 읽습니다.
2. 로그 포맷: `[Frame:NNNNNN] [Category] Message | Entity:ID | Tag:EventTag`
3. 사용자의 질문이나 버그 리포트에 맞는 로그 항목을 필터링하여 분석합니다.
4. 로그 카테고리 계층:
   - `HktLog.Core` — Core 시스템 (Entity, VM, Story)
   - `HktLog.Runtime` — 런타임 (Server, Client, Intent)
   - `HktLog.Presentation` — 프레젠테이션 레이어
   - `HktLog.Asset` — 에셋 로딩
   - `HktLog.Rule` — 게임 룰
   - `HktLog.Story` — 스토리 시스템
   - `HktLog.UI` — UI
   - `HktLog.VFX` — VFX
5. 원인 분석 시 관련 소스 코드의 HKT_EVENT_LOG 호출 위치도 함께 확인합니다.

## 사용 가능한 콘솔 명령

- `hkt.EventLog.Start` — 로그 수집 시작 (패널 없이 독립 수집)
- `hkt.EventLog.Stop` — 로그 수집 중지
- `hkt.EventLog.Dump` — 현재 버퍼를 파일로 출력
- `hkt.EventLog.Clear` — 로그 버퍼 초기화

## 분석 절차

$ARGUMENTS 에 제시된 증상이나 문제를 기반으로:

1. 로그 파일에서 관련 프레임 범위와 카테고리를 식별합니다.
2. 에러 패턴, 비정상 시퀀스, 누락된 이벤트를 찾습니다.
3. 해당 로그를 남긴 소스 코드 위치 (HKT_EVENT_LOG 호출부)를 추적합니다.
4. 근본 원인과 수정 방안을 제시합니다.
