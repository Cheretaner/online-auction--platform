import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/layout/page-header'
import { Pagination } from '@/components/ui/pagination'
import { ListingFeed } from '../components/discovery/ListingFeed'
import { SearchFilterBar } from '../components/discovery/SearchFilterBar'
import { TenderSidebar } from '../components/discovery/TenderSidebar'
import { PAGE_SIZE, useDiscoveryFilters } from '../components/discovery/use-discovery-filters'
import { usePublicAuctions } from '@/features/auctions/queries'
import { useOrganizations } from '@/features/operations/queries'
import { useT } from '@/i18n/context'

export default function AuctionDiscoveryPage() {
  const { filters, update, apiParams } = useDiscoveryFilters()
  const auctions = usePublicAuctions(apiParams)
  const organizations = useOrganizations()
  const location = useLocation()
  const t = useT('auctions')

  const orgNames = useMemo(
    () => new Map((organizations.data?.items ?? []).map((org) => [org.id, org.name])),
    [organizations.data],
  )
  const issuerName = (orgId: string) => orgNames.get(orgId) ?? t('discovery.verifiedIssuer')

  const items = auctions.data?.items ?? []
  const total = auctions.data?.total
  const pages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1
  const hasFilters = Boolean(filters.q || filters.status || filters.categoryId || filters.orgId || filters.region)

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash, auctions.isSuccess])

  return (
    <div>
      <PageHeader
        title={filters.q ? t('discovery.resultsFor', { query: filters.q }) : t('discovery.title')}
        description={t('discovery.description')}
      />
      <div className="flex flex-col gap-6">
        <SearchFilterBar total={total} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ListingFeed
            auctions={items}
            issuerName={issuerName}
            loading={auctions.isLoading}
            error={auctions.isError ? auctions.error : null}
            onRetry={() => void auctions.refetch()}
            onClearFilters={
              hasFilters ? () => update({ q: '', status: '', categoryId: '', orgId: '', region: '' }) : undefined
            }
            footer={
              <Pagination
                page={filters.page}
                pages={pages}
                total={total}
                noun={t('discovery.noun')}
                onChange={(page) => {
                  update({ page })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            }
          />
          <TenderSidebar auction={items[0]} issuer={items[0] ? issuerName(items[0].orgId) : ''} />
        </div>
      </div>
    </div>
  )
}
