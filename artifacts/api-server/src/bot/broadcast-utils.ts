import { Telegraf, Markup } from "telegraf";

export async function broadcastMessage(
  bot: Telegraf,
  userIds: number[],
  message: string,
  parseMode: "Markdown" | "HTML" | "MarkdownV2" = "Markdown",
  photoUrl?: string,
  caption?: string,
  inlineButtons?: { text: string; url: string }[][]
): Promise<{ success: number; fail: number }> {
  let success = 0;
  let fail = 0;

  for (const userId of userIds) {
    try {
      if (photoUrl) {
        if (inlineButtons && inlineButtons.length > 0) {
          await bot.telegram.sendPhoto(userId, photoUrl, {
            caption: caption || message,
            parse_mode: parseMode,
            reply_markup: Markup.inlineKeyboard(
              inlineButtons.map((row) =>
                row.map((btn) => Markup.button.url(btn.text, btn.url))
              )
            ).reply_markup,
          });
        } else {
          await bot.telegram.sendPhoto(userId, photoUrl, {
            caption: caption || message,
            parse_mode: parseMode,
          });
        }
      } else if (inlineButtons && inlineButtons.length > 0) {
        await bot.telegram.sendMessage(userId, message, {
          parse_mode: parseMode,
          reply_markup: Markup.inlineKeyboard(
            inlineButtons.map((row) =>
              row.map((btn) => Markup.button.url(btn.text, btn.url))
            )
          ).reply_markup,
        });
      } else {
        await bot.telegram.sendMessage(userId, message, {
          parse_mode: parseMode,
        });
      }
      success++;
    } catch {
      fail++;
    }
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  return { success, fail };
}
