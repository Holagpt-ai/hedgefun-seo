"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const navItems = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/logs", label: "Agent Logs" },
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/reports", label: "Reports" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin");
  };

  return (
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
            className={`block px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
              pathname === item.href
                ? "bg-zinc-800 text-white font-medium"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-zinc-800 space-y-2">
        <p className="text-zinc-600 text-xs">seo.hedgefun.fun</p>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-zinc-500 hover:text-red-400 transition-colors duration-150"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
