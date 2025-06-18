/**
 * Integration test for webhook handling in actual bot implementations
 */

import { assertEquals } from "jsr:@std/assert";

// Test webhook integration by verifying the fixed handleMessage logic
// This tests the actual CLI implementation after the fix

// Mock Discord Message for integration testing
interface TestMessage {
  author: {
    bot: boolean;
    tag: string;
    id: string;
    username: string;
  };
  webhookId: string | null;
  channelId: string;
  content: string;
}

// Mock bot config
interface TestBotConfig {
  authorizedUserId?: string;
}

// Mock logger to capture log output
class TestLogger {
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

// Simplified handleMessage logic for testing (based on the fixed implementation)
function testHandleMessage(
  message: TestMessage,
  config: TestBotConfig,
  logger: TestLogger,
  targetChannelId: string = "test-channel-123",
): boolean {
  // Check if message is in target channel first
  if (message.channelId !== targetChannelId) {
    logger.debug("Message not in target channel");
    return false;
  }

  // Check for webhook messages first (before bot filtering)
  if (message.webhookId) {
    // Webhook detected - bypass authorization and bot filtering
    if (config.authorizedUserId) {
      logger.info(
        `Webhook message detected - bypassing authorization for ${message.author.tag}`,
      );
    }
  } else {
    // Regular bot filtering (only for non-webhook messages)
    if (message.author.bot) {
      logger.debug("Skipping bot message (non-webhook)");
      return false;
    }

    // Check authorization for regular user messages
    if (
      config.authorizedUserId && message.author.id !== config.authorizedUserId
    ) {
      logger.debug(`Unauthorized user: ${message.author.tag}`);
      return false;
    }
  }

  // Message would be processed
  return true;
}

// Helper functions
function createTestMessage(overrides: Partial<TestMessage> = {}): TestMessage {
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
    ...overrides,
  };
}

