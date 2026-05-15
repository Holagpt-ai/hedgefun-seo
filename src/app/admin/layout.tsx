import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/logs", label: "Agent Logs" },
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/reports", label: "Reports" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="px-5 py-6 border-b border-zinc-800">
          <span className="text-green-400 font-bold text-lg tracking-tight">HedgeFun</span>
          <p className="text-zinc-500 text-xs mt-0.5">SEO Admin</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors duration-150"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-zinc-800">
          <p className="text-zinc-600 text-xs">seo.hedgefun.fun</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
