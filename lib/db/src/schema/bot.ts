import {
  pgTable,
  text,
  serial,
  bigint,
  boolean,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "moderator", "user"]);

export const broadcastStatusEnum = pgEnum("broadcast_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  languageCode: text("language_code"),
  isBot: boolean("is_bot").default(false),
  isPremium: boolean("is_premium").default(false),
  isBlacklisted: boolean("is_blacklisted").default(false),
  blacklistReason: text("blacklist_reason"),
  referredBy: bigint("referred_by", { mode: "number" }),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  requestCount: integer("request_count").default(0),
  notes: text("notes"),
});

export const joinRequestsTable = pgTable("join_requests", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  channelId: bigint("channel_id", { mode: "number" }).notNull(),
  channelTitle: text("channel_title"),
  channelUsername: text("channel_username"),
  status: requestStatusEnum("status").default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: bigint("processed_by", { mode: "number" }),
  rejectionReason: text("rejection_reason"),
  autoProcessed: boolean("auto_processed").default(false),
  userMessage: text("user_message"),
});

export const botSettingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const welcomeMessagesTable = pgTable("welcome_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false),
  messageText: text("message_text").notNull(),
  parseMode: text("parse_mode").default("Markdown"),
  photoUrl: text("photo_url"),
  photoFileId: text("photo_file_id"),
  hasInlineButtons: boolean("has_inline_buttons").default(false),
  inlineButtons: jsonb("inline_buttons"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const approvalMessagesTable = pgTable("approval_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false),
  messageText: text("message_text").notNull(),
  parseMode: text("parse_mode").default("Markdown"),
  photoUrl: text("photo_url"),
  photoFileId: text("photo_file_id"),
  hasInlineButtons: boolean("has_inline_buttons").default(false),
  inlineButtons: jsonb("inline_buttons"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rejectionMessagesTable = pgTable("rejection_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false),
  messageText: text("message_text").notNull(),
  parseMode: text("parse_mode").default("Markdown"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  messageText: text("message_text").notNull(),
  parseMode: text("parse_mode").default("Markdown"),
  photoUrl: text("photo_url"),
  photoFileId: text("photo_file_id"),
  caption: text("caption"),
  hasInlineButtons: boolean("has_inline_buttons").default(false),
  inlineButtons: jsonb("inline_buttons"),
  status: broadcastStatusEnum("status").default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  totalRecipients: integer("total_recipients").default(0),
  successCount: integer("success_count").default(0),
  failCount: integer("fail_count").default(0),
  targetFilter: text("target_filter").default("all"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: bigint("created_by", { mode: "number" }),
});

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  role: userRoleEnum("role").default("moderator"),
  canApprove: boolean("can_approve").default(true),
  canBroadcast: boolean("can_broadcast").default(false),
  canManageAdmins: boolean("can_manage_admins").default(false),
  canManageSettings: boolean("can_manage_settings").default(false),
  addedAt: timestamp("added_at").defaultNow(),
  addedBy: bigint("added_by", { mode: "number" }),
});

export const analyticsTable = pgTable("analytics", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  totalRequests: integer("total_requests").default(0),
  approved: integer("approved").default(0),
  rejected: integer("rejected").default(0),
  pending: integer("pending").default(0),
  newUsers: integer("new_users").default(0),
  broadcastsSent: integer("broadcasts_sent").default(0),
  messagesDelivered: integer("messages_delivered").default(0),
});

export const autoRulesTable = pgTable("auto_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  ruleType: text("rule_type").notNull(),
  pattern: text("pattern").notNull(),
  action: text("action").notNull(),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forwardRulesTable = pgTable("forward_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  fromChatId: bigint("from_chat_id", { mode: "number" }),
  toChatId: bigint("to_chat_id", { mode: "number" }).notNull(),
  filterKeywords: text("filter_keywords"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  channelId: bigint("channel_id", { mode: "number" }).notNull().unique(),
  title: text("title"),
  username: text("username"),
  isActive: boolean("is_active").default(true),
  requireApproval: boolean("require_approval").default(true),
  welcomeMessageId: integer("welcome_message_id"),
  approvalMessageId: integer("approval_message_id"),
  rejectionMessageId: integer("rejection_message_id"),
  autoApproveEnabled: boolean("auto_approve_enabled").default(false),
  cooldownSeconds: integer("cooldown_seconds").default(0),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const scheduledMessagesTable = pgTable("scheduled_messages", {
  id: serial("id").primaryKey(),
  broadcastId: integer("broadcast_id"),
  cronExpression: text("cron_expression"),
  scheduledAt: timestamp("scheduled_at"),
  isRecurring: boolean("is_recurring").default(false),
  isActive: boolean("is_active").default(true),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export const insertJoinRequestSchema = createInsertSchema(joinRequestsTable).omit({ id: true });
export const insertBotSettingSchema = createInsertSchema(botSettingsTable).omit({ id: true });
export const insertWelcomeMessageSchema = createInsertSchema(welcomeMessagesTable).omit({ id: true });
export const insertBroadcastSchema = createInsertSchema(broadcastsTable).omit({ id: true });
export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({ id: true });
export const insertAutoRuleSchema = createInsertSchema(autoRulesTable).omit({ id: true });
export const insertChannelSchema = createInsertSchema(channelsTable).omit({ id: true });

export type User = typeof usersTable.$inferSelect;
export type JoinRequest = typeof joinRequestsTable.$inferSelect;
export type BotSetting = typeof botSettingsTable.$inferSelect;
export type WelcomeMessage = typeof welcomeMessagesTable.$inferSelect;
export type ApprovalMessage = typeof approvalMessagesTable.$inferSelect;
export type RejectionMessage = typeof rejectionMessagesTable.$inferSelect;
export type Broadcast = typeof broadcastsTable.$inferSelect;
export type AdminUser = typeof adminUsersTable.$inferSelect;
export type Analytics = typeof analyticsTable.$inferSelect;
export type AutoRule = typeof autoRulesTable.$inferSelect;
export type Channel = typeof channelsTable.$inferSelect;
