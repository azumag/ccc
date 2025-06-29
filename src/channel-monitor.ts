/**
 * Discord Channel Monitor
 * Periodically monitors specified Discord channels and forwards messages to tmux
 */

import type { Client, Message, TextChannel } from "discord.js";
import type { TmuxSessionManager } from "./tmux.ts";
import type { Logger } from "./types.ts";

export class ChannelMonitor {
  private readonly monitoredChannelIds: Set<string>;
  private monitorInterval?: number;
  private lastMessageIds: Map<string, string> = new Map();
  private targetChannelId?: string;
  private startTime: Date;

  constructor(
    private client: Client,
    private tmuxManager: TmuxSessionManager,
    private logger: Logger,
    monitoredChannels: string[] = [],
    private intervalMs: number = 60 * 60 * 1000, // Default 1 hour
  ) {
    this.monitoredChannelIds = new Set(monitoredChannels);
    this.startTime = new Date(); // Record start time

    if (this.monitoredChannelIds.size > 0) {
      this.logger.info(
        `📡 Channel monitor initialized for ${this.monitoredChannelIds.size} channels: ${
          Array.from(this.monitoredChannelIds).join(", ")
        }`,
      );
      this.logger.info(
        `⏰ Monitor interval: ${this.intervalMs / 1000 / 60} minutes`,
      );
      this.logger.info(`🕒 Start time: ${this.startTime.toISOString()}`);
    }
  }

  /**
   * Set the target channel ID for status reports
   */
  public setTargetChannelId(channelId: string): void {
    this.targetChannelId = channelId;
    this.logger.info(`📡 Set target channel for status reports: ${channelId}`);
  }

  /**
   * Start periodic monitoring
   */
  public startMonitoring(): void {
    if (this.monitoredChannelIds.size === 0) {
      this.logger.info("📡 No channels to monitor, skipping monitoring setup");
      return;
    }

    this.logger.info(
      `🕒 Starting periodic channel monitoring every ${this.intervalMs / 1000 / 60} minutes`,
    );

    // Clear any existing interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Run immediately on start
    this.checkMonitoredChannels();

    // Then run periodically
    this.monitorInterval = setInterval(async () => {
      await this.checkMonitoredChannels();
    }, this.intervalMs) as unknown as number;
  }

  /**
   * Check all monitored channels for new messages
   */
  private async checkMonitoredChannels(): Promise<void> {
    this.logger.info("📡 Checking monitored channels for new messages...");

    for (const channelId of this.monitoredChannelIds) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          this.logger.warn(`❌ Channel ${channelId} not found or not text-based`);
          continue;
        }

        const textChannel = channel as TextChannel;

        // Get last message ID for this channel
        const lastMessageId = this.lastMessageIds.get(channelId);

        // If no last message ID, use start time to avoid processing old messages
        const fetchOptions: { limit: number; after?: string } = { limit: 100 };

        if (lastMessageId) {
          fetchOptions.after = lastMessageId;
        } else {
          // First time: get recent messages but only process those after start time
          // Don't set 'after' to get some recent messages, but filter them by timestamp
          this.logger.info(`📡 First check for channel ${channelId}, filtering by start time`);
        }

        // Fetch messages
        const messages = await textChannel.messages.fetch(fetchOptions);

        if (messages.size === 0) {
          this.logger.debug(`📡 No new messages in channel ${channelId}`);
          continue;
        }

        this.logger.info(`📡 Found ${messages.size} new messages in channel ${channelId}`);

        // Process messages in chronological order, but filter by start time if it's the first check
        const allMessages = Array.from(messages.values()).sort(
          (a, b) => a.createdTimestamp - b.createdTimestamp,
        );

        // Filter messages: only process those created after the monitor started
        const messagesToProcess = allMessages.filter((message) => {
          if (lastMessageId) {
            // Not first check - process all fetched messages
            return true;
          } else {
            // First check - only process messages created after start time
            const messageTime = message.createdAt;
            const shouldProcess = messageTime > this.startTime;
            if (!shouldProcess) {
              this.logger.debug(
                `📡 Skipping old message from ${messageTime.toISOString()} (before start time ${this.startTime.toISOString()})`,
              );
            }
            return shouldProcess;
          }
        });

        this.logger.info(
          `📡 Processing ${messagesToProcess.length} messages (${allMessages.length} fetched) in channel ${channelId}`,
        );

        for (const message of messagesToProcess) {
          await this.processMessage(message);
        }

        // Update last message ID - use the newest fetched message to track position
        const newestMessage = allMessages[allMessages.length - 1];
        if (newestMessage) {
          this.lastMessageIds.set(channelId, newestMessage.id);
        }
      } catch (error) {
        this.logger.error(
          `❌ Error checking channel ${channelId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Send status report to target channel
    await this.sendStatusReport();
  }

  /**
   * Process a single message
   */
  private async processMessage(message: Message): Promise<void> {
    // Skip bot messages (but allow webhook messages)
    if (message.author.bot && !message.webhookId) {
      return;
    }

    try {
      // Format message with context information
      const channelName = this.getChannelName(message);
      const authorName = message.author.username || message.author.displayName;
      const timestamp = message.createdAt.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Create formatted message for tmux
      const formattedMessage =
        `[${timestamp}][Discord][#${channelName}][${authorName}]: ${message.content}`;

      this.logger.debug(
        `📨 Forwarding message from channel #${channelName} by ${authorName} to tmux`,
      );

      // Send to tmux session
      const success = await this.tmuxManager.sendPrompt(formattedMessage);

      if (success) {
        this.logger.info(
          `✅ Successfully forwarded message from #${channelName} to tmux`,
        );
      } else {
        this.logger.error(
          `❌ Failed to forward message from #${channelName} to tmux`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error processing message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send status report (log only, not sent to Discord)
   */
  private sendStatusReport(): void {
    const currentTime = new Date().toLocaleString("ja-JP");
    const statusMessage = `🕒 監視ステータス (${currentTime})\n` +
      `現在 ${this.monitoredChannelIds.size} チャンネルを定期監視中です。\n` +
      `次回チェック: ${new Date(Date.now() + this.intervalMs).toLocaleTimeString("ja-JP")}`;

    // Only log to console, don't send to Discord
    this.logger.info(statusMessage);
  }

  /**
   * Get channel name for display purposes
   */
  private getChannelName(message: Message): string {
    if (message.channel.isDMBased()) {
      return "DM";
    }

    if ("name" in message.channel && message.channel.name) {
      return message.channel.name;
    }

    return `channel-${message.channel.id}`;
  }

  /**
   * Add a channel to monitoring list
   */
  public addChannel(channelId: string): void {
    this.monitoredChannelIds.add(channelId);
    this.logger.info(`📡 Added channel ${channelId} to monitoring list`);

    // Restart monitoring with new channel
    if (this.monitorInterval) {
      this.startMonitoring();
    }
  }

  /**
   * Remove a channel from monitoring list
   */
  public removeChannel(channelId: string): boolean {
    const removed = this.monitoredChannelIds.delete(channelId);
    if (removed) {
      this.logger.info(`📡 Removed channel ${channelId} from monitoring list`);
      this.lastMessageIds.delete(channelId);
    }
    return removed;
  }

  /**
   * Get list of monitored channel IDs
   */
  public getMonitoredChannels(): string[] {
    return Array.from(this.monitoredChannelIds);
  }

  /**
   * Check if a channel is being monitored
   */
  public isMonitoring(channelId: string): boolean {
    return this.monitoredChannelIds.has(channelId);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      this.logger.info("⏹️ Stopped channel monitoring");
    }
  }
}
