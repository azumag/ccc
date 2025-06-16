#!/usr/bin/env -S deno run --allow-all
/**
 * Claude Discord Bot - Main entry point (Standalone Version)
 * This version uses full URLs for imports to work without import maps
 */

import { load } from "jsr:@std/dotenv";
import { Client, GatewayIntentBits, Message, TextChannel } from "npm:discord.js@14";
import _process from "node:process";

// Simplified standalone version - core functionality only
interface BotConfig {
  discordToken: string;
  guildId: string;
  authorizedUserId?: string;
  channelName: string;
  tmuxSessionName: string;
  logLevel: string;
}

interface BotStats {
  startTime: Date;
  messagesProcessed: number;
  commandsExecuted: number;
  lastActivity: Date;
  sessionStatus: { exists: boolean; uptime: string };
}

class SimpleLogger {
  constructor(private level: string) {}

  info(message: string) {
    if (["debug", "info"].includes(this.level)) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    }
  }

  debug(message: string) {
    if (this.level === "debug") {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
    }
  }

  warn(message: string) {
    if (["debug", "info", "warn"].includes(this.level)) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    }
  }

  error(message: string) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  }
}

class SimpleTmuxManager {
  constructor(private sessionName: string, private logger: SimpleLogger) {}

  async createSession(): Promise<boolean> {
    try {
      this.logger.info(`Creating tmux session: ${this.sessionName}`);
      
      const cmd = new Deno.Command("tmux", {
        args: ["new-session", "-d", "-s", this.sessionName],
        cwd: Deno.cwd(),
      });

      const process = cmd.spawn();
      const status = await process.status;
      
      if (status.success) {
        // Start Claude Code in the session
        await this.sendCommand("claude --dangerously-skip-permissions");
        this.logger.info("Claude Code session started successfully");
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to create tmux session: ${error}`);
      return false;
    }
  }

  async sendCommand(command: string): Promise<boolean> {
    try {
      const cmd = new Deno.Command("tmux", {
        args: ["send-keys", "-t", this.sessionName, command, "Enter"],
      });

      const process = cmd.spawn();
      const status = await process.status;
      return status.success;
    } catch (error) {
      this.logger.error(`Failed to send command: ${error}`);
      return false;
    }
  }

  async sessionExists(): Promise<boolean> {
    try {
      const cmd = new Deno.Command("tmux", {
        args: ["has-session", "-t", this.sessionName],
      });

      const process = cmd.spawn();
      const status = await process.status;
      return status.success;
    } catch {
      return false;
    }
  }
}

export class ClaudeDiscordBot {
  private config: BotConfig;
  private client: Client;
  private tmuxManager: SimpleTmuxManager;
  private logger: SimpleLogger;
  private targetChannelId = "";
  private stats: BotStats;

  constructor(config: BotConfig) {
    this.config = config;
    this.logger = new SimpleLogger(config.logLevel);
    this.tmuxManager = new SimpleTmuxManager(config.tmuxSessionName, this.logger);

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.stats = {
      startTime: new Date(),
      messagesProcessed: 0,
      commandsExecuted: 0,
      lastActivity: new Date(),
      sessionStatus: { exists: false, uptime: "未開始" },
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once("ready", () => {
      this.logger.info(`Bot logged in as ${this.client.user?.tag}`);
      this.initializeClaudeSession();
      this.findTargetChannel();
    });

    this.client.on("messageCreate", async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on("error", (error) => {
      this.logger.error(`Discord client error: ${error.message}`);
    });
  }

  private async initializeClaudeSession(): Promise<void> {
    this.logger.info("Initializing Claude session...");
    
    if (!await this.tmuxManager.sessionExists()) {
      const created = await this.tmuxManager.createSession();
      if (created) {
        this.logger.info("Claude session initialized successfully");
        this.stats.sessionStatus = { exists: true, uptime: "Started" };
      } else {
        this.logger.error("Failed to initialize Claude session");
      }
    } else {
      this.logger.info("Claude session already exists");
      this.stats.sessionStatus = { exists: true, uptime: "Existing" };
    }
  }

  private findTargetChannel(): void {
    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) {
      this.logger.error(`Guild not found: ${this.config.guildId}`);
      return;
    }

    const channel = guild.channels.cache.find(
      (ch) => ch.name === this.config.channelName && ch.isTextBased()
    ) as TextChannel;

    if (channel) {
      this.targetChannelId = channel.id;
      this.logger.info(`Target channel found: #${channel.name} (${channel.id})`);
    } else {
      this.logger.error(`Channel not found: ${this.config.channelName}`);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    // Skip bot messages
    if (message.author.bot) return;

    // Check if message is in target channel
    if (message.channelId !== this.targetChannelId) return;

    // Check authorization if configured
    if (this.config.authorizedUserId && message.author.id !== this.config.authorizedUserId) {
      this.logger.debug(`Unauthorized user: ${message.author.tag}`);
      return;
    }

    // Handle special commands
    if (message.content.startsWith("/")) {
      await this.handleSpecialCommand(message);
      return;
    }

    // Process regular message
    await this.processMessage(message);
  }

  private async handleSpecialCommand(message: Message): Promise<void> {
    const command = message.content.toLowerCase();

    switch (command) {
      case "/status":
        await this.sendStatus(message);
        break;
      case "/restart":
        await this.restartSession(message);
        break;
      case "/help":
        await this.sendHelp(message);
        break;
      default:
        await message.reply("Unknown command. Use `/help` for available commands.");
    }

    this.stats.commandsExecuted++;
  }

  private async processMessage(message: Message): Promise<void> {
    this.logger.info(`Processing message from ${message.author.tag}: ${message.content.substring(0, 100)}...`);
    
    try {
      // Send thinking indicator
      const thinkingMessage = await message.reply("🤔 考えています...");
      
      const startTime = Date.now();
      
      // Send message to Claude via tmux
      const success = await this.tmuxManager.sendCommand(message.content);
      
      if (success) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        await thinkingMessage.edit(`✅ 完了 (${duration}s)`);
        
        // In a real implementation, you would capture Claude's response
        // For now, we just acknowledge the command was sent
        await message.reply("コマンドをClaude Codeに送信しました。tmuxセッションで結果を確認してください。");
        
        this.stats.messagesProcessed++;
        this.stats.lastActivity = new Date();
      } else {
        await thinkingMessage.edit("❌ 失敗");
        await message.reply("Claude Codeへの送信に失敗しました。tmuxセッションが正常に動作しているか確認してください。");
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);
      await message.reply("メッセージの処理中にエラーが発生しました。");
    }
  }

  private async sendStatus(message: Message): Promise<void> {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const uptimeStr = this.formatDuration(uptime);
    const sessionExists = await this.tmuxManager.sessionExists();

    const status = `**📊 Claude Discord Bot ステータス**

**Bot情報:**
• 起動時間: ${this.stats.startTime.toLocaleString()}
• 稼働時間: ${uptimeStr}
• 最終活動: ${this.stats.lastActivity.toLocaleString()}

**処理統計:**
• 処理メッセージ数: ${this.stats.messagesProcessed}
• 実行コマンド数: ${this.stats.commandsExecuted}

**Claude セッション:**
• セッション名: ${this.config.tmuxSessionName}
• セッション状態: ${sessionExists ? "✅ 動作中" : "❌ 停止"}

**設定:**
• チャネル: #${this.config.channelName}
• ログレベル: ${this.config.logLevel}`;

    await message.reply(status);
  }

  private async restartSession(message: Message): Promise<void> {
    await message.reply("🔄 Claude セッションを再起動しています...");
    
    try {
      // Kill existing session
      const killCmd = new Deno.Command("tmux", {
        args: ["kill-session", "-t", this.config.tmuxSessionName],
      });
      await killCmd.spawn().status;

      // Create new session
      const success = await this.tmuxManager.createSession();
      
      if (success) {
        await message.reply("✅ Claude セッションが再起動されました。");
      } else {
        await message.reply("❌ セッションの再起動に失敗しました。");
      }
    } catch (error) {
      this.logger.error(`Error restarting session: ${error}`);
      await message.reply("❌ セッションの再起動中にエラーが発生しました。");
    }
  }

  private async sendHelp(message: Message): Promise<void> {
    const help = `**🤖 Claude Discord Bot ヘルプ**

**基本的な使い方:**
• このチャネルにメッセージを投稿すると、Claude Codeで実行されます
• メンションは不要です

**特殊コマンド:**
• \`/status\` - Bot・セッション状態を表示
• \`/restart\` - Claudeセッションを再起動
• \`/help\` - このヘルプを表示

**tmux直接操作:**
• \`tmux attach -t ${this.config.tmuxSessionName}\` - セッションに接続
• \`Ctrl+B → D\` - セッションから切断

**その他:**
• 認証ユーザー: ${this.config.authorizedUserId ? `<@${this.config.authorizedUserId}>` : "全ユーザー"}
• セッション名: ${this.config.tmuxSessionName}`;

    await message.reply(help);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}日 ${hours % 24}時間`;
    if (hours > 0) return `${hours}時間 ${minutes % 60}分`;
    if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  async start(): Promise<void> {
    try {
      this.logger.info("Starting Claude Discord Bot...");
      await this.client.login(this.config.discordToken);
    } catch (error) {
      this.logger.error(`Failed to start bot: ${error}`);
      throw error;
    }
  }

  stop(): void {
    this.logger.info("Stopping Claude Discord Bot...");
    this.client.destroy();
  }
}

// Auto-start when run directly
if (import.meta.main) {
  // Load environment variables
  await load({ export: true });

  // Validate required environment variables
  const requiredVars = [
    "DISCORD_BOT_TOKEN",
    "GUILD_ID",
    "DISCORD_CHANNEL_NAME",
  ];

  for (const varName of requiredVars) {
    if (!Deno.env.get(varName)) {
      console.error(`❌ Missing required environment variable: ${varName}`);
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      console.error("Run 'claude-discord-bot init' to set up your environment.");
      Deno.exit(1);
    }
  }

  const config: BotConfig = {
    discordToken: Deno.env.get("DISCORD_BOT_TOKEN")!,
    guildId: Deno.env.get("GUILD_ID")!,
    authorizedUserId: Deno.env.get("AUTHORIZED_USER_ID"),
    channelName: Deno.env.get("DISCORD_CHANNEL_NAME") || "claude",
    tmuxSessionName: Deno.env.get("TMUX_SESSION_NAME") || "claude-main",
    logLevel: Deno.env.get("LOG_LEVEL") || "info",
  };

  console.log("🤖 Claude Discord Bot 起動中...");
  console.log(`📋 設定: チャネル=#${config.channelName}, セッション=${config.tmuxSessionName}`);

  try {
    const bot = new ClaudeDiscordBot(config);
    await bot.start();
    
    console.log("✅ Bot が正常に起動しました");
    console.log(`🔗 tmuxセッション接続: tmux attach -t ${config.tmuxSessionName}`);
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 シャットダウン中...");
      await bot.stop();
      Deno.exit(0);
    };

    // Handle Ctrl+C
    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);

  } catch (error) {
    console.error("❌ Bot の起動に失敗しました:", error);
    Deno.exit(1);
  }
}