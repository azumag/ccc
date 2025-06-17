/**
 * Utility functions for the Claude Discord Bot
 */

import type { ProjectContext } from "./types.ts";

/**
 * Detect project context from the current directory
 */
export async function detectProjectContext(rootPath: string): Promise<ProjectContext> {
  const projectName = await getProjectName(rootPath);
  const language = await detectLanguage(rootPath);
  const framework = await detectFramework(rootPath);
  const gitRepo = await getGitRepo(rootPath);
  const packageManager = await detectPackageManager(rootPath);

  return {
    rootPath,
    projectName,
    language,
    framework,
    gitRepo,
    packageManager,
  };
}

/**
 * Get project name from package.json or directory name
 */
async function getProjectName(rootPath: string): Promise<string> {
  try {
    // Try package.json first
    const packageJsonPath = `${rootPath}/package.json`;
    const packageJson = await Deno.readTextFile(packageJsonPath);
    const parsed = JSON.parse(packageJson);
    if (parsed.name) {
      return parsed.name;
    }
  } catch {
    // Fallback to directory name
  }

  try {
    // Try Cargo.toml
    const cargoTomlPath = `${rootPath}/Cargo.toml`;
    const cargoToml = await Deno.readTextFile(cargoTomlPath);
    const nameMatch = cargoToml.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1];
    }
  } catch {
    // Continue to fallback
  }

  // Fallback to directory name
  return rootPath.split("/").pop() || "unknown-project";
}

/**
 * Detect primary programming language
 */
async function detectLanguage(rootPath: string): Promise<string> {
  const fileChecks = [
    { pattern: "package.json", language: "typescript" },
    { pattern: "Cargo.toml", language: "rust" },
    { pattern: "requirements.txt", language: "python" },
    { pattern: "Pipfile", language: "python" },
    { pattern: "pyproject.toml", language: "python" },
    { pattern: "go.mod", language: "go" },
    { pattern: "pom.xml", language: "java" },
    { pattern: "build.gradle", language: "java" },
    { pattern: "composer.json", language: "php" },
    { pattern: "Gemfile", language: "ruby" },
  ];

  for (const check of fileChecks) {
    try {
      await Deno.stat(`${rootPath}/${check.pattern}`);
      return check.language;
    } catch {
      continue;
    }
  }

  return "unknown";
}

/**
 * Detect framework or major library
 */
async function detectFramework(rootPath: string): Promise<string | undefined> {
  try {
    // Check package.json for frameworks
    const packageJsonPath = `${rootPath}/package.json`;
    const packageJson = await Deno.readTextFile(packageJsonPath);
    const parsed = JSON.parse(packageJson);
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };

    const frameworkChecks = [
      { name: "react", framework: "React" },
      { name: "vue", framework: "Vue.js" },
      { name: "@angular/core", framework: "Angular" },
      { name: "svelte", framework: "Svelte" },
      { name: "next", framework: "Next.js" },
      { name: "nuxt", framework: "Nuxt.js" },
      { name: "express", framework: "Express.js" },
      { name: "fastify", framework: "Fastify" },
      { name: "@nestjs/core", framework: "NestJS" },
      { name: "solid-js", framework: "SolidJS" },
    ];

    for (const check of frameworkChecks) {
      if (deps[check.name]) {
        return check.framework;
      }
    }
  } catch {
    // Continue with other checks
  }

  try {
    // Check for Deno
    const denoJsonPath = `${rootPath}/deno.json`;
    await Deno.stat(denoJsonPath);
    return "Deno";
  } catch {
    // Continue
  }

  return undefined;
}

/**
 * Get Git repository URL
 */
async function getGitRepo(rootPath: string): Promise<string | undefined> {
  try {
    const command = new Deno.Command("git", {
      args: ["remote", "get-url", "origin"],
      cwd: rootPath,
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout } = await command.output();
    if (code === 0) {
      return new TextDecoder().decode(stdout).trim();
    }
  } catch {
    // Git not available or not a git repo
  }

  return undefined;
}

/**
 * Detect package manager
 */
async function detectPackageManager(
  rootPath: string,
): Promise<"npm" | "yarn" | "pnpm" | "deno" | "cargo" | "pip" | undefined> {
  const checks = [
    { file: "pnpm-lock.yaml", manager: "pnpm" as const },
    { file: "yarn.lock", manager: "yarn" as const },
    { file: "package-lock.json", manager: "npm" as const },
    { file: "deno.json", manager: "deno" as const },
    { file: "Cargo.lock", manager: "cargo" as const },
    { file: "requirements.txt", manager: "pip" as const },
  ];

  for (const check of checks) {
    try {
      await Deno.stat(`${rootPath}/${check.file}`);
      return check.manager;
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): {
  channelName?: string;
  help?: boolean;
  version?: boolean;
  logLevel?: string;
} {
  const result: {
    channelName?: string;
    help?: boolean;
    version?: boolean;
    logLevel?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--channel":
      case "-c":
        result.channelName = args[++i];
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      case "--log-level":
        result.logLevel = args[++i];
        break;
    }
  }

  return result;
}

/**
 * Display help message
 */
export function showHelp(): void {
  console.log(`
Claude Discord Bot

Usage:
  deno run --allow-all src/bot.ts [options]

Options:
  -c, --channel <name>    Discord channel name to monitor (required)
  -h, --help             Show this help message
  -v, --version          Show version information
  --log-level <level>    Set log level (debug, info, warn, error)

Environment Variables:
  DISCORD_BOT_TOKEN      Discord bot token (required)
  GUILD_ID              Discord server ID (required)
  AUTHORIZED_USER_ID    Authorized Discord user ID (required)
  DISCORD_CHANNEL_NAME  Default channel name (optional)
  LOG_LEVEL             Default log level (optional)

Examples:
  deno run --allow-all src/bot.ts --channel dev-claude
  deno run --allow-all src/bot.ts -c claude --log-level debug
  DISCORD_CHANNEL_NAME=claude deno task start
`);
}

/**
 * Check if required environment variables are set
 */
export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
} {
  const required = ["DISCORD_BOT_TOKEN", "GUILD_ID", "AUTHORIZED_USER_ID"];
  const missing: string[] = [];

  for (const envVar of required) {
    if (!Deno.env.get(envVar)) {
      missing.push(envVar);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
