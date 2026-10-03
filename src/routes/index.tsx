import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Pencil, Plus, Trash2, Wallet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  createExpense,
  deleteExpense,
  getCategorySummary,
  getTotal,
  listExpenses,
  updateExpense,
  type Category,
  type Expense,
} from "@/lib/expenses.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledger — Expense Tracker" },
      { name: "description", content: "Track daily spending in AZN with a clean, minimal dashboard." },
      { property: "og:title", content: "Ledger — Expense Tracker" },
      { property: "og:description", content: "Track daily spending in AZN with a clean, minimal dashboard." },
    ],
  }),
  component: Dashboard,
});

const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const azn = (n: number) => `${fmt.format(n)} ₼`;
const label = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Dashboard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExpenses);
  const totalFn = useServerFn(getTotal);
  const catFn = useServerFn(getCategorySummary);
  const delFn = useServerFn(deleteExpense);

  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => listFn() });
  const total = useQuery({ queryKey: ["total"], queryFn: () => totalFn() });
  const cats = useQuery({ queryKey: ["cats"], queryFn: () => catFn() });

  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const refresh = () => qc.invalidateQueries();

  const del = useMutation({
    mutationFn: (id: number) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Expense deleted");
      setToDelete(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sorted = [...(expenses.data ?? [])].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const catData = [...(cats.data ?? [])].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const catMax = Math.max(1, ...catData.map((c) => c.amount));
  const anyError = expenses.error || total.error || cats.error;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wallet className="h-4 w-4" /> Ledger
          </p>
          <h1 className="font-display text-5xl text-foreground sm:text-6xl">Your expenses</h1>
        </div>
        <Button
          size="lg"
          className="rounded-full px-6"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </header>

      {anyError && (
        <div className="mb-8 flex flex-col items-start justify-between gap-3 rounded-2xl border border-destructive/30 bg-card p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-foreground">We couldn't load your data.</p>
            <p className="text-sm text-muted-foreground">
              The server may be waking up — this can take up to a minute. {(anyError as Error).message}
            </p>
          </div>
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )}

      <section className="mb-10 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-7 shadow-soft">
          <p className="text-sm text-muted-foreground">Total spent</p>
          {total.isLoading ? (
            <Skeleton className="mt-4 h-12 w-48" />
          ) : (
            <p className="mt-3 font-display text-5xl tabular-nums text-foreground">{azn(total.data ?? 0)}</p>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            {expenses.isLoading ? "…" : `${sorted.length} ${sorted.length === 1 ? "expense" : "expenses"} recorded`}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-7 shadow-soft lg:col-span-2">
          <p className="mb-5 text-sm text-muted-foreground">By category</p>
          {cats.isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : catData.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No spending yet.</p>
          ) : (
            <ul className="space-y-4">
              {catData.map((c) => (
                <li key={c.category} className="grid grid-cols-[7rem_1fr_auto] items-center gap-4 text-sm">
                  <span className="text-foreground">{label(c.category)}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(c.amount / catMax) * 100}%` }}
                    />
                  </span>
                  <span className="tabular-nums font-medium text-foreground">{azn(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b px-7 py-5">
          <h2 className="text-base font-semibold text-foreground">Recent expenses</h2>
        </div>
        {expenses.isLoading ? (
          <div className="space-y-3 p-7">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center px-7 py-16 text-center">
            <p className="font-display text-3xl text-foreground">Nothing here yet</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Add your first expense to start seeing totals and category breakdowns.
            </p>
            <Button
              variant="outline"
              className="mt-6 rounded-full"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {sorted.map((e) => (
              <li key={e.id} className="group flex items-center gap-4 px-7 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{e.title}</p>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                      {label(e.category)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {fmtDate(e.expenseDate)}
                    {e.description ? ` · ${e.description}` : ""}
                  </p>
                </div>
                <p className="tabular-nums font-semibold text-foreground">{azn(e.amount)}</p>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(e);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setToDelete(e)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} expense={editing} onSaved={refresh} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                if (toDelete) del.mutate(toDelete.id);
              }}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type FormState = { title: string; amount: string; category: Category | ""; expenseDate: string; description: string };

function ExpenseForm({
  open,
  onOpenChange,
  expense,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: Expense | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <FormBody key={expense?.id ?? "new"} expense={expense} onDone={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({ expense, onDone, onSaved }: { expense: Expense | null; onDone: () => void; onSaved: () => void }) {
  const createFn = useServerFn(createExpense);
  const updateFn = useServerFn(updateExpense);
  const [f, setF] = useState<FormState>(() => ({
    title: expense?.title ?? "",
    amount: expense ? String(expense.amount) : "",
    category: expense?.category ?? "",
    expenseDate: expense?.expenseDate ?? new Date().toISOString().slice(0, 10),
    description: expense?.description ?? "",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: f.title.trim(),
        amount: Number(f.amount),
        category: f.category as Category,
        expenseDate: f.expenseDate,
        description: f.description.trim() || null,
      };
      return expense ? updateFn({ data: { ...payload, id: expense.id } }) : createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(expense ? "Expense updated" : "Expense added");
      onSaved();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Something went wrong"),
  });

  const validate = () => {
    const e: typeof errors = {};
    if (!f.title.trim()) e.title = "Title is required";
    else if (f.title.length > 120) e.title = "Keep it under 120 characters";
    const n = Number(f.amount);
    if (!f.amount) e.amount = "Amount is required";
    else if (!Number.isFinite(n) || n <= 0) e.amount = "Enter an amount greater than 0";
    if (!f.category) e.category = "Choose a category";
    if (!f.expenseDate) e.expenseDate = "Date is required";
    if (f.description.length > 500) e.description = "Keep it under 500 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        if (validate()) save.mutate();
      }}
      className="space-y-5"
      noValidate
    >
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">{expense ? "Edit expense" : "New expense"}</DialogTitle>
        <DialogDescription>All amounts are in Azerbaijani manat (AZN).</DialogDescription>
      </DialogHeader>

      <Field label="Title" error={errors.title}>
        <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Groceries" maxLength={120} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (₼)" error={errors.amount}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={f.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Date" error={errors.expenseDate}>
          <Input type="date" value={f.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} />
        </Field>
      </div>

      <Field label="Category" error={errors.category}>
        <Select value={f.category} onValueChange={(v) => set("category", v as Category)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {label(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Description (optional)" error={errors.description}>
        <Textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Add a note"
        />
      </Field>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label: l, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-foreground">{l}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
