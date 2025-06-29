/**
 * Discord Channel Monitor
 * Monitors specified Discord channels and forwards messages to tmux
 */

import type { Client, Message, TextChannel } from "discord.js";
import type { TmuxSessionManager } from "./tmux.ts";
import type { Logger } from "./types.ts";

export class ChannelMonitor {
  private readonly monitoredChannelIds: Set<string>;
  private statusReportInterval?: number;

  constructor(
    private client: Client,
    private tmuxManager: TmuxSessionManager,
    private logger: Logger,
    monitoredChannels: string[] = [],
  ) {
    this.monitoredChannelIds = new Set(monitoredChannels);

    if (this.monitoredChannelIds.size > 0) {
      this.logger.info(
        `📡 Channel monitor initialized for ${this.monitoredChannelIds.size} channels: ${
          Array.from(this.monitoredChannelIds).join(", ")
        }`,
      );
      this.startStatusReporting();
    }
  }

  /**
   * Handle incoming Discord message and forward to tmux if from monitored channel
   */
  public async handleMessage(message: Message): Promise<void> {
    // Skip if no channels are being monitored
    if (this.monitoredChannelIds.size === 0) {
      this.logger.debug("📡 No channels being monitored, skipping message");
      return;
    }

    // Skip bot messages and messages from non-monitored channels
    if (message.author.bot) {
      this.logger.debug(`📡 Skipping bot message from ${message.author.username}`);
      return;
    }

    if (!this.monitoredChannelIds.has(message.channel.id)) {
      this.logger.debug(
        `📡 Message from non-monitored channel ${message.channel.id}, monitored: [${
          Array.from(this.monitoredChannelIds).join(", ")
        }]`,
      );
      return;
    }

    this.logger.info(
      `📡 Processing monitored message from ${message.author.username} in channel ${message.channel.id}`,
    );

    try {
      // Format message with context information
      const channelName = this.getChannelName(message);
      const authorName = message.author.username || message.author.displayName;
      const timestamp = new Date().toLocaleTimeString("ja-JP", {
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
          `❌ Failed to forward message from #${channelName} to tmux (sendCommand returned false)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error forwarding message to tmux: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      // Log additional context for debugging
      this.logger.debug(
        `Error context: channel=${message.channel.id}, author=${message.author.id}, content_length=${message.content.length}`,
      );
    }
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
  }

  /**
   * Remove a channel from monitoring list
   */
  public removeChannel(channelId: string): boolean {
    const removed = this.monitoredChannelIds.delete(channelId);
    if (removed) {
      this.logger.info(`📡 Removed channel ${channelId} from monitoring list`);
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
   * Start periodic status reporting (every hour)
   */
  private startStatusReporting(): void {
    const ONE_HOUR_IN_MS = 60 * 60 * 1000;
    this.logger.info(`🕒 Scheduling channel monitor status reports every 1 hour`);

    // Clear any existing timer
    if (this.statusReportInterval) {
      clearInterval(this.statusReportInterval);
    }

    this.statusReportInterval = setInterval(async () => {
      await this.reportStatus();
    }, ONE_HOUR_IN_MS) as unknown as number;
  }

  /**
   * Report current monitoring status to monitored channels
   */
  public async reportStatus(): Promise<void> {
    if (this.monitoredChannelIds.size === 0) {
      return;
    }

    const currentTime = new Date().toLocaleString("ja-JP");
    const statusMessage = `🕒 **監視ステータス** (${currentTime})\n` +
      `現在 ${this.monitoredChannelIds.size} チャンネルを監視中です。\n` +
      `メッセージは tmux セッションに転送されています。`;

    this.logger.info("📡 Reporting channel monitor status...");

    for (const channelId of this.monitoredChannelIds) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          await (channel as TextChannel).send(statusMessage);
          this.logger.info(`✅ Status report sent to channel ${channelId}`);
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to send status report to channel ${channelId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /**
   * Stop periodic status reporting
   */
  public stopStatusReporting(): void {
    if (this.statusReportInterval) {
      clearInterval(this.statusReportInterval);
      this.statusReportInterval = undefined;
      this.logger.info("⏹️ Stopped channel monitor status reporting");
    }
  }
}
