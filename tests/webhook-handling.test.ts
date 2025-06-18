/**
 * Test webhook message handling functionality
 */

import { assertEquals } from "jsr:@std/assert";

// Mock Discord Message interface
interface MockMessage {
  author: {
    bot: boolean;
    tag: string;
    id: string;
    username: string;
  };
  webhookId: string | null;
  channelId: string;
  content: string;
  reply: (content: string) => Promise<void>;
  react: (emoji: string) => Promise<void>;
}

// Mock bot config for testing
interface MockBotConfig {
  authorizedUserId?: string;
  channelName: string;
  tmuxSessionName: string;
  logLevel: string;
}

// Mock logger for testing
class MockLogger {
  public logs: { level: string; message: string }[] = [];

  info(message: string) {
    this.logs.push({ level: "info", message });
  }

  debug(message: string) {
    this.logs.push({ level: "debug", message });
  }

  warn(message: string) {
    this.logs.push({ level: "warn", message });
  }

  error(message: string) {
    this.logs.push({ level: "error", message });
  }

  clear() {
    this.logs = [];
  }
}

// Simplified webhook handler for testing
class MockWebhookHandler {
  private logger: MockLogger;
  private config: MockBotConfig;
  private targetChannelId: string = "test-channel-123";
  public processedMessages: MockMessage[] = [];

  constructor(config: MockBotConfig) {
    this.config = config;
    this.logger = new MockLogger();
  }

  // Current implementation (with the bug)
  handleMessageCurrentImplementation(message: MockMessage): boolean {
    this.logger.debug(
      `Processing message from ${message.author.tag}, bot: ${message.author.bot}, webhook: ${
        message.webhookId ? "yes" : "no"
      }`,
    );

    // Current bug: Bot filtering happens first
    if (message.author.bot) {
      this.logger.debug("Skipping bot message");
      return false;
    }

    // Check if message is in target channel
    if (message.channelId !== this.targetChannelId) {
      this.logger.debug("Message not in target channel");
      return false;
    }

    // Check authorization (with webhook bypass that never gets reached)
    if (
      this.config.authorizedUserId &&
      message.author.id !== this.config.authorizedUserId &&
      !message.webhookId
    ) {
      this.logger.debug(`Unauthorized user: ${message.author.tag}`);
      return false;
    }

    // Log webhook authorization bypass (never reached for webhooks)
    if (message.webhookId && this.config.authorizedUserId) {
      this.logger.info(
        `Webhook message detected - bypassing authorization for ${message.author.tag}`,
      );
    }

    this.processedMessages.push(message);
    return true;
  }

  // Fixed implementation
  handleMessageFixed(message: MockMessage): boolean {
    this.logger.debug(
      `Processing message from ${message.author.tag}, bot: ${message.author.bot}, webhook: ${
        message.webhookId ? "yes" : "no"
      }`,
    );

    // Check if message is in target channel first
    if (message.channelId !== this.targetChannelId) {
      this.logger.debug("Message not in target channel");
      return false;
    }

    // Check for webhook first, then bot filtering
    if (message.webhookId) {
      // Webhook detected - bypass authorization and bot filtering
      if (this.config.authorizedUserId) {
        this.logger.info(
          `Webhook message detected - bypassing authorization for ${message.author.tag}`,
        );
      }
      this.processedMessages.push(message);
      return true;
    }

    // Regular bot filtering (only for non-webhook messages)
    if (message.author.bot) {
      this.logger.debug("Skipping bot message (non-webhook)");
      return false;
    }

    // Check authorization for regular user messages
    if (
      this.config.authorizedUserId &&
      message.author.id !== this.config.authorizedUserId
    ) {
      this.logger.debug(`Unauthorized user: ${message.author.tag}`);
      return false;
    }

    this.processedMessages.push(message);
    return true;
  }

  getLogger(): MockLogger {
    return this.logger;
  }

  reset() {
    this.processedMessages = [];
    this.logger.clear();
  }
}

// Test helper functions
function createMockMessage(overrides: Partial<MockMessage> = {}): MockMessage {
  return {
    author: {
      bot: false,
      tag: "TestUser#1234",
      id: "user-123",
      username: "TestUser",
    },
    webhookId: null,
    channelId: "test-channel-123",
    content: "Test message",
    reply: async (_content: string) => {},
    react: async (_emoji: string) => {},
    ...overrides,
  };
}

function createWebhookMessage(overrides: Partial<MockMessage> = {}): MockMessage {
  return createMockMessage({
    author: {
      bot: true, // Webhooks are typically marked as bots
      tag: "WebhookBot#0000",
      id: "webhook-bot-456",
      username: "WebhookBot",
    },
    webhookId: "webhook-123",
    ...overrides,
  });
}

function createBotMessage(overrides: Partial<MockMessage> = {}): MockMessage {
  return createMockMessage({
    author: {
      bot: true,
      tag: "RegularBot#0000",
      id: "regular-bot-789",
      username: "RegularBot",
    },
    webhookId: null,
    ...overrides,
  });
}

