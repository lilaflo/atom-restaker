import { CONFIG } from "./config";

/**
 * Rate limiting for notifications to prevent spam
 */
export class NotificationRateLimiter {
  private lastNotification = new Map<string, number>();

  /**
   * Check if a notification can be sent based on rate limiting
   * @param key - Unique identifier for the notification type
   * @returns true if notification can be sent, false if rate limited
   */
  canSend(key: string): boolean {
    const lastTime = this.lastNotification.get(key);
    const now = Date.now();

    if (!lastTime || now - lastTime > CONFIG.NOTIFICATION_COOLDOWN) {
      this.lastNotification.set(key, now);
      return true;
    }
    return false;
  }

  /**
   * Clear all rate limiting history
   */
  clear(): void {
    this.lastNotification.clear();
  }

  /**
   * Get the remaining cooldown time for a specific key
   * @param key - Unique identifier for the notification type
   * @returns remaining cooldown time in milliseconds, or 0 if no cooldown
   */
  getRemainingCooldown(key: string): number {
    const lastTime = this.lastNotification.get(key);
    if (!lastTime) return 0;

    const elapsed = Date.now() - lastTime;
    return Math.max(0, CONFIG.NOTIFICATION_COOLDOWN - elapsed);
  }

  /**
   * Get the cooldown duration in milliseconds
   */
  getCooldownDuration(): number {
    return CONFIG.NOTIFICATION_COOLDOWN;
  }
}
