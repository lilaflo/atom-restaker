export const sendMessage = async (
  message: string,
  type: "info" | "error" | "warn" | "success" = "info"
): Promise<void> => {
  let icon = "";
  const webHookUrl = process.env["DISCORD_WEBHOOK_URL"];

  if (!webHookUrl) {
    console.error("No webhook URL found in environment variables");
    return;
  }

  switch (type) {
    case "info":
      icon = "ℹ️";
      break;
    case "error":
      icon = "❌";
      break;
    case "warn":
      icon = "⚠️";
      break;
    case "success":
      icon = "✅";
      break;
    default:
      icon = "";
      break;
  }

  const response = await fetch(webHookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "RestakeBot/1.0",
    },
    body: JSON.stringify({ content: `${icon} ${message}` }),
  });

  if (!response.ok) {
    throw new Error(
      `Discord webhook error: ${response.status} ${response.statusText}`
    );
  }
};
