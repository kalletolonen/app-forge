"use client";

import { useTransition } from "react";
import { deleteRecord } from "@/lib/actions";

export function DeleteRecordButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn danger"
      style={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}
      disabled={pending}
      onClick={() => startTransition(() => deleteRecord(id))}
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