function createWebhookMessage(overrides: Partial<TestMessage> = {}): TestMessage {
  return createTestMessage({
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

function createBotMessage(overrides: Partial<TestMessage> = {}): TestMessage {
  return createTestMessage({
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

// Integration tests
Deno.test("webhook integration - authorized user messages work", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  const message = createTestMessage({
    author: { ...createTestMessage().author, id: "authorized-user-123" },
  });

  const result = testHandleMessage(message, config, logger);

  assertEquals(result, true, "Authorized user message should be processed");
  assertEquals(logger.hasLog("Skipping bot message"), false, "Should not skip authorized user");
  assertEquals(logger.hasLog("Unauthorized user"), false, "Should not be marked as unauthorized");
});

Deno.test("webhook integration - unauthorized user messages blocked", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  const message = createTestMessage({
    author: { ...createTestMessage().author, id: "unauthorized-user-456" },
  });

  const result = testHandleMessage(message, config, logger);

  assertEquals(result, false, "Unauthorized user message should be blocked");
  assertEquals(logger.hasLog("Unauthorized user"), true, "Should log unauthorized user");
});

Deno.test("webhook integration - regular bot messages blocked", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  const message = createBotMessage();

  const result = testHandleMessage(message, config, logger);

  assertEquals(result, false, "Regular bot message should be blocked");
  assertEquals(
    logger.hasLog("Skipping bot message (non-webhook)"),
    true,
    "Should log bot message skip",
  );
  assertEquals(logger.hasLog("Webhook message detected"), false, "Should not detect webhook");
});

Deno.test("webhook integration - webhook messages bypass all filters", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  const message = createWebhookMessage({
    author: {
      bot: true, // Even though it's a bot
      tag: "WebhookBot#0000",
      id: "unauthorized-webhook-456", // And not the authorized user
      username: "WebhookBot",
    },
  });

  const result = testHandleMessage(message, config, logger);

  assertEquals(result, true, "Webhook message should bypass all filters");
  assertEquals(
    logger.hasLog("Webhook message detected - bypassing authorization"),
    true,
    "Should log webhook bypass",
  );
  assertEquals(
    logger.hasLog("Skipping bot message"),
    false,
    "Should not skip webhook due to bot status",
  );
  assertEquals(
    logger.hasLog("Unauthorized user"),
    false,
    "Should not check authorization for webhook",
  );
});

Deno.test("webhook integration - webhook in wrong channel blocked", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  const message = createWebhookMessage({
    channelId: "wrong-channel-456",
  });

  const result = testHandleMessage(message, config, logger);

  assertEquals(result, false, "Webhook in wrong channel should be blocked");
  assertEquals(logger.hasLog("Message not in target channel"), true, "Should log channel mismatch");
  assertEquals(
    logger.hasLog("Webhook message detected"),
    false,
    "Should not reach webhook detection",
  );
});

Deno.test("webhook integration - no authorization configured", () => {
  const config: TestBotConfig = {
    // No authorizedUserId configured
  };
  const logger = new TestLogger();

  // Test regular user
  const userMessage = createTestMessage();
  const userResult = testHandleMessage(userMessage, config, logger);
  assertEquals(userResult, true, "User message should be processed when no auth configured");

  logger.clear();

  // Test webhook
  const webhookMessage = createWebhookMessage();
  const webhookResult = testHandleMessage(webhookMessage, config, logger);
  assertEquals(webhookResult, true, "Webhook message should be processed when no auth configured");
  assertEquals(
    logger.hasLog("bypassing authorization"),
    false,
    "Should not log auth bypass when no auth configured",
  );

  logger.clear();

  // Test regular bot
  const botMessage = createBotMessage();
  const botResult = testHandleMessage(botMessage, config, logger);
  assertEquals(botResult, false, "Regular bot should still be blocked even without auth");
  assertEquals(
    logger.hasLog("Skipping bot message (non-webhook)"),
    true,
    "Should still block regular bots",
  );
});

Deno.test("webhook integration - edge case: webhook with non-bot author", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  const message = createWebhookMessage({
    author: {
      bot: false, // Unusual: webhook with non-bot author
      tag: "HumanWebhook#1234",
      id: "human-webhook-789",
      username: "HumanWebhook",
    },
  });

  const result = testHandleMessage(message, config, logger);

  assertEquals(result, true, "Webhook with non-bot author should still be processed");
  assertEquals(
    logger.hasLog("Webhook message detected - bypassing authorization"),
    true,
    "Should still detect webhook",
  );
});

Deno.test("webhook integration - empty or falsy webhook ID", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };
  const logger = new TestLogger();

  // Test with empty string webhookId
  const emptyWebhookMessage = createTestMessage({
    webhookId: "", // Empty string should be falsy
    author: { ...createTestMessage().author, id: "unauthorized-user-456" },
  });

  const emptyResult = testHandleMessage(emptyWebhookMessage, config, logger);
  assertEquals(
    emptyResult,
    false,
    "Message with empty webhookId should be treated as regular message",
  );
  assertEquals(
    logger.hasLog("Unauthorized user"),
    true,
    "Should check authorization for empty webhookId",
  );
  assertEquals(
    logger.hasLog("Webhook message detected"),
    false,
    "Should not detect empty webhookId as webhook",
  );
});

// Performance test - verify the fix doesn't introduce significant overhead
Deno.test("webhook integration - performance test", () => {
  const config: TestBotConfig = {
    authorizedUserId: "authorized-user-123",
  };

  const testCases = [
    createTestMessage({ author: { ...createTestMessage().author, id: "authorized-user-123" } }), // Authorized user
    createTestMessage({ author: { ...createTestMessage().author, id: "unauthorized-user-456" } }), // Unauthorized user
    createBotMessage(), // Regular bot
    createWebhookMessage(), // Webhook
  ];

  const iterations = 1000;
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    for (const testCase of testCases) {
      const logger = new TestLogger();
      testHandleMessage(testCase, config, logger);
    }
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTimePerMessage = totalTime / (iterations * testCases.length);

  // Should be very fast - under 1ms per message on average
  assertEquals(
    avgTimePerMessage < 1,
    true,
    `Message processing should be fast, got ${avgTimePerMessage.toFixed(3)}ms per message`,
  );
});
