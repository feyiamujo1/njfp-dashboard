export async function moodleCall<T>(
  wsfunction: string,
  params: Record<string, string | number> = {},
  _attempt = 0
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

  const contentType = res.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("text/plain");

  // Retry transient server errors (502, 503, 504) up to 3 times with backoff.
  // These return HTML error pages so isJson is false.
  if (!isJson && res.status >= 500 && _attempt < 3) {
    const delay = 3000 * (_attempt + 1);
    console.warn(`[moodle] ${wsfunction} HTTP ${res.status} (attempt ${_attempt + 1}/4) — retrying in ${delay / 1000}s`);
    await new Promise<void>((r) => setTimeout(r, delay));
    return moodleCall(wsfunction, params, _attempt + 1);
  }

  if (!isJson) {
    console.error(`[moodle] ${wsfunction} HTTP ${res.status} — all retries exhausted`);
    throw new Error(
      `Moodle [${wsfunction}] returned HTTP ${res.status} with non-JSON body — server may be overloaded`
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `Moodle [${wsfunction}] returned HTTP ${res.status} but body is not valid JSON`
    );
  }

  if ((data as { exception?: string })?.exception) {
    throw new Error(
      `Moodle error [${wsfunction}]: ${(data as { message?: string }).message}`
    );
  }

  return data as T;
}
