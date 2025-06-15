/**
 * Discord API interface for Claude Code
 * This module provides functions that Claude Code can use to post messages to Discord
 */

import { Client, TextChannel } from "discord.js";
// Using Deno built-in APIs

export interface DiscordMessage {
  content: string;
  channelId: string;
  timestamp: string;
  type?: "text" | "code" | "error";
}

export class DiscordAPIBridge {
  private static RESPONSE_FILE = "/tmp/claude-discord-response.json";
  private static COMMAND_FILE = "/tmp/claude-discord-command.json";

  /**
   * Write a response for the bot to pick up
   */
  static async writeResponse(message: DiscordMessage): Promise<void> {
    await Deno.writeTextFile(
      DiscordAPIBridge.RESPONSE_FILE,
      JSON.stringify(message, null, 2),
    );
  }

  /**
   * Read pending responses
   */
  static async readResponse(): Promise<DiscordMessage | null> {
    try {
      const content = await Deno.readTextFile(DiscordAPIBridge.RESPONSE_FILE);
      await Deno.remove(DiscordAPIBridge.RESPONSE_FILE); // Clean up after reading
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Write a command for Claude Code to execute
   */
  static async writeCommand(channelId: string, prompt: string): Promise<void> {
    const command = {
      channelId,
      prompt,
      timestamp: new Date().toISOString(),
    };
    await Deno.writeTextFile(
      DiscordAPIBridge.COMMAND_FILE,
      JSON.stringify(command, null, 2),
    );
  }

  /**
   * Create helper script for Claude Code
   */
  static generateClaudeHelperScript(): string {
    return `#!/usr/bin/env deno run --allow-write --allow-read

// Discord Response Helper for Claude Code
// Usage: ./discord-respond.ts "Your message here"

const message = Deno.args[0];
const channelId = Deno.args[1] || await Deno.readTextFile("/tmp/claude-discord-channel.txt").catch(() => "");

if (!message) {
  console.error("Usage: ./discord-respond.ts <message> [channelId]");
  Deno.exit(1);
}

const response = {
  content: message,
  channelId: channelId,
  timestamp: new Date().toISOString(),
  type: "text"
};

await Deno.writeTextFile(
  "/tmp/claude-discord-response.json",
  JSON.stringify(response, null, 2)
);

console.log("Response queued for Discord");
`;
  }
}