import { sendDiscordNotification, sendCriticalNotification } from "./notify";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { RestakeBot } from "./RestakeBot";

// Main execution function
async function main(): Promise<void> {
  const monitor = new PerformanceMonitor();
  monitor.start();

  sendCriticalNotification("🚀 Starting restake bot execution...");

  try {
    const bot = new RestakeBot();
    await bot.run();
    sendCriticalNotification("✅ Restake bot execution completed");

    monitor.checkpoint("total_execution");
    monitor.logPerformance();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendCriticalNotification(`❌ Fatal error in main: ${errorMessage}`);
    console.error("Fatal error details:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Graceful shutdown handlers
process.on("SIGTERM", () => {
  sendDiscordNotification("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  sendDiscordNotification("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

// Error handlers
process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  }
);

process.on("uncaughtException", (error: Error) => {
  sendDiscordNotification(`❌ Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((e: unknown) => {
    sendDiscordNotification(
      "❌ Fatal error:" + (e instanceof Error ? e.message : String(e))
    );
    process.exit(1);
  });
}
