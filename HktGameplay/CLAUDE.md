# CLAUDE.md

## Project Overview

3d rts adventure dynamic mmorpg's module 
[adventure: item attribute and combination, random growth]
[dynamic: realtime build adventure configurance by mcp server]

## Architecture

## Important Constraints

1. **No UE5 runtime in HktCore** — keep the VM pure C++ (no UObject, UWorld, etc.)
2. **Server-authoritative** — clients cannot manipulate what they see; server filters all data

## Coding Convention
1. Prefix FHkt

## Debug: HKT Event Log

런타임 디버깅을 위한 이벤트 로그 시스템. `HKT_EVENT_LOG` 매크로로 기록된 로그를 링 버퍼(8192개)에 보관하고, 파일로 덤프하여 분석할 수 있다.

- **로그 파일**: `Saved/Logs/HktEventLog.log`
- **콘솔 명령**: `hkt.EventLog.Start` / `hkt.EventLog.Stop` / `hkt.EventLog.Dump` / `hkt.EventLog.Clear`
- **AI 디버깅 스킬**: `/debug-logs <증상>` — 로그 파일을 읽고 원인 분석