import { Telegraf, Markup, Context } from "telegraf";
import { message } from "telegraf/filters";
import { db } from "@workspace/db";
import {
  usersTable,
  joinRequestsTable,
  botSettingsTable,
  welcomeMessagesTable,
  approvalMessagesTable,
  rejectionMessagesTable,
  adminUsersTable,
  analyticsTable,
  autoRulesTable,
  channelsTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

export const bot = new Telegraf(BOT_TOKEN);

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key: string, defaultValue = ""): Promise<string> {
  try {
    const result = await db
      .select()
      .from(botSettingsTable)
      .where(eq(botSettingsTable.key, key))
      .limit(1);
    return result[0]?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

async function getActiveWelcomeMessage() {
  const msgs = await db
    .select()
    .from(welcomeMessagesTable)
    .where(eq(welcomeMessagesTable.isActive, true))
    .limit(1);
  return msgs[0] ?? null;
}

async function getActiveApprovalMessage() {
  const msgs = await db
    .select()
    .from(approvalMessagesTable)
    .where(eq(approvalMessagesTable.isActive, true))
    .limit(1);
  return msgs[0] ?? null;
}

async function getActiveRejectionMessage() {
  const msgs = await db
    .select()
    .from(rejectionMessagesTable)
    .where(eq(rejectionMessagesTable.isActive, true))
    .limit(1);
  return msgs[0] ?? null;
}

async function isAdmin(telegramId: number): Promise<boolean> {
  const admin = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.telegramId, telegramId))
    .limit(1);
  return admin.length > 0;
}

async function upsertUser(telegramUser: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_bot?: boolean;
  is_premium?: boolean;
}) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramUser.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(usersTable).values({
      telegramId: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      languageCode: telegramUser.language_code,
      isBot: telegramUser.is_bot ?? false,
      isPremium: telegramUser.is_premium ?? false,
    });
  } else {
    await db
      .update(usersTable)
      .set({
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        lastSeenAt: new Date(),
      })
      .where(eq(usersTable.telegramId, telegramUser.id));
  }
}

async function updateDailyAnalytics(field: string) {
  const today = new Date().toISOString().split("T")[0];
  const existing = await db
    .select()
    .from(analyticsTable)
    .where(eq(analyticsTable.date, today))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(analyticsTable).values({
      date: today,
      totalRequests: field === "totalRequests" ? 1 : 0,
      approved: field === "approved" ? 1 : 0,
      rejected: field === "rejected" ? 1 : 0,
      newUsers: field === "newUsers" ? 1 : 0,
    });
  } else {
    await db
      .update(analyticsTable)
      .set({
        [field]: sql`${analyticsTable[field as keyof typeof analyticsTable]} + 1`,
      })
      .where(eq(analyticsTable.date, today));
  }
}

async function sendApprovalDm(userId: number) {
  try {
    const approvalMsg = await getActiveApprovalMessage();
    const parseMode = (approvalMsg?.parseMode ?? "Markdown") as
      | "Markdown"
      | "HTML"
      | "MarkdownV2";
    const text =
      approvalMsg?.messageText ??
      "🎉 *Congratulations!* Your join request has been approved. Welcome to the channel!";

    const inlineButtons = approvalMsg?.inlineButtons as
      | { text: string; url: string }[][]
      | null;

    if (approvalMsg?.photoFileId || approvalMsg?.photoUrl) {
      const photo = approvalMsg.photoFileId || approvalMsg.photoUrl!;
      if (inlineButtons && Array.isArray(inlineButtons)) {
        await bot.telegram.sendPhoto(userId, photo, {
          caption: text,
          parse_mode: parseMode,
          reply_markup: Markup.inlineKeyboard(
            inlineButtons.map((row) =>
              row.map((btn) => Markup.button.url(btn.text, btn.url))
            )
          ).reply_markup,
        });
      } else {
        await bot.telegram.sendPhoto(userId, photo, {
          caption: text,
          parse_mode: parseMode,
        });
      }
    } else if (inlineButtons && Array.isArray(inlineButtons)) {
      await bot.telegram.sendMessage(userId, text, {
        parse_mode: parseMode,
        reply_markup: Markup.inlineKeyboard(
          inlineButtons.map((row) =>
            row.map((btn) => Markup.button.url(btn.text, btn.url))
          )
        ).reply_markup,
      });
    } else {
      await bot.telegram.sendMessage(userId, text, { parse_mode: parseMode });
    }
  } catch (err) {
    logger.error({ err, userId }, "Failed to send approval DM");
  }
}

