"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Database, Warehouse } from "lucide-react";

const navigation = [
  { href: "/", label: "剧情", title: "剧情编辑器", icon: BookOpenText },
  { href: "/config", label: "配置", title: "配置中心", icon: Database },
  { href: "/resources", label: "资源", title: "资源管理", icon: Warehouse },
];

export function AdminRail() {
  const pathname = usePathname();

  return (
    <nav className="app-rail" aria-label="后台导航">
      <div className="rail-main">
        {navigation.map(({ href, label, title, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} title={title} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
              <Icon size={20} /><span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
