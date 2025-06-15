/**
 * Tests for TmuxSessionManager
 */

import { assertEquals } from "@std/assert";
import { TmuxSessionManager } from "../src/tmux.ts";
import { SimpleLogger } from "../src/logger.ts";

// Mock logger for testing
const mockLogger = new SimpleLogger("error"); // Suppress logs during tests

Deno.test("TmuxSessionManager - checkTmuxAvailable", async () => {
  const available = await TmuxSessionManager.checkTmuxAvailable();
  // This should be true in CI/dev environments with tmux installed
  // In environments without tmux, this would be false
  assertEquals(typeof available, "boolean");
});

Deno.test("TmuxSessionManager - constructor", () => {
  const manager = new TmuxSessionManager("test-session", mockLogger);
  assertEquals(typeof manager, "object");
});

Deno.test("TmuxSessionManager - hasSession returns boolean", async () => {
  const manager = new TmuxSessionManager("non-existent-session", mockLogger);
  const hasSession = await manager.hasSession();
  assertEquals(typeof hasSession, "boolean");
});

Deno.test("TmuxSessionManager - getSessionStatus", async () => {
  const manager = new TmuxSessionManager("test-session-status", mockLogger);
  const status = await manager.getSessionStatus();

  assertEquals(typeof status.exists, "boolean");
  assertEquals(typeof status.uptime, "string");
});

Deno.test("TmuxSessionManager - listClaudeSessions", async () => {
  const manager = new TmuxSessionManager("test-list", mockLogger);
  const sessions = await manager.listClaudeSessions();

  assertEquals(Array.isArray(sessions), true);
  // Each session should be a string
  sessions.forEach((session) => {
    assertEquals(typeof session, "string");
  });
});

Deno.test("TmuxSessionManager - updateActivity", () => {
  const manager = new TmuxSessionManager("test-activity", mockLogger);
  // Should not throw
  manager.updateActivity();
});

// Integration test - only run if tmux is available
Deno.test({
  name: "TmuxSessionManager - session lifecycle",
  ignore: !(await TmuxSessionManager.checkTmuxAvailable()),
  async fn() {
    const sessionName = `test-session-${Date.now()}`;
    const manager = new TmuxSessionManager(sessionName, mockLogger);
    const tempDir = await Deno.makeTempDir();

    try {
      // Initially should not exist
      assertEquals(await manager.hasSession(), false);

      // Create session
      const created = await manager.createSession(tempDir);
      assertEquals(created, true);

      // Should exist now
      assertEquals(await manager.hasSession(), true);

      // Kill session
      const killed = await manager.killSession();
      assertEquals(killed, true);

      // Should not exist after killing
      assertEquals(await manager.hasSession(), false);
    } finally {
      // Cleanup
      await manager.killSession().catch(() => {}); // Ignore errors
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "TmuxSessionManager - sendPrompt and captureOutput",
  ignore: !(await TmuxSessionManager.checkTmuxAvailable()),
  async fn() {
    const sessionName = `test-prompt-${Date.now()}`;
    const manager = new TmuxSessionManager(sessionName, mockLogger);
    const tempDir = await Deno.makeTempDir();

    try {
      // Create session first
      await manager.createSession(tempDir);

      // Wait a moment for session to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send a simple prompt
      const sent = await manager.sendPrompt("echo 'test message'");
      assertEquals(sent, true);

      // Wait for output
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Capture output
      const output = await manager.captureOutput();
      assertEquals(typeof output, "string");
    } finally {
      await manager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "TmuxSessionManager - restartSession",
  ignore: !(await TmuxSessionManager.checkTmuxAvailable()),
  async fn() {
    const sessionName = `test-restart-${Date.now()}`;
    const manager = new TmuxSessionManager(sessionName, mockLogger);
    const tempDir = await Deno.makeTempDir();

    try {
      // Create initial session
      await manager.createSession(tempDir);
      assertEquals(await manager.hasSession(), true);

      // Restart session
      const restarted = await manager.restartSession(tempDir);
      assertEquals(restarted, true);
      assertEquals(await manager.hasSession(), true);
    } finally {
      await manager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});
