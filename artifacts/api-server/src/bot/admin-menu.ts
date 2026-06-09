import { Telegraf, Markup } from "telegraf";
import { db } from "@workspace/db";
import {
  usersTable,
  joinRequestsTable,
  botSettingsTable,
  welcomeMessagesTable,
  approvalMessagesTable,
  rejectionMessagesTable,
  autoRulesTable,
  broadcastsTable,
  adminUsersTable,
  analyticsTable,
} from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { broadcastMessage } from "./broadcast-utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ConvState =
  | { type: "idle" }
  | { type: "await_welcome_text"; id: number }
  | { type: "await_approval_text"; id: number }
  | { type: "await_rejection_text"; id: number }
  | { type: "await_reject_reason"; reqId: number; userId: number; channelId: number }
  | { type: "await_broadcast_title" }
  | { type: "await_broadcast_text"; title: string }
  | { type: "await_blacklist_id" }
  | { type: "await_blacklist_reason"; targetId: number };

const convStates = new Map<number, ConvState>();

function getState(userId: number): ConvState {
  return convStates.get(userId) ?? { type: "idle" };
}
function setState(userId: number, state: ConvState) {
  convStates.set(userId, state);
}
function clearState(userId: number) {
  convStates.delete(userId);
}

// ─── DB Helpers ────────────────────────────────────────────────────────────────

async function getSetting(key: string, def = ""): Promise<string> {
  const r = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, key)).limit(1);
  return r[0]?.value ?? def;
}

async function upsertSetting(key: string, value: string) {
  const existing = await db.select().from(botSettingsTable).where(eq(botSettingsTable.key, key)).limit(1);
  if (existing.length) {
    await db.update(botSettingsTable).set({ value, updatedAt: new Date() }).where(eq(botSettingsTable.key, key));
  } else {
    await db.insert(botSettingsTable).values({ key, value });
  }
}

async function isAdmin(telegramId: number): Promise<boolean> {
  const envIds = (process.env.ADMIN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (envIds.includes(String(telegramId))) return true;
  const r = await db.select().from(adminUsersTable).where(eq(adminUsersTable.telegramId, telegramId)).limit(1);
  return r.length > 0;
}

async function updateDailyAnalytics(field: "approved" | "rejected") {
  const today = new Date().toISOString().split("T")[0]!;
  const existing = await db.select().from(analyticsTable).where(eq(analyticsTable.date, today)).limit(1);
  if (existing.length) {
    if (field === "approved") {
      await db.update(analyticsTable).set({ approved: sql`${analyticsTable.approved} + 1` }).where(eq(analyticsTable.date, today));
    } else {
      await db.update(analyticsTable).set({ rejected: sql`${analyticsTable.rejected} + 1` }).where(eq(analyticsTable.date, today));
    }
  } else {
    await db.insert(analyticsTable).values({ date: today, approved: field === "approved" ? 1 : 0, rejected: field === "rejected" ? 1 : 0 });
  }
}

// ─── Menu Builders ─────────────────────────────────────────────────────────────

async function buildMainMenu() {
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "pending"));

  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [approvedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "approved"));

  const pending = Number(pendingCount?.count ?? 0);
  const text =
    `🤖 *Admin Control Panel*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 Users: *${userCount?.count ?? 0}*  ✅ Approved: *${approvedCount?.count ?? 0}*  ⏳ Pending: *${pending}*`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(`📋 Pending${pending > 0 ? ` (${pending})` : ""}`, "m:pending:0"),
      Markup.button.callback("📊 Stats", "m:stats"),
    ],
    [
      Markup.button.callback("⚙️ Settings", "m:settings"),
      Markup.button.callback("🤖 Auto Rules", "m:rules:0"),
    ],
    [
      Markup.button.callback("👋 Welcome Msgs", "m:welcome"),
      Markup.button.callback("💬 Response Msgs", "m:approval"),
    ],
    [
      Markup.button.callback("📢 Broadcasts", "m:bcast:0"),
      Markup.button.callback("🚫 Blacklist User", "m:blask"),
    ],
    [Markup.button.callback("❌ Close", "m:close")],
  ]);

  return { text, keyboard };
}

