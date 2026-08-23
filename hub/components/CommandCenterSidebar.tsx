"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/command-center#overview", icon: "◉", label: "Overview" },
  { href: "/command-center#requests", icon: "!", label: "Solicitudes" },
  { href: "/setup", icon: "＋", label: "Preparar kit" },
  { href: "/command-center#resources", icon: "R", label: "Recursos" },
  { href: "/command-center#network", icon: "≋", label: "Red LoRa" },
  { href: "/command-center#broadcasts", icon: "↗", label: "Broadcasts" },
  { href: "/command-center#safe-people", icon: "✓", label: "Personas a salvo" },
];

export function CommandCenterSidebar({ connected = true, setup = false }: { connected?: boolean; setup?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("woki-sidebar-collapsed") === "true");
  }, []);

  function toggle() {
    setCollapsed((current) => {
      window.localStorage.setItem("woki-sidebar-collapsed", String(!current));
      return !current;
    });
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-is-collapsed" : ""}`} aria-label="Navegación principal">
      <div className="brand">
        <Link className="brand-home" href="/command-center" aria-label="Ir al Centro LoRa">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-label">Centro LoRa</span>
        </Link>
        <button className="sidebar-toggle" type="button" onClick={toggle} aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"} aria-expanded={!collapsed}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <nav aria-label="Secciones del Centro">
        {items.map((item) => {
          const active = item.href === "/setup"
            ? pathname === "/setup"
            : pathname === "/command-center" && item.label === "Overview" && !setup;
          return (
            <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined} title={item.label}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className={`status-dot ${connected ? "connected" : ""}`} aria-hidden="true" />
        <span>{setup ? "Configuración guiada" : connected ? "Réplica conectada" : "Réplica sin conexión"}</span>
      </div>
    </aside>
  );
}
