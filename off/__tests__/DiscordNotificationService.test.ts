import { DiscordNotificationService } from "../src/DiscordNotificationService";
import { NotificationRateLimiter } from "../src/NotificationRateLimiter";
import { PerformanceMonitor } from "../src/PerformanceMonitor";
import { ErrorHandler } from "../src/ErrorHandler";
import { CONFIG } from "../src/config";

// Mock dependencies
jest.mock("../src/NotificationRateLimiter");
jest.mock("../src/PerformanceMonitor");
jest.mock("../src/ErrorHandler");
jest.mock("../src/config");
jest.mock("../src/utils", () => ({
  logMemoryUsage: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("DiscordNotificationService", () => {
  let service: DiscordNotificationService;
  let mockRateLimiter: jest.Mocked<NotificationRateLimiter>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;
  let mockErrorHandler: jest.Mocked<typeof ErrorHandler>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env["DISCORD_WEBHOOK_URL"];

    // Setup mocks with all required methods
    mockRateLimiter = {
      canSend: jest.fn(),
      clear: jest.fn(),
      getRemainingCooldown: jest.fn(),
      getCooldownDuration: jest.fn(),
    } as unknown as jest.Mocked<NotificationRateLimiter>;

    mockPerformanceMonitor = {
      start: jest.fn(),
      checkpoint: jest.fn(),
      getDuration: jest.fn(),
      getCheckpointDuration: jest.fn(),
      getAllCheckpointDurations: jest.fn(),
      logPerformance: jest.fn(),
      getPerformanceReport: jest.fn(),
      reset: jest.fn(),
    } as unknown as jest.Mocked<PerformanceMonitor>;

    mockErrorHandler = {
      withRetry: jest.fn(),
      isRetryableError: jest.fn(),
      getErrorMessage: jest.fn(),
      getErrorContext: jest.fn(),
      withCustomRetry: jest.fn(),
    } as unknown as jest.Mocked<typeof ErrorHandler>;

    // Mock constructor dependencies
    (
      NotificationRateLimiter as jest.MockedClass<
        typeof NotificationRateLimiter
      >
    ).mockImplementation(() => mockRateLimiter);
    (
      PerformanceMonitor as jest.MockedClass<typeof PerformanceMonitor>
    ).mockImplementation(() => mockPerformanceMonitor);
    // Mock ErrorHandler static methods
    (ErrorHandler as jest.Mocked<typeof ErrorHandler>).withRetry =
      mockErrorHandler.withRetry;
    (ErrorHandler as jest.Mocked<typeof ErrorHandler>).isRetryableError =
      mockErrorHandler.isRetryableError;
    (ErrorHandler as jest.Mocked<typeof ErrorHandler>).getErrorMessage =
      mockErrorHandler.getErrorMessage;
    (ErrorHandler as jest.Mocked<typeof ErrorHandler>).getErrorContext =
      mockErrorHandler.getErrorContext;
    (ErrorHandler as jest.Mocked<typeof ErrorHandler>).withCustomRetry =
      mockErrorHandler.withCustomRetry;

    // Mock CONFIG
    (CONFIG as jest.Mocked<typeof CONFIG>).MAX_RETRIES = 3;

    service = new DiscordNotificationService();
  });

  describe("constructor", () => {
    test("should initialize with webhook URL from environment", () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      const newService = new DiscordNotificationService();

      // Access private property for testing
      const webhookUrl = (newService as any).webhookUrl;
      expect(webhookUrl).toBe("https://discord.com/api/webhooks/test");
    });

    test("should initialize without webhook URL when not set", () => {
      delete process.env["DISCORD_WEBHOOK_URL"];
      const newService = new DiscordNotificationService();

      const webhookUrl = (newService as any).webhookUrl;
      expect(webhookUrl).toBeUndefined();
    });
  });

  describe("sendNotification", () => {
    beforeEach(() => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      service = new DiscordNotificationService();
    });

    test("should send notification successfully", async () => {
      const mockResponse = { ok: true, status: 200 };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      mockRateLimiter.canSend.mockReturnValue(true);
      mockPerformanceMonitor.getDuration.mockReturnValue(100);

      // Make the withRetry mock actually call the function
      mockErrorHandler.withRetry.mockImplementation(async (operation) => {
        return await operation();
      });

      await service.sendNotification("Test message", "test-key");

      expect(mockPerformanceMonitor.start).toHaveBeenCalled();
      expect(mockErrorHandler.withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        3,
        1000
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "RestakeBot/1.0",
          },
          body: JSON.stringify({ content: "Test message" }),
        }
      );
    });

    test("should not send notification when webhook URL is not set", async () => {
      delete process.env["DISCORD_WEBHOOK_URL"];
      service = new DiscordNotificationService();

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      await service.sendNotification("Test message");

      expect(consoleSpy).toHaveBeenCalledWith(
        "⚠️ DISCORD_WEBHOOK_URL is not set."
      );
      expect(global.fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test("should respect rate limiting when key is provided", async () => {
      mockRateLimiter.canSend.mockReturnValue(false);
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await service.sendNotification("Test message", "rate-limited-key");

      expect(mockRateLimiter.canSend).toHaveBeenCalledWith("rate-limited-key");
      expect(consoleSpy).toHaveBeenCalledWith(
        "⏸️ Rate limited notification: Test message..."
      );
      expect(global.fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test("should handle Discord API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      mockRateLimiter.canSend.mockReturnValue(true);

      // Make the withRetry mock actually call the function and throw error
      mockErrorHandler.withRetry.mockImplementation(async (operation) => {
        return await operation();
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const { logMemoryUsage } = require("../src/utils");

      await service.sendNotification("Test message", "test-key");

      expect(consoleSpy).toHaveBeenCalledWith(
        "❌ Error sending Discord message:",
        expect.stringContaining("Discord webhook error: 429 Too Many Requests")
      );
      expect(logMemoryUsage).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
      mockRateLimiter.canSend.mockReturnValue(true);

      // Make the withRetry mock actually call the function and throw error
      mockErrorHandler.withRetry.mockImplementation(async (operation) => {
        return await operation();
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const { logMemoryUsage } = require("../src/utils");

      await service.sendNotification("Test message", "test-key");

      expect(consoleSpy).toHaveBeenCalledWith(
        "❌ Error sending Discord message:",
        "Network error"
      );
      expect(logMemoryUsage).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test("should log performance metrics for slow notifications", async () => {
      const mockResponse = { ok: true, status: 200 };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      mockRateLimiter.canSend.mockReturnValue(true);
      mockPerformanceMonitor.getDuration.mockReturnValue(6000); // 6 seconds

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await service.sendNotification("Test message", "test-key");

      expect(consoleSpy).toHaveBeenCalledWith(
        "⏱️ Discord notification took 6000ms"
      );

      consoleSpy.mockRestore();
    });

    test("should not log performance metrics for fast notifications", async () => {
      const mockResponse = { ok: true, status: 200 };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      mockRateLimiter.canSend.mockReturnValue(true);
      mockPerformanceMonitor.getDuration.mockReturnValue(1000); // 1 second

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await service.sendNotification("Test message", "test-key");

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("⏱️ Discord notification took")
      );

      consoleSpy.mockRestore();
    });

    test("should handle critical error notifications", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error("Critical error")
      );
      mockRateLimiter.canSend.mockReturnValue(true);

      // Make the withRetry mock actually call the function and throw error
      mockErrorHandler.withRetry.mockImplementation(async (operation) => {
        return await operation();
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await service.sendNotification("Critical error message", "critical");

      expect(consoleSpy).toHaveBeenCalledWith(
        "🔴 Critical notification failed:",
        "Critical error message"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("sendCriticalNotification", () => {
    test("should call sendNotification with critical key", async () => {
      const sendNotificationSpy = jest
        .spyOn(service, "sendNotification")
        .mockResolvedValue();

      await service.sendCriticalNotification("Critical message");

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        "Critical message",
        "critical"
      );

      sendNotificationSpy.mockRestore();
    });
  });

  describe("sendStatusNotification", () => {
    test("should call sendNotification with provided key", async () => {
      const sendNotificationSpy = jest
        .spyOn(service, "sendNotification")
        .mockResolvedValue();

      await service.sendStatusNotification("Status message", "status-key");

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        "Status message",
        "status-key"
      );

      sendNotificationSpy.mockRestore();
    });
  });

  describe("sendPerformanceNotification", () => {
    test("should send performance notification with basic info", async () => {
      const sendNotificationSpy = jest
        .spyOn(service, "sendNotification")
        .mockResolvedValue();

      await service.sendPerformanceNotification("test-operation", 1500);

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        "⏱️ test-operation: 1500ms",
        "performance_test-operation"
      );

      sendNotificationSpy.mockRestore();
    });

    test("should send performance notification with memory usage", async () => {
      const sendNotificationSpy = jest
        .spyOn(service, "sendNotification")
        .mockResolvedValue();
      const memoryUsage = { rss: 1024, heapUsed: 512 };

      await service.sendPerformanceNotification(
        "test-operation",
        1500,
        memoryUsage
      );

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        "⏱️ test-operation: 1500ms | Memory: 512MB used, 1024MB total",
        "performance_test-operation"
      );

      sendNotificationSpy.mockRestore();
    });
  });

  describe("sendErrorNotification", () => {
    test("should send non-critical error notification", async () => {
      const sendNotificationSpy = jest
        .spyOn(service, "sendNotification")
        .mockResolvedValue();
      const error = new Error("Test error");

      await service.sendErrorNotification(error, "test-context", false);

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        "❌ test-context: Test error",
        "error_test-context"
      );

      sendNotificationSpy.mockRestore();
    });

    test("should send critical error notification", async () => {
      const sendCriticalNotificationSpy = jest
        .spyOn(service, "sendCriticalNotification")
        .mockResolvedValue();
      const error = new Error("Critical error");

      await service.sendErrorNotification(error, "critical-context", true);

      expect(sendCriticalNotificationSpy).toHaveBeenCalledWith(
        "❌ critical-context: Critical error"
      );

      sendCriticalNotificationSpy.mockRestore();
    });

    test("should handle non-Error objects", async () => {
      const sendNotificationSpy = jest
        .spyOn(service, "sendNotification")
        .mockResolvedValue();
      const error = "String error";

      await service.sendErrorNotification(error, "test-context", false);

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        "❌ test-context: String error",
        "error_test-context"
      );

      sendNotificationSpy.mockRestore();
    });
  });

  describe("clearRateLimiter", () => {
    test("should clear the rate limiter", () => {
      service.clearRateLimiter();

      expect(mockRateLimiter.clear).toHaveBeenCalled();
    });
  });

  describe("getRateLimiter", () => {
    test("should return the rate limiter instance", () => {
      const rateLimiter = service.getRateLimiter();

      expect(rateLimiter).toBe(mockRateLimiter);
    });
  });
});