async function buildSettingsMenu() {
  const TOGGLE_SETTINGS = [
    { key: "auto_approve_enabled", label: "Auto Approve" },
    { key: "auto_reject_enabled", label: "Auto Reject" },
    { key: "welcome_enabled", label: "Send Welcome Msg" },
    { key: "maintenance_mode", label: "Maintenance Mode" },
    { key: "anti_spam_enabled", label: "Anti-Spam" },
    { key: "notify_admin_on_request", label: "Notify on Request" },
    { key: "notify_on_approve", label: "Notify on Approve" },
    { key: "notify_on_reject", label: "Notify on Reject" },
    { key: "require_username", label: "Require Username" },
    { key: "allow_reapply", label: "Allow Re-apply" },
  ];

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  const lines: string[] = ["⚙️ *Bot Settings*\n━━━━━━━━━━━━━━━━━━"];

  for (let i = 0; i < TOGGLE_SETTINGS.length; i += 2) {
    const pair = TOGGLE_SETTINGS.slice(i, i + 2);
    const btns = await Promise.all(
      pair.map(async (s) => {
        const val = await getSetting(s.key, "false");
        const on = val === "true";
        lines.push(`${on ? "✅" : "❌"} ${s.label}`);
        return Markup.button.callback(`${on ? "✅" : "❌"} ${s.label}`, `m:stog:${s.key}`);
      })
    );
    rows.push(btns);
  }

  rows.push([Markup.button.callback("« Back to Menu", "m:home")]);

  return {
    text: lines.join("\n"),
    keyboard: Markup.inlineKeyboard(rows),
  };
}

async function buildPendingMenu(page: number) {
  const PAGE_SIZE = 5;
  const offset = page * PAGE_SIZE;

  const all = await db
    .select()
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.status, "pending"))
    .orderBy(desc(joinRequestsTable.requestedAt));

  const total = all.length;
  const items = all.slice(offset, offset + PAGE_SIZE);

  if (total === 0) {
    return {
      text: "📋 *Pending Requests*\n\nNo pending requests right now! 🎉",
      keyboard: Markup.inlineKeyboard([[Markup.button.callback("« Back to Menu", "m:home")]]),
    };
  }

  const userIds = items.map((r) => r.userId);
  const users = await db.select().from(usersTable).where(inArray(usersTable.telegramId, userIds));
  const userMap = new Map(users.map((u) => [u.telegramId, u]));

  let text = `📋 *Pending Requests* (${total} total) — Page ${page + 1}/${Math.ceil(total / PAGE_SIZE)}\n━━━━━━━━━━━━━━━━━━\n`;

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  for (const req of items) {
    const user = userMap.get(req.userId);
    const name = user?.username ? `@${user.username}` : user?.firstName ?? `ID:${req.userId}`;
    const age = Math.round((Date.now() - new Date(req.requestedAt!).getTime()) / 60000);
    const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
    text += `\n👤 ${name} — ${req.channelTitle ?? "channel"} — ${ageStr}`;
    rows.push([
      Markup.button.callback(`✅ ${name}`, `m:apr:${req.id}`),
      Markup.button.callback(`❌ Reject`, `m:rej:${req.id}`),
      Markup.button.callback(`💬 Reason`, `m:rejask:${req.id}`),
    ]);
  }

  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) navRow.push(Markup.button.callback("‹ Prev", `m:pending:${page - 1}`));
  if (offset + PAGE_SIZE < total) navRow.push(Markup.button.callback("Next ›", `m:pending:${page + 1}`));
  if (navRow.length) rows.push(navRow);

  rows.push([
    Markup.button.callback("✅ Approve All", "m:aprall"),
    Markup.button.callback("« Menu", "m:home"),
  ]);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function buildStatsMenu() {
  const [users] = await db.select({ c: sql<number>`count(*)` }).from(usersTable);
  const [approved] = await db.select({ c: sql<number>`count(*)` }).from(joinRequestsTable).where(eq(joinRequestsTable.status, "approved"));
  const [rejected] = await db.select({ c: sql<number>`count(*)` }).from(joinRequestsTable).where(eq(joinRequestsTable.status, "rejected"));
  const [pending] = await db.select({ c: sql<number>`count(*)` }).from(joinRequestsTable).where(eq(joinRequestsTable.status, "pending"));
  const [blacklisted] = await db.select({ c: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isBlacklisted, true));

  const today = new Date().toISOString().split("T")[0]!;
  const [todayStats] = await db.select().from(analyticsTable).where(eq(analyticsTable.date, today)).limit(1);

  const text =
    `📊 *Bot Statistics*\n━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 Total Users: *${users?.c ?? 0}*\n` +
    `🚫 Blacklisted: *${blacklisted?.c ?? 0}*\n\n` +
    `✅ Approved: *${approved?.c ?? 0}*\n` +
    `❌ Rejected: *${rejected?.c ?? 0}*\n` +
    `⏳ Pending: *${pending?.c ?? 0}*\n\n` +
    `📅 *Today:*\n` +
    `  ✅ Approved: *${todayStats?.approved ?? 0}*\n` +
    `  ❌ Rejected: *${todayStats?.rejected ?? 0}*\n` +
    `  📥 New requests: *${todayStats?.totalRequests ?? 0}*`;

  return {
    text,
    keyboard: Markup.inlineKeyboard([[Markup.button.callback("🔄 Refresh", "m:stats"), Markup.button.callback("« Menu", "m:home")]]),
  };
}