async function sendRejectionDm(userId: number, reason?: string) {
  try {
    const rejectionMsg = await getActiveRejectionMessage();
    const parseMode = (rejectionMsg?.parseMode ?? "Markdown") as
      | "Markdown"
      | "HTML"
      | "MarkdownV2";
    let text =
      rejectionMsg?.messageText ??
      "We're sorry, your join request has been declined.";
    if (reason) {
      text += `\n\n*Reason:* ${reason}`;
    }
    await bot.telegram.sendMessage(userId, text, { parse_mode: parseMode });
  } catch (err) {
    logger.error({ err, userId }, "Failed to send rejection DM");
  }
}

async function checkAutoRules(
  username?: string
): Promise<{ action: string } | null> {
  const rules = await db
    .select()
    .from(autoRulesTable)
    .where(eq(autoRulesTable.isActive, true))
    .orderBy(desc(autoRulesTable.priority));

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, "i");
      if (rule.ruleType === "username" && username && regex.test(username)) {
        return { action: rule.action };
      }
      if (rule.ruleType === "any") {
        return { action: rule.action };
      }
    } catch {
      // invalid regex, skip
    }
  }
  return null;
}

// ─── /start command ────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  await upsertUser(user);
  await updateDailyAnalytics("newUsers");

  const customStart = await getSetting("custom_start_message");
  const maintenanceMode = await getSetting("maintenance_mode", "false");

  if (maintenanceMode === "true") {
    await ctx.reply(
      "🔧 The bot is currently under maintenance. Please try again later."
    );
    return;
  }

  const welcomeMsg = await getActiveWelcomeMessage();

  if (welcomeMsg) {
    const parseMode = (welcomeMsg.parseMode ?? "Markdown") as
      | "Markdown"
      | "HTML"
      | "MarkdownV2";
    const text = welcomeMsg.messageText;
    const inlineButtons = welcomeMsg.inlineButtons as
      | { text: string; url: string }[][]
      | null;

    try {
      if (welcomeMsg.photoFileId || welcomeMsg.photoUrl) {
        const photo = welcomeMsg.photoFileId || welcomeMsg.photoUrl!;
        if (inlineButtons && Array.isArray(inlineButtons)) {
          await ctx.replyWithPhoto(photo, {
            caption: text,
            parse_mode: parseMode,
            reply_markup: Markup.inlineKeyboard(
              inlineButtons.map((row) =>
                row.map((btn) => Markup.button.url(btn.text, btn.url))
              )
            ).reply_markup,
          });
        } else {
          await ctx.replyWithPhoto(photo, {
            caption: text,
            parse_mode: parseMode,
          });
        }
      } else if (inlineButtons && Array.isArray(inlineButtons)) {
        await ctx.reply(text, {
          parse_mode: parseMode,
          reply_markup: Markup.inlineKeyboard(
            inlineButtons.map((row) =>
              row.map((btn) => Markup.button.url(btn.text, btn.url))
            )
          ).reply_markup,
        });
      } else {
        await ctx.reply(text, { parse_mode: parseMode });
      }
      return;
    } catch (err) {
      logger.error({ err }, "Failed to send welcome message, using fallback");
    }
  }

  const text =
    customStart ||
    `*Welcome to True Request Acceptor!* 🤖

I help manage join requests for private Telegram channels.

*What I do:*
• Process join requests automatically
• Notify you when approved
• Send custom welcome messages

Use /help to see all available commands.`;

  await ctx.reply(text, { parse_mode: "Markdown" });
});

// ─── /help command ─────────────────────────────────────────────────────────────

bot.command("help", async (ctx) => {
  const customHelp = await getSetting("custom_help_message");
  const adminMode = await isAdmin(ctx.from?.id ?? 0);

  if (customHelp) {
    await ctx.reply(customHelp, { parse_mode: "Markdown" });
    return;
  }

  const userHelp = `*True Request Acceptor — Help*

*Available Commands:*
/start — Welcome message
/help — Show this help
/status — Check your request status
/info — Bot information
/myid — Get your Telegram ID`;

  const adminHelp = adminMode
    ? `

*Admin Commands:*
/pending — List pending requests
/approve [user_id] — Approve a request
/reject [user_id] [reason] — Reject a request
/broadcast [message] — Broadcast to all users
/stats — View bot statistics
/blacklist [user_id] — Blacklist a user
/unblacklist [user_id] — Remove from blacklist
/admins — List bot admins
/settings — View current settings`
    : "";

  await ctx.reply(userHelp + adminHelp, { parse_mode: "Markdown" });
});

