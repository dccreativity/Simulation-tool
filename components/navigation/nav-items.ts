import { Award, ChartColumn, ClipboardPaste, Compass, House, NotebookPen, Sprout, Table2, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', short: 'Home', icon: House },
  { href: '/explore', label: 'Explore', short: 'Explore', icon: Compass },
  { href: '/simulation', label: 'Simulation', short: 'Field', icon: Sprout },
  { href: '/my-data', label: 'My Data', short: 'My Data', icon: ClipboardPaste },
  { href: '/data-lab', label: 'Data Lab', short: 'Data', icon: Table2 },
  { href: '/statistics', label: 'Statistics', short: 'Stats', icon: ChartColumn },
  { href: '/notebook', label: 'Field Notebook', short: 'Notebook', icon: NotebookPen },
  { href: '/achievements', label: 'Achievements', short: 'Badges', icon: Award },
];

/** The five destinations on the phone's bottom bar. */
export const BOTTOM_NAV = ['/', '/simulation', '/data-lab', '/statistics', '/notebook'];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
