import type { ReactNode } from "react"

import { PageHeader } from "@/components/common/page-header"
import { SettingsTabs } from "@/components/settings/settings-tabs"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Company details, tax configuration, numbering and user access." />
      <SettingsTabs />
      <div className="mt-5">{children}</div>
    </>
  )
}
