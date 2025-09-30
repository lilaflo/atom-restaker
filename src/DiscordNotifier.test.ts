import { sendMessage } from "./DiscordNotifier";

global.fetch = jest.fn();

describe("DiscordNotifier", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("sendMessage", () => {
    test("should send info message with correct icon", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      await sendMessage("Test message", "info");

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "RestakeBot/1.0",
          },
          body: JSON.stringify({ content: "ℹ️ Test message" }),
        })
      );
    });

    test("should send error message with correct icon", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      await sendMessage("Error occurred", "error");

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        expect.objectContaining({
          body: JSON.stringify({ content: "❌ Error occurred" }),
        })
      );
    });

    test("should send warn message with correct icon", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      await sendMessage("Warning message", "warn");

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        expect.objectContaining({
          body: JSON.stringify({ content: "⚠️ Warning message" }),
        })
      );
    });

    test("should send success message with correct icon", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      await sendMessage("Success!", "success");

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        expect.objectContaining({
          body: JSON.stringify({ content: "✅ Success!" }),
        })
      );
    });

    test("should default to info when type is not provided", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      await sendMessage("Default message");

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/test",
        expect.objectContaining({
          body: JSON.stringify({ content: "ℹ️ Default message" }),
        })
      );
    });

    test("should not send message when webhook URL is not set", async () => {
      delete process.env["DISCORD_WEBHOOK_URL"];
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation();

      await sendMessage("Test message");

      expect(fetch).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "No webhook URL found in environment variables"
      );

      consoleErrorSpy.mockRestore();
    });

    test("should throw error when Discord API returns error", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(sendMessage("Test message")).rejects.toThrow(
        "Discord webhook error: 400 Bad Request"
      );
    });

    test("should handle network errors", async () => {
      process.env["DISCORD_WEBHOOK_URL"] =
        "https://discord.com/api/webhooks/test";
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(sendMessage("Test message")).rejects.toThrow(
        "Network error"
      );
    });
  });
});
