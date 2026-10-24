import { z } from "zod";
import type { Session } from "../state/useEngine";

export async function desktopSession(): Promise<Session | null> {
	const { isTauri, invoke } = await import("@tauri-apps/api/core");
	if (!isTauri()) return null;
	const raw: unknown = await invoke("engine_session");
	if (raw === null) return null;
	const session = z
		.object({ origin: z.string().url(), token: z.string().min(32).max(256) })
		.parse(raw);
	return { baseUrl: session.origin, token: session.token };
}
export async function isDesktop(): Promise<boolean> {
	return (await import("@tauri-apps/api/core")).isTauri();
}
