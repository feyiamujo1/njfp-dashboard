export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  return <div>Module {moduleId} — detail coming soon.</div>;
}
