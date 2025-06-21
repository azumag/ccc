/**
 * Tests for --dangerous-permit flag functionality
 * Ensures that --dangerous-permit properly adds --dangerously-skip-permissions to Claude command
 */

import { assertEquals, assertStringIncludes } from "@std/assert";

// Mock logger for testing
class MockLogger {
  info(_message: string) {}
  debug(_message: string) {}
  warn(_message: string) {}
  error(_message: string) {}
}

// Mock BotConfig interface
interface BotConfig {
  discordToken: string;
  guildId: string;
  authorizedUserId?: string;
  channelName: string;
  tmuxSessionName: string;
  logLevel: string;
  enableUltraThink?: boolean;
  orchestratorMode?: boolean;
  useDangerouslySkipPermissions?: boolean;
  enableResume?: boolean;
  enableContinue?: boolean;
  autoCommit?: boolean;
  autoPush?: boolean;
  progressUpdate?: boolean;
  progressInterval?: string;
}

// Simplified version of SimpleTmuxManager for testing command generation
class TestTmuxManager {
  constructor(
    private sessionName: string,
    private logger: MockLogger,
    private config: BotConfig,
  ) {}

  /**
   * Extract the Claude command generation logic for testing
   */
  generateClaudeCommand(): string {
    const claudeFlags = [];

    if (this.config.useDangerouslySkipPermissions) {
      claudeFlags.push("--dangerously-skip-permissions");
    }

    if (this.config.enableResume) {
      claudeFlags.push("-r");
    }

    if (this.config.enableContinue) {
      claudeFlags.push("-c");
    }

    return `claude ${claudeFlags.join(" ")}`.trim();
  }
}

Deno.test("dangerous-permit - flag disabled", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    useDangerouslySkipPermissions: false,
  };

  const manager = new TestTmuxManager("test-session", new MockLogger(), config);
  const command = manager.generateClaudeCommand();

  assertEquals(command, "claude");
  assertEquals(command.includes("--dangerously-skip-permissions"), false);
});

Deno.test("dangerous-permit - flag enabled", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    useDangerouslySkipPermissions: true,
  };

  const manager = new TestTmuxManager("test-session", new MockLogger(), config);
  const command = manager.generateClaudeCommand();

  assertEquals(command, "claude --dangerously-skip-permissions");
  assertStringIncludes(command, "--dangerously-skip-permissions");
});

Deno.test("dangerous-permit - with other flags", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    useDangerouslySkipPermissions: true,
    enableResume: true,
    enableContinue: true,
  };

  const manager = new TestTmuxManager("test-session", new MockLogger(), config);
  const command = manager.generateClaudeCommand();

  assertEquals(command, "claude --dangerously-skip-permissions -r -c");
  assertStringIncludes(command, "--dangerously-skip-permissions");
  assertStringIncludes(command, "-r");
  assertStringIncludes(command, "-c");
});

Deno.test("dangerous-permit - only resume flag", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    useDangerouslySkipPermissions: false,
    enableResume: true,
  };

  const manager = new TestTmuxManager("test-session", new MockLogger(), config);
  const command = manager.generateClaudeCommand();

  assertEquals(command, "claude -r");
  assertEquals(command.includes("--dangerously-skip-permissions"), false);
  assertStringIncludes(command, "-r");
});

Deno.test("dangerous-permit - CLI arg parsing test", () => {
  // Simulate CLI argument parsing result for --dangerously-permit
  const args = {
    "dangerously-permit": true,
    ultrathink: false,
    resume: false,
    continue: false,
  };

  // This simulates how the config is created in cli.ts startCommand
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    useDangerouslySkipPermissions: Boolean((args as Record<string, unknown>)["dangerously-permit"]) || false,
    enableResume: args.resume || false,
    enableContinue: args.continue || false,
  };

  assertEquals(config.useDangerouslySkipPermissions, true);

  const manager = new TestTmuxManager("test-session", new MockLogger(), config);
  const command = manager.generateClaudeCommand();

  assertEquals(command, "claude --dangerously-skip-permissions");
});
