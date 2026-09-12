"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { records } from "@repo/database/schema";
import { getDb } from "./db";
import { requireSession } from "./session";

const appId = process.env.APP_ID ?? "demo";

export async function createRecord(formData: FormData) {
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!title) {
    throw new Error("Title is required");
  }

  const db = await getDb();
  await db.insert(records).values({
    appId,
    userId: session.user.id,
    title,
    notes: notes || null,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteRecord(id: string) {
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  const db = await getDb();
  await db
    .delete(records)
    .where(
      and(
        eq(records.id, id),
        eq(records.userId, session.user.id),
        eq(records.appId, appId),
      ),
    );

  revalidatePath("/dashboard");
}

export async function updateRecord(id: string, formData: FormData) {
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!title) {
    throw new Error("Title is required");
  }

  const db = await getDb();
  await db
    .update(records)
    .set({
      title,
      notes: notes || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(records.id, id),
        eq(records.userId, session.user.id),
        eq(records.appId, appId),
      ),
    );

  revalidatePath(`/records/${id}`);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
