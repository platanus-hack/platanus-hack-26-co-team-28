"use client";

import { usePathname } from "next/navigation";
import { COMMAND_CENTER_TITLES } from "@/lib/command-center-routes";

export function CommandCenterHeader({ connected }: { connected: boolean }) {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div><p className="eyebrow">Réplica online</p><h1>{COMMAND_CENTER_TITLES[pathname] ?? "Centro LoRa"}</h1></div>
      <div className="topbar-status">
        <span className="badge">Solo lectura</span>
        <span className={`badge ${connected ? "success" : "critical"}`}>{connected ? "Sincronizado" : "Sin conexión"}</span>
      </div>
    </header>
  );
}
