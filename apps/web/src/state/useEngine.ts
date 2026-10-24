import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EngineClient } from "../api/client";
import { createEngineClient, EngineError } from "../api/client";
import type { Capabilities, Recipe, Run, RunEvent } from "../api/types";
import { isTerminal } from "../api/types";
import { messageOf } from "../lib/model";

export type Session = { baseUrl: string; token?: string };
export type Connection = "connecting" | "ready" | "auth" | "offline" | "error";
const defaultOrigin =
	import.meta.env.VITE_ENGINE_URL ||
	(typeof location !== "undefined" &&
	["http:", "https:"].includes(location.protocol)
		? `${location.origin}/api`
		: "http://127.0.0.1:4318");

export function useEngine() {
	const [session, setSession] = useState<Session>({ baseUrl: defaultOrigin });
	const [revision, setRevision] = useState(0);
	const [connection, setConnection] = useState<Connection>("connecting");
	const [connectionError, setConnectionError] = useState("");
	const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
	const [recipes, setRecipes] = useState<Recipe[]>([]);
	const [history, setHistory] = useState<Run[]>([]);
	const [historyError, setHistoryError] = useState("");
	const [historyLoading, setHistoryLoading] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const epoch = useRef(0);
	const clientResult = useMemo(() => {
		try {
			return { client: createEngineClient(session), error: "" };
		} catch (error) {
			return { client: null, error: messageOf(error) };
		}
	}, [session]);
	const client = clientResult.client;

	useEffect(() => {
		void revision; // Explicit reconnect epoch restarts this bootstrap.
		const current = ++epoch.current;
		setConnection("connecting");
		setConnectionError("");
		setCapabilities(null);
		setRecipes([]);
		setHistory([]);
		setHistoryError("");
		setHasMore(false);
		if (!client) {
			setConnection("error");
			setConnectionError(clientResult.error);
			return;
		}
		let disposed = false;
		void (async () => {
			try {
				const health = await client.health();
				if (!health.ok) throw new Error("The local engine is not ready.");
				if (!session.token) {
					if (!disposed) {
						setConnection("auth");
						setConnectionError(
							"Engine found. Add its local session token to connect. No account is needed.",
						);
					}
					return;
				}
				const readiness = await client.ready();
				if (!readiness.ok)
					throw new Error(
						readiness.issues.map((issue) => issue.message).join(" ") ||
							"Engine dependencies are unavailable.",
					);
				const [caps, catalog] = await Promise.all([
					client.capabilities(),
					client.recipes(),
				]);
				if (disposed || current !== epoch.current) return;
				setCapabilities(caps);
				setRecipes(catalog);
				setConnection("ready");
				setHistoryLoading(true);
				try {
					const runs = await client.listRuns(50, 0);
					if (!disposed && current === epoch.current) {
						setHistory(runs);
						setHasMore(runs.length === 50);
					}
				} catch (error) {
					if (!disposed) setHistoryError(messageOf(error));
				} finally {
					if (!disposed) setHistoryLoading(false);
				}
			} catch (error) {
				if (!disposed && current === epoch.current) {
					setConnection(
						error instanceof EngineError && error.kind === "auth"
							? "auth"
							: error instanceof EngineError &&
									["offline", "timeout"].includes(error.kind)
								? "offline"
								: "error",
					);
					setConnectionError(messageOf(error));
				}
			}
		})();
		return () => {
			disposed = true;
		};
	}, [client, clientResult.error, session.token, revision]);

	const refreshHistory = useCallback(
		async (more = false) => {
			if (!client || connection !== "ready")
				throw new Error("Connect the local engine to load run history.");
			const current = epoch.current;
			setHistoryLoading(true);
			setHistoryError("");
			try {
				const runs = await client.listRuns(50, more ? history.length : 0);
				if (current !== epoch.current) return;
				setHistory((previous) =>
					more
						? [
								...previous,
								...runs.filter(
									(item) => !previous.some((old) => old.id === item.id),
								),
							]
						: runs,
				);
				setHasMore(runs.length === 50);
			} catch (error) {
				if (current === epoch.current) setHistoryError(messageOf(error));
				throw error;
			} finally {
				if (current === epoch.current) setHistoryLoading(false);
			}
		},
		[client, connection, history.length],
	);
	const remember = useCallback(
		(run: Run) =>
			setHistory((previous) => [
				run,
				...previous.filter((item) => item.id !== run.id),
			]),
		[],
	);
	const connect = useCallback((next: Session) => setSession({ ...next }), []);
	return {
		client,
		session,
		connection,
		connectionError,
		capabilities,
		recipes,
		history,
		historyError,
		historyLoading,
		hasMore,
		refreshHistory,
		remember,
		connect,
		reconnect: () => setRevision((value) => value + 1),
		disconnect: () => setSession({ baseUrl: session.baseUrl }),
	};
}

