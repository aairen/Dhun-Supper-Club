/**
 * Express API (book-event, Stripe, email, admin).
 * - With `npm run dev` (server on :3000): leave VITE_API_BASE_URL unset — same origin.
 * - Static site (e.g. GitHub Pages): set VITE_API_BASE_URL to your API origin (no trailing slash),
 *   e.g. https://your-api.railway.app — and enable CORS on the server for your site origin.
 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const base = typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (base) return `${base}${normalized}`;
  return normalized;
}

export async function readResponseJson<T extends Record<string, unknown> = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Invalid response from server."
        : "Could not reach the API. Set VITE_API_BASE_URL to your deployed server if the site is on GitHub Pages.",
    );
  }
}
