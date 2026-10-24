import { z } from "zod";

const LocalSession = z.object({
	origin: z.string().url(),
	token: z.string().min(32).max(256),
});

/** Available only from the managed loopback app server. Never persists credentials. */
export async function localApplicationSession(): Promise<{
	baseUrl: string;
	token: string;
} | null> {
	const response = await fetch("/__hardcase/session", {
		headers: { "X-Hardcase-Bootstrap": "1" },
		cache: "no-store",
		redirect: "error",
		signal: AbortSignal.timeout(4000),
	});
	if (response.status === 404) return null;
	if (
		!response.ok ||
		!response.headers.get("content-type")?.includes("application/json")
	)
		return null;
	const session = LocalSession.parse(await response.json());
	const origin = new URL(session.origin);
	if (
		origin.origin !== location.origin ||
		origin.username ||
		origin.password ||
		origin.pathname !== "/api" ||
		origin.search ||
		origin.hash
	)
		throw new Error("Invalid local application session.");
	return { baseUrl: `${origin.origin}/api`, token: session.token };
}
