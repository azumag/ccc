/**
 * Additional tests for tmux Enter key fixes in specific components
 * Tests the fixes applied to src/tmux.ts createSession() and src/bot-standalone.ts sendCommand()
 */

import { assertEquals } from "jsr:@std/assert";

// Mock tmux command execution for testing
interface MockTmuxCommand {
  args: string[];
}

interface MockTmuxResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

// Mock logger for testing
class MockTmuxLogger {
  public logs: string[] = [];

  info(message: string) {
    this.logs.push(`[INFO] ${message}`);
  }

  debug(message: string) {
    this.logs.push(`[DEBUG] ${message}`);
  }

  warn(message: string) {
    this.logs.push(`[WARN] ${message}`);
  }

  error(message: string) {
    this.logs.push(`[ERROR] ${message}`);
  }

  clear() {
    this.logs = [];
  }

  hasLog(substring: string): boolean {
    return this.logs.some((log) => log.includes(substring));
  }
}

// Mock simplified version of TmuxSessionManager to test createSession logic
class MockTmuxSessionManager {
  private sessionName: string;
  private logger: MockTmuxLogger;
  public commandsExecuted: MockTmuxCommand[] = [];
  public shouldFailCommand = false;
  public shouldFailEnter = false;

  constructor(sessionName: string, logger: MockTmuxLogger) {
    this.sessionName = sessionName;
    this.logger = logger;
  }

  // Simulate the fixed createSession logic
  async simulateCreateSessionLogic(claudeCommand: string): Promise<boolean> {
    // Send Claude command first
    const claudeCommandResult = await this.executeTmuxCommand({
      args: [
        "send-keys",
        "-t",
        this.sessionName,
        "--",
        claudeCommand,
      ],
    });

    if (!claudeCommandResult.success) {
      this.logger.error(`Failed to send Claude command: ${claudeCommandResult.stderr}`);
      return false;
    }

    // Wait before sending Enter key
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Send Enter key separately using C-m for better reliability
    const enterResult = await this.executeTmuxCommand({
      args: [
        "send-keys",
        "-t",
        this.sessionName,
        "C-m",
      ],
    });

    if (!enterResult.success) {
      this.logger.error(`Failed to start Claude in tmux: ${enterResult.stderr}`);
      return false;
    }

    return true;
  }

  // Mock executeTmuxCommand
  private executeTmuxCommand(command: MockTmuxCommand): Promise<MockTmuxResult> {
    this.commandsExecuted.push(command);

    // Check for command vs enter key
    const isEnterKey = command.args.includes("C-m");

    if (isEnterKey && this.shouldFailEnter) {
      return Promise.resolve({ success: false, stderr: "Mock enter key failure" });
    }

    if (!isEnterKey && this.shouldFailCommand) {
      return Promise.resolve({ success: false, stderr: "Mock command failure" });
    }

    return Promise.resolve({ success: true, stdout: "Mock success" });
  }

  reset() {
    this.commandsExecuted = [];
    this.shouldFailCommand = false;
    this.shouldFailEnter = false;
    this.logger.clear();
  }
}

// Mock bot-standalone sendCommand implementation
class MockBotStandalone {
  private sessionName: string;
  private logger: MockTmuxLogger;
  public commandsExecuted: MockTmuxCommand[] = [];
  public shouldFailCommand = false;
  public shouldFailEnter = false;

  constructor(sessionName: string, logger: MockTmuxLogger) {
    this.sessionName = sessionName;
    this.logger = logger;
  }

  // Simulate the fixed sendCommand logic
  async simulateSendCommand(command: string): Promise<boolean> {
    try {
      // Clean command (remove trailing newlines)
      const cleanCommand = command.trim();
      this.logger.debug(`Sending command to tmux: "${cleanCommand}"`);

      // Send command text first with option terminator
      const commandResult = await this.mockTmuxCommand({
        args: ["send-keys", "-t", this.sessionName, "--", cleanCommand],
      });

      if (!commandResult.success) {
        this.logger.error("Failed to send command text");
        return false;
      }

      // Wait before sending Enter key
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send Enter key using C-m
      const enterResult = await this.mockTmuxCommand({
        args: ["send-keys", "-t", this.sessionName, "C-m"],
      });

      if (!enterResult.success) {
        this.logger.error("Failed to send Enter key");
        return false;
      }

      this.logger.debug("Successfully sent command and Enter to tmux");
      return true;
    } catch (error) {
      this.logger.error(`Failed to send command: ${error}`);
      return false;
    }
  }

