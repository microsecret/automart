import { IconArrowsExchange, IconCar, IconGavel, IconNews } from "@tabler/icons-react"

const emblems = { news: IconNews, lots: IconGavel, rates: IconArrowsExchange, listings: IconCar }

/** Decorative section identity; the adjacent heading remains the accessible name. */
export default function SidebarEmblem({ tone }: { tone: keyof typeof emblems }) {
  const Icon = emblems[tone]
  return <span className="sidebar-emblem" aria-hidden="true"><Icon size={18} stroke={1.8} /></span>
}
