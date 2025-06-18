/**
 * Tests for tmux Enter key sending functionality
 * Verifies that Enter key is properly sent after sending commands to tmux
 */

import { assertEquals, assertStringIncludes } from "@std/assert";

// Mock logger for testing
class MockLogger {
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

  clearLogs() {
    this.logs = [];
  }
}

// Test SimpleTmuxManager equivalent for CLI usage
class TestTmuxManager {
  public commandsExecuted: string[][] = [];
  public shouldFailSendKeys = false;
  public shouldFailEnter = false;

  constructor(
    private sessionName: string,
    private logger: MockLogger,
  ) {}

  async sendCommand(command: string): Promise<boolean> {
    try {
      // Clean command (remove trailing newlines)
      const cleanCommand = command.trim();
      this.logger.debug(`Sending command to tmux: "${cleanCommand}"`);

      // Record the send-keys command
      const sendKeysArgs = ["send-keys", "-t", this.sessionName, cleanCommand];
      this.commandsExecuted.push(sendKeysArgs);

      if (this.shouldFailSendKeys) {
        this.logger.error("Failed to send command text");
        return false;
      }

      // Small delay before sending Enter
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Record the Enter command
      const enterArgs = ["send-keys", "-t", this.sessionName, "Enter"];
      this.commandsExecuted.push(enterArgs);

      if (this.shouldFailEnter) {
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

  clearCommands() {
    this.commandsExecuted = [];
  }
}

// Enhanced version with fixes
class ImprovedTmuxManager {
  public commandsExecuted: string[][] = [];
  public shouldFailSendKeys = false;
  public shouldFailEnter = false;

  constructor(
    private sessionName: string,
    private logger: MockLogger,
  ) {}

  async sendCommand(command: string): Promise<boolean> {
    try {
      // Clean command (remove trailing newlines)
      const cleanCommand = command.trim();
      this.logger.debug(`Sending command to tmux: "${cleanCommand}"`);

      // Record the send-keys command with -- option terminator
      const sendKeysArgs = ["send-keys", "-t", this.sessionName, "--", cleanCommand];
      this.commandsExecuted.push(sendKeysArgs);

      if (this.shouldFailSendKeys) {
        this.logger.error("Failed to send command text");
        return false;
      }

      // Longer delay before sending Enter
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Record the Enter command using C-m instead of Enter
      const enterArgs = ["send-keys", "-t", this.sessionName, "C-m"];
      this.commandsExecuted.push(enterArgs);

      if (this.shouldFailEnter) {
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

  clearCommands() {
    this.commandsExecuted = [];
  }
}

Deno.test("TmuxManager - Enter key is sent after command", async () => {
  const logger = new MockLogger();
  const manager = new TestTmuxManager("test-session", logger);

  const result = await manager.sendCommand("echo test");

  assertEquals(result, true);
  assertEquals(manager.commandsExecuted.length, 2);

  // First command should be the actual message
  assertEquals(manager.commandsExecuted[0], ["send-keys", "-t", "test-session", "echo test"]);

  // Second command should be Enter
  assertEquals(manager.commandsExecuted[1], ["send-keys", "-t", "test-session", "Enter"]);

  // Check logs
  assertStringIncludes(logger.logs.join(" "), "Successfully sent command and Enter");
});

Deno.test("TmuxManager - handles commands starting with dash", async () => {
  const logger = new MockLogger();
  const manager = new TestTmuxManager("test-session", logger);

  const result = await manager.sendCommand("--help");

  assertEquals(result, true);
  assertEquals(manager.commandsExecuted.length, 2);

  // This test shows the potential issue - tmux might interpret --help as an option
  // The command is sent without proper protection
  assertEquals(manager.commandsExecuted[0], ["send-keys", "-t", "test-session", "--help"]);
  assertEquals(manager.commandsExecuted[1], ["send-keys", "-t", "test-session", "Enter"]);
});

Deno.test("TmuxManager - Enter key sending failure", async () => {
  const logger = new MockLogger();
  const manager = new TestTmuxManager("test-session", logger);
  manager.shouldFailEnter = true;

  const result = await manager.sendCommand("test command");

  assertEquals(result, false);
  assertEquals(manager.commandsExecuted.length, 2);

  // Command was sent but Enter failed
  assertEquals(manager.commandsExecuted[0], ["send-keys", "-t", "test-session", "test command"]);
  assertEquals(manager.commandsExecuted[1], ["send-keys", "-t", "test-session", "Enter"]);

  // Check error log
  assertStringIncludes(logger.logs.join(" "), "Failed to send Enter key");
});

Deno.test("TmuxManager - Command text sending failure", async () => {
  const logger = new MockLogger();
  const manager = new TestTmuxManager("test-session", logger);
  manager.shouldFailSendKeys = true;

  const result = await manager.sendCommand("test command");

  assertEquals(result, false);
  assertEquals(manager.commandsExecuted.length, 1);

  // Only the failed command was attempted
  assertEquals(manager.commandsExecuted[0], ["send-keys", "-t", "test-session", "test command"]);

  // Check error log
  assertStringIncludes(logger.logs.join(" "), "Failed to send command text");
});

Deno.test("TmuxManager - Empty command handling", async () => {
  const logger = new MockLogger();
  const manager = new TestTmuxManager("test-session", logger);

  const result = await manager.sendCommand("   \n\n   ");

  assertEquals(result, true);
  assertEquals(manager.commandsExecuted.length, 2);

  // Command should be trimmed to empty string
  assertEquals(manager.commandsExecuted[0], ["send-keys", "-t", "test-session", ""]);
  assertEquals(manager.commandsExecuted[1], ["send-keys", "-t", "test-session", "Enter"]);
});

Deno.test("ImprovedTmuxManager - uses option terminator and C-m", async () => {
  const logger = new MockLogger();
  const manager = new ImprovedTmuxManager("test-session", logger);

  const result = await manager.sendCommand("--help");

  assertEquals(result, true);
  assertEquals(manager.commandsExecuted.length, 2);

  // Command should include -- option terminator
  assertEquals(manager.commandsExecuted[0], ["send-keys", "-t", "test-session", "--", "--help"]);

  // Enter should use C-m instead of Enter
  assertEquals(manager.commandsExecuted[1], ["send-keys", "-t", "test-session", "C-m"]);

  assertStringIncludes(logger.logs.join(" "), "Successfully sent command and Enter");
});

Deno.test("ImprovedTmuxManager - handles complex prompts", async () => {
  const logger = new MockLogger();
  const manager = new ImprovedTmuxManager("test-session", logger);

  const complexPrompt = "echo 'complex prompt with --flags and $VARIABLES'";
  const result = await manager.sendCommand(complexPrompt);

  assertEquals(result, true);
  assertEquals(manager.commandsExecuted.length, 2);

  // Command should include -- option terminator
  assertEquals(manager.commandsExecuted[0], [
    "send-keys",
    "-t",
    "test-session",
    "--",
    complexPrompt,
  ]);

  // Enter should use C-m
  assertEquals(manager.commandsExecuted[1], ["send-keys", "-t", "test-session", "C-m"]);
});
