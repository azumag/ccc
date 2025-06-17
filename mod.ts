/**
 * @fileoverview Claude Discord Bot CLI Package
 * @description Easy setup and management for Claude Discord Bot in any project
 * @author azumag
 * @license MIT
 */

// Export main CLI class for programmatic usage
export { ClaudeDiscordBotCLI } from "./cli.ts";

// Export core bot classes for advanced usage
export { ClaudeDiscordBot } from "./src/bot.ts";
export { TmuxSessionManager } from "./src/tmux.ts";
export { ClaudeCodeExecutor } from "./src/claude.ts";
export { SimpleLogger } from "./src/logger.ts";

// Export types
export type {
  BotConfig,
  BotStats,
  LogLevel,
  SpecialCommand,
  ProjectContext,
  CommandResult,
} from "./src/types.ts";

// Export utilities
export {
  detectProjectContext,
  formatDuration,
  parseArgs,
  validateEnvironment,
} from "./src/utils.ts";

/**
 * Quick setup function for programmatic usage
 * @param projectPath - Path to the project directory
 * @param options - Configuration options
 */
export async function quickSetup(
  projectPath: string,
  options: {
    channelName?: string;
    tmuxSessionName?: string;
    logLevel?: string;
    discordToken?: string;
    guildId?: string;
    authorizedUserId?: string;
  } = {},
): Promise<typeof options & { projectPath: string }> {
  const { ClaudeDiscordBotCLI } = await import("./cli.ts");
  const cli = new ClaudeDiscordBotCLI();
  
  const config = {
    projectPath,
    channelName: options.channelName || "claude",
    tmuxSessionName: options.tmuxSessionName || "claude-main", 
    logLevel: options.logLevel || "info",
    discordToken: options.discordToken,
    guildId: options.guildId,
    authorizedUserId: options.authorizedUserId,
  };

  await cli.run(["init", "--project", projectPath]);
  return config;
}

/**
 * Package version
 */
export const VERSION = "1.9.0";

/**
 * Package information
 */
export const PACKAGE_INFO = {
  name: "@azumag/claude-discord-bot",
  version: VERSION,
  description: "CLI tool for setting up Claude Discord Bot in any project",
  repository: "https://github.com/azumag/ccc",
  documentation: "https://github.com/azumag/ccc#readme",
} as const;