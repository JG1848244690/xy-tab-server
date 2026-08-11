import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
export const task = sqliteTable("tasks", {
    id: integer("id", { mode: 'number' })
        .primaryKey({ autoIncrement: true }),
    name: text('name')
        .notNull(),
    done: integer('done', { mode: 'boolean' })
        .notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
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