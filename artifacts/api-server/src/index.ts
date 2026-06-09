import app from "./app";
import { logger } from "./lib/logger";
import { startBot, stopBot } from "./bot/index";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const gracefulShutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down gracefully");
  stopBot();
  process.exit(0);
};

process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

// Start the Telegram bot
startBot().catch((err) => {
  logger.error({ err }, "Bot startup error");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
