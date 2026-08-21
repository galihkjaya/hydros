import { InvestigationWorkspace } from "@/components/investigation/InvestigationWorkspace";

export const metadata = { title: "Investigation" };

export default async function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <InvestigationWorkspace investigationId={id} />
    </main>
  );
}
