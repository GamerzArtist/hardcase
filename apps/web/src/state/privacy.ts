export const CONSENT_KEY = "hardcase.storage.v1";
export const PREFERENCES_KEY = "hardcase.preferences.v1";
export type StorageConsent = {
	version: 1;
	preferences: boolean;
	updatedAt: string;
};
export function readConsent(): StorageConsent | null {
	try {
		const data = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
		return data?.version === 1 && typeof data.preferences === "boolean"
			? data
			: null;
	} catch {
		return null;
	}
}
export function saveConsent(preferences: boolean): void {
	try {
		localStorage.setItem(
			CONSENT_KEY,
			JSON.stringify({
				version: 1,
				preferences,
				updatedAt: new Date().toISOString(),
			}),
		);
		if (!preferences) localStorage.removeItem(PREFERENCES_KEY);
	} catch {
		/* Storage choice remains functional for the current page. */
	}
	window.dispatchEvent(
		new CustomEvent("hardcase:consent", { detail: { preferences } }),
	);
}
export function openPrivacyControls(): void {
	window.dispatchEvent(new Event("hardcase:open-privacy"));
}