async function buildWelcomeMenu() {
  const msgs = await db.select().from(welcomeMessagesTable).orderBy(desc(welcomeMessagesTable.createdAt)).limit(10);

  if (!msgs.length) {
    return {
      text: "👋 *Welcome Messages*\n\nNo templates yet.\n\nCreate some from the admin panel.",
      keyboard: Markup.inlineKeyboard([[Markup.button.callback("« Back", "m:home")]]),
    };
  }

  let text = "👋 *Welcome Messages*\n━━━━━━━━━━━━━━━━━━\nTap to activate or edit:\n";
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  for (const m of msgs) {
    const star = m.isActive ? "⭐" : "○";
    const label = m.name.length > 18 ? m.name.slice(0, 18) + "…" : m.name;
    text += `\n${star} ${m.name}${m.isActive ? " *(active)*" : ""}`;
    rows.push([
      Markup.button.callback(`${star} ${label}`, `m:wact:${m.id}`),
      Markup.button.callback(`✏️ Edit`, `m:wedit:${m.id}`),
    ]);
  }

  rows.push([Markup.button.callback("« Back", "m:home")]);
  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function buildApprovalMenu() {
  const approved = await db.select().from(approvalMessagesTable).orderBy(desc(approvalMessagesTable.createdAt)).limit(10);
  const rejected = await db.select().from(rejectionMessagesTable).orderBy(desc(rejectionMessagesTable.createdAt)).limit(10);

  let text = "💬 *Response Messages*\n━━━━━━━━━━━━━━━━━━\n\n*Approval Templates:*";
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  if (!approved.length) {
    text += "\n  (none — using built-in default)";
  } else {
    for (const m of approved) {
      const star = m.isActive ? "⭐" : "○";
      const label = (m.name.length > 16 ? m.name.slice(0, 16) + "…" : m.name);
      text += `\n${star} ${m.name}${m.isActive ? " *(active)*" : ""}`;
      rows.push([
        Markup.button.callback(`✅ ${star} ${label}`, `m:aact:${m.id}`),
        Markup.button.callback(`✏️ Edit`, `m:aedit:${m.id}`),
      ]);
    }
  }

  text += "\n\n*Rejection Templates:*";
  if (!rejected.length) {
    text += "\n  (none — using built-in default)";
  } else {
    for (const m of rejected) {
      const star = m.isActive ? "⭐" : "○";
      const label = (m.name.length > 16 ? m.name.slice(0, 16) + "…" : m.name);
      text += `\n${star} ${m.name}${m.isActive ? " *(active)*" : ""}`;
      rows.push([
        Markup.button.callback(`❌ ${star} ${label}`, `m:ract:${m.id}`),
        Markup.button.callback(`✏️ Edit`, `m:redit:${m.id}`),
      ]);
    }
  }

  rows.push([Markup.button.callback("« Back", "m:home")]);
  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function buildAutoRulesMenu(page: number) {
  const PAGE_SIZE = 6;
  const all = await db.select().from(autoRulesTable).orderBy(desc(autoRulesTable.priority));
  const total = all.length;
  const items = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (!total) {
    return {
      text: "🤖 *Auto Rules*\n\nNo rules configured.\n\nCreate rules from the admin panel.",
      keyboard: Markup.inlineKeyboard([[Markup.button.callback("« Back", "m:home")]]),
    };
  }

  let text = `🤖 *Auto Rules* (${total})\n━━━━━━━━━━━━━━━━━━\n`;
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  for (const rule of items) {
    const icon = rule.action === "approve" ? "✅" : "❌";
    const active = rule.isActive ? "🟢" : "🔴";
    const label = rule.name.length > 14 ? rule.name.slice(0, 14) + "…" : rule.name;
    text += `\n${active} ${icon} ${rule.name} — \`${rule.pattern}\``;
    rows.push([
      Markup.button.callback(`${active} ${icon} ${label}`, `m:rtog:${rule.id}`),
    ]);
  }

  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) navRow.push(Markup.button.callback("‹ Prev", `m:rules:${page - 1}`));
  if ((page + 1) * PAGE_SIZE < total) navRow.push(Markup.button.callback("Next ›", `m:rules:${page + 1}`));
  if (navRow.length) rows.push(navRow);

  rows.push([Markup.button.callback("« Back", "m:home")]);
  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function buildBroadcastMenu(page: number) {
  const PAGE_SIZE = 5;
  const all = await db.select().from(broadcastsTable).orderBy(desc(broadcastsTable.createdAt));
  const total = all.length;
  const items = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  let text = `📢 *Broadcasts* (${total})\n━━━━━━━━━━━━━━━━━━\n`;

  if (!total) {
    text += "\nNo broadcasts yet.";
  } else {
    for (const b of items) {
      const statusIcon = b.status === "sent" ? "✅" : b.status === "sending" ? "⏳" : b.status === "failed" ? "❌" : "📝";
      const label = b.title.length > 18 ? b.title.slice(0, 18) + "…" : b.title;
      text += `\n${statusIcon} *${b.title}* — ${b.status}`;
      if (b.status === "sent") text += ` (${b.successCount}/${b.totalRecipients})`;
      const btnRow: ReturnType<typeof Markup.button.callback>[] = [
        Markup.button.callback(`${statusIcon} ${label}`, `m:binfo:${b.id}`),
      ];
      if (b.status === "draft" || b.status === "scheduled") {
        btnRow.push(Markup.button.callback("🚀 Send", `m:bsend:${b.id}`));
      }
      rows.push(btnRow);
    }
  }

  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) navRow.push(Markup.button.callback("‹ Prev", `m:bcast:${page - 1}`));
  if ((page + 1) * PAGE_SIZE < total) navRow.push(Markup.button.callback("Next ›", `m:bcast:${page + 1}`));
  if (navRow.length) rows.push(navRow);

  rows.push([
    Markup.button.callback("✍️ New Broadcast", "m:bnew"),
    Markup.button.callback("« Menu", "m:home"),
  ]);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

// ─── Register All Handlers ─────────────────────────────────────────────────────

export function registerAdminMenu(bot: Telegraf) {

  // ── /menu command ────────────────────────────────────────────────────────────

  bot.command("menu", async (ctx) => {
    const userId = ctx.from?.id ?? 0;
    if (!(await isAdmin(userId))) {
      await ctx.reply("⛔ You are not authorized to access the admin menu.");
      return;
    }
    clearState(userId);
    const { text, keyboard } = await buildMainMenu();
    await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
  });

  // ── Callback query router ─────────────────────────────────────────────────

  bot.on("callback_query", async (ctx) => {
    if (!("data" in ctx.callbackQuery)) return;
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("m:")) return;

    const userId = ctx.from?.id ?? 0;
    if (!(await isAdmin(userId))) {
      await ctx.answerCbQuery("⛔ Not authorized");
      return;
    }

    await ctx.answerCbQuery();

    const editMsg = async (text: string, keyboard: ReturnType<typeof Markup.inlineKeyboard>) => {
      try {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
      } catch {
        await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
      }
    };

    // ── Navigation ────────────────────────────────────────────────────────────

    if (data === "m:home") {
      clearState(userId);
      const m = await buildMainMenu();
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data === "m:close") {
      try { await ctx.deleteMessage(); } catch { /* ignore */ }
      return;
    }

    if (data === "m:stats") {
      const m = await buildStatsMenu();
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data === "m:settings") {
      const m = await buildSettingsMenu();
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data === "m:welcome") {
      const m = await buildWelcomeMenu();
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data === "m:approval") {
      const m = await buildApprovalMenu();
      await editMsg(m.text, m.keyboard);
      return;
    }

    // ── Pending ────────────────────────────────────────────────────────────────

    if (data.startsWith("m:pending:")) {
      const page = parseInt(data.split(":")[2] ?? "0");
      const m = await buildPendingMenu(page);
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:apr:")) {
      const reqId = parseInt(data.split(":")[2] ?? "0");
      const req = await db.select().from(joinRequestsTable).where(and(eq(joinRequestsTable.id, reqId), eq(joinRequestsTable.status, "pending"))).limit(1);
      if (!req.length) {
        await editMsg("⚠️ Request not found or already processed.", Markup.inlineKeyboard([[Markup.button.callback("« Back", "m:pending:0")]]));
        return;
      }
      const r = req[0]!;
      try { await bot.telegram.approveChatJoinRequest(r.channelId, r.userId); } catch { /* ignore */ }
      await db.update(joinRequestsTable).set({ status: "approved", processedAt: new Date(), processedBy: userId }).where(eq(joinRequestsTable.id, reqId));
      await updateDailyAnalytics("approved");
      // send approval DM
      try {
        const active = await db.select().from(approvalMessagesTable).where(eq(approvalMessagesTable.isActive, true)).limit(1);
        if (active.length && active[0]) {
          const msg = active[0];
          if (msg.photoUrl) {
            await bot.telegram.sendPhoto(r.userId, msg.photoUrl, { caption: msg.messageText, parse_mode: (msg.parseMode ?? "Markdown") as "Markdown" | "HTML" });
          } else {
            await bot.telegram.sendMessage(r.userId, msg.messageText, { parse_mode: (msg.parseMode ?? "Markdown") as "Markdown" | "HTML" });
          }
        } else {
          await bot.telegram.sendMessage(r.userId, "✅ Your join request has been approved! Welcome!");
        }
      } catch { /* user may have blocked bot */ }
      const m = await buildPendingMenu(0);
      await editMsg(`✅ Approved!\n\n` + m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:rej:")) {
      const reqId = parseInt(data.split(":")[2] ?? "0");
      const req = await db.select().from(joinRequestsTable).where(and(eq(joinRequestsTable.id, reqId), eq(joinRequestsTable.status, "pending"))).limit(1);
      if (!req.length) {
        await editMsg("⚠️ Request not found or already processed.", Markup.inlineKeyboard([[Markup.button.callback("« Back", "m:pending:0")]]));
        return;
      }
      const r = req[0]!;
      try { await bot.telegram.declineChatJoinRequest(r.channelId, r.userId); } catch { /* ignore */ }
      await db.update(joinRequestsTable).set({ status: "rejected", processedAt: new Date(), processedBy: userId }).where(eq(joinRequestsTable.id, reqId));
      await updateDailyAnalytics("rejected");
      try {
        const active = await db.select().from(rejectionMessagesTable).where(eq(rejectionMessagesTable.isActive, true)).limit(1);
        const msgText = active[0]?.messageText ?? "❌ Your join request has been declined.";
        await bot.telegram.sendMessage(r.userId, msgText, { parse_mode: "Markdown" });
      } catch { /* user may have blocked bot */ }
      const m = await buildPendingMenu(0);
      await editMsg(`❌ Rejected!\n\n` + m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:rejask:")) {
      const reqId = parseInt(data.split(":")[2] ?? "0");
      const req = await db.select().from(joinRequestsTable).where(and(eq(joinRequestsTable.id, reqId), eq(joinRequestsTable.status, "pending"))).limit(1);
      if (!req.length) {
        await editMsg("⚠️ Request not found or already processed.", Markup.inlineKeyboard([[Markup.button.callback("« Back", "m:pending:0")]]));
        return;
      }
      const r = req[0]!;
      setState(userId, { type: "await_reject_reason", reqId, userId: r.userId, channelId: r.channelId });
      await ctx.reply(
        "💬 Send the rejection reason (or /cancel to cancel):",
        Markup.forceReply()
      );
      return;
    }

    if (data === "m:aprall") {
      const allPending = await db.select().from(joinRequestsTable).where(eq(joinRequestsTable.status, "pending")).limit(50);
      let done = 0;
      for (const r of allPending) {
        try { await bot.telegram.approveChatJoinRequest(r.channelId, r.userId); } catch { /* ignore */ }
        await db.update(joinRequestsTable).set({ status: "approved", processedAt: new Date(), processedBy: userId }).where(eq(joinRequestsTable.id, r.id));
        await updateDailyAnalytics("approved");
        done++;
      }
      const m = await buildPendingMenu(0);
      await editMsg(`✅ Approved all ${done} requests!\n\n` + m.text, m.keyboard);
      return;
    }

    // ── Settings toggles ───────────────────────────────────────────────────────

    if (data.startsWith("m:stog:")) {
      const key = data.slice("m:stog:".length);
      const current = await getSetting(key, "false");
      await upsertSetting(key, current === "true" ? "false" : "true");
      const m = await buildSettingsMenu();
      await editMsg(m.text, m.keyboard);
      return;
    }

    // ── Welcome messages ───────────────────────────────────────────────────────

    if (data.startsWith("m:wact:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      await db.update(welcomeMessagesTable).set({ isActive: false });
      await db.update(welcomeMessagesTable).set({ isActive: true }).where(eq(welcomeMessagesTable.id, id));
      const m = await buildWelcomeMenu();
      await editMsg("⭐ Welcome message activated!\n\n" + m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:wedit:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      const msg = await db.select().from(welcomeMessagesTable).where(eq(welcomeMessagesTable.id, id)).limit(1);
      if (!msg.length) return;
      setState(userId, { type: "await_welcome_text", id });
      await ctx.reply(
        `✏️ *Edit Welcome Message: "${msg[0]!.name}"*\n\nCurrent text:\n\`\`\`\n${msg[0]!.messageText}\n\`\`\`\n\nSend the new message text (Markdown supported), or /cancel:`,
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }

    // ── Approval/Rejection messages ────────────────────────────────────────────

    if (data.startsWith("m:aact:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      await db.update(approvalMessagesTable).set({ isActive: false });
      await db.update(approvalMessagesTable).set({ isActive: true }).where(eq(approvalMessagesTable.id, id));
      const m = await buildApprovalMenu();
      await editMsg("⭐ Approval message activated!\n\n" + m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:aedit:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      const msg = await db.select().from(approvalMessagesTable).where(eq(approvalMessagesTable.id, id)).limit(1);
      if (!msg.length) return;
      setState(userId, { type: "await_approval_text", id });
      await ctx.reply(
        `✏️ *Edit Approval Message: "${msg[0]!.name}"*\n\nCurrent text:\n\`\`\`\n${msg[0]!.messageText}\n\`\`\`\n\nSend new text, or /cancel:`,
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }

    if (data.startsWith("m:ract:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      await db.update(rejectionMessagesTable).set({ isActive: false });
      await db.update(rejectionMessagesTable).set({ isActive: true }).where(eq(rejectionMessagesTable.id, id));
      const m = await buildApprovalMenu();
      await editMsg("⭐ Rejection message activated!\n\n" + m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:redit:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      const msg = await db.select().from(rejectionMessagesTable).where(eq(rejectionMessagesTable.id, id)).limit(1);
      if (!msg.length) return;
      setState(userId, { type: "await_rejection_text", id });
      await ctx.reply(
        `✏️ *Edit Rejection Message: "${msg[0]!.name}"*\n\nCurrent text:\n\`\`\`\n${msg[0]!.messageText}\n\`\`\`\n\nSend new text, or /cancel:`,
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }

    // ── Auto rules ─────────────────────────────────────────────────────────────

    if (data.startsWith("m:rules:")) {
      const page = parseInt(data.split(":")[2] ?? "0");
      const m = await buildAutoRulesMenu(page);
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data.startsWith("m:rtog:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      const rule = await db.select().from(autoRulesTable).where(eq(autoRulesTable.id, id)).limit(1);
      if (rule.length) {
        await db.update(autoRulesTable).set({ isActive: !rule[0]!.isActive }).where(eq(autoRulesTable.id, id));
      }
      const m = await buildAutoRulesMenu(0);
      await editMsg(m.text, m.keyboard);
      return;
    }

    // ── Broadcasts ─────────────────────────────────────────────────────────────

    if (data.startsWith("m:bcast:")) {
      const page = parseInt(data.split(":")[2] ?? "0");
      const m = await buildBroadcastMenu(page);
      await editMsg(m.text, m.keyboard);
      return;
    }

    if (data === "m:bnew") {
      setState(userId, { type: "await_broadcast_title" });
      await ctx.reply(
        "📢 *New Broadcast*\n\nStep 1/2: Send the broadcast *title* (internal label), or /cancel:",
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }

    if (data.startsWith("m:binfo:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      const bc = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
      if (!bc.length) return;
      const b = bc[0]!;
      const text =
        `📢 *${b.title}*\n━━━━━━━━━━━━━━━━━━\n` +
        `Status: ${b.status}\n` +
        (b.status === "sent" ? `Delivered: ${b.successCount}/${b.totalRecipients}\nFailed: ${b.failCount}\n` : "") +
        `Created: ${new Date(b.createdAt).toLocaleDateString()}\n\n` +
        `*Message:*\n${b.messageText.slice(0, 200)}${b.messageText.length > 200 ? "…" : ""}`;
      const btnRow: ReturnType<typeof Markup.button.callback>[] = [Markup.button.callback("« Back", "m:bcast:0")];
      if (b.status === "draft") btnRow.unshift(Markup.button.callback("🚀 Send Now", `m:bsend:${b.id}`));
      await editMsg(text, Markup.inlineKeyboard([btnRow]));
      return;
    }

    if (data.startsWith("m:bsend:")) {
      const id = parseInt(data.split(":")[2] ?? "0");
      const bc = await db.select().from(broadcastsTable).where(eq(broadcastsTable.id, id)).limit(1);
      if (!bc.length) return;
      const b = bc[0]!;

      await db.update(broadcastsTable).set({ status: "sending" }).where(eq(broadcastsTable.id, id));
      await editMsg(
        `⏳ Sending broadcast *${b.title}*...\n\nThis may take a while. You'll be notified when done.`,
        Markup.inlineKeyboard([[Markup.button.callback("« Menu", "m:home")]])
      );

      const users = await db.select().from(usersTable).where(eq(usersTable.isBlacklisted, false));
      const buttons = (b.inlineButtons as { text: string; url: string }[][] | null) ?? undefined;

      const { success, fail } = await broadcastMessage(
        bot,
        users.map((u) => u.telegramId),
        b.messageText,
        (b.parseMode ?? "Markdown") as "Markdown" | "HTML" | "MarkdownV2",
        b.photoUrl ?? undefined,
        b.caption ?? undefined,
        buttons
      );

      await db.update(broadcastsTable).set({
        status: "sent", sentAt: new Date(),
        totalRecipients: users.length, successCount: success, failCount: fail,
      }).where(eq(broadcastsTable.id, id));

      await ctx.reply(
        `✅ *Broadcast Complete!*\n\nTitle: *${b.title}*\nDelivered: *${success}*\nFailed: *${fail}*`,
        { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.callback("📢 Broadcasts", "m:bcast:0"), Markup.button.callback("« Menu", "m:home")]]) }
      );
      return;
    }

    // ── Blacklist ──────────────────────────────────────────────────────────────

    if (data === "m:blask") {
      setState(userId, { type: "await_blacklist_id" });
      await ctx.reply(
        "🚫 *Blacklist User*\n\nSend the Telegram ID of the user to blacklist, or /cancel:",
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }
  });

  // ── /cancel command ──────────────────────────────────────────────────────────

  bot.command("cancel", async (ctx) => {
    const userId = ctx.from?.id ?? 0;
    const state = getState(userId);
    if (state.type !== "idle") {
      clearState(userId);
      await ctx.reply("✅ Cancelled.", Markup.removeKeyboard());
    }
  });

  // ── Text input handler (conversation state machine) ──────────────────────────

  bot.on("text", async (ctx, next) => {
    const userId = ctx.from?.id ?? 0;
    const state = getState(userId);

    if (state.type === "idle") return next();

    const text = ctx.message.text.trim();

    // ── Await welcome text ──────────────────────────────────────────────────

    if (state.type === "await_welcome_text") {
      clearState(userId);
      await db.update(welcomeMessagesTable).set({ messageText: text, updatedAt: new Date() }).where(eq(welcomeMessagesTable.id, state.id));
      await ctx.reply("✅ Welcome message updated!", Markup.removeKeyboard());
      const m = await buildWelcomeMenu();
      await ctx.reply(m.text, { parse_mode: "Markdown", ...m.keyboard });
      return;
    }

    // ── Await approval text ─────────────────────────────────────────────────

    if (state.type === "await_approval_text") {
      clearState(userId);
      await db.update(approvalMessagesTable).set({ messageText: text }).where(eq(approvalMessagesTable.id, state.id));
      await ctx.reply("✅ Approval message updated!", Markup.removeKeyboard());
      const m = await buildApprovalMenu();
      await ctx.reply(m.text, { parse_mode: "Markdown", ...m.keyboard });
      return;
    }

    // ── Await rejection text ────────────────────────────────────────────────

    if (state.type === "await_rejection_text") {
      clearState(userId);
      await db.update(rejectionMessagesTable).set({ messageText: text }).where(eq(rejectionMessagesTable.id, state.id));
      await ctx.reply("✅ Rejection message updated!", Markup.removeKeyboard());
      const m = await buildApprovalMenu();
      await ctx.reply(m.text, { parse_mode: "Markdown", ...m.keyboard });
      return;
    }

    // ── Await reject reason ─────────────────────────────────────────────────

    if (state.type === "await_reject_reason") {
      const { reqId, userId: targetUserId, channelId } = state;
      clearState(userId);

      try { await bot.telegram.declineChatJoinRequest(channelId, targetUserId); } catch { /* ignore */ }
      await db.update(joinRequestsTable).set({ status: "rejected", processedAt: new Date(), processedBy: userId, rejectionReason: text }).where(eq(joinRequestsTable.id, reqId));
      await updateDailyAnalytics("rejected");

      try {
        const active = await db.select().from(rejectionMessagesTable).where(eq(rejectionMessagesTable.isActive, true)).limit(1);
        const base = active[0]?.messageText ?? "❌ Your join request has been declined.";
        await bot.telegram.sendMessage(targetUserId, `${base}\n\n*Reason:* ${text}`, { parse_mode: "Markdown" });
      } catch { /* user may have blocked bot */ }

      await ctx.reply("✅ Request rejected with reason.", Markup.removeKeyboard());
      const m = await buildPendingMenu(0);
      await ctx.reply(m.text, { parse_mode: "Markdown", ...m.keyboard });
      return;
    }

    // ── Broadcast wizard ────────────────────────────────────────────────────

    if (state.type === "await_broadcast_title") {
      setState(userId, { type: "await_broadcast_text", title: text });
      await ctx.reply(
        `📢 *New Broadcast: "${text}"*\n\nStep 2/2: Send the message text (Markdown supported), or /cancel:`,
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }

    if (state.type === "await_broadcast_text") {
      const { title } = state;
      clearState(userId);

      const [bc] = await db.insert(broadcastsTable).values({
        title, messageText: text, parseMode: "Markdown", status: "draft", createdBy: userId,
      }).returning();

      await ctx.reply(
        `✅ *Broadcast "${title}" created!*\n\nTap "🚀 Send Now" to deliver it to all users.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback(`🚀 Send Now`, `m:bsend:${bc!.id}`), Markup.button.callback("📢 All Broadcasts", "m:bcast:0")],
            [Markup.button.callback("« Menu", "m:home")],
          ]),
        }
      );
      return;
    }

    // ── Blacklist wizard ────────────────────────────────────────────────────

    if (state.type === "await_blacklist_id") {
      const targetId = parseInt(text);
      if (isNaN(targetId)) {
        await ctx.reply("❌ Invalid ID. Send a numeric Telegram ID, or /cancel.");
        return;
      }
      setState(userId, { type: "await_blacklist_reason", targetId });
      await ctx.reply(
        `🚫 User ID: \`${targetId}\`\n\nSend the blacklist reason (or type "none"), or /cancel:`,
        { parse_mode: "Markdown", ...Markup.forceReply() }
      );
      return;
    }

    if (state.type === "await_blacklist_reason") {
      const { targetId } = state;
      clearState(userId);
      const reason = text === "none" ? "No reason given" : text;
      await db.update(usersTable).set({ isBlacklisted: true, blacklistReason: reason }).where(eq(usersTable.telegramId, targetId));
      await ctx.reply(`🚫 User \`${targetId}\` blacklisted.\nReason: ${reason}`, { parse_mode: "Markdown", ...Markup.removeKeyboard() });
      const m = await buildMainMenu();
      await ctx.reply(m.text, { parse_mode: "Markdown", ...m.keyboard });
      return;
    }

    return next();
  });
}
