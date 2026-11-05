/** خريطة التنقل المجمّعة (M1): 5 مجموعات منطقية + مشتقات الشريط السفلي للهاتف. */
import {
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ClipboardList,
  FilePenLine,
  Database,
  FileDown,
  LayoutDashboard,
  Package,
  Settings as SettingsIcon,
  Tags,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
};
export type NavGroup = { groupKey: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "nav.groupWorkspace",
    items: [{ href: "/", labelKey: "nav.home", icon: LayoutDashboard }],
  },
  {
    groupKey: "nav.groupReference",
    items: [
      { href: "/entities", labelKey: "nav.entities", icon: Building2 },
      { href: "/items", labelKey: "nav.items", icon: Package },
      { href: "/prices", labelKey: "nav.prices", icon: Tags },
    ],
  },
  {
    groupKey: "nav.groupOperations",
    items: [
      { href: "/cargo", labelKey: "nav.cargo", icon: Calculator },
      { href: "/quick-calculator", labelKey: "nav.quickCalculator", icon: Calculator },
      { href: "/multi-quick-calculator", labelKey: "nav.multiQuickCalculator", icon: Calculator },
      { href: "/quick-entry-drafts", labelKey: "nav.quickEntryDrafts", icon: FilePenLine },
    ],
  },
  {
    groupKey: "nav.groupDecisions",
    items: [
      { href: "/reports", labelKey: "nav.reports", icon: ChartNoAxesCombined },
      { href: "/follow-up", labelKey: "nav.followUp", icon: ClipboardList },
      { href: "/export", labelKey: "nav.export", icon: FileDown },
    ],
  },
  {
    groupKey: "nav.groupSystem",
    items: [
      { href: "/backup", labelKey: "nav.backup", icon: Database },
      { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
    ],
  },
];

export const NAV_FLAT: NavItem[] = NAV_GROUPS.flatMap(group => group.items);

const MOBILE_PRIMARY_HREFS = ["/", "/items", "/cargo", "/reports"];

export const MOBILE_PRIMARY: NavItem[] = MOBILE_PRIMARY_HREFS.map(
  href => NAV_FLAT.find(item => item.href === href) as NavItem
);

export const MOBILE_MORE: NavItem[] = NAV_FLAT.filter(
  item => !MOBILE_PRIMARY.includes(item)
);

export function findActiveGroup(location: string): NavGroup | undefined {
  return NAV_GROUPS.find(group =>
    group.items.some(item => item.href === location)
  );
}
