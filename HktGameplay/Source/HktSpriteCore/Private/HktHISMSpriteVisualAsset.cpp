// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktHISMSpriteVisualAsset.h"

// UPROPERTY 직렬화만으로 충분 — 본 .cpp 는 UHT-generated StaticClass/registration
// 심볼을 HktSpriteCore DLL 에 포함시키기 위한 anchor 파일이다. 헤더만 두면
// 다른 모듈(예: HktSpriteGenerator)에서 NewObject<>/StaticClass 호출 시
// LNK2019 가 발생한다.