// ─── /myid command ─────────────────────────────────────────────────────────────

bot.command("myid", async (ctx) => {
  const id = ctx.from?.id;
  await ctx.reply(
    `Your Telegram ID: \`${id}\``,
    { parse_mode: "Markdown" }
  );
});

// ─── /info command ─────────────────────────────────────────────────────────────

bot.command("info", async (ctx) => {
  const botInfo = await bot.telegram.getMe();
  await ctx.reply(
    `*Bot Information*\n\nName: ${botInfo.first_name}\nUsername: @${botInfo.username}\nID: \`${botInfo.id}\`\n\n_True Request Acceptor v1.0_`,
    { parse_mode: "Markdown" }
  );
});

// ─── /status command ───────────────────────────────────────────────────────────

bot.command("status", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const requests = await db
    .select()
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.userId, userId))
    .orderBy(desc(joinRequestsTable.requestedAt))
    .limit(5);

  if (requests.length === 0) {
    await ctx.reply(
      "You have no join requests on record.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const lines = requests.map((r) => {
    const status =
      r.status === "approved"
        ? "✅ Approved"
        : r.status === "rejected"
        ? "❌ Rejected"
        : "⏳ Pending";
    return `*${r.channelTitle ?? "Unknown Channel"}*: ${status}`;
  });

  await ctx.reply(`*Your Recent Requests:*\n\n${lines.join("\n")}`, {
    parse_mode: "Markdown",
  });
});

// ─── /pending command (admin) ──────────────────────────────────────────────────

bot.command("pending", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized to use this command.");
    return;
  }

  const pending = await db
    .select()
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "pending"))
    .orderBy(desc(joinRequestsTable.requestedAt))
    .limit(10);

  if (pending.length === 0) {
    await ctx.reply("No pending join requests.");
    return;
  }

  const lines = pending.map(
    (r) =>
      `• User ID: \`${r.userId}\` — Channel: ${r.channelTitle ?? r.channelId}`
  );
  await ctx.reply(
    `*Pending Requests (${pending.length}):*\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown" }
  );
});

// ─── /approve command (admin) ──────────────────────────────────────────────────

bot.command("approve", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const args = ctx.message.text.split(" ");
  const targetUserId = args[1] ? parseInt(args[1]) : null;

  if (!targetUserId) {
    await ctx.reply("Usage: /approve [user_id]");
    return;
  }

  const requests = await db
    .select()
    .from(joinRequestsTable)
    .where(
      and(
        eq(joinRequestsTable.userId, targetUserId),
        eq(joinRequestsTable.status, "pending")
      )
    )
    .limit(1);

  if (requests.length === 0) {
    await ctx.reply(`No pending request found for user ID ${targetUserId}`);
    return;
  }

  const req = requests[0];

  try {
    await bot.telegram.approveChatJoinRequest(req.channelId, targetUserId);
  } catch (err) {
    logger.warn({ err }, "Could not call approveChatJoinRequest via Telegram");
  }

  await db
    .update(joinRequestsTable)
    .set({
      status: "approved",
      processedAt: new Date(),
      processedBy: ctx.from?.id,
    })
    .where(eq(joinRequestsTable.id, req.id));

  await updateDailyAnalytics("approved");
  await sendApprovalDm(targetUserId);

  await ctx.reply(`✅ Approved request for user \`${targetUserId}\``, {
    parse_mode: "Markdown",
  });
});

// ─── /reject command (admin) ───────────────────────────────────────────────────

