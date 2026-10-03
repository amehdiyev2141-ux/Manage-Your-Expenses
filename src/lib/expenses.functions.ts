import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://expense-tracker-cajv.onrender.com/api/expenses";

export const CATEGORIES = [
  "MARKET",
  "TRANSPORT",
  "FOOD",
  "HOME",
  "SHOPPING",
  "HEALTH",
  "ENTERTAINMENT",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Expense = {
  id: number;
  title: string;
  amount: number;
  category: Category;
  expenseDate: string;
  description: string | null;
};

export type CategorySummary = { category: Category; amount: number };

const expenseInput = z.object({
  title: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1_000_000_000),
  category: z.enum(CATEGORIES),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional().nullable(),
});

async function call(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Could not reach the server. Please try again.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Backend error", res.status, text);
    throw new Error(
      res.status === 404 ? "That expense no longer exists." : "The server could not process the request.",
    );
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const listExpenses = createServerFn({ method: "GET" }).handler(async () => {
  const data = (await call("")) as Expense[];
  return data.map((e) => ({ ...e, amount: Number(e.amount), description: e.description ?? null }));
});

export const getTotal = createServerFn({ method: "GET" }).handler(async () => {
  const v = await call("/summary");
  return Number(v ?? 0);
});

export const getCategorySummary = createServerFn({ method: "GET" }).handler(async () => {
  const data = ((await call("/summary/category")) ?? []) as CategorySummary[];
  return data.map((c) => ({ category: c.category, amount: Number(c.amount) }));
});

export const createExpense = createServerFn({ method: "POST" })
  .inputValidator((d) => expenseInput.parse(d))
  .handler(async ({ data }) => {
    await call("", { method: "POST", body: JSON.stringify(data) });
    return { ok: true };
  });

export const updateExpense = createServerFn({ method: "POST" })
  .inputValidator((d) => expenseInput.extend({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { id, ...body } = data;
    await call(`/${id}`, { method: "PUT", body: JSON.stringify(body) });
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    await call(`/${data.id}`, { method: "DELETE" });
    return { ok: true };
  });
