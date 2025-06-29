/**
 * Shared utility functions for Claude Discord Bot CLI
 */

import { parseArgs as denoParseArgs } from "@std/cli/parse-args";
import { exists } from "@std/fs";
import { join } from "@std/path";
import type { ProjectContext } from "./types.ts";

export const VERSION = "1.30.0";

export function getHomeDirectory(): string {
  return Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
}

export function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}時間${minutes % 60}分`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function chunkString(str: string, maxLength: number): string[] {
  if (str.length <= maxLength) return [str];

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < str.length) {
    chunks.push(str.slice(currentIndex, currentIndex + maxLength));
    currentIndex += maxLength;
  }

  return chunks;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}日${hours % 24}時間${minutes % 60}分`;
  } else if (hours > 0) {
    return `${hours}時間${minutes % 60}分`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function parseArgs(args: string[]) {
  return denoParseArgs(args, {
    boolean: [
      "help",
      "version",
      "global",
      "orch",
      "ultrathink",
      "dangerous-permit",
      "resume",
      "continue",
      "auto-commit",
      "auto-push",
      "progress-update",
    ],
    string: [
      "channel",
      "session",
      "log-level",
      "progress-interval",
      "monitor-channel",
    ],
    alias: {
      h: "help",
      v: "version",
      g: "global",
      c: "channel",
      s: "session",
      l: "log-level",
    },
  });
}

export function showHelp(): void {
  console.log(`
Claude Discord Bot CLI v${VERSION}

USAGE:
  claude-discord-bot <command> [options]

COMMANDS:
  init                     Initialize project configuration
  start                    Start Discord bot
  send-to-discord <msg>    Send message to Discord channel
  status                   Show bot status
  --version, -v            Show version
  --help, -h               Show this help

START OPTIONS:
  --channel, -c <name>     Discord channel name (default: "claude")
  --session, -s <name>     Tmux session name (default: "claude-main")
  --log-level, -l <level>  Log level (debug, info, warn, error)
  --global, -g             Use global installation
  --orch                   Enable orchestrator mode
  --ultrathink             Enable ultra-thinking mode
  --dangerous-permit       Skip dangerous permissions
  --resume                 Enable resume mode
  --continue               Enable continue mode
  --auto-commit            Auto-commit changes
  --auto-push              Auto-push changes
  --progress-update        Enable progress updates
  --progress-interval <t>  Progress update interval (default: 1m)
  --monitor-channel <name> Monitor channel and forward to tmux

EXAMPLES:
  claude-discord-bot init
  claude-discord-bot start --channel claude --orch
  claude-discord-bot start --monitor-channel test --channel claude
  claude-discord-bot send-to-discord "Hello from CLI!"
  claude-discord-bot status
`);
}

export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    "DISCORD_BOT_TOKEN",
    "GUILD_ID",
  ];

  const missing = required.filter((key) => !Deno.env.get(key));

  return {
    valid: missing.length === 0,
    missing,
  };
}

export async function detectProjectContext(rootPath: string): Promise<ProjectContext> {
  const context: ProjectContext = {
    rootPath,
    projectName: rootPath.split("/").pop() || "unknown",
  };

  // Check for package.json (Node.js/JavaScript/TypeScript)
  const packageJsonPath = join(rootPath, "package.json");
  if (await exists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath));
      context.projectName = packageJson.name || context.projectName;
      context.language = "javascript";

      // Detect framework
      if (packageJson.dependencies || packageJson.devDependencies) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.react) context.framework = "React";
        else if (deps.vue) context.framework = "Vue";
        else if (deps.angular) context.framework = "Angular";
        else if (deps.next) context.framework = "Next.js";
        else if (deps.nuxt) context.framework = "Nuxt.js";
        else if (deps.express) context.framework = "Express";
        else if (deps.fastify) context.framework = "Fastify";
      }

      // Detect package manager
      if (await exists(join(rootPath, "package-lock.json"))) {
        context.packageManager = "npm";
      } else if (await exists(join(rootPath, "yarn.lock"))) {
        context.packageManager = "yarn";
      } else if (await exists(join(rootPath, "pnpm-lock.yaml"))) {
        context.packageManager = "pnpm";
      } else if (await exists(join(rootPath, "bun.lockb"))) {
        context.packageManager = "bun";
      }
    } catch (error) {
      console.warn(`Warning: Could not parse package.json: ${error}`);
    }
  }

  // Check for deno.json (Deno)
  const denoJsonPath = join(rootPath, "deno.json");
  if (await exists(denoJsonPath)) {
    context.language = "typescript";
    context.framework = "Deno";
    context.packageManager = "deno";
  }

  // Check for Cargo.toml (Rust)
  const cargoTomlPath = join(rootPath, "Cargo.toml");
  if (await exists(cargoTomlPath)) {
    try {
      const cargoToml = await Deno.readTextFile(cargoTomlPath);
      const nameMatch = cargoToml.match(/name\s*=\s*"([^"]+)"/);
      if (nameMatch) context.projectName = nameMatch[1];
      context.language = "rust";
      context.packageManager = "cargo";
    } catch (error) {
      console.warn(`Warning: Could not parse Cargo.toml: ${error}`);
    }
  }

  // Check for go.mod (Go)
  const goModPath = join(rootPath, "go.mod");
  if (await exists(goModPath)) {
    try {
      const goMod = await Deno.readTextFile(goModPath);
      const moduleMatch = goMod.match(/module\s+([^\s]+)/);
      if (moduleMatch && moduleMatch[1]) {
        context.projectName = moduleMatch[1].split("/").pop() || context.projectName;
      }
      context.language = "go";
      context.packageManager = "go";
    } catch (error) {
      console.warn(`Warning: Could not parse go.mod: ${error}`);
    }
  }

  // Check for requirements.txt or pyproject.toml (Python)
  const requirementsPath = join(rootPath, "requirements.txt");
  const pyprojectPath = join(rootPath, "pyproject.toml");
  if (await exists(requirementsPath) || await exists(pyprojectPath)) {
    context.language = "python";
    if (await exists(pyprojectPath)) {
      context.packageManager = "pip/poetry";
    } else {
      context.packageManager = "pip";
    }
  }

  // Check for git repository
  const gitPath = join(rootPath, ".git");
  if (await exists(gitPath)) {
    try {
      // Try to get git remote origin URL
      const command = new Deno.Command("git", {
        args: ["remote", "get-url", "origin"],
        cwd: rootPath,
        stdout: "piped",
        stderr: "piped",
      });
      const { code, stdout } = await command.output();
      if (code === 0) {
        const remoteUrl = new TextDecoder().decode(stdout).trim();
        if (remoteUrl) {
          context.gitRepo = remoteUrl;
        }
      }
    } catch (error) {
      // Git command failed, just mark as git repo without URL
      console.warn(`Warning: Could not get git remote URL: ${error}`);
      context.gitRepo = "local";
    }
  }

  // Default to detected language or generic
  if (!context.language) {
    context.language = "text";
  }

  return context;
}
