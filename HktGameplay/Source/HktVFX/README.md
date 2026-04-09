# HktVFX 모듈 (Runtime)

## 개요

HktVFX는 **Hkt VFX Generator**의 런타임 모듈입니다.

- **FHktVFXIntent**: 프로그래머가 정의하는 VFX 의도(의미). 런타임에서 에셋 Resolve의 키로 사용.
- **UHktVFXAssetBank**: 생성된 VFX 에셋 관리 + Intent → Niagara/텍스처 런타임 Resolve.
- **UHktVFXRuntimeResolver**: 게임플레이 코드에서 사용하는 VFX 스폰 컴포넌트.
- 게임 로직 없음(읽기 전용). HktRuntime의 `IHktModelProvider`를 통해 데이터 수신.
- 클라이언트 전용(서버에서 VFX 생성되지 않음).

## 아키텍처 내 역할

```
[프로그래머] FHktVFXIntent 정의  ──►  [HktVFXEditor] 생성 파이프라인  ──►  [HktVFX] UHktVFXAssetBank 보관·Resolve
```

## 파일 구조

```
HktVFX/
├── HktVFX.Build.cs
├── Public/
│   ├── IHktVFXModule.h
│   ├── HktVFXIntent.h              # FHktVFXIntent, FHktVFXGenerationRequest
│   ├── HktVFXAssetBank.h           # UHktVFXAssetBank, FHktVFXAssetEntry (에셋 관리)
│   └── HktVFXRuntimeResolver.h     # UHktVFXRuntimeResolver (런타임 Resolve 컴포넌트)
├── Private/
│   ├── HktVFXModule.cpp
│   ├── HktVFXIntent.cpp            # FHktVFXIntent::ToNaturalLanguage() 구현
│   ├── HktVFXAssetBank.cpp         # UHktVFXAssetBank 검색 로직
│   └── HktVFXRuntimeResolver.cpp   # UHktVFXRuntimeResolver 구현
└── README.md
```

## 의존성

- Core, CoreUObject, Engine, GameplayTags, Niagara, HktCore, HktRuntime, HktAsset
