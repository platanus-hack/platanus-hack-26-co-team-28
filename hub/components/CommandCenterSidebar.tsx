"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COMMAND_CENTER_ROUTES } from "@/lib/command-center-routes";

export function CommandCenterSidebar({ connected = true }: { connected?: boolean }) {
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
        {COMMAND_CENTER_ROUTES.map((item) => {
          const active = pathname === item.href;
          return (
            <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined} title={item.label}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-settings">
        <Link href="/setup" title="Configuración">
          <span className="nav-icon" aria-hidden="true">⚙</span>
          <span className="nav-label">Configuración</span>
        </Link>
      </div>

      <div className="sidebar-footer">
        <span className={`status-dot ${connected ? "connected" : ""}`} aria-hidden="true" />
        <span>{connected ? "Réplica conectada" : "Réplica sin conexión"}</span>
      </div>
    </aside>
  );
}
