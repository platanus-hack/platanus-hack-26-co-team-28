import { CommandCenterHeader } from "@/components/CommandCenterHeader";
import { CommandCenterSidebar } from "@/components/CommandCenterSidebar";
import { ReplicaRefresh } from "@/components/ReplicaRefresh";
import { loadCommandCenterReplica } from "@/lib/command-center";

export const dynamic = "force-dynamic";

export default async function CommandCenterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { error } = await loadCommandCenterReplica();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Ir al contenido</a>
      <CommandCenterSidebar connected={!error} />
      <ReplicaRefresh />
      <div className="workspace">
        <CommandCenterHeader connected={!error} />
        <main id="content">
          {children}
          <p className="read-only-note">Las asignaciones se autorizan únicamente en el Centro local. Esta réplica no controla las radios.</p>
        </main>
      </div>
    </div>
  );
}
