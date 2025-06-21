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

  // Message buffering configuration
  private messageBuffer: Map<string, { messages: Message[]; timer?: number }> = new Map();
  private readonly BUFFER_TIMEOUT_MS = 120000; // 2 minutes
  private readonly MAX_BUFFER_SIZE = 10; // Maximum messages to buffer before forcing execution

  constructor(config: BotConfig) {
    this.config = config;
    this.logger = new SimpleLogger(config.logLevel);
    this.tmuxManager = new TmuxSessionManager(
      config.tmuxSessionName,
      this.logger,
      config.useDangerouslySkipPermissions || false,
      config.enableResume || false,
      config.enableContinue || false,
    );
    this.claudeExecutor = new ClaudeCodeExecutor(
      this.tmuxManager,
      config.projectContext,
      this.logger,
      config.enableUltraThink || false,
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
      this.logger.debug(
        `Message received from ${message.author.tag} (${message.author.id}) in channel ${message.channel.id}, bot: ${message.author.bot}, webhook: ${
          message.webhookId ? "true" : "false"
        }`,
      );

      // Skip messages from this bot itself
      if (message.author.id === this.client.user?.id) {
        this.logger.debug(`Skipping message from self: ${message.author.id}`);
        return;
      }

      if (message.channel.id !== this.targetChannelId) {
        this.logger.debug(
          `Message not in target channel. Expected: ${this.targetChannelId}, Got: ${message.channel.id}`,
        );
        return;
      }

      this.logger.info(
        `Processing message from ${message.author.tag} (webhook: ${
          message.webhookId ? "yes" : "no"
        }): ${message.content.substring(0, 100)}...`,
      );
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
    const instanceId = Math.random().toString(36).substring(7);

    try {
      this.logger.info(
        `[ENTRY] handleChannelMessage called for ${message.author.tag} [Instance: ${instanceId}]`,
      );
      this.logger.info(`[STEP 1] Starting message processing [Instance: ${instanceId}]`);

      this.logger.info(`[STEP 2] Getting message content [Instance: ${instanceId}]`);
      const content = message.content.trim();
      this.logger.info(
        `[STEP 3] Content obtained: "${content.substring(0, 50)}..." [Instance: ${instanceId}]`,
      );

      this.logger.info(`[STEP 4] Updating stats [Instance: ${instanceId}]`);
      this.stats.messagesProcessed++;
      this.stats.lastActivity = new Date();
      this.logger.info(`[STEP 5] Stats updated [Instance: ${instanceId}]`);

      this.logger.info(
        `Processing message from ${message.author.tag}: ${content.substring(0, 100)}...`,
      );
      this.logger.info(`[STEP 6] First processing log completed [Instance: ${instanceId}]`);
      this.logger.info(`Full message content: "${content}"`);
      this.logger.info(`[STEP 7] Full content log completed [Instance: ${instanceId}]`);

      // Check for special commands
      this.logger.info(`[STEP 8] Checking for special commands [Instance: ${instanceId}]`);
      this.logger.info("Checking for special commands...");
      this.logger.info(`[STEP 9] Special command check started [Instance: ${instanceId}]`);

      const specialCommand = this.specialCommands.find((cmd) => content.startsWith(cmd.name));
      this.logger.info(
        `[STEP 10] Special command search completed, found: ${
          specialCommand ? specialCommand.name : "none"
        } [Instance: ${instanceId}]`,
      );

      if (specialCommand) {
        this.logger.info(
          `[STEP 11] Executing special command: ${specialCommand.name} [Instance: ${instanceId}]`,
        );
        await specialCommand.handler(message);
        this.logger.info(`[STEP 12] Special command execution completed [Instance: ${instanceId}]`);
        return;
      }

      this.logger.info(
        `[STEP 11] No special command detected, adding to buffer [Instance: ${instanceId}]`,
      );
      this.logger.info("No special command detected, adding message to buffer");

      // Add message to buffer
      await this.addMessageToBuffer(message);

      this.logger.info(
        `[EXIT] handleChannelMessage completed for ${message.author.tag} [Instance: ${instanceId}]`,
      );
    } catch (error) {
      this.logger.error(
        `[ERROR] Error in handleChannelMessage [Instance: ${instanceId}]: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.logger.error(
        `[ERROR] Error stack [Instance: ${instanceId}]: ${
          error instanceof Error ? error.stack : "No stack trace"
        }`,
      );

      try {
        await message.reply(
          `❌ メッセージ処理中にエラーが発生しました: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } catch (replyError) {
        this.logger.error(
          `[ERROR] Failed to send error reply [Instance: ${instanceId}]: ${replyError}`,
        );
      }
    }
  }

  /**
   * Add message to buffer and handle buffer processing
   */
  private async addMessageToBuffer(message: Message): Promise<void> {
    const channelId = message.channel.id;

    // Get or create buffer for this channel
    let buffer = this.messageBuffer.get(channelId);
    if (!buffer) {
      buffer = { messages: [] };
      this.messageBuffer.set(channelId, buffer);
    }

    // Add message to buffer
    buffer.messages.push(message);
    this.logger.info(`Added message to buffer. Buffer size: ${buffer.messages.length}`);

    // Check if buffer is full
    if (buffer.messages.length >= this.MAX_BUFFER_SIZE) {
      this.logger.info(`Buffer reached max size (${this.MAX_BUFFER_SIZE}), processing immediately`);
      await this.processBufferedMessages(channelId);
      return;
    }

    // Clear existing timer
    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }

    // Set new timer
    buffer.timer = setTimeout(async () => {
      this.logger.info(`Buffer timeout reached, processing ${buffer.messages.length} messages`);
      await this.processBufferedMessages(channelId);
    }, this.BUFFER_TIMEOUT_MS) as unknown as number;

    // Send acknowledgment for the first message
    if (buffer.messages.length === 1) {
      await message.react("⏳");
      this.logger.info("Added waiting reaction to first message");
    }
  }

  /**
   * Process all buffered messages for a channel
   */
  private async processBufferedMessages(channelId: string): Promise<void> {
    const buffer = this.messageBuffer.get(channelId);
    if (!buffer || buffer.messages.length === 0) {
      return;
    }

    // Clear timer
    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = undefined;
    }

    // Get messages and clear buffer
    const messages = [...buffer.messages];
    buffer.messages = [];

    this.logger.info(`Processing ${messages.length} buffered messages`);

    // Combine all message contents
    const combinedPrompt = messages.map((msg, index) => {
      return `[メッセージ ${index + 1} from ${msg.author.username}]: ${msg.content}`;
    }).join("\n\n");

    this.logger.info(`Combined prompt:\n${combinedPrompt.substring(0, 500)}...`);

    // Use the first message for context and replies
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    if (!firstMessage || !lastMessage) {
      this.logger.error("No messages to process in buffer");
      return;
    }

    // Remove waiting reaction from first message
    await firstMessage.reactions.cache.get("⏳")?.remove().catch(() => {});

    // Execute combined prompt
    await this.executeClaudePrompt(lastMessage, combinedPrompt);
  }

  /**
   * Execute Claude prompt and respond
   */
  private async executeClaudePrompt(message: Message, prompt: string): Promise<void> {
    const instanceId = Math.random().toString(36).substring(7);
    let thinkingMessage: Message | null = null;

    try {
      this.logger.info(
        `[CLAUDE-STEP 1] Starting Claude execution for message from ${message.author.tag} [Instance: ${instanceId}]`,
      );

      // Send thinking message
      this.logger.info(`[CLAUDE-STEP 2] Sending thinking message [Instance: ${instanceId}]`);
      thinkingMessage = await message.reply("🤔 考えています...");
      this.logger.info(
        `[CLAUDE-STEP 3] Thinking message sent successfully [Instance: ${instanceId}]`,
      );
      this.logger.debug("Thinking message sent");

      // Execute Claude prompt
      this.logger.info(`[CLAUDE-STEP 4] About to execute Claude prompt [Instance: ${instanceId}]`);
      this.logger.info(`Executing Claude prompt: ${prompt.substring(0, 200)}...`);
      this.logger.info(
        `[CLAUDE-STEP 5] Calling claudeExecutor.executePrompt [Instance: ${instanceId}]`,
      );

      const response = await this.claudeExecutor.executePrompt(prompt, message.channel.id);

      this.logger.info(`[CLAUDE-STEP 6] Claude execution completed [Instance: ${instanceId}]`);
      this.logger.info(`Claude execution completed, success: ${response.success}`);

      // Update thinking message
      this.logger.info(`[CLAUDE-STEP 7] Deleting thinking message [Instance: ${instanceId}]`);
      await thinkingMessage.delete();
      this.logger.info(`[CLAUDE-STEP 8] Adding reaction [Instance: ${instanceId}]`);
      await message.react("👀");
      this.logger.info(`[CLAUDE-STEP 9] Reaction added [Instance: ${instanceId}]`);

      // Send response(s)
      this.logger.info(`[CLAUDE-STEP 10] Formatting responses [Instance: ${instanceId}]`);
      const formattedResponses = this.claudeExecutor.formatResponseForDiscord(response);
      this.logger.info(
        `[CLAUDE-STEP 11] Got ${formattedResponses.length} formatted responses [Instance: ${instanceId}]`,
      );

      for (let i = 0; i < formattedResponses.length; i++) {
        const formattedResponse = formattedResponses[i];
        this.logger.info(
          `[CLAUDE-STEP 12.${i + 1}] Sending response ${
            i + 1
          }/${formattedResponses.length} [Instance: ${instanceId}]`,
        );
        if ("send" in message.channel && formattedResponse) {
          await message.channel.send(formattedResponse);
          this.logger.info(
            `[CLAUDE-STEP 12.${i + 1}] Response ${
              i + 1
            } sent successfully [Instance: ${instanceId}]`,
          );
        }
      }

      this.logger.info(`[CLAUDE-STEP 13] Updating stats [Instance: ${instanceId}]`);
      this.stats.commandsExecuted++;
      this.logger.info(
        `[CLAUDE-STEP 14] Claude prompt executed successfully in ${response.executionTime}ms [Instance: ${instanceId}]`,
      );
      this.logger.info(`Claude prompt executed successfully in ${response.executionTime}ms`);
    } catch (error) {
      this.logger.error(
        `[CLAUDE-ERROR] Failed to execute Claude prompt [Instance: ${instanceId}]: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.logger.error(
        `[CLAUDE-ERROR] Error stack [Instance: ${instanceId}]: ${
          error instanceof Error ? error.stack : "No stack trace"
        }`,
      );
      this.logger.error(
        `Failed to execute Claude prompt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (thinkingMessage) {
        this.logger.info(
          `[CLAUDE-ERROR] Editing thinking message to show error [Instance: ${instanceId}]`,
        );
        await thinkingMessage.edit("❌ エラーが発生しました");
      }

      this.logger.info(`[CLAUDE-ERROR] Sending error reply [Instance: ${instanceId}]`);
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
      // Remove signal listeners
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");

      // Stop response monitor
      if (this.responseMonitorInterval) {
        clearInterval(this.responseMonitorInterval);
      }

      // Clear all message buffer timers
      for (const [channelId, buffer] of this.messageBuffer.entries()) {
        if (buffer.timer) {
          clearTimeout(buffer.timer);
        }
        // Process any remaining buffered messages
        if (buffer.messages.length > 0) {
          this.logger.info(
            `Processing ${buffer.messages.length} buffered messages before shutdown`,
          );
          await this.processBufferedMessages(channelId);
        }
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
  await load({ export: true, envPath: ".ccc.env" });

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
  const channelName = args.channel ||
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
