/**
 * Discord Channel Monitor
 * Monitors specified Discord channels and forwards messages to tmux
 */

import type { Message } from "discord.js";
import type { TmuxSessionManager } from "./tmux.ts";
import type { Logger } from "./types.ts";

export class ChannelMonitor {
  private readonly monitoredChannelIds: Set<string>;

  constructor(
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
    }
  }

  /**
   * Handle incoming Discord message and forward to tmux if from monitored channel
   */
  public async handleMessage(message: Message): Promise<void> {
    // Skip if no channels are being monitored
    if (this.monitoredChannelIds.size === 0) {
      return;
    }

    // Skip bot messages and messages from non-monitored channels
    if (message.author.bot || !this.monitoredChannelIds.has(message.channel.id)) {
      return;
    }

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
}
