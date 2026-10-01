import { ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { useCategories, useOrganizations } from '@/features/operations/queries'
import { cn } from '@/lib/utils'
import { ETHIOPIAN_REGIONS, STATUS_TABS, useDiscoveryFilters } from './use-discovery-filters'

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="eyebrow text-muted-foreground">
        {label}
      </label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}

export function SearchFilterBar({ total }: { total: number | undefined }) {
  const { filters, update } = useDiscoveryFilters()
  const categories = useCategories()
  const organizations = useOrganizations()

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 lg:pb-0"
          role="group"
          aria-label="Filter by auction status"
        >
          {STATUS_TABS.map(({ value, label }) => {
            const active = filters.status === value
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => update({ status: value })}
                className={cn(
                  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {label}
                {active && total !== undefined ? (
                  <span className="rounded-sm bg-primary-foreground/20 px-1.5 text-xs tabular-nums">{total}</span>
                ) : null}
              </button>
            )
          })}
        </div>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          Only auctions approved under the two-person rule are listed
        </p>
      </div>

      <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
        <FilterSelect
          id="filter-category"
          label="Category"
          value={filters.categoryId}
          onChange={(categoryId) => update({ categoryId })}
          allLabel="All categories"
          options={(categories.data?.items ?? []).map((category) => ({ value: category.id, label: category.name }))}
        />
        <FilterSelect
          id="filter-issuer"
          label="Issuer"
          value={filters.orgId}
          onChange={(orgId) => update({ orgId })}
          allLabel="All organizations"
          options={(organizations.data?.items ?? []).map((org) => ({ value: org.id, label: org.name }))}
        />
        <FilterSelect
          id="filter-region"
          label="Region"
          value={filters.region}
          onChange={(region) => update({ region })}
          allLabel="All regions"
          options={ETHIOPIAN_REGIONS.map((region) => ({ value: region, label: region }))}
        />
      </div>
    </Card>
  )
}
