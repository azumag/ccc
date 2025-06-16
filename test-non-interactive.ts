#!/usr/bin/env -S deno run --allow-all
/**
 * Non-interactive test for CLI functionality
 */

import { ClaudeDiscordBotCLI } from "./cli.ts";

// Mock CLI for testing without interactive prompts
class TestCLI extends ClaudeDiscordBotCLI {
  async testNonInteractive(): Promise<void> {
    console.log("🧪 Testing CLI functionality...");
    
    // Test project detection
    const projectInfo = await this.detectProject("./test-project");
    console.log("✅ Project detection:", projectInfo);
    
    // Test file generation
    const config = {
      projectPath: "./test-project",
      channelName: "test-claude",
      tmuxSessionName: "test-session",
      logLevel: "info",
      discordToken: "test_token",
      guildId: "test_guild",
      authorizedUserId: "test_user",
    };
    
    // Test environment file generation
    const envContent = this.generateEnvFile(config);
    console.log("✅ Environment file generation");
    console.log(envContent.substring(0, 100) + "...");
    
    console.log("🎉 CLI functionality test completed successfully!");
  }
  
  // Make protected methods public for testing
  public detectProject(path: string) {
    return super.detectProject(path);
  }
  
  public generateEnvFile(config: Record<string, unknown>) {
    return super.generateEnvFile(config);
  }
}

// Run test
if (import.meta.main) {
  const testCli = new TestCLI();
  await testCli.testNonInteractive();
}