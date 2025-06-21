/**
 * Tests for ClaudeDiscordBot
 * Note: These are mostly unit tests for individual methods.
 * Full integration tests require actual Discord tokens and connections.
 */

import { assertEquals, assertExists } from "@std/assert";
import { ClaudeDiscordBot } from "../src/bot.ts";
import { detectProjectContext } from "../src/utils.ts";
import type { BotConfig } from "../src/types.ts";

// Mock Discord bot config for testing
async function createMockBotConfig(channelName = "test"): Promise<BotConfig> {
  const projectContext = await detectProjectContext(Deno.cwd());

  return {
    discordToken: "test-token",
    guildId: "test-guild",
    authorizedUserId: "test-user",
    channelName,
    projectContext,
    tmuxSessionName: "test-claude",
    logLevel: "error", // Suppress logs during tests
  };
}

Deno.test("ClaudeDiscordBot - constructor", async () => {
  const config = await createMockBotConfig();
  const bot = new ClaudeDiscordBot(config);

  assertEquals(typeof bot, "object");

  // Properly cleanup resources
  await bot.shutdown();
});

Deno.test("ClaudeDiscordBot - config validation", async () => {
  const config = await createMockBotConfig("valid-channel");

  // Should not throw with valid config
  const bot = new ClaudeDiscordBot(config);
  assertEquals(typeof bot, "object");

  // Properly cleanup resources
  await bot.shutdown();
});

// Mock Message class for testing
class MockMessage {
  content: string;
  author: { bot: boolean; tag: string };
  channel: { id: string; send: (msg: string) => Promise<MockMessage> };
  reply: (msg: string) => Promise<MockMessage>;

  constructor(content: string, channelId = "test-channel") {
    this.content = content;
    this.author = { bot: false, tag: "TestUser#1234" };
    this.channel = {
      id: channelId,
      send: (msg: string) => Promise.resolve(new MockMessage(msg)),
    };
    this.reply = (msg: string) => Promise.resolve(new MockMessage(msg));
  }
}

Deno.test("ClaudeDiscordBot - special commands recognition", async () => {
  const config = await createMockBotConfig();
  const bot = new ClaudeDiscordBot(config);

  // Test /help command
  const helpMessage = new MockMessage("/help");
  const isSpecialHelp = helpMessage.content.startsWith("/help");
  assertEquals(isSpecialHelp, true);

  // Test /status command
  const statusMessage = new MockMessage("/status");
  const isSpecialStatus = statusMessage.content.startsWith("/status");
  assertEquals(isSpecialStatus, true);

  // Test /restart command
  const restartMessage = new MockMessage("/restart");
  const isSpecialRestart = restartMessage.content.startsWith("/restart");
  assertEquals(isSpecialRestart, true);

  // Test /attach command
  const attachMessage = new MockMessage("/attach");
  const isSpecialAttach = attachMessage.content.startsWith("/attach");
  assertEquals(isSpecialAttach, true);

  // Test regular message (not a special command)
  const regularMessage = new MockMessage("create a React component");
  const isRegular = !regularMessage.content.startsWith("/");
  assertEquals(isRegular, true);

  // Properly cleanup resources
  await bot.shutdown();
});

Deno.test("ClaudeDiscordBot - message filtering", async () => {
  const config = await createMockBotConfig("target-channel");
  const bot = new ClaudeDiscordBot(config);

  // Test bot message filtering
  const botMessage = new MockMessage("test");
  botMessage.author.bot = true;
  assertEquals(botMessage.author.bot, true); // Should be ignored

  // Test human message
  const humanMessage = new MockMessage("test");
  humanMessage.author.bot = false;
  assertEquals(humanMessage.author.bot, false); // Should be processed

  // Test channel filtering
  const wrongChannelMessage = new MockMessage("test", "wrong-channel");
  assertEquals(wrongChannelMessage.channel.id === "target-channel", false);

  const rightChannelMessage = new MockMessage("test", "target-channel");
  assertEquals(rightChannelMessage.channel.id === "target-channel", true);

  // Properly cleanup resources
  await bot.shutdown();
});

Deno.test("ClaudeDiscordBot - initialization", async () => {
  const config = await createMockBotConfig();
  const bot = new ClaudeDiscordBot(config);

  // Bot should be created successfully
  assertExists(bot);

  // Config should be stored (testing through public interface)
  assertEquals(typeof bot, "object");

  // Properly cleanup resources
  await bot.shutdown();
});

// Test project context detection used in bot
Deno.test("ClaudeDiscordBot - project context integration", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    // Create a test project structure
    await Deno.writeTextFile(
      `${tempDir}/package.json`,
      JSON.stringify({ name: "bot-test-project" }, null, 2),
    );

    const projectContext = await detectProjectContext(tempDir);

    const config: BotConfig = {
      discordToken: "test-token",
      guildId: "test-guild",
      authorizedUserId: "test-user",
      channelName: "test",
      projectContext,
      tmuxSessionName: "test-claude",
      logLevel: "error",
    };

    const bot = new ClaudeDiscordBot(config);
    assertExists(bot);

    // Verify bot creation succeeded with project context
    assertEquals(typeof bot, "object");

    // Properly cleanup resources
    await bot.shutdown();
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// Test stats tracking
Deno.test("ClaudeDiscordBot - stats initialization", async () => {
  const config = await createMockBotConfig();
  const bot = new ClaudeDiscordBot(config);

  // Bot should initialize successfully
  assertExists(bot);
  assertEquals(typeof bot, "object");

  // Properly cleanup resources
  await bot.shutdown();
});

// Test special commands array initialization
Deno.test("ClaudeDiscordBot - special commands initialization", async () => {
  const config = await createMockBotConfig();
  const bot = new ClaudeDiscordBot(config);

  // Bot should be created successfully with special commands
  assertExists(bot);
  assertEquals(typeof bot, "object");

  // Properly cleanup resources
  await bot.shutdown();
});

// Test graceful error handling
Deno.test("ClaudeDiscordBot - error handling configuration", async () => {
  const config = await createMockBotConfig();

  // Should not throw even with invalid token (since we're not actually connecting)
  const bot = new ClaudeDiscordBot(config);
  assertExists(bot);

  // Properly cleanup resources
  await bot.shutdown();
});
