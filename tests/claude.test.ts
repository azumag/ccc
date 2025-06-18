/**
 * Tests for ClaudeCodeExecutor
 */

import { assertEquals, assertExists } from "@std/assert";
import { ClaudeCodeExecutor } from "../src/claude.ts";
import { TmuxSessionManager } from "../src/tmux.ts";
import { SimpleLogger } from "../src/logger.ts";
import type { ProjectContext } from "../src/types.ts";

// Mock logger and project context for testing
const mockLogger = new SimpleLogger("error");
const mockProjectContext: ProjectContext = {
  rootPath: "/tmp/test-project",
  projectName: "test-project",
  language: "typescript",
  framework: "deno",
  packageManager: "deno",
};

Deno.test("ClaudeCodeExecutor - checkClaudeAvailable", async () => {
  const available = await ClaudeCodeExecutor.checkClaudeAvailable();
  assertEquals(typeof available, "boolean");
});

Deno.test("ClaudeCodeExecutor - constructor", () => {
  const tmuxManager = new TmuxSessionManager("test-claude", mockLogger);
  const executor = new ClaudeCodeExecutor(tmuxManager, mockProjectContext, mockLogger);
  assertEquals(typeof executor, "object");
});

Deno.test("ClaudeCodeExecutor - formatResponseForDiscord", () => {
  const tmuxManager = new TmuxSessionManager("test-format", mockLogger);
  const executor = new ClaudeCodeExecutor(tmuxManager, mockProjectContext, mockLogger);

  // Test successful response
  const successResponse = {
    content: "console.log('Hello, World!');",
    success: true,
    executionTime: 1000,
  };

  const formatted = executor.formatResponseForDiscord(successResponse);
  assertEquals(Array.isArray(formatted), true);
  assertEquals(formatted.length, 1);
  assertEquals(formatted[0]?.includes("```"), true);
  assertEquals(formatted[0]?.includes("Hello, World!"), true);
});

Deno.test("ClaudeCodeExecutor - formatResponseForDiscord error", () => {
  const tmuxManager = new TmuxSessionManager("test-error", mockLogger);
  const executor = new ClaudeCodeExecutor(tmuxManager, mockProjectContext, mockLogger);

  // Test error response
  const errorResponse = {
    content: "",
    success: false,
    error: "Test error message",
    executionTime: 500,
  };

  const formatted = executor.formatResponseForDiscord(errorResponse);
  assertEquals(Array.isArray(formatted), true);
  assertEquals(formatted.length, 1);
  assertEquals(formatted[0]?.includes("❌"), true);
  assertEquals(formatted[0]?.includes("Test error message"), true);
});

Deno.test("ClaudeCodeExecutor - formatResponseForDiscord long content", () => {
  const tmuxManager = new TmuxSessionManager("test-long", mockLogger);
  const executor = new ClaudeCodeExecutor(tmuxManager, mockProjectContext, mockLogger);

  // Create long content that should be split
  const longContent = "x".repeat(3000); // Longer than Discord limit
  const longResponse = {
    content: longContent,
    success: true,
    executionTime: 2000,
  };

  const formatted = executor.formatResponseForDiscord(longResponse);
  assertEquals(Array.isArray(formatted), true);
  assertEquals(formatted.length > 1, true); // Should be split into multiple messages
});

// Integration test - only run if tmux and Claude are available
Deno.test({
  name: "ClaudeCodeExecutor - executePrompt integration",
  ignore: !(await TmuxSessionManager.checkTmuxAvailable() &&
    await ClaudeCodeExecutor.checkClaudeAvailable()),
  async fn() {
    const sessionName = `test-claude-${Date.now()}`;
    const tmuxManager = new TmuxSessionManager(sessionName, mockLogger);
    const tempDir = await Deno.makeTempDir();

    const testProjectContext: ProjectContext = {
      ...mockProjectContext,
      rootPath: tempDir,
    };

    const executor = new ClaudeCodeExecutor(tmuxManager, testProjectContext, mockLogger);

    try {
      // Execute a simple prompt
      const response = await executor.executePrompt("echo 'test'", "test-channel-id");

      assertEquals(typeof response.content, "string");
      assertEquals(typeof response.success, "boolean");
      assertEquals(typeof response.executionTime, "number");

      if (!response.success) {
        assertExists(response.error);
      }
    } finally {
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "ClaudeCodeExecutor - restartSession",
  ignore: !(await TmuxSessionManager.checkTmuxAvailable()),
  async fn() {
    const sessionName = `test-restart-claude-${Date.now()}`;
    const tmuxManager = new TmuxSessionManager(sessionName, mockLogger);
    const tempDir = await Deno.makeTempDir();

    const testProjectContext: ProjectContext = {
      ...mockProjectContext,
      rootPath: tempDir,
    };

    const executor = new ClaudeCodeExecutor(tmuxManager, testProjectContext, mockLogger);

    try {
      const restarted = await executor.restartSession();
      assertEquals(typeof restarted, "boolean");
    } finally {
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test("ClaudeCodeExecutor - getSessionStatus", async () => {
  const tmuxManager = new TmuxSessionManager("test-status-claude", mockLogger);
  const executor = new ClaudeCodeExecutor(tmuxManager, mockProjectContext, mockLogger);

  const status = await executor.getSessionStatus();
  assertEquals(typeof status.exists, "boolean");
  assertEquals(typeof status.uptime, "string");
});

// Test language detection in code blocks
Deno.test("ClaudeCodeExecutor - language detection", () => {
  const tmuxManager = new TmuxSessionManager("test-lang", mockLogger);
  const executor = new ClaudeCodeExecutor(tmuxManager, mockProjectContext, mockLogger);

  // Test TypeScript detection
  const tsResponse = {
    content: "import React from 'react';\nconst Component = () => <div>Hello</div>;",
    success: true,
  };
  const tsFormatted = executor.formatResponseForDiscord(tsResponse);
  assertEquals(tsFormatted[0]?.includes("```jsx"), true);

  // Test JavaScript detection
  const jsResponse = {
    content: "function hello() { console.log('world'); }",
    success: true,
  };
  const jsFormatted = executor.formatResponseForDiscord(jsResponse);
  assertEquals(jsFormatted[0]?.includes("```javascript"), true);

  // Test Python detection
  const pyResponse = {
    content: "def hello():\n    print('world')",
    success: true,
  };
  const pyFormatted = executor.formatResponseForDiscord(pyResponse);
  assertEquals(pyFormatted[0]?.includes("```python"), true);
});