bot.command("reject", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const args = ctx.message.text.split(" ");
  const targetUserId = args[1] ? parseInt(args[1]) : null;
  const reason = args.slice(2).join(" ");

  if (!targetUserId) {
    await ctx.reply("Usage: /reject [user_id] [optional reason]");
    return;
  }

  const requests = await db
    .select()
    .from(joinRequestsTable)
    .where(
      and(
        eq(joinRequestsTable.userId, targetUserId),
        eq(joinRequestsTable.status, "pending")
      )
    )
    .limit(1);

  if (requests.length === 0) {
    await ctx.reply(`No pending request found for user ID ${targetUserId}`);
    return;
  }

  const req = requests[0];

  try {
    await bot.telegram.declineChatJoinRequest(req.channelId, targetUserId);
  } catch (err) {
    logger.warn({ err }, "Could not call declineChatJoinRequest");
  }

  await db
    .update(joinRequestsTable)
    .set({
      status: "rejected",
      processedAt: new Date(),
      processedBy: ctx.from?.id,
      rejectionReason: reason || null,
    })
    .where(eq(joinRequestsTable.id, req.id));

  await updateDailyAnalytics("rejected");
  await sendRejectionDm(targetUserId, reason);

  await ctx.reply(`❌ Rejected request for user \`${targetUserId}\``, {
    parse_mode: "Markdown",
  });
});

// ─── /stats command (admin) ────────────────────────────────────────────────────

bot.command("stats", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable);
  const [approvedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "approved"));
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "pending"));
  const [rejectedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "rejected"));

  await ctx.reply(
    `*Bot Statistics*\n\n` +
      `👥 Total Users: ${userCount?.count ?? 0}\n` +
      `✅ Approved: ${approvedCount?.count ?? 0}\n` +
      `❌ Rejected: ${rejectedCount?.count ?? 0}\n` +
      `⏳ Pending: ${pendingCount?.count ?? 0}`,
    { parse_mode: "Markdown" }
  );
});

// ─── /broadcast command (admin) ────────────────────────────────────────────────

bot.command("broadcast", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const text = ctx.message.text.replace("/broadcast", "").trim();
  if (!text) {
    await ctx.reply("Usage: /broadcast [message]");
    return;
  }

  const users = await db.select().from(usersTable);
  let sent = 0;
  let failed = 0;

  await ctx.reply(`Broadcasting to ${users.length} users...`);

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegramId, text, {
        parse_mode: "Markdown",
      });
      sent++;
    } catch {
      failed++;
    }
    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  await ctx.reply(
    `✅ Broadcast complete!\n\nDelivered: ${sent}\nFailed: ${failed}`
  );
});

// ─── /blacklist command (admin) ────────────────────────────────────────────────

bot.command("blacklist", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const args = ctx.message.text.split(" ");
  const targetUserId = args[1] ? parseInt(args[1]) : null;
  const reason = args.slice(2).join(" ");

  if (!targetUserId) {
    await ctx.reply("Usage: /blacklist [user_id] [optional reason]");
    return;
  }

  await db
    .update(usersTable)
    .set({ isBlacklisted: true, blacklistReason: reason || "No reason given" })
    .where(eq(usersTable.telegramId, targetUserId));

  await ctx.reply(
    `🚫 User \`${targetUserId}\` has been blacklisted.`,
    { parse_mode: "Markdown" }
  );
});

// ─── /unblacklist command (admin) ──────────────────────────────────────────────

bot.command("unblacklist", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const args = ctx.message.text.split(" ");
  const targetUserId = args[1] ? parseInt(args[1]) : null;

  if (!targetUserId) {
    await ctx.reply("Usage: /unblacklist [user_id]");
    return;
  }

  await db
    .update(usersTable)
    .set({ isBlacklisted: false, blacklistReason: null })
    .where(eq(usersTable.telegramId, targetUserId));

  await ctx.reply(
    `✅ User \`${targetUserId}\` has been removed from the blacklist.`,
    { parse_mode: "Markdown" }
  );
});

// ─── /admins command (admin) ───────────────────────────────────────────────────

bot.command("admins", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const admins = await db.select().from(adminUsersTable);
  if (admins.length === 0) {
    await ctx.reply("No admins configured.");
    return;
  }

  const lines = admins.map(
    (a) =>
      `• ${a.firstName ?? "Unknown"} (@${a.username ?? "no username"}) — ${a.role} [ID: ${a.telegramId}]`
  );
  await ctx.reply(`*Bot Admins:*\n\n${lines.join("\n")}`, {
    parse_mode: "Markdown",
  });
});

// ─── /settings command (admin) ─────────────────────────────────────────────────

