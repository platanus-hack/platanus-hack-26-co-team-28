import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Acceso | WOKI Hub",
  description: "Acceso de demostración al Centro LoRa WOKI.",
};

export default function LoginPage() {
  return <main className="login-page"><LoginForm /></main>;
}
