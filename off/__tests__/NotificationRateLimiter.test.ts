import { NotificationRateLimiter } from "../src/NotificationRateLimiter";
import { CONFIG } from "../src/config";

// Mock dependencies
jest.mock("../src/config");

describe("NotificationRateLimiter", () => {
  let rateLimiter: NotificationRateLimiter;
  let mockConfig: jest.Mocked<typeof CONFIG>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CONFIG
    mockConfig = {
      NOTIFICATION_COOLDOWN: 60000, // 60 seconds
    } as jest.Mocked<typeof CONFIG>;

    (CONFIG as jest.Mocked<typeof CONFIG>).NOTIFICATION_COOLDOWN =
      mockConfig.NOTIFICATION_COOLDOWN;

    rateLimiter = new NotificationRateLimiter();
  });

  describe("constructor", () => {
    test("should initialize with empty notification history", () => {
      const newRateLimiter = new NotificationRateLimiter();

      // Test that canSend returns true for any key (no history)
      expect(newRateLimiter.canSend("test-key")).toBe(true);
      // After calling canSend, the key should have a remaining cooldown (allow 1ms difference)
      const remaining = newRateLimiter.getRemainingCooldown("test-key");
      expect(
        Math.abs(remaining - CONFIG.NOTIFICATION_COOLDOWN)
      ).toBeLessThanOrEqual(1);
    });
  });

  describe("canSend", () => {
    test("should allow first notification for a key", () => {
      const result = rateLimiter.canSend("test-key");

      expect(result).toBe(true);
    });

    test("should allow notification after cooldown period", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;

      // Mock time for first notification
      Date.now = jest.fn(() => mockTime);
      rateLimiter.canSend("test-key");

      // Mock time to advance past cooldown
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN + 1000);

      const result = rateLimiter.canSend("test-key");

      expect(result).toBe(true);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should block notification during cooldown period", () => {
      // First notification
      rateLimiter.canSend("test-key");

      // Try again immediately
      const result = rateLimiter.canSend("test-key");

      expect(result).toBe(false);
    });

    test("should handle multiple keys independently", () => {
      // Send notification for key1
      expect(rateLimiter.canSend("key1")).toBe(true);
      expect(rateLimiter.canSend("key1")).toBe(false); // Should be blocked

      // Send notification for key2
      expect(rateLimiter.canSend("key2")).toBe(true);
      expect(rateLimiter.canSend("key2")).toBe(false); // Should be blocked

      // key1 should still be blocked
      expect(rateLimiter.canSend("key1")).toBe(false);
    });

    test("should update timestamp when allowing notification", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // First notification
      rateLimiter.canSend("test-key");

      // Advance time but not past cooldown
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN - 1000);
      expect(rateLimiter.canSend("test-key")).toBe(false);

      // Advance past cooldown
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN + 1000);
      expect(rateLimiter.canSend("test-key")).toBe(true);

      // Should be blocked again immediately
      expect(rateLimiter.canSend("test-key")).toBe(false);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should handle empty key", () => {
      const result = rateLimiter.canSend("");

      expect(result).toBe(true);
    });

    test("should handle special characters in key", () => {
      const specialKey = "test-key-with-special-chars!@#$%^&*()";

      expect(rateLimiter.canSend(specialKey)).toBe(true);
      expect(rateLimiter.canSend(specialKey)).toBe(false);
    });
  });

  describe("clear", () => {
    test("should clear all notification history", () => {
      // Send notifications for multiple keys
      rateLimiter.canSend("key1");
      rateLimiter.canSend("key2");
      rateLimiter.canSend("key3");

      // Verify they are blocked
      expect(rateLimiter.canSend("key1")).toBe(false);
      expect(rateLimiter.canSend("key2")).toBe(false);
      expect(rateLimiter.canSend("key3")).toBe(false);

      // Clear history
      rateLimiter.clear();

      // Verify all keys can send again
      expect(rateLimiter.canSend("key1")).toBe(true);
      expect(rateLimiter.canSend("key2")).toBe(true);
      expect(rateLimiter.canSend("key3")).toBe(true);
    });

    test("should clear empty history", () => {
      // Should not throw any errors
      expect(() => rateLimiter.clear()).not.toThrow();

      // Should still allow notifications after clearing
      expect(rateLimiter.canSend("test-key")).toBe(true);
    });
  });

  describe("getRemainingCooldown", () => {
    test("should return 0 for new key", () => {
      const remaining = rateLimiter.getRemainingCooldown("new-key");

      expect(remaining).toBe(0);
    });

    test("should return 0 for cleared key", () => {
      rateLimiter.canSend("test-key");
      rateLimiter.clear();

      const remaining = rateLimiter.getRemainingCooldown("test-key");

      expect(remaining).toBe(0);
    });

    test("should return full cooldown time immediately after notification", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      rateLimiter.canSend("test-key");

      const remaining = rateLimiter.getRemainingCooldown("test-key");

      expect(remaining).toBe(CONFIG.NOTIFICATION_COOLDOWN);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should return partial cooldown time during cooldown", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      rateLimiter.canSend("test-key");

      // Advance time by half the cooldown
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN / 2);

      const remaining = rateLimiter.getRemainingCooldown("test-key");

      expect(remaining).toBe(CONFIG.NOTIFICATION_COOLDOWN / 2);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should return 0 after cooldown period", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      rateLimiter.canSend("test-key");

      // Advance time past cooldown
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN + 1000);

      const remaining = rateLimiter.getRemainingCooldown("test-key");

      expect(remaining).toBe(0);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should handle multiple keys independently", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      rateLimiter.canSend("key1");
      rateLimiter.canSend("key2");

      // Advance time by different amounts
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN / 2);

      const remaining1 = rateLimiter.getRemainingCooldown("key1");
      const remaining2 = rateLimiter.getRemainingCooldown("key2");

      expect(remaining1).toBe(CONFIG.NOTIFICATION_COOLDOWN / 2);
      expect(remaining2).toBe(CONFIG.NOTIFICATION_COOLDOWN / 2);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should handle empty key", () => {
      const remaining = rateLimiter.getRemainingCooldown("");

      expect(remaining).toBe(0);
    });
  });

  describe("getCooldownDuration", () => {
    test("should return the configured cooldown duration", () => {
      const duration = rateLimiter.getCooldownDuration();

      expect(duration).toBe(CONFIG.NOTIFICATION_COOLDOWN);
    });

    test("should return updated duration when config changes", () => {
      const originalCooldown = CONFIG.NOTIFICATION_COOLDOWN;

      // Change the config
      (CONFIG as jest.Mocked<typeof CONFIG>).NOTIFICATION_COOLDOWN = 30000;

      const duration = rateLimiter.getCooldownDuration();

      expect(duration).toBe(30000);

      // Restore original config
      (CONFIG as jest.Mocked<typeof CONFIG>).NOTIFICATION_COOLDOWN =
        originalCooldown;
    });
  });

  describe("integration tests", () => {
    test("should work correctly with real time progression", () => {
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      // First notification
      expect(rateLimiter.canSend("test-key")).toBe(true);
      expect(rateLimiter.getRemainingCooldown("test-key")).toBe(
        CONFIG.NOTIFICATION_COOLDOWN
      );

      // Try again immediately
      expect(rateLimiter.canSend("test-key")).toBe(false);
      expect(rateLimiter.getRemainingCooldown("test-key")).toBe(
        CONFIG.NOTIFICATION_COOLDOWN
      );

      // Advance time by half cooldown
      currentTime += CONFIG.NOTIFICATION_COOLDOWN / 2;
      Date.now = jest.fn(() => currentTime);

      expect(rateLimiter.canSend("test-key")).toBe(false);
      expect(rateLimiter.getRemainingCooldown("test-key")).toBe(
        CONFIG.NOTIFICATION_COOLDOWN / 2
      );

      // Advance past cooldown
      currentTime += CONFIG.NOTIFICATION_COOLDOWN / 2 + 1000;
      Date.now = jest.fn(() => currentTime);

      expect(rateLimiter.canSend("test-key")).toBe(true);
      expect(rateLimiter.getRemainingCooldown("test-key")).toBe(
        CONFIG.NOTIFICATION_COOLDOWN
      );

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should handle rapid successive calls", () => {
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Send notification
      expect(rateLimiter.canSend("test-key")).toBe(true);

      // Rapid successive calls should all return false
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.canSend("test-key")).toBe(false);
      }

      // Advance time and try again
      Date.now = jest.fn(() => mockTime + CONFIG.NOTIFICATION_COOLDOWN + 1000);
      expect(rateLimiter.canSend("test-key")).toBe(true);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    test("should handle multiple rate limiters independently", () => {
      const rateLimiter1 = new NotificationRateLimiter();
      const rateLimiter2 = new NotificationRateLimiter();

      // Send notifications on both
      expect(rateLimiter1.canSend("same-key")).toBe(true);
      expect(rateLimiter2.canSend("same-key")).toBe(true);

      // Both should block the same key
      expect(rateLimiter1.canSend("same-key")).toBe(false);
      expect(rateLimiter2.canSend("same-key")).toBe(false);

      // Clear one rate limiter
      rateLimiter1.clear();

      // Only the cleared one should allow notifications
      expect(rateLimiter1.canSend("same-key")).toBe(true);
      expect(rateLimiter2.canSend("same-key")).toBe(false);
    });
  });
});
