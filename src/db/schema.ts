import { bigint, boolean, jsonb, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ============================================================
// 原 tasks 表(保留)
// ============================================================

export const task = pgTable("tasks", {
    id: serial("id").primaryKey(),
    name: text('name').notNull(),
    done: boolean('done').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const selectTasksSchema = createSelectSchema(task);
export const insertTaskSchema = createInsertSchema(task, {
    name: schema => schema.min(1)
})
    .required({
        done: true
    })
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true
    });

export const patchTasksSchema = insertTaskSchema.partial();

// ============================================================
// 云同步相关表
// ============================================================

/**
 * 用户表
 * - id 是 sha256(email).slice(0, 32),由后端在登录时计算,保证同 email 重复登录 = 同一行
 * - google_sub 是 Google 稳定用户 id,即使 email 改了也能 merge
 */
export const users = pgTable("users", {
    id: text("id").primaryKey(),                          // sha256(email).slice(0,32)
    email: text("email").notNull().unique(),
    googleSub: text("google_sub").notNull().unique(),
    name: text("name"),
    picture: text("picture"),
    createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
    lastLoginAt: timestamp("last_login_at", { mode: 'date' }).defaultNow().notNull(),
});

/**
 * session token 表(支持多设备登录)
 * - id 是后端生成的随机 32 字节 base64url,等价于 session token
 * - 过期时间默认 30 天
 * - last_used_at 用于清理长期不用的 row
 */
export const userSessions = pgTable("user_sessions", {
    id: text("id").primaryKey(),                          // session token 本身
    userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: 'date' }).notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: 'date' }).defaultNow().notNull(),
    userAgent: text("user_agent"),                        // 哪个浏览器/插件
}, (t) => ({
    userIdIdx: index("user_sessions_user_id_idx").on(t.userId),
}));

/**
 * 书签同步快照(shortcuts + groups,一个用户一行)
 * - payload 是整包 JSON,前端用 ExportData 类型
 * - version 用于乐观锁,每次更新 +1
 */
export const syncBookmarks = pgTable("sync_bookmarks", {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    payload: jsonb("payload").notNull(),
    version: bigint("version", { mode: 'number' }).notNull().default(1),
    updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull(),
});

/**
 * 标签页会话同步快照
 */
export const syncTabSessions = pgTable("sync_tab_sessions", {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    payload: jsonb("payload").notNull(),
    version: bigint("version", { mode: 'number' }).notNull().default(1),
    updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull(),
});
