@echo off
rem HktAdvProtoC - 플레이 국면 진입 (기획서 §3 모듈 7: 구운 패키지를 그대로 불러와 플레이)
rem 실제 로직은 run.bat 하나가 갖는다 - 여기는 모드 인자만 넘긴다.
call "%~dp0run.bat" play
