import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  joinRequestsTable,
  botSettingsTable,
  welcomeMessagesTable,
  approvalMessagesTable,
  rejectionMessagesTable,
  broadcastsTable,
  adminUsersTable,
  analyticsTable,
  autoRulesTable,
  channelsTable,
} from "@workspace/db";
import {
  eq,
  and,
  sql,
  desc,
  like,
  count,
  or,
  asc,
} from "drizzle-orm";
import { bot, broadcastMessage } from "../bot/index";

const router = Router();

// ─── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/dashboard/stats", async (req, res) => {
  try {
    const [totalUsers] = await db
      .select({ count: count() })
      .from(usersTable);
    const [totalApproved] = await db
      .select({ count: count() })
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.status, "approved"));
    const [totalRejected] = await db
      .select({ count: count() })
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.status, "rejected"));
    const [totalPending] = await db
      .select({ count: count() })
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.status, "pending"));
    const [blacklisted] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.isBlacklisted, true));
    const [channels] = await db
      .select({ count: count() })
      .from(channelsTable)
      .where(eq(channelsTable.isActive, true));
    const [broadcasts] = await db
      .select({ count: count() })
      .from(broadcastsTable)
      .where(eq(broadcastsTable.status, "sent"));

    const today = new Date().toISOString().split("T")[0];
    const todayAnalytics = await db
      .select()
      .from(analyticsTable)
      .where(eq(analyticsTable.date, today))
      .limit(1);

    const approvedCount = Number(totalApproved?.count ?? 0);
    const rejectedCount = Number(totalRejected?.count ?? 0);
    const total = approvedCount + rejectedCount;
    const approvalRate = total > 0 ? (approvedCount / total) * 100 : 0;

    res.json({
      totalUsers: Number(totalUsers?.count ?? 0),
      totalApproved: approvedCount,
      totalRejected: rejectedCount,
      totalPending: Number(totalPending?.count ?? 0),
      todayRequests: todayAnalytics[0]?.totalRequests ?? 0,
      todayApproved: todayAnalytics[0]?.approved ?? 0,
      broadcastsSent: Number(broadcasts?.count ?? 0),
      blacklistedUsers: Number(blacklisted?.count ?? 0),
      activeChannels: Number(channels?.count ?? 0),
      approvalRate: Math.round(approvalRate * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/activity", async (req, res) => {
  try {
    const requests = await db
      .select({
        id: joinRequestsTable.id,
        userId: joinRequestsTable.userId,
        channelTitle: joinRequestsTable.channelTitle,
        status: joinRequestsTable.status,
        requestedAt: joinRequestsTable.requestedAt,
        username: usersTable.username,
        firstName: usersTable.firstName,
      })
      .from(joinRequestsTable)
      .leftJoin(usersTable, eq(joinRequestsTable.userId, usersTable.telegramId))
      .orderBy(desc(joinRequestsTable.requestedAt))
      .limit(20);

    const items = requests.map((r) => ({
      id: r.id,
      type: "join_request",
      userId: r.userId,
      userDisplay:
        r.username
          ? `@${r.username}`
          : r.firstName ?? `User ${r.userId}`,
      channelTitle: r.channelTitle,
      status: r.status,
      timestamp: r.requestedAt?.toISOString() ?? new Date().toISOString(),
    }));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to get activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Join Requests ─────────────────────────────────────────────────────────────

router.get("/requests", async (req, res) => {
  try {
    const { status = "all", page = "1", limit = "20", search } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status !== "all") {
      conditions.push(eq(joinRequestsTable.status, status as "pending" | "approved" | "rejected"));
    }

    const query = db
      .select({
        id: joinRequestsTable.id,
        userId: joinRequestsTable.userId,
        channelId: joinRequestsTable.channelId,
        channelTitle: joinRequestsTable.channelTitle,
        channelUsername: joinRequestsTable.channelUsername,
        status: joinRequestsTable.status,
        requestedAt: joinRequestsTable.requestedAt,
        processedAt: joinRequestsTable.processedAt,
        rejectionReason: joinRequestsTable.rejectionReason,
        userMessage: joinRequestsTable.userMessage,
        autoProcessed: joinRequestsTable.autoProcessed,
        userTelegramId: usersTable.telegramId,
        username: usersTable.username,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        isBlacklisted: usersTable.isBlacklisted,
        isPremium: usersTable.isPremium,
        requestCount: usersTable.requestCount,
        userJoinedAt: usersTable.joinedAt,
        userLastSeenAt: usersTable.lastSeenAt,
      })
      .from(joinRequestsTable)
      .leftJoin(usersTable, eq(joinRequestsTable.userId, usersTable.telegramId));

    if (search) {
      conditions.push(
        or(
          like(usersTable.username, `%${search}%`),
          like(usersTable.firstName, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const items = await query
      .where(whereClause)
      .orderBy(desc(joinRequestsTable.requestedAt))
      .limit(limitNum)
      .offset(offset);

    const [total] = await db
      .select({ count: count() })
      .from(joinRequestsTable)
      .leftJoin(usersTable, eq(joinRequestsTable.userId, usersTable.telegramId))
      .where(whereClause);

    const totalCount = Number(total?.count ?? 0);

    res.json({
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        channelId: item.channelId,
        channelTitle: item.channelTitle,
        channelUsername: item.channelUsername,
        status: item.status,
        requestedAt: item.requestedAt?.toISOString(),
        processedAt: item.processedAt?.toISOString(),
        rejectionReason: item.rejectionReason,
        userMessage: item.userMessage,
        autoProcessed: item.autoProcessed,
        user: item.userTelegramId
          ? {
              id: item.userId,
              telegramId: item.userTelegramId,
              username: item.username,
              firstName: item.firstName,
              lastName: item.lastName,
              isBlacklisted: item.isBlacklisted,
              isPremium: item.isPremium,
              requestCount: item.requestCount,
              joinedAt: item.userJoinedAt?.toISOString(),
              lastSeenAt: item.userLastSeenAt?.toISOString(),
            }
          : null,
      })),
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get requests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/requests/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const request = await db
      .select()
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.id, id))
      .limit(1);

    if (!request[0]) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const r = request[0];

    try {
      await bot.telegram.approveChatJoinRequest(r.channelId, r.userId);
    } catch (err) {
      req.log.warn({ err }, "Could not approve on Telegram side");
    }

    await db
      .update(joinRequestsTable)
      .set({ status: "approved", processedAt: new Date() })
      .where(eq(joinRequestsTable.id, id));

    // Send DM
    try {
      const msgs = await db
        .select()
        .from(approvalMessagesTable)
        .where(eq(approvalMessagesTable.isActive, true))
        .limit(1);
      const approvalMsg = msgs[0];
      if (approvalMsg) {
        await bot.telegram.sendMessage(
          r.userId,
          approvalMsg.messageText,
          { parse_mode: (approvalMsg.parseMode ?? "Markdown") as "Markdown" | "HTML" | "MarkdownV2" }
        );
      } else {
        await bot.telegram.sendMessage(
          r.userId,
          "Congratulations! Your join request has been approved."
        );
      }
    } catch {}

    res.json({ success: true, message: "Request approved" });
  } catch (err) {
    req.log.error({ err }, "Failed to approve request");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/requests/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body as { reason?: string };

    const request = await db
      .select()
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.id, id))
      .limit(1);

    if (!request[0]) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const r = request[0];

    try {
      await bot.telegram.declineChatJoinRequest(r.channelId, r.userId);
    } catch {}

    await db
      .update(joinRequestsTable)
      .set({ status: "rejected", processedAt: new Date(), rejectionReason: reason })
      .where(eq(joinRequestsTable.id, id));

    try {
      const msgs = await db
        .select()
        .from(rejectionMessagesTable)
        .where(eq(rejectionMessagesTable.isActive, true))
        .limit(1);
      let text = msgs[0]?.messageText ?? "Your join request has been declined.";
      if (reason) text += `\n\nReason: ${reason}`;
      await bot.telegram.sendMessage(r.userId, text, { parse_mode: "Markdown" });
    } catch {}

    res.json({ success: true, message: "Request rejected" });
  } catch (err) {
    req.log.error({ err }, "Failed to reject request");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/requests/approve-all", async (req, res) => {
  try {
    const pending = await db
      .select()
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.status, "pending"));

    let processed = 0;
    for (const r of pending) {
      try {
        await bot.telegram.approveChatJoinRequest(r.channelId, r.userId);
        await db
          .update(joinRequestsTable)
          .set({ status: "approved", processedAt: new Date(), autoProcessed: true })
          .where(eq(joinRequestsTable.id, r.id));
        await bot.telegram.sendMessage(r.userId, "Your join request has been approved!");
        processed++;
      } catch {}
    }

    res.json({ success: true, processed, message: `${processed} requests approved` });
  } catch (err) {
    req.log.error({ err }, "Failed to approve all");
    res.status(500).json({ success: false, processed: 0, message: "Internal server error" });
  }
});

router.post("/requests/reject-all", async (req, res) => {
  try {
    const { reason } = req.body as { reason?: string };
    const pending = await db
      .select()
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.status, "pending"));

    let processed = 0;
    for (const r of pending) {
      try {
        await bot.telegram.declineChatJoinRequest(r.channelId, r.userId);
        await db
          .update(joinRequestsTable)
          .set({ status: "rejected", processedAt: new Date(), autoProcessed: true, rejectionReason: reason })
          .where(eq(joinRequestsTable.id, r.id));
        processed++;
      } catch {}
    }

    res.json({ success: true, processed, message: `${processed} requests rejected` });
  } catch (err) {
    req.log.error({ err }, "Failed to reject all");
    res.status(500).json({ success: false, processed: 0, message: "Internal server error" });
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────────

router.get("/users", async (req, res) => {
  try {
    const { page = "1", limit = "20", search, blacklisted } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (blacklisted === "true") conditions.push(eq(usersTable.isBlacklisted, true));
    if (blacklisted === "false") conditions.push(eq(usersTable.isBlacklisted, false));
    if (search) {
      conditions.push(
        or(
          like(usersTable.username, `%${search}%`),
          like(usersTable.firstName, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.joinedAt))
      .limit(limitNum)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(usersTable).where(whereClause);
    const totalCount = Number(total?.count ?? 0);

    res.json({
      items: items.map((u) => ({
        ...u,
        telegramId: Number(u.telegramId),
        joinedAt: u.joinedAt?.toISOString(),
        lastSeenAt: u.lastSeenAt?.toISOString(),
      })),
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/export", async (req, res) => {
  try {
    const items = await db.select().from(usersTable).orderBy(desc(usersTable.joinedAt));
    res.json({
      data: items.map((u) => ({
        ...u,
        telegramId: Number(u.telegramId),
        joinedAt: u.joinedAt?.toISOString(),
        lastSeenAt: u.lastSeenAt?.toISOString(),
      })),
      total: items.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to export users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!users[0]) return res.status(404).json({ error: "User not found" });

    const user = users[0];
    const requests = await db
      .select()
      .from(joinRequestsTable)
      .where(eq(joinRequestsTable.userId, user.telegramId))
      .orderBy(desc(joinRequestsTable.requestedAt))
      .limit(10);

    res.json({
      user: {
        ...user,
        telegramId: Number(user.telegramId),
        joinedAt: user.joinedAt?.toISOString(),
        lastSeenAt: user.lastSeenAt?.toISOString(),
      },
      requests: requests.map((r) => ({
        ...r,
        requestedAt: r.requestedAt?.toISOString(),
        processedAt: r.processedAt?.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/blacklist", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body as { reason?: string };
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users[0]) return res.status(404).json({ success: false, message: "User not found" });

    await db
      .update(usersTable)
      .set({ isBlacklisted: true, blacklistReason: reason ?? "No reason given" })
      .where(eq(usersTable.id, id));

    res.json({ success: true, message: "User blacklisted" });
  } catch (err) {
    req.log.error({ err }, "Failed to blacklist user");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/users/:id/unblacklist", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(usersTable).set({ isBlacklisted: false, blacklistReason: null }).where(eq(usersTable.id, id));
    res.json({ success: true, message: "User unblacklisted" });
  } catch (err) {
    req.log.error({ err }, "Failed to unblacklist user");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/users/:id/send-dm", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { message: messageText, parseMode = "Markdown", photoUrl } = req.body as { message: string; parseMode?: string; photoUrl?: string };

    const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users[0]) return res.status(404).json({ success: false, message: "User not found" });

    const user = users[0];
    if (photoUrl) {
      await bot.telegram.sendPhoto(Number(user.telegramId), photoUrl, {
        caption: messageText,
        parse_mode: parseMode as "Markdown" | "HTML" | "MarkdownV2",
      });
    } else {
      await bot.telegram.sendMessage(Number(user.telegramId), messageText, {
        parse_mode: parseMode as "Markdown" | "HTML" | "MarkdownV2",
      });
    }

    res.json({ success: true, message: "DM sent successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to send DM");
    res.status(500).json({ success: false, message: "Failed to send DM" });
  }
});

// ─── Broadcasts ────────────────────────────────────────────────────────────────

router.get("/broadcasts", async (req, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = status ? [eq(broadcastsTable.status, status as "draft" | "sent" | "sending" | "scheduled" | "failed")] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(broadcastsTable)
      .where(whereClause)
      .orderBy(desc(broadcastsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(broadcastsTable).where(whereClause);

    res.json({
      items: items.map((b) => ({
        ...b,
        scheduledAt: b.scheduledAt?.toISOString(),
        sentAt: b.sentAt?.toISOString(),
        createdAt: b.createdAt?.toISOString(),
      })),
      total: Number(total?.count ?? 0),
      page: pageNum,
      totalPages: Math.ceil(Number(total?.count ?? 0) / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get broadcasts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/broadcasts", async (req, res) => {
  try {
    const body = req.body as {
      title: string;
      messageText: string;
      parseMode?: string;
      photoUrl?: string;
      caption?: string;
      hasInlineButtons?: boolean;
      inlineButtons?: unknown;
      scheduledAt?: string;
      targetFilter?: string;
    };

    const [created] = await db
      .insert(broadcastsTable)
      .values({
        title: body.title,
        messageText: body.messageText,
        parseMode: body.parseMode ?? "Markdown",
        photoUrl: body.photoUrl,
        caption: body.caption,
        hasInlineButtons: body.hasInlineButtons ?? false,
        inlineButtons: body.inlineButtons ?? null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        targetFilter: body.targetFilter ?? "all",
        status: body.scheduledAt ? "scheduled" : "draft",
      })
      .returning();

    res.status(201).json({
      ...created,
      scheduledAt: created.scheduledAt?.toISOString(),
      sentAt: created.sentAt?.toISOString(),
      createdAt: created.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create broadcast");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/broadcasts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const broadcasts = await db
      .select()
      .from(broadcastsTable)
      .where(eq(broadcastsTable.id, id))
      .limit(1);

    if (!broadcasts[0]) return res.status(404).json({ error: "Not found" });
    const b = broadcasts[0];
    res.json({
      ...b,
      scheduledAt: b.scheduledAt?.toISOString(),
      sentAt: b.sentAt?.toISOString(),
      createdAt: b.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get broadcast");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/broadcasts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body as Partial<{
      title: string;
      messageText: string;
      parseMode: string;
      photoUrl: string;
      caption: string;
      hasInlineButtons: boolean;
      inlineButtons: unknown;
      scheduledAt: string;
      targetFilter: string;
    }>;

    const [updated] = await db
      .update(broadcastsTable)
      .set({
        ...body,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      })
      .where(eq(broadcastsTable.id, id))
      .returning();

    res.json({
      ...updated,
      scheduledAt: updated.scheduledAt?.toISOString(),
      sentAt: updated.sentAt?.toISOString(),
      createdAt: updated.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update broadcast");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/broadcasts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(broadcastsTable).where(eq(broadcastsTable.id, id));
    res.json({ success: true, message: "Broadcast deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete broadcast");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/broadcasts/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const broadcasts = await db
      .select()
      .from(broadcastsTable)
      .where(eq(broadcastsTable.id, id))
      .limit(1);

    if (!broadcasts[0]) return res.status(404).json({ success: false, processed: 0, message: "Not found" });
    const broadcast = broadcasts[0];

    await db
      .update(broadcastsTable)
      .set({ status: "sending" })
      .where(eq(broadcastsTable.id, id));

    const users = await db.select().from(usersTable).where(eq(usersTable.isBlacklisted, false));
    const userIds = users.map((u) => Number(u.telegramId));

    const inlineButtons = broadcast.inlineButtons as { text: string; url: string }[][] | null;

    const { success, fail } = await broadcastMessage(
      userIds,
      broadcast.messageText,
      (broadcast.parseMode ?? "Markdown") as "Markdown" | "HTML" | "MarkdownV2",
      broadcast.photoUrl ?? undefined,
      broadcast.caption ?? undefined,
      inlineButtons ?? undefined
    );

    await db
      .update(broadcastsTable)
      .set({
        status: "sent",
        sentAt: new Date(),
        totalRecipients: userIds.length,
        successCount: success,
        failCount: fail,
      })
      .where(eq(broadcastsTable.id, id));

    res.json({ success: true, processed: success, message: `Sent to ${success}/${userIds.length} users` });
  } catch (err) {
    req.log.error({ err }, "Failed to send broadcast");
    res.status(500).json({ success: false, processed: 0, message: "Internal server error" });
  }
});

// ─── Welcome Messages ──────────────────────────────────────────────────────────

router.get("/welcome-messages", async (req, res) => {
  try {
    const msgs = await db
      .select()
      .from(welcomeMessagesTable)
      .orderBy(desc(welcomeMessagesTable.createdAt));
    res.json(msgs.map((m) => ({
      ...m,
      createdAt: m.createdAt?.toISOString(),
      updatedAt: m.updatedAt?.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get welcome messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/welcome-messages", async (req, res) => {
  try {
    const body = req.body as {
      name: string;
      messageText: string;
      parseMode?: string;
      photoUrl?: string;
      photoFileId?: string;
      hasInlineButtons?: boolean;
      inlineButtons?: unknown;
    };
    const [created] = await db.insert(welcomeMessagesTable).values({
      name: body.name,
      messageText: body.messageText,
      parseMode: body.parseMode ?? "Markdown",
      photoUrl: body.photoUrl,
      photoFileId: body.photoFileId,
      hasInlineButtons: body.hasInlineButtons ?? false,
      inlineButtons: body.inlineButtons ?? null,
    }).returning();
    res.status(201).json({ ...created, createdAt: created.createdAt?.toISOString(), updatedAt: created.updatedAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create welcome message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/welcome-messages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [updated] = await db
      .update(welcomeMessagesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(welcomeMessagesTable.id, id))
      .returning();
    res.json({ ...updated, createdAt: updated.createdAt?.toISOString(), updatedAt: updated.updatedAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update welcome message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/welcome-messages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(welcomeMessagesTable).where(eq(welcomeMessagesTable.id, id));
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete welcome message");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/welcome-messages/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(welcomeMessagesTable).set({ isActive: false });
    await db.update(welcomeMessagesTable).set({ isActive: true }).where(eq(welcomeMessagesTable.id, id));
    res.json({ success: true, message: "Welcome message activated" });
  } catch (err) {
    req.log.error({ err }, "Failed to activate welcome message");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  welcome_enabled: "true",
  auto_approve_enabled: "false",
  auto_reject_enabled: "false",
  cooldown_seconds: "0",
  max_requests_per_user: "3",
  notify_admin_on_request: "true",
  notify_admin_on_approval: "false",
  require_channel_membership: "false",
  bot_language: "en",
  maintenance_mode: "false",
  custom_start_message: "",
  custom_help_message: "",
  anti_spam_enabled: "true",
  deep_link_enabled: "true",
};

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(botSettingsTable);
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    result[row.key] = row.value ?? "";
  }
  return result;
}

router.get("/settings", async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({
      welcomeEnabled: settings.welcome_enabled === "true",
      autoApproveEnabled: settings.auto_approve_enabled === "true",
      autoRejectEnabled: settings.auto_reject_enabled === "true",
      cooldownSeconds: parseInt(settings.cooldown_seconds ?? "0"),
      maxRequestsPerUser: parseInt(settings.max_requests_per_user ?? "3"),
      notifyAdminOnRequest: settings.notify_admin_on_request === "true",
      notifyAdminOnApproval: settings.notify_admin_on_approval === "true",
      requireChannelMembership: settings.require_channel_membership === "true",
      botLanguage: settings.bot_language ?? "en",
      maintenanceMode: settings.maintenance_mode === "true",
      customStartMessage: settings.custom_start_message ?? "",
      customHelpMessage: settings.custom_help_message ?? "",
      antiSpamEnabled: settings.anti_spam_enabled === "true",
      deepLinkEnabled: settings.deep_link_enabled === "true",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const mapping: Record<string, string> = {
      welcomeEnabled: "welcome_enabled",
      autoApproveEnabled: "auto_approve_enabled",
      autoRejectEnabled: "auto_reject_enabled",
      cooldownSeconds: "cooldown_seconds",
      maxRequestsPerUser: "max_requests_per_user",
      notifyAdminOnRequest: "notify_admin_on_request",
      notifyAdminOnApproval: "notify_admin_on_approval",
      requireChannelMembership: "require_channel_membership",
      botLanguage: "bot_language",
      maintenanceMode: "maintenance_mode",
      customStartMessage: "custom_start_message",
      customHelpMessage: "custom_help_message",
      antiSpamEnabled: "anti_spam_enabled",
      deepLinkEnabled: "deep_link_enabled",
    };

    for (const [frontKey, dbKey] of Object.entries(mapping)) {
      if (body[frontKey] !== undefined) {
        const value = String(body[frontKey]);
        await db
          .insert(botSettingsTable)
          .values({ key: dbKey, value })
          .onConflictDoUpdate({
            target: botSettingsTable.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }

    const settings = await getAllSettings();
    res.json({
      welcomeEnabled: settings.welcome_enabled === "true",
      autoApproveEnabled: settings.auto_approve_enabled === "true",
      autoRejectEnabled: settings.auto_reject_enabled === "true",
      cooldownSeconds: parseInt(settings.cooldown_seconds ?? "0"),
      maxRequestsPerUser: parseInt(settings.max_requests_per_user ?? "3"),
      notifyAdminOnRequest: settings.notify_admin_on_request === "true",
      notifyAdminOnApproval: settings.notify_admin_on_approval === "true",
      requireChannelMembership: settings.require_channel_membership === "true",
      botLanguage: settings.bot_language ?? "en",
      maintenanceMode: settings.maintenance_mode === "true",
      customStartMessage: settings.custom_start_message ?? "",
      customHelpMessage: settings.custom_help_message ?? "",
      antiSpamEnabled: settings.anti_spam_enabled === "true",
      deepLinkEnabled: settings.deep_link_enabled === "true",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admins ────────────────────────────────────────────────────────────────────

router.get("/admins", async (req, res) => {
  try {
    const admins = await db.select().from(adminUsersTable).orderBy(asc(adminUsersTable.addedAt));
    res.json(admins.map((a) => ({
      ...a,
      telegramId: Number(a.telegramId),
      addedAt: a.addedAt?.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admins");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admins", async (req, res) => {
  try {
    const body = req.body as {
      telegramId: number;
      username?: string;
      firstName?: string;
      role?: "admin" | "moderator";
      canApprove?: boolean;
      canBroadcast?: boolean;
      canManageAdmins?: boolean;
      canManageSettings?: boolean;
    };
    const [created] = await db.insert(adminUsersTable).values({
      telegramId: body.telegramId,
      username: body.username,
      firstName: body.firstName,
      role: body.role ?? "moderator",
      canApprove: body.canApprove ?? true,
      canBroadcast: body.canBroadcast ?? false,
      canManageAdmins: body.canManageAdmins ?? false,
      canManageSettings: body.canManageSettings ?? false,
    }).returning();
    res.status(201).json({ ...created, telegramId: Number(created.telegramId), addedAt: created.addedAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to add admin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body as Partial<{
      role: "admin" | "moderator";
      canApprove: boolean;
      canBroadcast: boolean;
      canManageAdmins: boolean;
      canManageSettings: boolean;
    }>;
    const [updated] = await db.update(adminUsersTable).set(body).where(eq(adminUsersTable.id, id)).returning();
    res.json({ ...updated, telegramId: Number(updated.telegramId), addedAt: updated.addedAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update admin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
    res.json({ success: true, message: "Admin removed" });
  } catch (err) {
    req.log.error({ err }, "Failed to remove admin");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Channels ─────────────────────────────────────────────────────────────────

router.get("/channels", async (req, res) => {
  try {
    const channels = await db.select().from(channelsTable).orderBy(desc(channelsTable.joinedAt));
    res.json(channels.map((c) => ({
      ...c,
      channelId: Number(c.channelId),
      joinedAt: c.joinedAt?.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get channels");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get("/analytics/daily", async (req, res) => {
  try {
    const days = parseInt((req.query.days as string) ?? "7");
    const rows = await db
      .select()
      .from(analyticsTable)
      .orderBy(desc(analyticsTable.date))
      .limit(days);

    const result = rows.reverse().map((r) => ({
      date: r.date,
      totalRequests: r.totalRequests ?? 0,
      approved: r.approved ?? 0,
      rejected: r.rejected ?? 0,
      newUsers: r.newUsers ?? 0,
    }));

    // Fill in missing days with zeros
    const dates: Record<string, typeof result[0]> = {};
    for (const r of result) {
      dates[r.date] = r;
    }

    const filled = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      filled.push(dates[key] ?? { date: key, totalRequests: 0, approved: 0, rejected: 0, newUsers: 0 });
    }

    res.json(filled);
  } catch (err) {
    req.log.error({ err }, "Failed to get analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Auto Rules ───────────────────────────────────────────────────────────────

router.get("/auto-rules", async (req, res) => {
  try {
    const rules = await db.select().from(autoRulesTable).orderBy(desc(autoRulesTable.priority));
    res.json(rules.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get auto rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auto-rules", async (req, res) => {
  try {
    const body = req.body as { name: string; isActive?: boolean; ruleType: string; pattern: string; action: string; priority?: number };
    const [created] = await db.insert(autoRulesTable).values({
      name: body.name,
      isActive: body.isActive ?? true,
      ruleType: body.ruleType,
      pattern: body.pattern,
      action: body.action,
      priority: body.priority ?? 0,
    }).returning();
    res.status(201).json({ ...created, createdAt: created.createdAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create auto rule");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/auto-rules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [updated] = await db.update(autoRulesTable).set(body).where(eq(autoRulesTable.id, id)).returning();
    res.json({ ...updated, createdAt: updated.createdAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update auto rule");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/auto-rules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(autoRulesTable).where(eq(autoRulesTable.id, id));
    res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete auto rule");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Approval Messages ────────────────────────────────────────────────────────

router.get("/approval-messages", async (req, res) => {
  try {
    const msgs = await db
      .select()
      .from(approvalMessagesTable)
      .orderBy(desc(approvalMessagesTable.createdAt));
    res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt?.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get approval messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approval-messages", async (req, res) => {
  try {
    const body = req.body as {
      name: string;
      messageText: string;
      parseMode?: string;
      photoUrl?: string;
      hasInlineButtons?: boolean;
      inlineButtons?: unknown;
    };
    const [created] = await db
      .insert(approvalMessagesTable)
      .values({
        name: body.name,
        messageText: body.messageText,
        parseMode: body.parseMode ?? "Markdown",
        photoUrl: body.photoUrl,
        hasInlineButtons: body.hasInlineButtons ?? false,
        inlineButtons: body.inlineButtons ?? null,
      })
      .returning();
    res.status(201).json({ ...created, createdAt: created.createdAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create approval message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/approval-messages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [updated] = await db
      .update(approvalMessagesTable)
      .set(body)
      .where(eq(approvalMessagesTable.id, id))
      .returning();
    res.json({ ...updated, createdAt: updated.createdAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update approval message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/approval-messages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(approvalMessagesTable).where(eq(approvalMessagesTable.id, id));
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete approval message");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/approval-messages/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(approvalMessagesTable).set({ isActive: false });
    await db.update(approvalMessagesTable).set({ isActive: true }).where(eq(approvalMessagesTable.id, id));
    res.json({ success: true, message: "Approval message activated" });
  } catch (err) {
    req.log.error({ err }, "Failed to activate approval message");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Rejection Messages ───────────────────────────────────────────────────────

router.get("/rejection-messages", async (req, res) => {
  try {
    const msgs = await db
      .select()
      .from(rejectionMessagesTable)
      .orderBy(desc(rejectionMessagesTable.createdAt));
    res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt?.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get rejection messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/rejection-messages", async (req, res) => {
  try {
    const body = req.body as { name: string; messageText: string; parseMode?: string };
    const [created] = await db
      .insert(rejectionMessagesTable)
      .values({
        name: body.name,
        messageText: body.messageText,
        parseMode: body.parseMode ?? "Markdown",
      })
      .returning();
    res.status(201).json({ ...created, createdAt: created.createdAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create rejection message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/rejection-messages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db
      .update(rejectionMessagesTable)
      .set(req.body)
      .where(eq(rejectionMessagesTable.id, id))
      .returning();
    res.json({ ...updated, createdAt: updated.createdAt?.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update rejection message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/rejection-messages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(rejectionMessagesTable).where(eq(rejectionMessagesTable.id, id));
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete rejection message");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/rejection-messages/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(rejectionMessagesTable).set({ isActive: false });
    await db.update(rejectionMessagesTable).set({ isActive: true }).where(eq(rejectionMessagesTable.id, id));
    res.json({ success: true, message: "Rejection message activated" });
  } catch (err) {
    req.log.error({ err }, "Failed to activate rejection message");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Bot Info ─────────────────────────────────────────────────────────────────

router.get("/bot/info", async (req, res) => {
  try {
    const botInfo = await bot.telegram.getMe();
    res.json({
      id: botInfo.id,
      firstName: botInfo.first_name,
      username: botInfo.username,
      isOnline: true,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get bot info");
    res.json({ id: 0, firstName: "Unknown", username: "unknown", isOnline: false });
  }
});

export default router;
