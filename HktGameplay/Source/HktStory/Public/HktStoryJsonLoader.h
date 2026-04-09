// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

struct FHktStoryParseResult;

/**
 * FHktStoryJsonLoader — Content/Stories 디렉토리에서 JSON Story 파일을 로드하여 등록
 *
 * HktStory 모듈 시작 시 호출되어 JSON 기반 Story 정의를 자동으로 파싱하고
 * FHktStoryJsonParser를 통해 빌드 + 레지스트리 등록한다.
 *
 * 파일 규칙:
 *   - Content/Stories/*.json
 *   - 각 파일은 하나의 Story 정의를 포함
 *   - storyTag 필드가 필수
 */
class HKTSTORY_API FHktStoryJsonLoader
{
public:
	/**
	 * Content/Stories 디렉토리의 모든 JSON 파일을 로드하여 Story를 빌드 + 등록.
	 * 실패한 파일은 로그에 에러를 출력하고 건너뛴다.
	 *
	 * @return 성공적으로 로드된 Story 수
	 */
	static int32 LoadAllFromContentDirectory();

	/**
	 * 지정된 디렉토리의 모든 JSON 파일을 로드하여 Story를 빌드 + 등록.
	 *
	 * @param DirectoryPath JSON 파일이 있는 디렉토리 절대 경로
	 * @return 성공적으로 로드된 Story 수
	 */
	static int32 LoadAllFromDirectory(const FString& DirectoryPath);

	/**
	 * 단일 JSON 파일을 로드하여 Story를 빌드 + 등록.
	 *
	 * @param FilePath JSON 파일 절대 경로
	 * @return 파싱 결과
	 */
	static FHktStoryParseResult LoadFromFile(const FString& FilePath);

	/**
	 * JSON 문자열에서 직접 Story를 빌드 + 등록.
	 *
	 * @param JsonStr JSON 문자열
	 * @return 파싱 결과
	 */
	static FHktStoryParseResult LoadFromString(const FString& JsonStr);
};
