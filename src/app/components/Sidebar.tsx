"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBarIcon, EyeIcon, InboxIcon } from "@heroicons/react/24/outline";

const links = [
  { href: "/price-watch", label: "Price Watch", icon: ChartBarIcon },
  { href: "/whale-watch", label: "Whale Watch", icon: EyeIcon },
  { href: "/jobs", label: "Jobs", icon: InboxIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const activePath = pathname === "/" ? "/price-watch" : pathname;
  return (
    <aside className="w-64 min-h-screen bg-[#101112] flex flex-col shadow-2xl">
      <div className="h-16 flex items-center justify-center bg-[#101112] shadow-lg">
        <Link href="/price-watch" className="text-2xl font-bold text-white tracking-tight hover:text-[#28ebcf] transition-colors duration-200">
          PriceNotifier
        </Link>
      </div>
      <nav className="flex flex-col gap-2 p-6 flex-1 mt-12">
        <ul className="space-y-4">
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-all duration-200 group relative overflow-hidden
                  ${activePath === href
                    ? "bg-[#18191a] text-white shadow-lg"
                    : "text-white hover:text-[#28ebcf]"}
                `}
              >
                <span className={`absolute left-0 top-0 h-full w-1 rounded bg-[#28ebcf] transition-all duration-300 ${activePath === href ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}></span>
                <Icon className={`h-5 w-5 z-10 ${activePath === href ? "text-[#28ebcf]" : "text-gray-400 group-hover:text-[#28ebcf]"}`} />
                <span className="z-10">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
