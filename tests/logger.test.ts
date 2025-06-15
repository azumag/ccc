/**
 * Tests for SimpleLogger
 */

import { assertEquals } from "@std/assert";
import { SimpleLogger } from "../src/logger.ts";

Deno.test("SimpleLogger - constructor", () => {
  const logger = new SimpleLogger("info");
  assertEquals(typeof logger, "object");
});

Deno.test("SimpleLogger - default log level", () => {
  const logger = new SimpleLogger();
  // Should not throw
  logger.info("test message");
});

Deno.test("SimpleLogger - setLevel", () => {
  const logger = new SimpleLogger("error");
  logger.setLevel("debug");
  // Should not throw
  logger.debug("debug message");
});

Deno.test("SimpleLogger - log level filtering", () => {
  // Capture console output
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  let logCalls = 0;
  let warnCalls = 0;
  let errorCalls = 0;

  console.log = () => {
    logCalls++;
  };
  console.warn = () => {
    warnCalls++;
  };
  console.error = () => {
    errorCalls++;
  };

  try {
    const logger = new SimpleLogger("warn");

    // These should not be logged (below warn level)
    logger.debug("debug message");
    logger.info("info message");

    // These should be logged (warn level and above)
    logger.warn("warn message");
    logger.error("error message");

    assertEquals(logCalls, 0); // debug and info use console.log
    assertEquals(warnCalls, 1); // warn uses console.warn
    assertEquals(errorCalls, 1); // error uses console.error
  } finally {
    // Restore original console methods
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
});

Deno.test("SimpleLogger - log with additional arguments", () => {
  const originalLog = console.log;
  let capturedMessage = "";

  console.log = (message: string) => {
    capturedMessage = message;
  };

  try {
    const logger = new SimpleLogger("debug");
    logger.debug("test message", "arg1", "arg2");

    assertEquals(capturedMessage.includes("test message"), true);
    assertEquals(capturedMessage.includes("arg1"), true);
    assertEquals(capturedMessage.includes("arg2"), true);
  } finally {
    console.log = originalLog;
  }
});

Deno.test("SimpleLogger - message formatting", () => {
  const originalLog = console.log;
  let capturedMessage = "";

  console.log = (message: string) => {
    capturedMessage = message;
  };

  try {
    const logger = new SimpleLogger("info");
    logger.info("test message");

    // Check timestamp format (ISO string)
    assertEquals(capturedMessage.includes("["), true);
    assertEquals(capturedMessage.includes("T"), true);
    assertEquals(capturedMessage.includes("Z]"), true);

    // Check log level
    assertEquals(capturedMessage.includes("INFO"), true);

    // Check message
    assertEquals(capturedMessage.includes("test message"), true);
  } finally {
    console.log = originalLog;
  }
});

Deno.test("SimpleLogger - all log levels", () => {
  const logger = new SimpleLogger("debug");

  // Should not throw for any log level
  logger.debug("debug");
  logger.info("info");
  logger.warn("warn");
  logger.error("error");
});
