/**
 * Shared interfaces and types for Claude Discord Bot CLI
 */

export interface CLIConfig {
  projectPath: string;
  channelName: string;
  discordToken?: string;
  guildId?: string;
  authorizedUserId?: string;
  tmuxSessionName: string;
  logLevel: string;
  orchestratorMode?: boolean;
}

export interface BotConfig {
  discordToken: string;
  guildId: string;
  authorizedUserId?: string;
  channelName: string;
  tmuxSessionName: string;
  logLevel: string;
  enableUltraThink?: boolean;
  orchestratorMode?: boolean;
  useDangerouslySkipPermissions?: boolean;
  enableResume?: boolean;
  enableContinue?: boolean;
  autoCommit?: boolean;
  autoPush?: boolean;
  progressUpdate?: boolean;
  progressInterval?: string;
}

export interface BotStats {
  startTime: Date;
  messagesProcessed: number;
  commandsExecuted: number;
  lastActivity: Date;
  sessionStatus: { exists: boolean; uptime: string };
}

export interface ImportConfig {
  parseArgs: string;
  dotenv: string;
  fs: string;
  path: string;
}

export const IMPORT_CONFIGS = {
  "import-maps": {
    parseArgs: "@std/cli/parse-args",
    dotenv: "@std/dotenv",
    fs: "@std/fs",
    path: "@std/path",
  },
  "full-urls": {
    parseArgs: "jsr:@std/cli/parse-args",
    dotenv: "jsr:@std/dotenv", 
    fs: "jsr:@std/fs",
    path: "jsr:@std/path",
  }
} as const;

export type ImportType = keyof typeof IMPORT_CONFIGS;