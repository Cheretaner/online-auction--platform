import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const PAGE_SIZE = 10;

export const STATUS_TABS = [
  { value: "", label: "All tenders" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Upcoming" },
  { value: "closed", label: "Closed" },
  { value: "awarded", label: "Awarded" },
] as const;

export const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Central Ethiopia",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "South Ethiopia",
  "South West Ethiopia",
  "Tigray",
] as const;

export interface DiscoveryFilters {
  q: string;
  status: string;
  categoryId: string;
  orgId: string;
  region: string;
  page: number;
}

/** Discovery filters live in the URL so a filtered view can be shared and
 * survives a reload. Any filter change goes back to the first page. */
export function useDiscoveryFilters() {
  const [params, setParams] = useSearchParams();
  const filters: DiscoveryFilters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      status: params.get("status") ?? "",
      categoryId: params.get("categoryId") ?? "",
      orgId: params.get("orgId") ?? "",
      region: params.get("region") ?? "",
      page: Math.max(1, Number(params.get("page") ?? 1) || 1),
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<DiscoveryFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === "" || value === undefined || (key === "page" && value === 1)) next.delete(key);
            else next.set(key, String(value));
          }
          if (!("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const apiParams = useMemo(
    () => ({
      q: filters.q || undefined,
      status: filters.status || undefined,
      categoryId: filters.categoryId || undefined,
      orgId: filters.orgId || undefined,
      region: filters.region || undefined,
      limit: PAGE_SIZE,
      offset: (filters.page - 1) * PAGE_SIZE,
    }),
    [filters],
  );

  return { filters, update, apiParams };
}
