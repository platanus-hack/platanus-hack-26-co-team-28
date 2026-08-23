export const COMMAND_CENTER_ROUTES = [
  { href: "/command-center", icon: "◉", label: "Overview" },
  { href: "/command-center/requests", icon: "!", label: "Solicitudes" },
  { href: "/command-center/resources", icon: "R", label: "Recursos" },
  { href: "/command-center/network", icon: "≋", label: "Red LoRa" },
  { href: "/command-center/broadcasts", icon: "↗", label: "Broadcasts" },
  { href: "/command-center/safe-people", icon: "✓", label: "Personas a salvo" },
] as const;

export const COMMAND_CENTER_TITLES = Object.fromEntries(
  COMMAND_CENTER_ROUTES.map(({ href, label }) => [href, label]),
) as Record<string, string>;
