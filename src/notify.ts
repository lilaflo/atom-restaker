export const sendDiscordNotification = async (
  content: string
): Promise<void> => {
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  if (!webhookUrl) {
    console.warn("⚠️ DISCORD_WEBHOOK_URL is not set.");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    console.log("📣 Discord notification sent.");
  } catch (error) {
    console.error("❌ Error sending Discord message:", error);
  }
};
