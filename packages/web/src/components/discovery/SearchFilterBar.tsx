import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import cpoProtectedIcon from '../../assets/icons/cpo-protected.svg'
import verifiedFilterIcon from '../../assets/icons/verified-filter.svg'
import { useCategories, useOrganizations } from '@/features/operations/queries'
import { Icon } from '../ui/Icon'
import { ETHIOPIAN_REGIONS, STATUS_TABS, useDiscoveryFilters } from './use-discovery-filters'

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full appearance-none truncate border border-line bg-panel py-[8px] pr-[32px] pl-[12px] text-left text-body-13 text-ink-strong"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        src={chevronDownIcon}
        width={9}
        height={5.45625}
        className="pointer-events-none absolute top-1/2 right-[12px] -translate-y-1/2"
      />
    </label>
  )
}

export function SearchFilterBar({ total }: { total: number | undefined }) {
  const { filters, update } = useDiscoveryFilters()
  const categories = useCategories()
  const organizations = useOrganizations()

  return (
    <section className="flex flex-col gap-[12px] border border-line bg-card p-[12px] drop-shadow-panel">
      <div className="flex flex-col gap-2 border-b border-line/60 pb-[8px] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-[4px] overflow-x-auto" role="tablist" aria-label="Auction status">
          {STATUS_TABS.map(({ value, label }) => {
            const active = filters.status === value
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => update({ status: value })}
                className={`px-[12px] py-[6px] font-label text-label-11 font-medium whitespace-nowrap uppercase ${
                  active ? 'border border-primary bg-primary text-primary-foreground' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {label}
                {active && total !== undefined ? ` (${total})` : ''}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-[8px]">
          <Icon src={verifiedFilterIcon} width={16.2} height={15.3} />
          <span className="text-sm text-ink-soft">Only auctions approved under the two-person rule are listed</span>
        </div>
      </div>

      <div className="flex flex-col gap-[8px] md:flex-row md:items-start">
        <FilterSelect
          label="Category"
          value={filters.categoryId}
          onChange={(categoryId) => update({ categoryId })}
          options={[
            { value: '', label: 'Category: All Categories' },
            ...(categories.data?.items ?? []).map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <FilterSelect
          label="Issuer"
          value={filters.orgId}
          onChange={(orgId) => update({ orgId })}
          options={[
            { value: '', label: 'Issuer: All Organizations' },
            ...(organizations.data?.items ?? []).map((org) => ({ value: org.id, label: org.name })),
          ]}
        />
        <FilterSelect
          label="Region"
          value={filters.region}
          onChange={(region) => update({ region })}
          options={[
            { value: '', label: 'Location: All Regions' },
            ...ETHIOPIAN_REGIONS.map((region) => ({ value: region, label: region })),
          ]}
        />
        <div className="flex min-w-0 flex-1 items-center justify-between border border-line bg-panel px-[12px] py-[8px]">
          <div className="flex items-center gap-[6px]">
            <Icon src={cpoProtectedIcon} width={10.4} height={12.8} />
            <span className="text-body-13 whitespace-nowrap text-ink-soft">CPO Bond Protected</span>
          </div>
          <span className="font-label text-label-11 font-semibold whitespace-nowrap text-forest uppercase">Active</span>
        </div>
      </div>
    </section>
  )
}
