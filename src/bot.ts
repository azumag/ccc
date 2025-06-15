/**
 * Claude Discord Bot - Main entry point
 * Simple channel monitoring Discord bot that executes Claude Code via tmux
 */

import { load } from "@std/dotenv";
import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import process from "node:process";
import { TmuxSessionManager } from "./tmux.ts";
import { ClaudeCodeExecutor } from "./claude.ts";
import { DiscordAPIBridge } from "./discord-api.ts";
import { SimpleLogger } from "./logger.ts";
import {
  detectProjectContext,
  formatDuration,
  parseArgs,
  showHelp,
  validateEnvironment,
} from "./utils.ts";
import type { BotConfig, BotStats, LogLevel, SpecialCommand } from "./types.ts";

export class ClaudeDiscordBot {
  private config: BotConfig;
  private client: Client;
  private tmuxManager: TmuxSessionManager;
  private claudeExecutor: ClaudeCodeExecutor;
  private logger: SimpleLogger;
  private targetChannelId = "";
  private stats: BotStats;
  private specialCommands: SpecialCommand[];
  private responseMonitorInterval?: number;

  constructor(config: BotConfig) {
    this.config = config;
    this.logger = new SimpleLogger(config.logLevel);
    this.tmuxManager = new TmuxSessionManager(config.tmuxSessionName, this.logger);
    this.claudeExecutor = new ClaudeCodeExecutor(
      this.tmuxManager,
      config.projectContext,
      this.logger,
    );

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

    this.specialCommands = this.initializeSpecialCommands();
    this.setupEventHandlers();
  }