bot.command("settings", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }

  const autoApprove = await getSetting("auto_approve_enabled", "false");
  const autoReject = await getSetting("auto_reject_enabled", "false");
  const welcomeEnabled = await getSetting("welcome_enabled", "true");
  const maintenanceMode = await getSetting("maintenance_mode", "false");
  const antiSpam = await getSetting("anti_spam_enabled", "true");

  await ctx.reply(
    `*Current Settings:*\n\n` +
      `Auto Approve: ${autoApprove === "true" ? "✅ On" : "❌ Off"}\n` +
      `Auto Reject: ${autoReject === "true" ? "✅ On" : "❌ Off"}\n` +
      `Welcome Message: ${welcomeEnabled === "true" ? "✅ On" : "❌ Off"}\n` +
      `Maintenance Mode: ${maintenanceMode === "true" ? "✅ On" : "❌ Off"}\n` +
      `Anti-Spam: ${antiSpam === "true" ? "✅ On" : "❌ Off"}\n\n` +
      `Manage all settings in the admin panel.`,
    { parse_mode: "Markdown" }
  );
});

// ─── /panel command (admin) ────────────────────────────────────────────────────

bot.command("panel", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized to access the admin panel.");
    return;
  }

  const panelUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/`
    : process.env.PANEL_URL ?? "https://your-panel-url.replit.app/";

  await ctx.reply(
    `*Admin Panel Access*\n\nClick the button below to open the True Request Acceptor admin panel.`,
    {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url("Open Admin Panel", panelUrl)],
      ]).reply_markup,
    }
  );
});

// ─── /deeplink command ─────────────────────────────────────────────────────────

bot.command("deeplink", async (ctx) => {
  const botInfo = await bot.telegram.getMe();
  await ctx.reply(
    `*Deep Link:*\nhttps://t.me/${botInfo.username}?start=ref_${ctx.from?.id}`,
    { parse_mode: "Markdown" }
  );
});

// ─── /addadmin command ─────────────────────────────────────────────────────────

bot.command("addadmin", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }
  const args = ctx.message.text.split(" ");
  const targetId = args[1] ? parseInt(args[1]) : null;
  if (!targetId) {
    await ctx.reply("Usage: /addadmin [telegram_id]");
    return;
  }
  await db
    .insert(adminUsersTable)
    .values({ telegramId: targetId, addedBy: ctx.from?.id })
    .onConflictDoNothing();
  await ctx.reply(`✅ User \`${targetId}\` added as admin.`, {
    parse_mode: "Markdown",
  });
});

// ─── /removeadmin command ─────────────────────────────────────────────────────

bot.command("removeadmin", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id ?? 0))) {
    await ctx.reply("You are not authorized.");
    return;
  }
  const args = ctx.message.text.split(" ");
  const targetId = args[1] ? parseInt(args[1]) : null;
  if (!targetId) {
    await ctx.reply("Usage: /removeadmin [telegram_id]");
    return;
  }
  await db
    .delete(adminUsersTable)
    .where(eq(adminUsersTable.telegramId, targetId));
  await ctx.reply(`✅ User \`${targetId}\` removed from admins.`, {
    parse_mode: "Markdown",
  });
});

// ─── Join Request Handler ──────────────────────────────────────────────────────

