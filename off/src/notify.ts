import { DiscordNotificationService } from "./DiscordNotificationService";

// Create a singleton instance of the Discord notification service
const discordService = new DiscordNotificationService();

// Backward compatibility exports - these maintain the same API as before
export const sendDiscordNotification = async (
  content: string,
  key?: string
): Promise<void> => {
  await discordService.sendNotification(content, key);
};

// Helper function for critical notifications (bypasses rate limiting)
export const sendCriticalNotification = async (
  content: string
): Promise<void> => {
  await discordService.sendCriticalNotification(content);
};

// Helper function for status updates (with rate limiting)
export const sendStatusNotification = async (
  content: string,
  key: string
): Promise<void> => {
  await discordService.sendStatusNotification(content, key);
};

// Performance monitoring for notification operations
export const sendPerformanceNotification = async (
  operation: string,
  duration: number,
  memoryUsage?: { rss: number; heapUsed: number }
): Promise<void> => {
  await discordService.sendPerformanceNotification(
    operation,
    duration,
    memoryUsage
  );
};

// Enhanced error notification with context
export const sendErrorNotification = async (
  error: unknown,
  context: string,
  isCritical: boolean = false
): Promise<void> => {
  await discordService.sendErrorNotification(error, context, isCritical);
};

// Export the service class for advanced usage
export { DiscordNotificationService } from "./DiscordNotificationService";
export { NotificationRateLimiter } from "./NotificationRateLimiter";
