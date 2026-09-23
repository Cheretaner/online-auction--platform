import { ListingFeed } from '../components/discovery/ListingFeed'
import { SearchFilterBar } from '../components/discovery/SearchFilterBar'
import { TenderSidebar } from '../components/discovery/TenderSidebar'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'

export function AuctionDiscoveryPage() {
  return (
    <div className="flex min-h-screen flex-col gap-[32px] bg-canvas font-body text-ink">
      <Header />
      <main className="bg-canvas pt-[112px]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-[20px] px-[48px] py-[12px]">
          <SearchFilterBar />
          <div className="grid grid-cols-12 items-start gap-[24px]">
            <ListingFeed />
            <TenderSidebar />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
