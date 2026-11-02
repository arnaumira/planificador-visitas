import { Planner } from "@/components/Planner";
import { listSites, listTechnicians } from "@/lib/visits";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [technicians, sites] = await Promise.all([listTechnicians(), listSites()]);

  return (
    <main>
      <h1>Planificador de visitas</h1>
      <Planner technicians={technicians} sites={sites} />
    </main>
  );
}