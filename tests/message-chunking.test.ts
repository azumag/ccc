/**
 * Test message chunking functionality for Discord message display
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

// Mock CLI class for testing splitMessageForDiscord method
class TestDiscordBotCLI {
  /**
   * Split long messages for Discord's character limit
   */
  splitMessageForDiscord(message: string): string[] {
    const maxLength = 1900; // Discord limit minus buffer

    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    const lines = message.split("\n");
    let currentChunk = "";

    for (const line of lines) {
      // If adding this line would exceed the limit
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Add chunk indicators for multiple chunks
    if (chunks.length > 1) {
      return chunks.map((chunk, index) => {
        const indicator = `📄 **[${index + 1}/${chunks.length}]**\n\n`;
        return indicator + chunk;
      });
    }

    return chunks;
  }
}

Deno.test("message chunking - short message", () => {
  const cli = new TestDiscordBotCLI();
  const shortMessage = "Hello World";

  const result = cli.splitMessageForDiscord(shortMessage);

  assertEquals(result.length, 1);
  assertEquals(result[0], shortMessage);
});

Deno.test("message chunking - long message with array notation", () => {
  const cli = new TestDiscordBotCLI();

  // Create a message with problematic content that was missing from Discord
  const problematicContent = `
**1. オプション終了マーカー追加**
\`\`\`bash
# 修正前
["send-keys", "-t", sessionName, command]
# 修正後  
["send-keys", "-t", sessionName, "--", command]
\`\`\`

**2. Enterキーの改善**
\`\`\`bash
# 修正前
["send-keys", "-t", sessionName, "Enter"]
# 修正後
["send-keys", "-t", sessionName, "C-m"]
\`\`\`

**3. 遅延の増加**
修正前: 100ms
修正後: 150ms

これらの変更により、tmuxコマンドの送信がより確実になります。
  `.repeat(20); // Make it long enough to require chunking

  const result = cli.splitMessageForDiscord(problematicContent);

  // Should be split into multiple chunks
  assertEquals(result.length > 1, true);

  // Each chunk should have chunk indicator
  for (let i = 0; i < result.length; i++) {
    const chunk = result[i];
    if (chunk) {
      assertStringIncludes(chunk, `📄 **[${i + 1}/${result.length}]**`);
    }
  }

  // Important: Check that array notation is preserved
  const combinedResult = result.join("");
  assertStringIncludes(combinedResult, '["send-keys", "-t", sessionName, command]');
  assertStringIncludes(combinedResult, '["send-keys", "-t", sessionName, "--", command]');
  assertStringIncludes(combinedResult, '["send-keys", "-t", sessionName, "Enter"]');
  assertStringIncludes(combinedResult, '["send-keys", "-t", sessionName, "C-m"]');
});

Deno.test("message chunking - special characters preservation", () => {
  const cli = new TestDiscordBotCLI();

  const messageWithSpecialChars = `
Test with special characters:
- Array: ["item1", "item2", "item3"]
- Variable: $HOME and \${PATH}
- Option: --dangerous-permit
- Code block: \`some code\`
- Multi-line code:
\`\`\`bash
echo "test"
ls -la
\`\`\`
  `.repeat(15); // Make it long enough

  const result = cli.splitMessageForDiscord(messageWithSpecialChars);

  const combinedResult = result.join("");

  // Verify special characters are preserved
  assertStringIncludes(combinedResult, '["item1", "item2", "item3"]');
  assertStringIncludes(combinedResult, "$HOME and ${PATH}");
  assertStringIncludes(combinedResult, "--dangerous-permit");
  assertStringIncludes(combinedResult, "`some code`");
  assertStringIncludes(combinedResult, "```bash");
  assertStringIncludes(combinedResult, 'echo "test"');
});

Deno.test("message chunking - line break preservation", () => {
  const cli = new TestDiscordBotCLI();

  const multiLineMessage = "Line 1\nLine 2\nLine 3\n".repeat(200);

  const result = cli.splitMessageForDiscord(multiLineMessage);

  // Should be split into multiple chunks
  assertEquals(result.length > 1, true);

  // Each chunk should contain complete lines (no partial lines)
  for (const chunk of result) {
    // Remove chunk indicator for content check
    const content = chunk.replace(/📄 \*\*\[\d+\/\d+\]\*\*\n\n/, "");

    // Should start and end with complete lines
    assertEquals(content.includes("\nLine"), true);
  }
});

Deno.test("message chunking - empty input", () => {
  const cli = new TestDiscordBotCLI();

  const result = cli.splitMessageForDiscord("");

  assertEquals(result.length, 1);
  assertEquals(result[0], "");
});

Deno.test("message chunking - exactly at limit", () => {
  const cli = new TestDiscordBotCLI();

  // Create message exactly at the 1900 character limit
  const exactLimitMessage = "x".repeat(1900);

  const result = cli.splitMessageForDiscord(exactLimitMessage);

  assertEquals(result.length, 1);
  assertEquals(result[0], exactLimitMessage);
});

Deno.test("message chunking - just over limit", () => {
  const cli = new TestDiscordBotCLI();

  // Create message just over the 1900 character limit
  const overLimitMessage = "x".repeat(1901);

  const result = cli.splitMessageForDiscord(overLimitMessage);

  assertEquals(result.length, 2);
  assertStringIncludes(result[0]!, "📄 **[1/2]**");
  assertStringIncludes(result[1]!, "📄 **[2/2]**");
});
