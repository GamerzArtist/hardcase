import { useEffect, useState } from "react";
import { PREFERENCES_KEY, readConsent } from "./privacy";

export type Preferences = {
	theme: "light" | "dark";
	graphics: "enhanced" | "standard";
	motion: "system" | "reduced";
};
const defaults: Preferences = {
	theme: "light",
	graphics: "enhanced",
	motion: "system",
};
function load(): Preferences {
	try {
		if (!readConsent()?.preferences) return defaults;
		const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
		return {
			theme: stored.theme === "dark" ? "dark" : "light",
			graphics: stored.graphics === "standard" ? "standard" : "enhanced",
			motion: stored.motion === "reduced" ? "reduced" : "system",
		};
	} catch {
		return defaults;
	}
}
export function usePreferences() {
	const [preferences, setPreferences] = useState<Preferences>(load);
	const [remember, setRemember] = useState(() => !!readConsent()?.preferences);
	useEffect(() => {
		const update = (event: Event) =>
			setRemember(
				(event as CustomEvent<{ preferences: boolean }>).detail.preferences,
			);
		window.addEventListener("hardcase:consent", update);
		return () => window.removeEventListener("hardcase:consent", update);
	}, []);
	useEffect(() => {
		document.documentElement.dataset.theme = preferences.theme;
		document.documentElement.dataset.motion = preferences.motion;
		try {
			if (remember)
				localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
			else localStorage.removeItem(PREFERENCES_KEY);
		} catch {
			/* private/restricted storage is supported */
		}
	}, [preferences, remember]);
	return [preferences, setPreferences] as const;
}