bot.on("chat_join_request", async (ctx) => {
  const req = ctx.chatJoinRequest;
  const user = req.from;

  try {
    await upsertUser(user);
    await updateDailyAnalytics("totalRequests");

    const blacklisted = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.telegramId, user.id),
          eq(usersTable.isBlacklisted, true)
        )
      )
      .limit(1);

    if (blacklisted.length > 0) {
      await ctx.declineChatJoinRequest(user.id);
      await updateDailyAnalytics("rejected");
      try {
        await bot.telegram.sendMessage(
          user.id,
          "Your join request has been declined."
        );
      } catch {}
      return;
    }

    // Upsert channel
    await db
      .insert(channelsTable)
      .values({
        channelId: req.chat.id,
        title: req.chat.title,
        username: "username" in req.chat ? req.chat.username : undefined,
      })
      .onConflictDoUpdate({
        target: channelsTable.channelId,
        set: {
          title: req.chat.title,
        },
      });

    // Check auto rules
    const autoResult = await checkAutoRules(user.username);
    const autoApproveEnabled = await getSetting(
      "auto_approve_enabled",
      "false"
    );

    if (
      autoResult?.action === "approve" ||
      autoApproveEnabled === "true"
    ) {
      await ctx.approveChatJoinRequest(user.id);

      await db.insert(joinRequestsTable).values({
        userId: user.id,
        channelId: req.chat.id,
        channelTitle: req.chat.title,
        channelUsername:
          "username" in req.chat ? req.chat.username : undefined,
        status: "approved",
        processedAt: new Date(),
        autoProcessed: true,
      });

      await updateDailyAnalytics("approved");
      await sendApprovalDm(user.id);
      return;
    }

    if (autoResult?.action === "reject") {
      await ctx.declineChatJoinRequest(user.id);

      await db.insert(joinRequestsTable).values({
        userId: user.id,
        channelId: req.chat.id,
        channelTitle: req.chat.title,
        channelUsername:
          "username" in req.chat ? req.chat.username : undefined,
        status: "rejected",
        processedAt: new Date(),
        autoProcessed: true,
      });

      await updateDailyAnalytics("rejected");
      await sendRejectionDm(user.id, "Auto-rejected by rule");
      return;
    }

    // Save pending request
    await db.insert(joinRequestsTable).values({
      userId: user.id,
      channelId: req.chat.id,
      channelTitle: req.chat.title,
      channelUsername:
        "username" in req.chat ? req.chat.username : undefined,
      status: "pending",
    });

    await db
      .update(usersTable)
      .set({ requestCount: sql`${usersTable.requestCount} + 1` })
      .where(eq(usersTable.telegramId, user.id));

    // Notify admins
    const notifyAdmin = await getSetting("notify_admin_on_request", "true");
    if (notifyAdmin === "true") {
      const admins = await db.select().from(adminUsersTable);
      const displayName =
        user.first_name + (user.last_name ? ` ${user.last_name}` : "");
      const notification =
        `📨 *New Join Request*\n\n` +
        `User: [${displayName}](tg://user?id=${user.id})\n` +
        `Username: ${user.username ? `@${user.username}` : "N/A"}\n` +
        `Channel: ${req.chat.title}\n` +
        `User ID: \`${user.id}\`\n\n` +
        `Use /approve ${user.id} or /reject ${user.id}`;

      for (const admin of admins) {
        try {
          await bot.telegram.sendMessage(admin.telegramId, notification, {
            parse_mode: "Markdown",
          });
        } catch {}
      }
    }
  } catch (err) {
    logger.error({ err }, "Error handling chat_join_request");
  }
});

// ─── Message handler for unknown messages ──────────────────────────────────────

bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const maintenanceMode = await getSetting("maintenance_mode", "false");
  if (maintenanceMode === "true") {
    await ctx.reply("The bot is currently under maintenance. Please try again later.");
    return;
  }

  await ctx.reply(
    "Use /help to see available commands.",
    { parse_mode: "Markdown" }
  );
});

// ─── Error handler ─────────────────────────────────────────────────────────────

bot.catch((err, ctx) => {
  logger.error({ err, update: ctx.update }, "Bot error");
});

export async function startBot() {
  const launch = async (attempt = 1): Promise<void> => {
    try {
      const botInfo = await bot.telegram.getMe();
      logger.info({ username: botInfo.username, attempt }, "Bot starting");
      await bot.launch({ dropPendingUpdates: true });
      logger.info("Bot launched successfully");
    } catch (err: unknown) {
      const e = err as { response?: { error_code?: number } };
      if (e?.response?.error_code === 409 && attempt <= 5) {
        const delay = attempt * 3000;
        logger.warn({ attempt, delay }, "Bot conflict (409) — another instance still running, retrying...");
        await new Promise((r) => setTimeout(r, delay));
        return launch(attempt + 1);
      }
      logger.error({ err }, "Failed to launch bot");
    }
  };

  await launch();
}

export function stopBot() {
  try {
    bot.stop("SIGTERM");
  } catch {
    // already stopped
  }
}

export async function broadcastMessage(
  userIds: number[],
  message: string,
  parseMode: "Markdown" | "HTML" | "MarkdownV2" = "Markdown",
  photoUrl?: string,
  caption?: string,
  inlineButtons?: { text: string; url: string }[][]
) {
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
