/**
 * Shared utility functions for Claude Discord Bot CLI
 */

export const VERSION = "1.25.0";

export function getHomeDirectory(): string {
  return Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "/tmp";
}

export function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}時間${minutes % 60}分`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function chunkString(str: string, maxLength: number): string[] {
  if (str.length <= maxLength) return [str];

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < str.length) {
    chunks.push(str.slice(currentIndex, currentIndex + maxLength));
    currentIndex += maxLength;
  }

  return chunks;
}