export function useRun(
	client: EngineClient | null,
	connected: boolean,
	id: string | null,
) {
	const [run, setRun] = useState<Run | null>(null);
	const [events, setEvents] = useState<RunEvent[]>([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [stream, setStream] = useState<
		"connecting" | "live" | "reconnecting" | "complete" | "paused"
	>("paused");
	const [retry, setRetry] = useState(0);
	const snapshot = useRef<Run | null>(null);
	const cursor = useRef(0);
	const selected = useRef<string | null>(null);
	const accept = useCallback((next: Run) => {
		if (selected.current !== next.id) return;
		if (!snapshot.current || next.revision >= snapshot.current.revision) {
			snapshot.current = next;
			setRun(next);
		}
	}, []);

	useEffect(() => {
		if (selected.current !== id) {
			selected.current = id;
			snapshot.current = null;
			cursor.current = 0;
			setRun(null);
			setEvents([]);
			setError("");
		}
	}, [id]);
	useEffect(() => {
		if (!id || !client || !connected) {
			setStream("paused");
			setLoading(false);
			return;
		}
		void retry; // User requested a fresh snapshot and stream.
		const activeClient = client;
		const activeId = id;
		let disposed = false;
		let timer: ReturnType<typeof setTimeout>;
		let streamTimer: ReturnType<typeof setTimeout>;
		const controller = new AbortController();
		setLoading(!snapshot.current);
		setStream("connecting");
		async function read(): Promise<Run | null> {
			try {
				const next = await activeClient.getRun(activeId);
				if (disposed) return null;
				accept(next);
				setError("");
				setLoading(false);
				return next;
			} catch (cause) {
				if (!disposed) {
					setError(messageOf(cause));
					setStream("reconnecting");
					setLoading(false);
				}
				return null;
			}
		}
		async function poll() {
			const next = await read();
			if (disposed) return;
			if (next && isTerminal(next.state)) {
				setStream("complete");
				controller.abort();
				return;
			}
			timer = setTimeout(() => void poll(), next ? 2000 : 5000);
		}
		async function listen() {
			try {
				await activeClient.events(activeId, cursor.current, {
					signal: controller.signal,
					onEvent: (event) => {
						if (disposed) return;
						cursor.current = event.id;
						setStream("live");
						setEvents((previous) =>
							[...previous.filter((item) => item.id !== event.id), event].slice(
								-500,
							),
						);
					},
				});
				if (!disposed && !controller.signal.aborted) {
					const next = await read();
					if (next && isTerminal(next.state)) {
						setStream("complete");
						return;
					}
					setStream("reconnecting");
					streamTimer = setTimeout(() => void listen(), 3000);
				}
			} catch (cause) {
				if (!disposed && !controller.signal.aborted) {
					setStream("reconnecting");
					setError(messageOf(cause));
					streamTimer = setTimeout(() => void listen(), 5000);
				}
			}
		}
		void (async () => {
			const next = await read();
			if (disposed) return;
			if (next && isTerminal(next.state)) {
				setStream("complete");
				void listen();
				return;
			}
			void listen();
			timer = setTimeout(() => void poll(), 1500);
		})();
		return () => {
			disposed = true;
			clearTimeout(timer);
			clearTimeout(streamTimer);
			controller.abort();
		};
	}, [id, client, connected, accept, retry]);
	return {
		run: run?.id === id ? run : null,
		events,
		error,
		loading,
		stream,
		accept,
		refresh: () => setRetry((value) => value + 1),
	};
}
