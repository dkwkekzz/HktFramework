// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktStoryValidator.h"
#include "HktStoryRegistry.h"
#include "VM/HktVMProgram.h"

// 외부 테스트 함수 선언
namespace HktOpcodeTests
{
	FHktTestReport RunControlFlowTests();
	FHktTestReport RunDataTests();
	FHktTestReport RunEntityTests();
	FHktTestReport RunCompositeTests();
}

namespace HktStoryIntegrityTests
{
	FHktTestReport RunAllIntegrityTests();
}

namespace HktStoryScenarioTests
{
	FHktTestReport RunAllScenarioTests();
}

namespace HktStoryJsonParserTests
{
	FHktTestReport RunAllJsonParserTests();
}

namespace HktAutomationTestsRunner
{
	static FHktTestReport LastReport;

	static void PrintReport(const FHktTestReport& Report)
	{
		UE_LOG(LogHktAutomationTests, Log, TEXT(""));
		UE_LOG(LogHktAutomationTests, Log, TEXT("============================================"));
		UE_LOG(LogHktAutomationTests, Log, TEXT("  HktAutomationTests Report: %d/%d PASSED"),
			Report.PassCount(), Report.TotalCount());
		UE_LOG(LogHktAutomationTests, Log, TEXT("============================================"));

		for (const FHktTestResult& R : Report.Results)
		{
			if (R.bPassed)
			{
				UE_LOG(LogHktAutomationTests, Log, TEXT("  [PASS] %s"), *R.TestName);
			}
			else
			{
				UE_LOG(LogHktAutomationTests, Error, TEXT("  [FAIL] %s — %s"), *R.TestName, *R.Message);
			}
		}

		UE_LOG(LogHktAutomationTests, Log, TEXT("============================================"));
		if (Report.AllPassed())
		{
			UE_LOG(LogHktAutomationTests, Log, TEXT("  ALL TESTS PASSED"));
		}
		else
		{
			UE_LOG(LogHktAutomationTests, Error, TEXT("  %d TESTS FAILED"), Report.FailCount());
		}
		UE_LOG(LogHktAutomationTests, Log, TEXT("============================================"));
	}

	void RunOpcodeTests()
	{
		UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Running Opcode tests..."));

		FHktTestReport Report;
		Report.Append(HktOpcodeTests::RunControlFlowTests());
		Report.Append(HktOpcodeTests::RunDataTests());
		Report.Append(HktOpcodeTests::RunEntityTests());
		Report.Append(HktOpcodeTests::RunCompositeTests());

		LastReport = Report;
		PrintReport(Report);
	}

	void RunStoryTests()
	{
		UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Running Story tests (integrity + scenarios + JSON parser)..."));

		FHktTestReport Report;
		Report.Append(HktStoryIntegrityTests::RunAllIntegrityTests());
		Report.Append(HktStoryScenarioTests::RunAllScenarioTests());
		Report.Append(HktStoryJsonParserTests::RunAllJsonParserTests());

		LastReport = Report;
		PrintReport(Report);
	}

	void RunJsonParserTests()
	{
		UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Running JSON Parser tests..."));

		FHktTestReport Report = HktStoryJsonParserTests::RunAllJsonParserTests();

		LastReport = Report;
		PrintReport(Report);
	}

	void RunScenarioTests()
	{
		UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Running Story scenario tests..."));

		FHktTestReport Report = HktStoryScenarioTests::RunAllScenarioTests();

		LastReport = Report;
		PrintReport(Report);
	}

	void RunAllTests()
	{
		UE_LOG(LogHktAutomationTests, Log, TEXT("[HktAutomationTests] Running ALL tests..."));

		FHktTestReport Report;
		Report.Append(HktOpcodeTests::RunControlFlowTests());
		Report.Append(HktOpcodeTests::RunDataTests());
		Report.Append(HktOpcodeTests::RunEntityTests());
		Report.Append(HktOpcodeTests::RunCompositeTests());
		Report.Append(HktStoryIntegrityTests::RunAllIntegrityTests());
		Report.Append(HktStoryScenarioTests::RunAllScenarioTests());
		Report.Append(HktStoryJsonParserTests::RunAllJsonParserTests());

		LastReport = Report;
		PrintReport(Report);
	}

	void PrintLastReport()
	{
		if (LastReport.TotalCount() == 0)
		{
			UE_LOG(LogHktAutomationTests, Warning, TEXT("No test results. Run hkt.automation.run first."));
			return;
		}
		PrintReport(LastReport);
	}
}
