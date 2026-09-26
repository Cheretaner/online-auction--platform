import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ListingFeed } from '../components/discovery/ListingFeed'
import { SearchFilterBar } from '../components/discovery/SearchFilterBar'
import { TenderSidebar } from '../components/discovery/TenderSidebar'
import { PAGE_SIZE, useDiscoveryFilters } from '../components/discovery/use-discovery-filters'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'
import { usePublicAuctions } from '@/features/auctions/queries'
import { useOrganizations } from '@/features/operations/queries'
import { getErrorMessage } from '@/lib/api/errors'

const pagerButton =
  'border border-ink px-[12px] py-[6px] font-label text-label-12 font-medium uppercase text-ink disabled:border-line disabled:text-line'

export default function AuctionDiscoveryPage() {
  const { filters, update, apiParams } = useDiscoveryFilters()
  const auctions = usePublicAuctions(apiParams)
  const organizations = useOrganizations()
  const location = useLocation()

  const orgNames = useMemo(
    () => new Map((organizations.data?.items ?? []).map((org) => [org.id, org.name])),
    [organizations.data],
  )
  const issuerName = (orgId: string) => orgNames.get(orgId) ?? 'Verified issuer'

  const items = auctions.data?.items ?? []
  const total = auctions.data?.total
  const pages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash, auctions.isSuccess])

  return (
    <div className="flex min-h-screen flex-col gap-[32px] bg-canvas font-body text-ink">
      <Header />
      <main className="flex-1 bg-canvas">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-[20px] px-4 py-[12px] lg:px-[48px]">
          <SearchFilterBar total={total} />
          <div className="grid grid-cols-12 items-start gap-[24px]">
            <ListingFeed
              auctions={items}
              issuerName={issuerName}
              loading={auctions.isLoading}
              error={auctions.isError ? getErrorMessage(auctions.error, 'Auctions could not be loaded') : null}
              onRetry={() => void auctions.refetch()}
              footer={
                total && total > PAGE_SIZE ? (
                  <nav className="flex items-center justify-between pt-[4px]" aria-label="Pagination">
                    <button
                      type="button"
                      className={pagerButton}
                      disabled={filters.page <= 1}
                      onClick={() => update({ page: filters.page - 1 })}
                    >
                      Previous
                    </button>
                    <span className="font-label text-label-11 text-ink-soft">
                      Page {filters.page} of {pages} · {total} auctions
                    </span>
                    <button
                      type="button"
                      className={pagerButton}
                      disabled={filters.page >= pages}
                      onClick={() => update({ page: filters.page + 1 })}
                    >
                      Next
                    </button>
                  </nav>
                ) : null
              }
            />
            <TenderSidebar auction={items[0]} issuer={items[0] ? issuerName(items[0].orgId) : ''} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
