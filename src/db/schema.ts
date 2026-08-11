import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

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