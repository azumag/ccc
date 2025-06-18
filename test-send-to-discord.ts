#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to reproduce send-to-discord message parsing issues
 */

// Test various message formats that might cause shell interpretation issues
const testMessages = [
  // Basic message - should work
  "Hello World",

  // Message with array notation - might cause issues
  'Array: ["send-keys", "-t", "session", "command"]',

  // Message with shell meta characters
  "Command with -- option and Enter key",

  // Message with backticks
  "Code: `some code here`",

  // Message with dollar signs
  "Variable: $HOME and ${PATH}",

  // Message with complex formatting
  `✅ Test Report:

**1. Array Example**
- Before: ["old", "command"] 
- After: ["new", "command"]

**2. Shell Meta Characters**
- Enter key: "Enter"
- Carriage return: "C-m"
- Option terminator: "--"

**3. File Paths**
tests/some-file.test.ts`,
];

// Function to simulate the parseArgs behavior
function simulateParseArgs(args: string[]): Record<string, unknown> {
  // This simulates what parseArgs does with the CLI arguments
  const result = { _: [] as string[] };

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      // Handle options
      const option = args[i].substring(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[option] = args[i + 1];
        i++; // Skip next argument
      } else {
        result[option] = true;
      }
    } else {
      result._.push(args[i]);
    }
  }

  return result;
}

// Test message extraction
console.log("=== Testing send-to-discord message extraction ===\n");

for (let i = 0; i < testMessages.length; i++) {
  const message = testMessages[i];
  console.log(`Test ${i + 1}: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`);

  // Simulate CLI args: ["send-to-discord", message, "--session", "test"]
  const args = ["send-to-discord", message, "--session", "test"];
  const parsed = simulateParseArgs(args);

  // Extract message like the real code does
  const extractedMessage = parsed._[1] as string;

  console.log(`Original length: ${message.length}`);
  console.log(`Extracted length: ${extractedMessage ? extractedMessage.length : "undefined"}`);
  console.log(`Match: ${message === extractedMessage}`);

  if (message !== extractedMessage) {
    console.log("❌ MISMATCH!");
    console.log(`Expected: ${JSON.stringify(message)}`);
    console.log(`Got: ${JSON.stringify(extractedMessage)}`);
  } else {
    console.log("✅ OK");
  }

  console.log();
}

// Test JSON serialization
console.log("=== Testing JSON serialization ===\n");

const testMessage = `Test with special chars: ["array"] and $VARIABLE and --option`;
const pendingMessage = {
  content: testMessage,
  timestamp: new Date().toISOString(),
  type: "claude-response",
};

const serialized = JSON.stringify(pendingMessage, null, 2);
console.log("Serialized message:");
console.log(serialized);

const parsed = JSON.parse(serialized);
console.log(`\nParsed content matches: ${parsed.content === testMessage}`);

console.log("\n=== Test complete ===");
