/**
 * Tests for CLI prompt generation to prevent regression
 * Ensures that CLI flags are properly reflected in generated prompts
 */

import { assertEquals, assertStringIncludes } from "@std/assert";

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

/**
 * Extract and test the enhanced prompt generation logic
 * This replicates the logic from cli.ts processMessage method
 */
function generateEnhancedPrompt(
  prompt: string,
  config: BotConfig,
): string {
  const projectPrefix = config.orchestratorMode ? "/project:orchestrator\n\n" : "";
  const ultrathinkText = config.enableUltraThink ? "\n\nultrathink\n" : "";

  // Add auto-commit/push instructions to prompt
  let autoGitInstructions = "";
  if (config.autoCommit || config.autoPush) {
    const actions = [];
    if (config.autoCommit) {
      actions.push(
        'git add . && git commit -m "task: Auto commit on task completion\n\n🤖 Generated with [Claude Code](https://claude.ai/code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>"',
      );
    }
    if (config.autoPush) actions.push("git push");
    autoGitInstructions = `\n\n注意: タスク完了後、以下のコマンドを実行してください:\n${
      actions.join(" && ")
    }\n`;
  }

  // Add progress update instructions to prompt
  let progressInstructions = "";
  if (config.progressUpdate) {
    const interval = config.progressInterval || "1m";
    progressInstructions = `\n\n重要: 長時間タスクの場合、${interval}間隔または重要な進捗があるたびに以下のコマンドで途中経過を報告してください:
claude-discord-bot send-to-discord "進捗: [現在の作業内容と進行状況]" --session ${config.tmuxSessionName}

進捗報告の例:
- "進捗: ファイル解析完了、3/10ファイル処理済み"
- "進捗: テスト実行中、2/5スイート完了"
- "進捗: デプロイ中、ビルド完了・アップロード開始"
`;
  }

  return `${projectPrefix}${prompt}${ultrathinkText}${autoGitInstructions}${progressInstructions}

重要: 実行結果や応答を以下のコマンドでDiscordに送信してください:
claude-discord-bot send-to-discord "あなたの応答内容" --session ${config.tmuxSessionName}`;
}

Deno.test("Enhanced Prompt Generation - Base case", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "Test message");
  assertStringIncludes(result, "--session test-session");
  assertEquals(result.includes("/project:orchestrator"), false);
  assertEquals(result.includes("ultrathink"), false);
  assertEquals(result.includes("注意: タスク完了後"), false);
});

Deno.test("Enhanced Prompt Generation - ultrathink flag", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    enableUltraThink: true,
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "Test message");
  assertStringIncludes(result, "\n\nultrathink\n");
});

Deno.test("Enhanced Prompt Generation - orchestrator mode", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    orchestratorMode: true,
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "/project:orchestrator\n\n");
  assertStringIncludes(result, "Test message");
});

Deno.test("Enhanced Prompt Generation - auto-commit flag", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    autoCommit: true,
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "注意: タスク完了後、以下のコマンドを実行してください:");
  assertStringIncludes(result, "git add . && git commit");
});

Deno.test("Enhanced Prompt Generation - auto-push flag", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    autoPush: true,
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "注意: タスク完了後、以下のコマンドを実行してください:");
  assertStringIncludes(result, "git push");
});

Deno.test("Enhanced Prompt Generation - all flags combined", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    enableUltraThink: true,
    orchestratorMode: true,
    autoCommit: true,
    autoPush: true,
  };

  const prompt = "Complex test message";
  const result = generateEnhancedPrompt(prompt, config);

  // Check orchestrator prefix
  assertStringIncludes(result, "/project:orchestrator\n\n");

  // Check original prompt
  assertStringIncludes(result, "Complex test message");

  // Check ultrathink text
  assertStringIncludes(result, "\n\nultrathink\n");

  // Check auto git instructions
  assertStringIncludes(result, "注意: タスク完了後、以下のコマンドを実行してください:");
  assertStringIncludes(result, "git add . && git commit");
  assertStringIncludes(result, "git push");
});

