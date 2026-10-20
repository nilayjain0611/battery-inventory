import type { Metadata } from "next"
import { Suspense } from "react"

import { EmptyState, NotAllowed } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { NewProductionForm } from "@/components/manufacturing/new-production-form"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getUserWith } from "@/lib/auth"
import { listBoms } from "@/lib/data/manufacturing"
import { param, todayIST, type SearchParams } from "@/lib/format"

export const metadata: Metadata = { title: "New production order" }

export default function NewProductionPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="max-w-5xl">
      <PageHeader title="New production order" back={{ href: "/manufacturing", label: "Manufacturing" }} />
      <Suspense fallback={<PageSkeleton />}>
        <NewProduction searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function NewProduction({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getUserWith("production.manage")
  if (!allowed) return <NotAllowed what="plan production" />
  const sp = await searchParams
  const boms = (await listBoms()).filter((b) => b.is_active)
  if (boms.length === 0) return <EmptyState title="No active bills of materials" description="Add a BOM for an own-brand product first." />
  return <NewProductionForm boms={boms} today={todayIST()} defaultBomId={param(sp.bom)} />
}
