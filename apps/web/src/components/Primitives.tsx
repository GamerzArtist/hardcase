import {
	AlertCircle,
	ArrowRight,
	Check,
	CheckCircle2,
	Circle,
	LoaderCircle,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { stateLabel } from "../lib/model";
export function Brand({ compact = false }: { compact?: boolean }) {
	return (
		<span className={`brand ${compact ? "compact" : ""}`}>
			<svg viewBox="0 0 44 44" aria-hidden="true">
				<path
					fill="currentColor"
					fillRule="evenodd"
					d="M14 2H42V30H30V42H2V14H14ZM14 14V30H30V14Z"
				/>
			</svg>
			{!compact && (
				<span>
					hardcase<span className="brand-dot">.</span>
				</span>
			)}
		</span>
	);
}
export function Status({ value }: { value: string }) {
	const tone = ["completed", "passed", "ready"].includes(value)
		? "good"
		: [
					"failed",
					"confirmed",
					"critical",
					"high",
					"infrastructure_error",
				].includes(value)
			? "bad"
			: ["queued", "preparing", "running", "analyzing", "connecting"].includes(
						value,
					)
				? "active"
				: "neutral";
	return (
		<span className={`status ${tone}`}>
			<span className="status-dot" />
			{stateLabel(value)}
		</span>
	);
}
export function Empty({
	icon,
	title,
	children,
	action,
}: {
	icon?: ReactNode;
	title: string;
	children: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="empty-state">
			<div className="empty-icon">{icon || <Circle size={28} />}</div>
			<h2>{title}</h2>
			<div className="empty-copy">{children}</div>
			{action && <div className="empty-action">{action}</div>}
		</div>
	);
}
export function Notice({
	children,
	action,
	tone = "info",
}: {
	children: ReactNode;
	action?: ReactNode;
	tone?: "info" | "error" | "success";
}) {
	return (
		<div
			className={`notice ${tone}`}
			role={tone === "error" ? "alert" : "status"}
		>
			{tone === "success" ? (
				<CheckCircle2 size={17} />
			) : (
				<AlertCircle size={17} />
			)}
			<div>{children}</div>
			{action}
		</div>
	);
}
export function Loading({ label = "Loading local data…" }: { label?: string }) {
	return (
		<div className="loading-state" role="status">
			<LoaderCircle size={17} className="spin" />
			{label}
			<div className="skeleton" />
			<div className="skeleton short" />
		</div>
	);
}
export function CheckControl({
	checked,
	onChange,
	children,
	disabled = false,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
	children: ReactNode;
	disabled?: boolean;
}) {
	return (
		<label className={`check-control ${disabled ? "disabled" : ""}`}>
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				disabled={disabled}
			/>
			<span className="checkbox" aria-hidden="true">
				{checked && <Check size={12} />}
			</span>
			<span>{children}</span>
		</label>
	);
}
export function PageHeader({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="page-heading">
			<div>
				<h1 tabIndex={-1} id="page-title">
					{title}
				</h1>
				{description && <p>{description}</p>}
			</div>
			{action && <div className="heading-actions">{action}</div>}
		</div>
	);
}
export function ActionLink({
	children,
	onClick,
}: {
	children: ReactNode;
	onClick: () => void;
}) {
	return (
		<button type="button" className="text-button" onClick={onClick}>
			{children}
			<ArrowRight size={15} />
		</button>
	);
}
export function Dismiss({
	onClick,
	label = "Close",
}: {
	onClick: () => void;
	label?: string;
}) {
	return (
		<button
			type="button"
			className="icon-button"
			onClick={onClick}
			aria-label={label}
		>
			<X size={18} />
		</button>
	);
}
