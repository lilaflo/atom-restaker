import { sendDiscordNotification } from "./notify";

async function main(): Promise<void> {
  const message = "This is a re-stake test";
  await sendDiscordNotification(message);
}

main();
