#!/usr/bin/env -S deno run --allow-write --allow-read

// Discord Response Helper for Claude Code
// Usage: ./discord-respond.ts "Your message here"

const message = Deno.args[0];
const channelId = Deno.args[1] ||
  await Deno.readTextFile("/tmp/claude-discord-channel.txt").catch(() => "");

if (!message) {
  console.error("Usage: ./discord-respond.ts <message> [channelId]");
  Deno.exit(1);
}

const response = {
  content: message,
  channelId: channelId,
  timestamp: new Date().toISOString(),
  type: "text",
};

await Deno.writeTextFile(
  "/tmp/claude-discord-response.json",
  JSON.stringify(response, null, 2),
);

console.log("Response queued for Discord");
