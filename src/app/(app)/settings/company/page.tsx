import type { Metadata } from "next"
import { Suspense } from "react"

import { CompanyForm } from "@/components/settings/company-form"
import { PageSkeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import { getCompany, getStates } from "@/lib/data/reference"
import { can } from "@/lib/domain/permissions"

export const metadata: Metadata = { title: "Company settings" }

export default function CompanySettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Company />
    </Suspense>
  )
}

async function Company() {
  const [user, company, states] = await Promise.all([getCurrentUser(), getCompany(), getStates()])
  const s = (v: string | null) => v ?? ""
  return (
    <CompanyForm
      readOnly={!can(user.role, "settings.manage")}
      states={states}
      initial={{
        name: company.name,
        legal_name: company.legal_name,
        gstin: s(company.gstin),
        state_code: company.state_code,
        address_line1: s(company.address_line1),
        address_line2: s(company.address_line2),
        city: s(company.city),
        pincode: s(company.pincode),
        phone: s(company.phone),
        email: s(company.email),
        bank_name: s(company.bank_name),
        bank_account_number: s(company.bank_account_number),
        bank_ifsc: s(company.bank_ifsc),
        invoice_terms: s(company.invoice_terms),
        invoice_footer: s(company.invoice_footer),
        overhead_per_unit_estimate: company.overhead_per_unit_estimate === null ? "" : String(company.overhead_per_unit_estimate),
        is_demo_configuration: company.is_demo_configuration,
      }}
    />
  )
}
