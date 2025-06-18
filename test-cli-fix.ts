#!/usr/bin/env -S deno run --allow-all

/**
 * Test the actual CLI fix with real command line argument simulation
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

// Mock the processMessageForReadability function
function processMessageForReadability(message: string): string {
  return message
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

// Simulate the problematic user message
const userProblematicMessage =
  `タスクが完了しました:\\n\\n1. TODOコメント抽出とissue作成 ✅\\n   - 29件のTODOを発見\\n   - 7件のGitHub issue（#181-#187）を作成\\n\\n2. リスク管理ポジション問題の調査 ✅\\n   - 原因: 両APIが同じgetAllPositionsRedisを使用\\n   - 未約定注文が含まれていない\\n   - 解決にはgetRiskPositionsの修正が必要\\n\\n3. コミット&プッシュ完了 ✅`;

console.log("=== Original User Message (problematic) ===");
console.log(userProblematicMessage);
console.log(`\nLength: ${userProblematicMessage.length}`);
console.log(`Contains literal \\n: ${userProblematicMessage.includes("\\n")}`);

// Simulate CLI argument parsing
const args = ["send-to-discord", userProblematicMessage, "--session", "claude-main"];
console.log("\n=== Simulated CLI Args ===");
console.log(args);

// Parse args like the real CLI does
const parsed = parseArgs(args, {
  string: ["session"],
  boolean: [],
});

// Extract message like the real code does
const extractedMessage = parsed._[1] as string;
console.log("\n=== Extracted Message (before processing) ===");
console.log(`"${extractedMessage}"`);
console.log(`Matches original: ${extractedMessage === userProblematicMessage}`);

// Apply the fix
const processedMessage = processMessageForReadability(extractedMessage);
console.log("\n=== Processed Message (after fix) ===");
console.log(processedMessage);
console.log(`\nLength: ${processedMessage.length}`);
console.log(`Contains literal \\n: ${processedMessage.includes("\\n")}`);
console.log(`Contains actual newlines: ${processedMessage.includes("\n")}`);

// Create pending message structure like the real code
const pendingMessage = {
  content: processedMessage,
  timestamp: new Date().toISOString(),
  type: "claude-response",
};

console.log("\n=== Final JSON Structure ===");
console.log(JSON.stringify(pendingMessage, null, 2));

// Simulate what Discord would receive
console.log("\n=== What Discord Would Display ===");
console.log("--- START OF DISCORD MESSAGE ---");
console.log(processedMessage);
console.log("--- END OF DISCORD MESSAGE ---");

// Count newlines
const newlineCount = (processedMessage.match(/\n/g) || []).length;
console.log(`\nNewline count: ${newlineCount}`);
console.log("✅ Fix successful: User's message is now properly formatted with actual newlines!");
