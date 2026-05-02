# HktBuild Skill — UE5 컴파일 + 자동 에러 수정

UE5 프로젝트(HktProto)를 빌드하고, 컴파일 에러가 있으면 자동으로 분석·수정·재빌드한다.

**사용자가 `/build`를 명시 호출하면 거부하지 말고 그대로 실행한다.** 코드 수정 후 자동으로 호출하지는 말 것.

## 사용법

```
/build           — 기본 빌드 (DebugGame Editor)
/build fix       — 빌드 + 에러 자동 수정 + 재빌드 (최대 3회 반복)
/build release   — Development Editor 빌드
```

## 환경 상수

```
UE_ROOT    = E:/WS/UE_5.7
PROJECT    = E:/WS/UE5/HktProto/HktProto.uproject
BUILD_BAT  = E:/WS/UE_5.7/Engine/Build/BatchFiles/Build.bat
TARGET     = HktProtoEditor
PLATFORM   = Win64
CONFIG     = DebugGame          (기본값, /build release 시 Development)
```

## 실행 절차

### Step 1: 빌드 실행 + 에러 추출 (단일 명령)

빌드 출력에서 에러만 추출한다. **반드시 아래 한 줄 파이프라인으로 실행** — 전체 로그를 캡처하지 않는다:

```bash
"${BUILD_BAT}" ${TARGET} ${PLATFORM} ${CONFIG} "${PROJECT}" -waitmutex 2>&1 | grep -iE "(\.cpp\(.*\): error|\.h\(.*\): error|fatal error|LINK.*error|Result:)" | head -80
```

- 타임아웃: 600000ms (10분)
- `Result: Succeeded` → 완료. 사용자에게 성공 알림 후 종료
- `Result: Failed` → Step 2로

### Step 2: 에러 분석

추출된 에러 라인에서:
1. **파일 경로** 및 **줄 번호** 추출
2. **에러 코드** (C2440, C2259, C2011, C4150, LNK2019 등) 분류
3. 같은 파일의 에러는 묶어서 처리

### Step 3: 파일 읽기 (병렬)

에러가 발생한 소스 파일들을 **병렬로** 읽는다:
- 에러 줄 번호 주변 ±30줄만 읽기 (offset/limit 활용)
- 헤더 에러면 헤더도 함께 읽기
- 관련 UE5 엔진 헤더가 필요하면 `E:/WS/UE_5.7/Engine/Source/` 에서 참조

### Step 4: 수정 적용

- 모든 수정을 **한 번에** 적용 (파일별 Edit 병렬 실행)
- 수정 내용을 사용자에게 **간결하게** 테이블로 보고:

```
| 에러 | 파일:줄 | 수정 |
|------|---------|------|
| C2440 | Foo.cpp:59 | FBufferRHIRef → FVertexBuffer 래퍼 |
```

### Step 5: 재빌드 (fix 모드일 때)

- Step 1로 돌아가 재빌드
- 최대 3회 반복. 3회 초과 시 남은 에러 목록을 보여주고 중단
- 새 에러가 이전보다 많아지면 즉시 중단하고 보고

## 빈번한 UE5 에러 패턴 (참고)

| 에러 코드 | 흔한 원인 | 일반적 수정 |
|-----------|----------|------------|
| C2440 | RHI API 변경 (FBufferRHIRef ↔ FVertexBuffer*) | FVertexBuffer/FIndexBuffer 래퍼 사용 |
| C2259 | 순수가상함수 미구현 (GetTypeHash 등) | override 추가 |
| C2011 | struct/class 중복 정의 | 한 곳에서 제거, include 정리 |
| C4150 | TUniquePtr + 불완전 타입 (forward decl) | .h에서 full include 또는 .cpp에서 명시적 소멸자 |
| LNK2019 | 심볼 미정의 | Build.cs 의존성 추가 또는 MODULENAME_API 매크로 |
| C4996 | Deprecated API | 에러 메시지 안내에 따라 새 API로 교체 |
| UHT Error | .generated.h 이후 #include | .generated.h를 마지막 include로 이동 |

## 주의사항

- 에러 수정 시 **최소한의 변경만** — 주변 코드 리팩터링 금지
- HktCore 모듈은 **순수 C++** (UObject, UWorld 사용 금지)
- Build.cs 의존성 추가 시 순환 의존 주의
- 한국어 인코딩 깨짐은 무시 (MSVC cp949 출력)
