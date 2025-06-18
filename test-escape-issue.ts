#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to reproduce the escape issue reported by user
 */

// The actual message that user reported as problematic
const userMessage =
  `タスクが完了しました:\\n\\n1. TODOコメント抽出とissue作成 ✅\\n   - 29件のTODOを発見\\n   - 7件のGitHub issue（#181-#187）を作成\\n\\n2. リスク管理ポジション問題の調査 ✅\\n   - 原因: 両APIが同じgetAllPositionsRedisを使用\\n   - 未約定注文が含まれていない\\n   - 解決にはgetRiskPositionsの修正が必要\\n\\n3. コミット&プッシュ完了 ✅`;

// Test case 1: Message with literal \n strings (what user is seeing)
console.log("=== Test 1: Message with literal \\n strings ===");
console.log("Raw message:");
console.log(userMessage);
console.log("\nLength:", userMessage.length);
console.log("Contains literal \\n:", userMessage.includes("\\n"));
console.log("Contains actual newline:", userMessage.includes("\n"));

// Test case 2: Message with actual newlines (what user wants)
const expectedMessage = userMessage.replace(/\\n/g, "\n");
console.log("\n=== Test 2: Message with actual newlines ===");
console.log("Expected message:");
console.log(expectedMessage);
console.log("\nLength:", expectedMessage.length);
console.log("Contains literal \\n:", expectedMessage.includes("\\n"));
console.log("Contains actual newline:", expectedMessage.includes("\n"));

// Test case 3: Show the difference
console.log("\n=== Test 3: Character-by-character comparison ===");
const literalExample = "Line1\\nLine2";
const newlineExample = "Line1\nLine2";

console.log("Literal \\n version:");
for (let i = 0; i < literalExample.length; i++) {
  const char = literalExample[i];
  const code = char.charCodeAt(0);
  console.log(`  [${i}] '${char}' (code: ${code})`);
}

console.log("\nActual newline version:");
for (let i = 0; i < newlineExample.length; i++) {
  const char = newlineExample[i];
  const code = char.charCodeAt(0);
  console.log(`  [${i}] '${char === "\n" ? "\\n" : char}' (code: ${code})`);
}

// Test case 4: Simulate the issue in send-to-discord command
console.log("\n=== Test 4: Simulating send-to-discord behavior ===");

// Simulate what might be happening
const simulatedMessage = {
  content: userMessage, // This has literal \n
  timestamp: new Date().toISOString(),
  type: "claude-response",
};

console.log("JSON serialized:");
console.log(JSON.stringify(simulatedMessage, null, 2));

// Now let's see what happens when we parse it back
const parsed = JSON.parse(JSON.stringify(simulatedMessage));
console.log("\nParsed content preview:");
console.log(parsed.content.substring(0, 100) + "...");
console.log("Still has literal \\n:", parsed.content.includes("\\n"));
