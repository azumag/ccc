/**
 * Integration tests for the Claude Discord Bot
 * These tests require external dependencies (tmux, claude) to be available
 */

import { assertEquals, assertExists } from "@std/assert";
import { TmuxSessionManager } from "../src/tmux.ts";
import { ClaudeCodeExecutor } from "../src/claude.ts";
import { SimpleLogger } from "../src/logger.ts";
import { detectProjectContext } from "../src/utils.ts";
// Integration tests for external dependencies

const logger = new SimpleLogger("error"); // Suppress logs during tests

// Check if required external dependencies are available
const hasTmux = await TmuxSessionManager.checkTmuxAvailable();
const hasClaude = await ClaudeCodeExecutor.checkClaudeAvailable();

Deno.test({
  name: "Integration - TmuxSessionManager with ClaudeCodeExecutor",
  ignore: !hasTmux,
  async fn() {
    const sessionName = `integration-test-${Date.now()}`;
    const tempDir = await Deno.makeTempDir();

    try {
      // Create a test project context
      const projectContext = await detectProjectContext(tempDir);

      // Initialize managers
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      const claudeExecutor = new ClaudeCodeExecutor(tmuxManager, projectContext, logger);

      // Test session creation
      const sessionCreated = await tmuxManager.createSession(tempDir);
      assertEquals(sessionCreated, true);

      // Test session exists
      const sessionExists = await tmuxManager.hasSession();
      assertEquals(sessionExists, true);

      // Test session status
      const status = await claudeExecutor.getSessionStatus();
      assertEquals(status.exists, true);
      assertEquals(typeof status.uptime, "string");

      // Test sending simple command
      const promptSent = await tmuxManager.sendPrompt("echo 'integration test'");
      assertEquals(promptSent, true);

      // Wait a moment and capture output
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const output = await tmuxManager.captureOutput();
      assertEquals(typeof output, "string");

      // Test restart functionality
      const restarted = await claudeExecutor.restartSession();
      assertEquals(restarted, true);

      // Verify session still exists after restart
      const existsAfterRestart = await tmuxManager.hasSession();
      assertEquals(existsAfterRestart, true);
    } finally {
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "Integration - Full Claude Code execution flow",
  ignore: !(hasTmux && hasClaude),
  async fn() {
    const sessionName = `claude-integration-${Date.now()}`;
    const tempDir = await Deno.makeTempDir();

    try {
      // Create test project structure
      await Deno.writeTextFile(
        `${tempDir}/package.json`,
        JSON.stringify({ name: "integration-test" }, null, 2),
      );

      const projectContext = await detectProjectContext(tempDir);
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      const claudeExecutor = new ClaudeCodeExecutor(tmuxManager, projectContext, logger);

      // Execute a simple prompt that should work
      const response = await claudeExecutor.executePrompt(
        "echo 'Hello from Claude'",
        "test-channel-id",
      );

      assertExists(response);
      assertEquals(typeof response.success, "boolean");
      assertEquals(typeof response.content, "string");
      assertEquals(typeof response.executionTime, "number");

      // If the command failed, check that error is provided
      if (!response.success) {
        assertExists(response.error);
        assertEquals(typeof response.error, "string");
      }

      // Test response formatting
      const formatted = claudeExecutor.formatResponseForDiscord(response);
      assertEquals(Array.isArray(formatted), true);
      assertEquals(formatted.length > 0, true);

      for (const msg of formatted) {
        assertEquals(typeof msg, "string");
        assertEquals(msg.length > 0, true);
      }
    } finally {
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "Integration - Multiple sequential commands",
  ignore: !hasTmux,
  async fn() {
    const sessionName = `sequential-test-${Date.now()}`;
    const tempDir = await Deno.makeTempDir();

    try {
      const _projectContext = await detectProjectContext(tempDir);
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      const _claudeExecutor = new ClaudeCodeExecutor(tmuxManager, _projectContext, logger);

      // Create session
      await tmuxManager.createSession(tempDir);

      // Send multiple commands in sequence
      const commands = [
        "echo 'first command'",
        "echo 'second command'",
        "pwd",
      ];

      for (const command of commands) {
        const sent = await tmuxManager.sendPrompt(command);
        assertEquals(sent, true);

        // Wait between commands
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Capture final output
      const output = await tmuxManager.captureOutput();
      assertEquals(typeof output, "string");

      // Output should contain evidence of our commands
      // Note: Exact content depends on tmux behavior and timing
      assertEquals(output.length > 0, true);
    } finally {
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "Integration - Session recovery after kill",
  ignore: !hasTmux,
  async fn() {
    const sessionName = `recovery-test-${Date.now()}`;
    const tempDir = await Deno.makeTempDir();

    try {
      const _projectContext = await detectProjectContext(tempDir);
      const tmuxManager = new TmuxSessionManager(sessionName, logger);

      // Create session
      await tmuxManager.createSession(tempDir);
      assertEquals(await tmuxManager.hasSession(), true);

      // Kill session
      await tmuxManager.killSession();
      assertEquals(await tmuxManager.hasSession(), false);

      // Restart session
      const restarted = await tmuxManager.restartSession(tempDir);
      assertEquals(restarted, true);
      assertEquals(await tmuxManager.hasSession(), true);
    } finally {
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});

Deno.test({
  name: "Integration - Project context detection with real files",
  async fn() {
    const tempDir = await Deno.makeTempDir();

    try {
      // Create various project files
      await Deno.writeTextFile(
        `${tempDir}/package.json`,
        JSON.stringify(
          {
            name: "integration-project",
            dependencies: { react: "^18.0.0", typescript: "^4.9.0" },
          },
          null,
          2,
        ),
      );

      await Deno.writeTextFile(
        `${tempDir}/tsconfig.json`,
        JSON.stringify({ compilerOptions: { strict: true } }, null, 2),
      );

      // Initialize git repo (if git is available)
      try {
        const gitInit = new Deno.Command("git", {
          args: ["init"],
          cwd: tempDir,
          stdout: "piped",
          stderr: "piped",
        });
        await gitInit.output();

        // Add remote (fake URL for testing)
        const gitRemote = new Deno.Command("git", {
          args: ["remote", "add", "origin", "https://github.com/test/repo.git"],
          cwd: tempDir,
          stdout: "piped",
          stderr: "piped",
        });
        await gitRemote.output();
      } catch {
        // Git not available, skip git tests
      }

      const context = await detectProjectContext(tempDir);

      assertEquals(context.projectName, "integration-project");
      assertEquals(context.language, "typescript");
      assertEquals(context.framework, "React");
      assertEquals(context.packageManager, "npm");
      assertEquals(context.rootPath, tempDir);

      // Git repo URL might be detected if git is available
      if (context.gitRepo) {
        assertEquals(typeof context.gitRepo, "string");
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "Integration - Error handling and recovery",
  ignore: !hasTmux,
  async fn() {
    const sessionName = `error-test-${Date.now()}`;
    const tempDir = await Deno.makeTempDir();

    try {
      const _projectContext = await detectProjectContext(tempDir);
      const tmuxManager = new TmuxSessionManager(sessionName, logger);

      // Test creating session with invalid directory
      const invalidPath = "/non/existent/path";
      const created = await tmuxManager.createSession(invalidPath);

      // Depending on tmux behavior, this might succeed or fail
      assertEquals(typeof created, "boolean");

      // If session was created, verify it exists
      if (created) {
        assertEquals(await tmuxManager.hasSession(), true);
      }

      // Test sending command to potentially non-existent session
      const sent = await tmuxManager.sendPrompt("echo 'test'");
      assertEquals(typeof sent, "boolean");

      // Test capturing output from potentially problematic session
      const output = await tmuxManager.captureOutput();
      assertEquals(typeof output, "string");
    } finally {
      const tmuxManager = new TmuxSessionManager(sessionName, logger);
      await tmuxManager.killSession().catch(() => {});
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  },
});
