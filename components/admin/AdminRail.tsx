"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Database, Warehouse, Package, Users, Swords, Skull, Map, Building2 } from "lucide-react";

const navigation = [
  { href: "/", label: "剧情", title: "剧情编辑器", icon: BookOpenText },
  { href: "/config", label: "发布", title: "版本与发布", icon: Database },
  { href: "/resources", label: "资源", title: "资源管理", icon: Warehouse },
  { href: "/items", label: "物品", title: "物品管理", icon: Package },
  { href: "/cultivators", label: "修士", title: "修士管理", icon: Users },
  { href: "/skills", label: "技能", title: "技能配置", icon: Swords },
  { href: "/enemies", label: "敌人", title: "敌人配置", icon: Skull },
  { href: "/maps", label: "地图", title: "地图配置", icon: Map },
  { href: "/camp", label: "营地", title: "营地配置", icon: Building2 },
];

export function AdminRail({configSet}:{configSet?:string}={}) {
  const pathname = usePathname();

  return (
    <nav className="app-rail" aria-label="后台导航">
      <div className="rail-main">
        {navigation.map(({ href, label, title, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={configSet&&href!=="/"&&href!=="/resources"?`${href}?configSet=${encodeURIComponent(configSet)}`:href} title={title} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
              <Icon size={20} /><span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
