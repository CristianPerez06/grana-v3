"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MovementList } from "@/lib/transactions/components/movement-list";
import { MovementListSkeleton } from "@/lib/transactions/components/movement-list-skeleton";
import { Button } from "@/components/ui/button";
import { formatDateISO, getTodayAR } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import {
  getGlobalMovementsPage,
  getMonthCategoryLines,
  hasAnyTransaction,
} from "@/lib/transactions/queries";
import { getRecurrenceLinkedTransactionIds } from "@/lib/recurrences/queries";
import { QUERY_KEYS } from "@/lib/transactions/query-keys";
import { useMovementDrawer } from "@/lib/transactions/movement-drawer-context";
import {
  adaptFiltersForQuery,
  hasActiveContentFilters,
  hasActiveSearch,
  type TransactionsFilters,
} from "@/lib/transactions/filters-state";
import { useTransactionsFilters } from "@/lib/transactions/filters-context";

function resolveEmptyVariant(
  filters: TransactionsFilters,
): "none" | "search" | "filter" {
  if (hasActiveContentFilters(filters)) return "filter";
  if (hasActiveSearch(filters)) return "search";
  return "none";
}

/**
 * Client container for `<MovementList>` plus the "Load more" action and the
 * empty-state variant resolution. Reads filters from React state, queries the
 * paginated list + linked recurrence ids + has-any-ever signal, and renders
 * the list with empty-state callbacks wired to the filter reducer.
 */
export function MovementListContainer() {
  const { filters, dispatch } = useTransactionsFilters();
  const drawer = useMovementDrawer();
  const tCommon = useTranslations("common");
  const t = useTranslations("transactions");

  const adapted = useMemo(() => adaptFiltersForQuery(filters), [filters]);

  // Drilled reconciliation view: in the PURE drill state (a category selected —
  // via the donut or the filter bar — with no other content filter or search
  // active), the list shows the movements that COMPOSE that category's donut
  // weight (devengado lens — cuota children by due month, the user's part of
  // shared, received reimbursements netting), NOT the general CAJA feed.
  // Per-currency, like the donut it drills into. As soon as the user layers on
  // another filter (account, type, amount, search) they've left the drill, so we
  // fall back to the general feed that honours ALL filters. Currency and
  // subcategory are part of the drill, so they don't break it.
  const pureCategoryDrill =
    filters.categoryId != null &&
    !filters.type &&
    !filters.accountId &&
    filters.amountMin == null &&
    filters.amountMax == null &&
    filters.query.trim().length === 0;
  const overviewCurrency: "ARS" | "USD" =
    filters.currency === "USD" ? "USD" : "ARS";

  const pageQ = useQuery({
    queryKey: QUERY_KEYS.transactionsPage(filters.limit, adapted),
    queryFn: () =>
      getGlobalMovementsPage(createClient(), {
        limit: filters.limit,
        filters: adapted,
      }),
    enabled: !pureCategoryDrill,
  });

  const linesQ = useQuery({
    queryKey: QUERY_KEYS.categoryLines(
      filters.month,
      filters.categoryId ?? "",
      overviewCurrency,
      filters.subcategoryId,
    ),
    queryFn: () =>
      getMonthCategoryLines(
        createClient(),
        filters.month,
        filters.categoryId as string,
        overviewCurrency,
        filters.subcategoryId ?? undefined,
      ),
    enabled: pureCategoryDrill,
  });

  const activeQ = pureCategoryDrill ? linesQ : pageQ;
  const movements = useMemo(
    () =>
      pureCategoryDrill
        ? (linesQ.data?.movements ?? [])
        : (pageQ.data?.movements ?? []),
    [pureCategoryDrill, linesQ.data, pageQ.data],
  );
  // The reconciliation list returns every composing row (a category-month is
  // small), so it never paginates.
  const hasMore = pureCategoryDrill ? false : (pageQ.data?.hasMore ?? false);

  const movementIds = useMemo(() => movements.map((m) => m.id), [movements]);

  const linkedQ = useQuery({
    queryKey: QUERY_KEYS.transactionsLinkedRecurrenceIds(movementIds),
    queryFn: () => getRecurrenceLinkedTransactionIds(createClient(), movementIds),
    enabled: movementIds.length > 0,
  });

  // "Cuota n de N" chips for the drilled installment children, keyed by row id.
  const installmentChips = useMemo(() => {
    if (!pureCategoryDrill || !linesQ.data) return undefined;
    const chips = new Map<string, string>();
    for (const [id, { n, total }] of linesQ.data.installments) {
      chips.set(id, t("installment_pair", { n, total }));
    }
    return chips;
  }, [pureCategoryDrill, linesQ.data, t]);

  // hasAny is only needed for the "none" empty variant (welcome vs. month-empty
  // copy). Cached for the session, so this is effectively free after first hit.
  const hasAnyQ = useQuery({
    queryKey: QUERY_KEYS.transactionsHasAny,
    queryFn: () => hasAnyTransaction(createClient()),
  });

  if (activeQ.isPending) return <MovementListSkeleton />;
  if (activeQ.error || !activeQ.data) {
    // Generic inline fallback; group 8 upgrades to <RouteError> with retry.
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        No pudimos cargar los movimientos. Recargá para reintentar.
      </div>
    );
  }
  const variant = resolveEmptyVariant(filters);
  const showAccount = false; // sin filter-options aquí; el container de filtros decide

  // Empty-state messaging for the 'none' variant: welcome (first time ever)
  // vs. month-empty (has history in other months).
  let emptyTitle: string | undefined;
  let emptyBody: string | undefined;
  let emptyCta: string | undefined;
  if (variant === "none" && movements.length === 0) {
    const hasAny = hasAnyQ.data;
    if (hasAny === false) {
      emptyTitle = t("empty.welcome.title");
      emptyBody = t("empty.welcome.body");
      emptyCta = t("empty.welcome.cta");
    } else if (hasAny === true) {
      const [yy, mm] = filters.month.split("-").map(Number);
      const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      });
      emptyTitle = t("empty.month.title", { month: monthLabel });
      emptyBody = t("empty.month.body");
      emptyCta = t("empty.month.cta");
    }
  }

  const recurrenceLinkedIds = linkedQ.data ? new Set(linkedQ.data) : undefined;

  const list = (
    <MovementList
      movements={movements}
      perspective={{ kind: "global" }}
      todayISO={formatDateISO(getTodayAR())}
      showAccount={showAccount}
      recurrenceLinkedIds={recurrenceLinkedIds}
      installmentChips={installmentChips}
      emptyState={{
        variant,
        query: filters.query,
        // Open the drawer when available; rendered disabled while the
        // app-shell loader still resolves (drawer === null).
        onAdd: drawer ? () => drawer.openCreate() : undefined,
        onClear:
          variant === "filter"
            ? () => dispatch({ type: "clearFilters" })
            : variant === "search"
              ? () => dispatch({ type: "clearSearch" })
              : undefined,
        title: emptyTitle,
        body: emptyBody,
        cta: emptyCta,
      }}
    />
  );

  // Same ledger-surface wrapper as the cards/period-movements pane: when there
  // are rows, the list sits on a single bordered card so date groups + rows
  // read as one ledger. Empty/loading falls through bare so its own dashed
  // empty-state surface owns the visual.
  return (
    <div id="movement-list" className="scroll-mt-6 flex flex-col gap-6">
      {movements.length === 0 ? (
        list
      ) : (
        <div className="overflow-hidden pt-2 rounded-2xl border border-border bg-card">
          {list}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                dispatch({ type: "incrementLimit" });
              }}
            >
              {tCommon("load_more")}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