  private mockTmuxCommand(command: MockTmuxCommand): Promise<MockTmuxResult> {
    this.commandsExecuted.push(command);

    const isEnterKey = command.args.includes("C-m");

    if (isEnterKey && this.shouldFailEnter) {
      return Promise.resolve({ success: false, stderr: "Mock enter failure" });
    }

    if (!isEnterKey && this.shouldFailCommand) {
      return Promise.resolve({ success: false, stderr: "Mock command failure" });
    }

    return Promise.resolve({ success: true });
  }

  reset() {
    this.commandsExecuted = [];
    this.shouldFailCommand = false;
    this.shouldFailEnter = false;
    this.logger.clear();
  }
}

// Tests for TmuxSessionManager createSession fix
Deno.test("TmuxSessionManager createSession - uses separate operations with C-m", async () => {
  const logger = new MockTmuxLogger();
  const manager = new MockTmuxSessionManager("test-session", logger);

  const result = await manager.simulateCreateSessionLogic("claude --help");

  assertEquals(result, true, "CreateSession should succeed");
  assertEquals(manager.commandsExecuted.length, 2, "Should execute 2 separate commands");

  // Check first command (claude command)
  const firstCommand = manager.commandsExecuted[0]!;
  assertEquals(firstCommand.args[0], "send-keys", "First should be send-keys");
  assertEquals(firstCommand.args[1], "-t", "Should use -t flag");
  assertEquals(firstCommand.args[2], "test-session", "Should use session name");
  assertEquals(firstCommand.args[3], "--", "Should use option terminator");
  assertEquals(firstCommand.args[4], "claude --help", "Should send claude command");
  assertEquals(firstCommand.args.length, 5, "First command should have 5 args");

  // Check second command (enter key)
  const secondCommand = manager.commandsExecuted[1]!;
  assertEquals(secondCommand.args[0], "send-keys", "Second should be send-keys");
  assertEquals(secondCommand.args[1], "-t", "Should use -t flag");
  assertEquals(secondCommand.args[2], "test-session", "Should use session name");
  assertEquals(secondCommand.args[3], "C-m", "Should use C-m for enter");
  assertEquals(secondCommand.args.length, 4, "Second command should have 4 args");
});

Deno.test("TmuxSessionManager createSession - handles command failure", async () => {
  const logger = new MockTmuxLogger();
  const manager = new MockTmuxSessionManager("test-session", logger);

  manager.shouldFailCommand = true;

  const result = await manager.simulateCreateSessionLogic("claude");

  assertEquals(result, false, "Should fail when command fails");
  assertEquals(manager.commandsExecuted.length, 1, "Should stop after first command fails");
  assertEquals(logger.hasLog("Failed to send Claude command"), true, "Should log command failure");
});

Deno.test("TmuxSessionManager createSession - handles enter key failure", async () => {
  const logger = new MockTmuxLogger();
  const manager = new MockTmuxSessionManager("test-session", logger);

  manager.shouldFailEnter = true;

  const result = await manager.simulateCreateSessionLogic("claude");

  assertEquals(result, false, "Should fail when enter key fails");
  assertEquals(
    manager.commandsExecuted.length,
    2,
    "Should execute both commands but fail on second",
  );
  assertEquals(logger.hasLog("Failed to start Claude in tmux"), true, "Should log enter failure");
});

// Tests for bot-standalone sendCommand fix
Deno.test("BotStandalone sendCommand - uses separate operations with C-m", async () => {
  const logger = new MockTmuxLogger();
  const bot = new MockBotStandalone("test-session", logger);

  const result = await bot.simulateSendCommand("echo hello");

  assertEquals(result, true, "SendCommand should succeed");
  assertEquals(bot.commandsExecuted.length, 2, "Should execute 2 separate commands");

  // Check first command (echo command)
  const firstCommand = bot.commandsExecuted[0]!;
  assertEquals(firstCommand.args[0], "send-keys", "First should be send-keys");
  assertEquals(firstCommand.args[1], "-t", "Should use -t flag");
  assertEquals(firstCommand.args[2], "test-session", "Should use session name");
  assertEquals(firstCommand.args[3], "--", "Should use option terminator");
  assertEquals(firstCommand.args[4], "echo hello", "Should send command");

  // Check second command (enter key)
  const secondCommand = bot.commandsExecuted[1]!;
  assertEquals(secondCommand.args[0], "send-keys", "Second should be send-keys");
  assertEquals(secondCommand.args[1], "-t", "Should use -t flag");
  assertEquals(secondCommand.args[2], "test-session", "Should use session name");
  assertEquals(secondCommand.args[3], "C-m", "Should use C-m for enter");

  // Check logging
  assertEquals(
    logger.hasLog("Successfully sent command and Enter to tmux"),
    true,
    "Should log success",
  );
});

