export async function moodleCall<T>(
  wsfunction: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const base = process.env.NEXT_MOODLE_BASE_URL;
  const token = process.env.NEXT_MOODLE_TOKEN;

  const query = new URLSearchParams({
    wstoken: token!,
    moodlewsrestformat: "json",
    wsfunction,
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ),
  });

  const res = await fetch(`${base}/webservice/rest/server.php?${query}`, {
    next: { revalidate: 300 },
  });

  const data = await res.json();

  if (data?.exception) {
    throw new Error(`Moodle error [${wsfunction}]: ${data.message}`);
  }

  return data as T;
}
