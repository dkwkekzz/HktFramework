// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceSettings.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"

FString UHktWorkspaceSettings::ResolveWorkspaceRoot()
{
	const UHktWorkspaceSettings* Settings = GetDefault<UHktWorkspaceSettings>();
	const FString Configured = Settings ? Settings->WorkspaceRoot.Path : FString();
	if (!Configured.IsEmpty())
	{
		return FPaths::ConvertRelativePathToFull(Configured);
	}

	const FString Default = FPaths::ProjectSavedDir() / TEXT("Workspace");
	return FPaths::ConvertRelativePathToFull(Default);
}