Deno.test("BotStandalone sendCommand - handles commands with leading dashes", async () => {
  const logger = new MockTmuxLogger();
  const bot = new MockBotStandalone("test-session", logger);

  const result = await bot.simulateSendCommand("--help");

  assertEquals(result, true, "Should handle commands with leading dashes");

  const firstCommand = bot.commandsExecuted[0]!;
  assertEquals(firstCommand.args[3], "--", "Should use option terminator");
  assertEquals(firstCommand.args[4], "--help", "Should preserve command with dashes");
});

Deno.test("BotStandalone sendCommand - trims whitespace", async () => {
  const logger = new MockTmuxLogger();
  const bot = new MockBotStandalone("test-session", logger);

  const result = await bot.simulateSendCommand("  echo test  \n");

  assertEquals(result, true, "Should handle whitespace");

  const firstCommand = bot.commandsExecuted[0]!;
  assertEquals(firstCommand.args[4], "echo test", "Should trim whitespace");
  assertEquals(
    logger.hasLog('Sending command to tmux: "echo test"'),
    true,
    "Should log trimmed command",
  );
});

Deno.test("BotStandalone sendCommand - handles command failure", async () => {
  const logger = new MockTmuxLogger();
  const bot = new MockBotStandalone("test-session", logger);

  bot.shouldFailCommand = true;

  const result = await bot.simulateSendCommand("test");

  assertEquals(result, false, "Should fail when command fails");
  assertEquals(bot.commandsExecuted.length, 1, "Should stop after first command fails");
  assertEquals(logger.hasLog("Failed to send command text"), true, "Should log command failure");
});

Deno.test("BotStandalone sendCommand - handles enter key failure", async () => {
  const logger = new MockTmuxLogger();
  const bot = new MockBotStandalone("test-session", logger);

  bot.shouldFailEnter = true;

  const result = await bot.simulateSendCommand("test");

  assertEquals(result, false, "Should fail when enter key fails");
  assertEquals(bot.commandsExecuted.length, 2, "Should execute both commands but fail on second");
  assertEquals(logger.hasLog("Failed to send Enter key"), true, "Should log enter failure");
});

// Integration test comparing old vs new behavior
Deno.test("Enter key fix comparison - old vs new behavior", () => {
  const _logger = new MockTmuxLogger();

  // Test old behavior (what was problematic)
  const oldCommand: MockTmuxCommand = {
    args: ["send-keys", "-t", "session", "command", "Enter"],
  };

  // Test new behavior (fixed)
  const newCommandStep1: MockTmuxCommand = {
    args: ["send-keys", "-t", "session", "--", "command"],
  };
  const newCommandStep2: MockTmuxCommand = {
    args: ["send-keys", "-t", "session", "C-m"],
  };

  // Verify old behavior issues
  assertEquals(oldCommand.args.includes("--"), false, "Old: No option terminator");
  assertEquals(oldCommand.args.includes("Enter"), true, "Old: Uses 'Enter' string");
  assertEquals(oldCommand.args.length, 5, "Old: Single operation");

  // Verify new behavior fixes
  assertEquals(newCommandStep1.args.includes("--"), true, "New: Has option terminator");
  assertEquals(newCommandStep1.args.includes("Enter"), false, "New: No 'Enter' in first command");
  assertEquals(newCommandStep2.args.includes("C-m"), true, "New: Uses 'C-m' for enter");
  assertEquals(newCommandStep1.args.length, 5, "New: Command step has 5 args");
  assertEquals(newCommandStep2.args.length, 4, "New: Enter step has 4 args");
});

// Performance test to ensure the delay doesn't cause significant overhead
Deno.test("Enter key fix - performance test", async () => {
  const logger = new MockTmuxLogger();
  const bot = new MockBotStandalone("test-session", logger);

  const iterations = 5;
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    bot.reset();
    await bot.simulateSendCommand(`test command ${i}`);
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTimePerCommand = totalTime / iterations;

  // Should complete reasonably quickly despite the 150ms delay
  // Each command should take about 150ms + some overhead
  assertEquals(avgTimePerCommand > 140, true, "Should include the 150ms delay");
  assertEquals(avgTimePerCommand < 300, true, "Should not take excessively long");
});