// Tests for current implementation (demonstrating the bug)
Deno.test("webhook handling - current implementation bug", () => {
  const config: MockBotConfig = {
    authorizedUserId: "authorized-user-123",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "debug",
  };

  const handler = new MockWebhookHandler(config);

  // Test 1: Regular user message should be processed
  const userMessage = createMockMessage({
    author: { ...createMockMessage().author, id: "authorized-user-123" },
  });

  const userResult = handler.handleMessageCurrentImplementation(userMessage);
  assertEquals(userResult, true);
  assertEquals(handler.processedMessages.length, 1);

  handler.reset();

  // Test 2: Regular bot message should be filtered out
  const botMessage = createBotMessage();

  const botResult = handler.handleMessageCurrentImplementation(botMessage);
  assertEquals(botResult, false);
  assertEquals(handler.processedMessages.length, 0);

  handler.reset();

  // Test 3: Webhook message should be processed BUT FAILS due to bug
  const webhookMessage = createWebhookMessage();

  const webhookResult = handler.handleMessageCurrentImplementation(webhookMessage);
  assertEquals(
    webhookResult,
    false,
    "BUG: Webhook message should be processed but is filtered out",
  );
  assertEquals(handler.processedMessages.length, 0, "BUG: Webhook message was not processed");

  // Verify the webhook never reached authorization bypass logic
  const logs = handler.getLogger().logs;
  const webhookBypassLog = logs.find((log) => log.message.includes("Webhook message detected"));
  assertEquals(webhookBypassLog, undefined, "Webhook authorization bypass was never reached");
});

// Tests for fixed implementation
Deno.test("webhook handling - fixed implementation", () => {
  const config: MockBotConfig = {
    authorizedUserId: "authorized-user-123",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "debug",
  };

  const handler = new MockWebhookHandler(config);

  // Test 1: Regular authorized user message should be processed
  const userMessage = createMockMessage({
    author: { ...createMockMessage().author, id: "authorized-user-123" },
  });

  const userResult = handler.handleMessageFixed(userMessage);
  assertEquals(userResult, true);
  assertEquals(handler.processedMessages.length, 1);

  handler.reset();

  // Test 2: Unauthorized user message should be filtered out
  const unauthorizedMessage = createMockMessage({
    author: { ...createMockMessage().author, id: "unauthorized-user-456" },
  });

  const unauthorizedResult = handler.handleMessageFixed(unauthorizedMessage);
  assertEquals(unauthorizedResult, false);
  assertEquals(handler.processedMessages.length, 0);

  handler.reset();

  // Test 3: Regular bot message should be filtered out
  const botMessage = createBotMessage();

  const botResult = handler.handleMessageFixed(botMessage);
  assertEquals(botResult, false);
  assertEquals(handler.processedMessages.length, 0);

  handler.reset();

  // Test 4: Webhook message should be processed (FIXED)
  const webhookMessage = createWebhookMessage();

  const webhookResult = handler.handleMessageFixed(webhookMessage);
  assertEquals(webhookResult, true, "FIXED: Webhook message should be processed");
  assertEquals(handler.processedMessages.length, 1, "FIXED: Webhook message was processed");

  // Verify the webhook reached authorization bypass logic
  const logs = handler.getLogger().logs;
  const webhookBypassLog = logs.find((log) => log.message.includes("Webhook message detected"));
  assertEquals(webhookBypassLog !== undefined, true, "Webhook authorization bypass was reached");

  handler.reset();

  // Test 5: Webhook from wrong channel should be filtered out
  const wrongChannelWebhook = createWebhookMessage({
    channelId: "wrong-channel-456",
  });

  const wrongChannelResult = handler.handleMessageFixed(wrongChannelWebhook);
  assertEquals(wrongChannelResult, false);
  assertEquals(handler.processedMessages.length, 0);
});

// Test without authorization configured
Deno.test("webhook handling - no authorization configured", () => {
  const config: MockBotConfig = {
    // No authorizedUserId configured
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "debug",
  };

  const handler = new MockWebhookHandler(config);

  // Test 1: Any user message should be processed
  const userMessage = createMockMessage();

  const userResult = handler.handleMessageFixed(userMessage);
  assertEquals(userResult, true);
  assertEquals(handler.processedMessages.length, 1);

  handler.reset();

  // Test 2: Webhook message should be processed
  const webhookMessage = createWebhookMessage();

  const webhookResult = handler.handleMessageFixed(webhookMessage);
  assertEquals(webhookResult, true);
  assertEquals(handler.processedMessages.length, 1);

  // Should not log authorization bypass when no auth is configured
  const logs = handler.getLogger().logs;
  const webhookBypassLog = logs.find((log) => log.message.includes("bypassing authorization"));
  assertEquals(webhookBypassLog, undefined, "No authorization bypass log when auth not configured");
});

// Test edge cases
Deno.test("webhook handling - edge cases", () => {
  const config: MockBotConfig = {
    authorizedUserId: "authorized-user-123",
    channelName: "test-channel",
    tmuxSessionName: "test-session",
    logLevel: "debug",
  };

  const handler = new MockWebhookHandler(config);

  // Test 1: Webhook with non-bot author (unusual but possible)
  const nonBotWebhook = createWebhookMessage({
    author: {
      bot: false, // Unusual case
      tag: "NonBotWebhook#1234",
      id: "non-bot-webhook-789",
      username: "NonBotWebhook",
    },
  });

  const nonBotResult = handler.handleMessageFixed(nonBotWebhook);
  assertEquals(nonBotResult, true, "Webhook with non-bot author should still be processed");
  assertEquals(handler.processedMessages.length, 1);

  handler.reset();

  // Test 2: Empty webhook ID should be treated as regular message
  const emptyWebhookId = createMockMessage({
    webhookId: "", // Empty string instead of null
    author: { ...createMockMessage().author, id: "authorized-user-123" },
  });

  const emptyWebhookResult = handler.handleMessageFixed(emptyWebhookId);
  assertEquals(
    emptyWebhookResult,
    true,
    "Message with empty webhookId should be processed as regular message",
  );

  handler.reset();

  // Test 3: Null webhookId should be treated as regular message
  const nullWebhookId = createMockMessage({
    webhookId: null,
    author: { ...createMockMessage().author, id: "unauthorized-user-456" },
  });

  const nullWebhookResult = handler.handleMessageFixed(nullWebhookId);
  assertEquals(
    nullWebhookResult,
    false,
    "Unauthorized user with null webhookId should be filtered out",
  );
});
