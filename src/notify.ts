export const sendDiscordNotification = async (
  message: string
): Promise<void> => {
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  if (!webhookUrl) {
    console.warn("⚠️ DISCORD_WEBHOOK_URL is not set.");
    return;
  }

  const timestamp = new Date().toLocaleString("de-DE");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `[${timestamp}]: ${message}` }),
    });
    console.log("📣 Discord notification sent.");
  } catch (error) {
    console.error("❌ Error sending Discord message:", error);
  }
};
