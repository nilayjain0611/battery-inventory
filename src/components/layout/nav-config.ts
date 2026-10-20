import {
  ArrowRightLeftIcon,
  ChartColumnIcon,
  ContactIcon,
  FactoryIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptIndianRupeeIcon,
  SettingsIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Highlight for nested routes, except where a more specific item exists. */
  exact?: boolean
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    title: "Stock",
    items: [
      { href: "/inventory", label: "Stock overview", icon: WarehouseIcon, exact: true },
      { href: "/inventory/products", label: "Products", icon: PackageIcon },
      { href: "/inventory/movements", label: "Stock movements", icon: ArrowRightLeftIcon },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/purchases", label: "Purchases", icon: TruckIcon },
      { href: "/manufacturing", label: "Manufacturing", icon: FactoryIcon },
      { href: "/sales", label: "Sales & invoices", icon: ReceiptIndianRupeeIcon },
      { href: "/payments", label: "Payments", icon: WalletIcon },
    ],
  },
  {
    title: "Parties",
    items: [
      { href: "/customers", label: "Customers", icon: UsersIcon },
      { href: "/suppliers", label: "Suppliers", icon: ContactIcon },
    ],
  },
  {
    title: "Insight",
    items: [
      { href: "/reports", label: "Reports", icon: ChartColumnIcon },
      { href: "/settings/company", label: "Settings", icon: SettingsIcon },
    ],
  },
]

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href.startsWith("/settings")) return pathname.startsWith("/settings")
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
