"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function enter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    router.push("/setup");
  }

  return (
    <form className="login-card" onSubmit={enter}>
      <div className="login-brand"><span className="brand-mark" aria-hidden="true" /><strong>Centro LoRa</strong></div>
      <div><p className="eyebrow">WOKI Hub</p><h1>Acceso al Centro</h1><p>Continúa a la preparación guiada del kit.</p></div>
      <label>Correo<input name="email" type="email" autoComplete="username" defaultValue="operador@woki.local" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" defaultValue="woki-demo" required /></label>
      <button type="submit" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</button>
      <small>Acceso de demostración · sin autenticación</small>
    </form>
  );
}
