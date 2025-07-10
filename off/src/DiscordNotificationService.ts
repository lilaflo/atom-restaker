import { CONFIG } from "./config";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { ErrorHandler } from "./ErrorHandler";
import { logMemoryUsage } from "./utils";
import { NotificationRateLimiter } from "./NotificationRateLimiter";

/**
 * Service for handling Discord webhook notifications with performance monitoring and retry logic
 */
export class DiscordNotificationService {
  private rateLimiter: NotificationRateLimiter;
  private performanceMonitor: PerformanceMonitor;
  private webhookUrl: string | undefined;

  constructor() {
    this.rateLimiter = new NotificationRateLimiter();
    this.performanceMonitor = new PerformanceMonitor();
    this.webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  }

  /**
   * Send a Discord notification with rate limiting and performance monitoring
   * @param content - The message content to send
   * @param key - Optional key for rate limiting
   * @returns Promise that resolves when notification is sent
   */
  async sendNotification(content: string, key?: string): Promise<void> {
    if (!this.webhookUrl) {
      console.warn("⚠️ DISCORD_WEBHOOK_URL is not set.");
      return;
    }

    // Apply rate limiting if key is provided
    if (key && !this.rateLimiter.canSend(key)) {
      console.log(
        `⏸️ Rate limited notification: ${content.substring(0, 50)}...`
      );
      return;
    }

    // Start performance monitoring for this notification
    this.performanceMonitor.start();

    try {
      await ErrorHandler.withRetry(
        async () => {
          const response = await fetch(this.webhookUrl!, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "RestakeBot/1.0",
            },
            body: JSON.stringify({ content }),
          });

          if (!response.ok) {
            throw new Error(
              `Discord webhook error: ${response.status} ${response.statusText}`
            );
          }

          this.performanceMonitor.checkpoint("discord_notification_sent");
          console.log(`✅ Discord notification sent successfully`);
        },
        CONFIG.MAX_RETRIES,
        1000 // 1 second base delay
      );

      // Log performance metrics
      const duration = this.performanceMonitor.getDuration();
      if (duration > 5000) {
        // Only log if it took more than 5 seconds
        console.log(`⏱️ Discord notification took ${duration}ms`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Error sending Discord message:", errorMessage);

      // Log memory usage on error for debugging
      logMemoryUsage();

      // Only send critical error notifications to avoid spam
      if (key === "critical") {
        console.error(
          "🔴 Critical notification failed:",
          content.substring(0, 100)
        );
      }
    }
  }

  /**
   * Send a critical notification (bypasses rate limiting)
   * @param content - The message content to send
   */
  async sendCriticalNotification(content: string): Promise<void> {
    await this.sendNotification(content, "critical");
  }

  /**
   * Send a status update notification (with rate limiting)
   * @param content - The message content to send
   * @param key - Key for rate limiting
   */
  async sendStatusNotification(content: string, key: string): Promise<void> {
    await this.sendNotification(content, key);
  }

  /**
   * Send a performance notification with memory usage
   * @param operation - Name of the operation
   * @param duration - Duration in milliseconds
   * @param memoryUsage - Optional memory usage data
   */
  async sendPerformanceNotification(
    operation: string,
    duration: number,
    memoryUsage?: { rss: number; heapUsed: number }
  ): Promise<void> {
    let content = `⏱️ ${operation}: ${duration}ms`;

    if (memoryUsage) {
      content += ` | Memory: ${memoryUsage.heapUsed}MB used, ${memoryUsage.rss}MB total`;
    }

    await this.sendNotification(content, `performance_${operation}`);
  }

  /**
   * Send an error notification with context
   * @param error - The error object
   * @param context - Context where the error occurred
   * @param isCritical - Whether this is a critical error
   */
  async sendErrorNotification(
    error: unknown,
    context: string,
    isCritical: boolean = false
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const content = `❌ ${context}: ${errorMessage}`;

    if (isCritical) {
      await this.sendCriticalNotification(content);
    } else {
      await this.sendNotification(content, `error_${context}`);
    }
  }

  /**
   * Clear the rate limiter history
   */
  clearRateLimiter(): void {
    this.rateLimiter.clear();
  }

  /**
   * Get the rate limiter instance for external access
   */
  getRateLimiter(): NotificationRateLimiter {
    return this.rateLimiter;
  }
}