  /**
   * Initialize special commands
   */
  private initializeSpecialCommands(): SpecialCommand[] {
    return [
      {
        name: "/restart",
        description: "Restart Claude tmux session",
        handler: async (messageUnknown: unknown) => {
          const message = messageUnknown as Message;
          const restarted = await this.claudeExecutor.restartSession();
          await message.reply(
            restarted ? "✅ Claudeセッションを再起動しました" : "❌ 再起動に失敗しました",
          );
          this.stats.commandsExecuted++;
        },
      },
      {
        name: "/status",
        description: "Show bot and session status",
        handler: async (messageUnknown: unknown) => {
          const message = messageUnknown as Message;
          const sessionStatus = await this.claudeExecutor.getSessionStatus();
          const uptime = formatDuration(Date.now() - this.stats.startTime.getTime());

          const statusMessage = [
            `📊 **Claude Discord Bot ステータス**`,
            ``,
            `🏠 **プロジェクト**: ${this.config.projectContext.projectName}`,
            `📁 **パス**: ${this.config.projectContext.rootPath}`,
            `🛠️ **言語**: ${this.config.projectContext.language}`,
            `📦 **フレームワーク**: ${this.config.projectContext.framework || "なし"}`,
            ``,
            `🔄 **Claudeセッション**: ${sessionStatus.exists ? "✅ 起動中" : "❌ 停止中"}`,
            `📋 **ペイン数**: ${sessionStatus.paneCount || 1}`,
            `⏰ **最終活動**: ${sessionStatus.uptime}`,
            ``,
            `🤖 **Bot稼働時間**: ${uptime}`,
            `📨 **処理メッセージ数**: ${this.stats.messagesProcessed}`,
            `⚡ **実行コマンド数**: ${this.stats.commandsExecuted}`,
          ].join("\n");

          await message.reply(statusMessage);
          this.stats.commandsExecuted++;
        },
      },
      {
        name: "/attach",
        description: "Show tmux attach command",
        handler: async (messageUnknown: unknown) => {
          const message = messageUnknown as Message;
          const attachMessage = [
            `🔧 **tmuxセッションに直接接続**:`,
            `\`\`\`bash`,
            `tmux attach -t ${this.config.tmuxSessionName}`,
            `\`\`\``,
            `**接続先**: Claude Code実行環境`,
            `**切断**: \`Ctrl+B\` → \`D\``,
            `**注意**: 接続中はBotからの操作ができません`,
          ].join("\n");

          await message.reply(attachMessage);
          this.stats.commandsExecuted++;
        },
      },
      {
        name: "/help",
        description: "Show available commands",
        handler: async (messageUnknown: unknown) => {
          const message = messageUnknown as Message;
          const helpMessage = [
            `🤖 **Claude Discord Bot ヘルプ**`,
            ``,
            `**基本操作**:`,
            `• このチャネルにメッセージを投稿するとClaudeが実行されます`,
            `• メンション不要、投稿内容がそのまま指示として処理されます`,
            ``,
            `**特殊コマンド**:`,
            ...this.specialCommands.map((cmd) => `• \`${cmd.name}\` - ${cmd.description}`),
            ``,
            `**プロジェクト情報**:`,
            `• 名前: ${this.config.projectContext.projectName}`,
            `• 言語: ${this.config.projectContext.language}`,
            `• パッケージマネージャー: ${this.config.projectContext.packageManager || "不明"}`,
          ].join("\n");

          await message.reply(helpMessage);
          this.stats.commandsExecuted++;
        },
      },
    ];
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.on("ready", async () => {
      this.logger.info(`Bot logged in as ${this.client.user?.tag}`);
      await this.resolveTargetChannel();
      await this.performStartupChecks();
      this.startResponseMonitor();
    });

    this.client.on("messageCreate", async (message) => {
      if (message.author.bot) return;
      if (message.channel.id !== this.targetChannelId) return;

      await this.handleChannelMessage(message);
    });

    this.client.on("error", (error) => {
      this.logger.error("Discord client error:", error);
    });

    this.client.on("disconnect", () => {
      this.logger.warn("Discord client disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      this.logger.info("Received SIGINT, shutting down gracefully...");
      await this.shutdown();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      this.logger.info("Received SIGTERM, shutting down gracefully...");
      await this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Resolve target channel from name
   */
  private async resolveTargetChannel(): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error(`Guild not found: ${this.config.guildId}`);
      }

      const channel = guild.channels.cache.find(
        (ch) => ch.name === this.config.channelName,
      ) as TextChannel;

      if (!channel) {
        throw new Error(`Channel not found: ${this.config.channelName}`);
      }

      this.targetChannelId = channel.id;
      this.logger.info(`🎯 監視対象チャネル: #${this.config.channelName} (${channel.id})`);

      // Send startup message
      await channel.send(
        `🤖 **Claude Discord Bot が起動しました**\n` +
          `📁 プロジェクト: ${this.config.projectContext.projectName}\n` +
          `🛠️ 言語: ${this.config.projectContext.language}\n` +
          `💡 このチャネルにメッセージを投稿してClaudeに指示してください`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resolve target channel: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Start monitoring for Discord responses from Claude
   */
  private startResponseMonitor(): void {
    this.responseMonitorInterval = setInterval(async () => {
      const response = await DiscordAPIBridge.readResponse();
      if (response && response.channelId) {
        const channel = this.client.channels.cache.get(response.channelId);
        if (channel && "send" in channel) {
          await channel.send(response.content);
          this.logger.info("Sent Claude response to Discord");
        }
      }
    }, 500);
  }

  /**
   * Perform startup checks
   */
  private async performStartupChecks(): Promise<void> {
    // Check tmux availability
    const tmuxAvailable = await TmuxSessionManager.checkTmuxAvailable();
    if (!tmuxAvailable) {
      this.logger.error("tmux is not available");
      throw new Error("tmux is required but not found");
    }

    // Check Claude Code availability
    const claudeAvailable = await ClaudeCodeExecutor.checkClaudeAvailable();
    if (!claudeAvailable) {
      this.logger.warn("Claude Code CLI is not available or not authenticated");
    }

    // Initialize Claude tmux session
    await this.initializeClaudeSession();

    this.logger.info("All startup checks completed successfully");
  }

  /**
   * Initialize Claude tmux session on startup
   */
  private async initializeClaudeSession(): Promise<void> {
    this.logger.info("Initializing Claude tmux session...");

    try {
      // Check if session already exists
      const sessionExists = await this.tmuxManager.hasSession();

      if (sessionExists) {
        this.logger.info(`Claude tmux session '${this.config.tmuxSessionName}' already exists`);

        // Update session status
        const status = await this.claudeExecutor.getSessionStatus();
        this.stats.sessionStatus = status;

        return;
      }

      // Create new session
      this.logger.info(`Creating new Claude tmux session: ${this.config.tmuxSessionName}`);
      const sessionCreated = await this.tmuxManager.createSession(
        this.config.projectContext.rootPath,
      );

      if (sessionCreated) {
        this.logger.info("✅ Claude tmux session created successfully");

        // Update session status
        const status = await this.claudeExecutor.getSessionStatus();
        this.stats.sessionStatus = status;

        // Send notification to channel when ready
        if (this.targetChannelId) {
          const channel = this.client.channels.cache.get(this.targetChannelId);
          if (channel && "send" in channel) {
            await channel.send("🔧 Claude実行環境が準備完了しました");
          }
        }
      } else {
        this.logger.warn("❌ Failed to create Claude tmux session");
        this.logger.warn("Claude commands will attempt to create session on first use");
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize Claude session: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.logger.warn("Claude commands will attempt to create session on first use");
    }
  }

  /**
   * Handle incoming channel messages
   */
  private async handleChannelMessage(message: Message): Promise<void> {
    const content = message.content.trim();
    this.stats.messagesProcessed++;
    this.stats.lastActivity = new Date();

    this.logger.info(
      `Processing message from ${message.author.tag}: ${content.substring(0, 100)}...`,
    );

    // Check for special commands
    const specialCommand = this.specialCommands.find((cmd) => content.startsWith(cmd.name));
    if (specialCommand) {
      await specialCommand.handler(message);
      return;
    }

    // Handle regular Claude prompt
    await this.executeClaudePrompt(message, content);
  }

  /**
   * Execute Claude prompt and respond
   */
  private async executeClaudePrompt(message: Message, prompt: string): Promise<void> {
    let thinkingMessage: Message | null = null;

    try {
      // Send thinking message
      thinkingMessage = await message.reply("🤔 考えています...");

      // Execute Claude prompt
      this.logger.debug(`Executing Claude prompt: ${prompt.substring(0, 200)}...`);
      const response = await this.claudeExecutor.executePrompt(prompt, message.channel.id);

      // Update thinking message
      await thinkingMessage.edit(
        `✅ 完了 (${formatDuration(response.executionTime || 0)})`,
      );

      // Send response(s)
      const formattedResponses = this.claudeExecutor.formatResponseForDiscord(response);
      for (const formattedResponse of formattedResponses) {
        if ("send" in message.channel) {
          await message.channel.send(formattedResponse);
        }
      }

      this.stats.commandsExecuted++;
      this.logger.info(`Claude prompt executed successfully in ${response.executionTime}ms`);
    } catch (error) {
      this.logger.error(
        `Failed to execute Claude prompt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (thinkingMessage) {
        await thinkingMessage.edit("❌ エラーが発生しました");
      }

      await message.reply(
        `❌ **エラー**: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    this.logger.info("Starting Claude Discord Bot...");
    this.logger.info(`Project: ${this.config.projectContext.projectName}`);
    this.logger.info(`Channel: #${this.config.channelName}`);

    try {
      await this.client.login(this.config.discordToken);
    } catch (error) {
      this.logger.error(
        `Failed to login to Discord: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Shutdown the bot gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down bot...");

    try {
      // Stop response monitor
      if (this.responseMonitorInterval) {
        clearInterval(this.responseMonitorInterval);
      }

      // Send shutdown message to channel
      if (this.targetChannelId) {
        const channel = this.client.channels.cache.get(this.targetChannelId) as TextChannel;
        if (channel) {
          await channel.send("🔄 Claude Discord Bot をシャットダウンしています...");
        }
      }

      // Cleanup tmux session
      await this.tmuxManager.killSession();

      // Disconnect from Discord
      this.client.destroy();

      this.logger.info("Bot shutdown completed");
    } catch (error) {
      this.logger.error(
        `Error during shutdown: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  // Load environment variables
  await load({ export: true });

  // Parse command line arguments
  const args = parseArgs(Deno.args);

  // Show help if requested
  if (args.help) {
    showHelp();
    return;
  }

  // Show version if requested
  if (args.version) {
    console.log("Claude Discord Bot v1.0.0");
    return;
  }

  // Validate environment
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    console.error("❌ Missing required environment variables:");
    for (const missing of envValidation.missing) {
      console.error(`  - ${missing}`);
    }
    console.error("\nPlease check .env.example for reference");
    Deno.exit(1);
  }

  // Get channel name
  const channelName = args.channelName ||
    Deno.env.get("DISCORD_CHANNEL_NAME") ||
    "claude";

  // Detect project context
  const projectContext = await detectProjectContext(Deno.cwd());

  // Create bot configuration
  const config: BotConfig = {
    discordToken: Deno.env.get("DISCORD_BOT_TOKEN")!,
    guildId: Deno.env.get("GUILD_ID")!,
    authorizedUserId: Deno.env.get("AUTHORIZED_USER_ID")!,
    channelName,
    projectContext,
    tmuxSessionName: Deno.env.get("TMUX_SESSION_NAME") || "claude-main",
    logLevel: (args.logLevel || Deno.env.get("LOG_LEVEL") || "info") as LogLevel,
  };

  // Create and start bot
  try {
    const bot = new ClaudeDiscordBot(config);
    await bot.start();
  } catch (error) {
    console.error(
      `❌ Failed to start bot: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}

// Run main function if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    Deno.exit(1);
  });
}
