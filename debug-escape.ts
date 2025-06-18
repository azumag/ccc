#!/usr/bin/env -S deno run --allow-all

function processMessageForReadability(message: string): string {
  return message
    .replace(/\\n/g, "\n") // \n to actual newline
    .replace(/\\t/g, "\t") // \t to actual tab
    .replace(/\\r/g, "\r"); // \r to carriage return
}

function analyzeString(label: string, str: string) {
  console.log(`\n=== ${label} ===`);
  console.log(`String: "${str}"`);
  console.log(`Length: ${str.length}`);
  console.log(`Characters:`);
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = char.charCodeAt(0);
    console.log(
      `  [${i}] '${
        char === "\n" ? "\\n" : char === "\t" ? "\\t" : char === "\r" ? "\\r" : char
      }' (code: ${code})`,
    );
  }
}

// Test the problematic case
const testInput = "\\\\n"; // This represents \\n in raw string
analyzeString("Input", testInput);

const result = processMessageForReadability(testInput);
analyzeString("Result", result);

console.log(`\nExpected behavior:`);
console.log(`Input "\\\\n" (2 backslashes + n) should become "\\n" (1 backslash + newline)`);
console.log(
  `But our regex /\\\\n/g matches \\n pattern, so it converts the second \\ + n to newline`,
);
console.log(`Result: first \\ remains, second \\n becomes newline = \\<newline>`);
