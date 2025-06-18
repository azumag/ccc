/**
 * Tests for message readability improvements in send-to-discord command
 */

import { assertEquals } from "jsr:@std/assert";

/**
 * Mock version of the processMessageForReadability function
 * Mirrors the implementation from cli.ts and cli-standalone.ts
 */
function processMessageForReadability(message: string): string {
  return message
    // Convert common escape sequences to actual characters for readability
    .replace(/\\n/g, "\n") // \n to actual newline
    .replace(/\\t/g, "\t") // \t to actual tab
    .replace(/\\r/g, "\r"); // \r to carriage return
  // Keep security-sensitive characters escaped (these should remain escaped)
  // Dollar signs, backticks, double quotes etc. are left as-is for security
}

Deno.test("Message readability - converts escape sequences", () => {
  const input = "Line1\\nLine2\\nLine3";
  const expected = "Line1\nLine2\nLine3";
  const result = processMessageForReadability(input);

  assertEquals(result, expected, "Should convert \\n to actual newlines");
  assertEquals(result.includes("\\n"), false, "Should not contain literal \\n");
  assertEquals(result.includes("\n"), true, "Should contain actual newlines");
});

Deno.test("Message readability - converts tab sequences", () => {
  const input = "Col1\\tCol2\\tCol3";
  const expected = "Col1\tCol2\tCol3";
  const result = processMessageForReadability(input);

  assertEquals(result, expected, "Should convert \\t to actual tabs");
  assertEquals(result.includes("\\t"), false, "Should not contain literal \\t");
  assertEquals(result.includes("\t"), true, "Should contain actual tabs");
});

Deno.test("Message readability - converts carriage return sequences", () => {
  const input = "Text\\rOverwrite";
  const expected = "Text\rOverwrite";
  const result = processMessageForReadability(input);

  assertEquals(result, expected, "Should convert \\r to actual carriage returns");
  assertEquals(result.includes("\\r"), false, "Should not contain literal \\r");
  assertEquals(result.includes("\r"), true, "Should contain actual carriage returns");
});

Deno.test("Message readability - preserves security-sensitive characters", () => {
  const input = 'Variable: $HOME and ${PATH} and `command` and "quoted"';
  const result = processMessageForReadability(input);

  // These should remain unchanged for security
  assertEquals(result, input, "Should preserve dollar signs, backticks, and quotes");
});

Deno.test("Message readability - handles user reported case", () => {
  const input =
    `タスクが完了しました:\\n\\n1. TODOコメント抽出とissue作成 ✅\\n   - 29件のTODOを発見\\n   - 7件のGitHub issue（#181-#187）を作成\\n\\n2. リスク管理ポジション問題の調査 ✅\\n   - 原因: 両APIが同じgetAllPositionsRedisを使用\\n   - 未約定注文が含まれていない\\n   - 解決にはgetRiskPositionsの修正が必要\\n\\n3. コミット&プッシュ完了 ✅`;

  const expected = `タスクが完了しました:

1. TODOコメント抽出とissue作成 ✅
   - 29件のTODOを発見
   - 7件のGitHub issue（#181-#187）を作成

2. リスク管理ポジション問題の調査 ✅
   - 原因: 両APIが同じgetAllPositionsRedisを使用
   - 未約定注文が含まれていない
   - 解決にはgetRiskPositionsの修正が必要

3. コミット&プッシュ完了 ✅`;

  const result = processMessageForReadability(input);

  assertEquals(result, expected, "Should convert user's problematic message correctly");
  assertEquals(result.includes("\\n"), false, "Should not contain any literal \\n sequences");

  // Count actual newlines in result
  const newlineCount = (result.match(/\n/g) || []).length;
  assertEquals(newlineCount, 11, "Should have correct number of actual newlines");
});

Deno.test("Message readability - handles mixed escape sequences", () => {
  const input = "Header\\n\\tIndented line\\n\\tAnother tab\\nEnd";
  const expected = "Header\n\tIndented line\n\tAnother tab\nEnd";
  const result = processMessageForReadability(input);

  assertEquals(result, expected, "Should handle mixed newlines and tabs");
});

Deno.test("Message readability - no change for normal text", () => {
  const input = "Normal text without escape sequences.";
  const result = processMessageForReadability(input);

  assertEquals(result, input, "Should not modify normal text");
});

Deno.test("Message readability - handles empty and edge cases", () => {
  assertEquals(processMessageForReadability(""), "", "Should handle empty string");
  assertEquals(processMessageForReadability("\\n"), "\n", "Should handle single newline");
  // Note: \\n in the input string is actually two backslashes followed by n
  // The regex \\n will match the second backslash + n and convert it to newline
  // So \\\\n becomes \\\n (first backslash remains, second backslash+n becomes newline)
  assertEquals(
    processMessageForReadability("\\\\n"),
    "\\\n",
    "Should handle escaped backslash followed by n",
  );
});

Deno.test("Message readability - prevents double conversion", () => {
  const input = "Already\\nprocessed\\nmessage";
  const firstPass = processMessageForReadability(input);
  const secondPass = processMessageForReadability(firstPass);

  assertEquals(firstPass, secondPass, "Should be idempotent - no change on second pass");
});

Deno.test("Message readability - preserves actual newlines mixed with escaped", () => {
  const input = "Real newline:\nEscaped newline:\\nEnd";
  const expected = "Real newline:\nEscaped newline:\nEnd";
  const result = processMessageForReadability(input);

  assertEquals(result, expected, "Should handle mix of real and escaped newlines");
  assertEquals((result.match(/\n/g) || []).length, 2, "Should have 2 actual newlines");
});
