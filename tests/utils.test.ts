/**
 * Tests for utility functions
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  detectProjectContext,
  formatBytes,
  formatDuration,
  parseArgs,
  validateEnvironment,
} from "../src/utils.ts";

Deno.test("parseArgs - basic parsing", () => {
  const args = ["--channel", "test-channel", "--log-level", "debug"];
  const parsed = parseArgs(args);

  assertEquals(parsed.channelName, "test-channel");
  assertEquals(parsed.logLevel, "debug");
});

Deno.test("parseArgs - short flags", () => {
  const args = ["-c", "my-channel", "-h"];
  const parsed = parseArgs(args);

  assertEquals(parsed.channelName, "my-channel");
  assertEquals(parsed.help, true);
});

Deno.test("parseArgs - version flag", () => {
  const args = ["--version"];
  const parsed = parseArgs(args);

  assertEquals(parsed.version, true);
});

Deno.test("parseArgs - empty args", () => {
  const args: string[] = [];
  const parsed = parseArgs(args);

  assertEquals(parsed.channelName, undefined);
  assertEquals(parsed.help, undefined);
  assertEquals(parsed.version, undefined);
});

Deno.test("validateEnvironment - missing variables", () => {
  // Save original env vars
  const originalToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const originalGuild = Deno.env.get("GUILD_ID");
  const originalUser = Deno.env.get("AUTHORIZED_USER_ID");

  try {
    // Clear env vars for test
    Deno.env.delete("DISCORD_BOT_TOKEN");
    Deno.env.delete("GUILD_ID");
    Deno.env.delete("AUTHORIZED_USER_ID");

    const validation = validateEnvironment();
    assertEquals(validation.valid, false);
    assertEquals(validation.missing.length, 3);
    assertEquals(validation.missing.includes("DISCORD_BOT_TOKEN"), true);
    assertEquals(validation.missing.includes("GUILD_ID"), true);
    assertEquals(validation.missing.includes("AUTHORIZED_USER_ID"), true);
  } finally {
    // Restore original env vars
    if (originalToken) Deno.env.set("DISCORD_BOT_TOKEN", originalToken);
    if (originalGuild) Deno.env.set("GUILD_ID", originalGuild);
    if (originalUser) Deno.env.set("AUTHORIZED_USER_ID", originalUser);
  }
});

Deno.test("validateEnvironment - all present", () => {
  // Set required env vars
  Deno.env.set("DISCORD_BOT_TOKEN", "test-token");
  Deno.env.set("GUILD_ID", "test-guild");
  Deno.env.set("AUTHORIZED_USER_ID", "test-user");

  const validation = validateEnvironment();
  assertEquals(validation.valid, true);
  assertEquals(validation.missing.length, 0);

  // Cleanup
  Deno.env.delete("DISCORD_BOT_TOKEN");
  Deno.env.delete("GUILD_ID");
  Deno.env.delete("AUTHORIZED_USER_ID");
});

Deno.test("formatBytes", () => {
  assertEquals(formatBytes(0), "0 B");
  assertEquals(formatBytes(1024), "1 KB");
  assertEquals(formatBytes(1048576), "1 MB");
  assertEquals(formatBytes(1073741824), "1 GB");
  assertEquals(formatBytes(512), "512 B");
  assertEquals(formatBytes(1536), "1.5 KB");
});

Deno.test("formatDuration", () => {
  assertEquals(formatDuration(500), "500ms");
  assertEquals(formatDuration(1500), "1.5s");
  assertEquals(formatDuration(65000), "1.1m");
  assertEquals(formatDuration(3665000), "1.0h");
});

Deno.test("detectProjectContext - current directory", async () => {
  const context = await detectProjectContext(Deno.cwd());

  assertExists(context.rootPath);
  assertExists(context.projectName);
  assertExists(context.language);
  assertEquals(typeof context.rootPath, "string");
  assertEquals(typeof context.projectName, "string");
  assertEquals(typeof context.language, "string");
});

Deno.test("detectProjectContext - with package.json", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    // Create a mock package.json
    const packageJson = {
      name: "test-project",
      dependencies: {
        react: "^18.0.0",
      },
    };

    await Deno.writeTextFile(
      `${tempDir}/package.json`,
      JSON.stringify(packageJson, null, 2),
    );

    const context = await detectProjectContext(tempDir);

    assertEquals(context.projectName, "test-project");
    assertEquals(context.language, "typescript");
    assertEquals(context.framework, "React");
    assertEquals(context.packageManager, "npm");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("detectProjectContext - with Cargo.toml", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const cargoToml = `[package]
name = "rust-project"
version = "0.1.0"
edition = "2021"`;

    await Deno.writeTextFile(`${tempDir}/Cargo.toml`, cargoToml);

    const context = await detectProjectContext(tempDir);

    assertEquals(context.projectName, "rust-project");
    assertEquals(context.language, "rust");
    assertEquals(context.packageManager, "cargo");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("detectProjectContext - with deno.json", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const denoJson = {
      name: "deno-project",
      exports: "./mod.ts",
    };

    await Deno.writeTextFile(
      `${tempDir}/deno.json`,
      JSON.stringify(denoJson, null, 2),
    );

    const context = await detectProjectContext(tempDir);

    assertEquals(context.framework, "Deno");
    assertEquals(context.packageManager, "deno");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("detectProjectContext - with Python requirements", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    await Deno.writeTextFile(`${tempDir}/requirements.txt`, "flask==2.0.0\nrequests==2.25.0");

    const context = await detectProjectContext(tempDir);

    assertEquals(context.language, "python");
    assertEquals(context.packageManager, "pip");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("detectProjectContext - directory name fallback", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const context = await detectProjectContext(tempDir);

    // Should use directory name as project name
    const expectedName = tempDir.split("/").pop() || "unknown-project";
    assertEquals(context.projectName, expectedName);
    assertEquals(context.language, "unknown");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