Deno.test("Enhanced Prompt Generation - prompt order verification", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    enableUltraThink: true,
    orchestratorMode: true,
    autoCommit: true,
  };

  const prompt = "Order test";
  const result = generateEnhancedPrompt(prompt, config);

  // Verify the order: orchestrator prefix, then prompt, then ultrathink, then git instructions, then command
  const orchestratorIndex = result.indexOf("/project:orchestrator");
  const promptIndex = result.indexOf("Order test");
  const ultrathinkIndex = result.indexOf("ultrathink");
  const gitInstructionsIndex = result.indexOf("注意: タスク完了後");
  const commandIndex = result.indexOf("claude-discord-bot send-to-discord");

  assertEquals(
    orchestratorIndex < promptIndex,
    true,
    "Orchestrator prefix should come before prompt",
  );
  assertEquals(promptIndex < ultrathinkIndex, true, "Prompt should come before ultrathink");
  assertEquals(
    ultrathinkIndex < gitInstructionsIndex,
    true,
    "Ultrathink should come before git instructions",
  );
  assertEquals(
    gitInstructionsIndex < commandIndex,
    true,
    "Git instructions should come before command",
  );
});

Deno.test("Enhanced Prompt Generation - session name escaping", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "special-session-name_123",
    logLevel: "info",
  };

  const prompt = "Session test";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "--session special-session-name_123");
});

Deno.test("Enhanced Prompt Generation - progress-update flag", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    progressUpdate: true,
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "重要: 長時間タスクの場合、1m間隔または重要な進捗があるたびに");
  assertStringIncludes(result, "進捗: [現在の作業内容と進行状況]");
  assertStringIncludes(result, "進捗報告の例:");
  assertStringIncludes(result, "- \"進捗: ファイル解析完了、3/10ファイル処理済み\"");
});

Deno.test("Enhanced Prompt Generation - progress-update with custom interval", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    progressUpdate: true,
    progressInterval: "30s",
  };

  const prompt = "Test message";
  const result = generateEnhancedPrompt(prompt, config);

  assertStringIncludes(result, "重要: 長時間タスクの場合、30s間隔または重要な進捗があるたびに");
  assertStringIncludes(result, "--session test-session");
});

Deno.test("Enhanced Prompt Generation - all flags including progress", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    enableUltraThink: true,
    orchestratorMode: true,
    autoCommit: true,
    autoPush: true,
    progressUpdate: true,
    progressInterval: "2m",
  };

  const prompt = "Complete test message";
  const result = generateEnhancedPrompt(prompt, config);

  // Check all components are present
  assertStringIncludes(result, "/project:orchestrator\n\n");
  assertStringIncludes(result, "Complete test message");
  assertStringIncludes(result, "\n\nultrathink\n");
  assertStringIncludes(result, "注意: タスク完了後、以下のコマンドを実行してください:");
  assertStringIncludes(result, "git add . && git commit");
  assertStringIncludes(result, "git push");
  assertStringIncludes(result, "重要: 長時間タスクの場合、2m間隔または重要な進捗があるたびに");
  assertStringIncludes(result, "進捗報告の例:");
});

Deno.test("Enhanced Prompt Generation - progress order verification", () => {
  const config: BotConfig = {
    discordToken: "test-token",
    guildId: "test-guild",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "info",
    enableUltraThink: true,
    orchestratorMode: true,
    autoCommit: true,
    progressUpdate: true,
  };

  const prompt = "Order test with progress";
  const result = generateEnhancedPrompt(prompt, config);

  // Verify the order: orchestrator prefix, prompt, ultrathink, git instructions, progress instructions, command
  const orchestratorIndex = result.indexOf("/project:orchestrator");
  const promptIndex = result.indexOf("Order test with progress");
  const ultrathinkIndex = result.indexOf("ultrathink");
  const gitInstructionsIndex = result.indexOf("注意: タスク完了後");
  const progressInstructionsIndex = result.indexOf("重要: 長時間タスクの場合");
  const commandIndex = result.indexOf("claude-discord-bot send-to-discord");

  assertEquals(orchestratorIndex < promptIndex, true, "Orchestrator prefix should come before prompt");
  assertEquals(promptIndex < ultrathinkIndex, true, "Prompt should come before ultrathink");
  assertEquals(ultrathinkIndex < gitInstructionsIndex, true, "Ultrathink should come before git instructions");
  assertEquals(gitInstructionsIndex < progressInstructionsIndex, true, "Git instructions should come before progress instructions");
  assertEquals(progressInstructionsIndex < commandIndex, true, "Progress instructions should come before command");
});
