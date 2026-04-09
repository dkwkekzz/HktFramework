// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"
#include "HktAutomationTestsLog.h"

DEFINE_LOG_CATEGORY(LogHktAutomationTests);

// Forward declarations
namespace HktAutomationTestsRunner
{
	void RunAllTests();
	void RunOpcodeTests();
	void RunStoryTests();
	void RunScenarioTests();
	void RunJsonParserTests();
	void PrintLastReport();
}

/**
 * HktAutomationTests 모듈 — 자동 테스트 환경
 */
class FHktAutomationTestsModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

private:
	TArray<IConsoleObject*> ConsoleCommands;
};

IMPLEMENT_MODULE(FHktAutomationTestsModule, HktAutomationTests)

void FHktAutomationTestsModule::StartupModule()
{
	UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Module starting up"));

	ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
		TEXT("hkt.automation.run"),
		TEXT("Run all HktAutomationTests tests (Opcode + Story Integrity)"),
		FConsoleCommandDelegate::CreateLambda([]()
		{
			HktAutomationTestsRunner::RunAllTests();
		}),
		ECVF_Default));

	ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
		TEXT("hkt.automation.opcodes"),
		TEXT("Run Opcode validation tests only"),
		FConsoleCommandDelegate::CreateLambda([]()
		{
			HktAutomationTestsRunner::RunOpcodeTests();
		}),
		ECVF_Default));

	ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
		TEXT("hkt.automation.stories"),
		TEXT("Run Story integrity tests only"),
		FConsoleCommandDelegate::CreateLambda([]()
		{
			HktAutomationTestsRunner::RunStoryTests();
		}),
		ECVF_Default));

	ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
		TEXT("hkt.automation.scenarios"),
		TEXT("Run Story scenario (execution) tests only"),
		FConsoleCommandDelegate::CreateLambda([]()
		{
			HktAutomationTestsRunner::RunScenarioTests();
		}),
		ECVF_Default));

	ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
		TEXT("hkt.automation.jsonparser"),
		TEXT("Run JSON Parser tests only"),
		FConsoleCommandDelegate::CreateLambda([]()
		{
			HktAutomationTestsRunner::RunJsonParserTests();
		}),
		ECVF_Default));

	ConsoleCommands.Add(IConsoleManager::Get().RegisterConsoleCommand(
		TEXT("hkt.automation.report"),
		TEXT("Print the last validation report"),
		FConsoleCommandDelegate::CreateLambda([]()
		{
			HktAutomationTestsRunner::PrintLastReport();
		}),
		ECVF_Default));
}

void FHktAutomationTestsModule::ShutdownModule()
{
	for (IConsoleObject* Cmd : ConsoleCommands)
	{
		IConsoleManager::Get().UnregisterConsoleObject(Cmd);
	}
	ConsoleCommands.Empty();

	UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Module shut down"));
}
