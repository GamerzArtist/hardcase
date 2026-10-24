import { Maximize2, Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { Recipe, Run } from "../api/types";
import { stateLabel } from "../lib/model";
export type PlanItem = {
	id: string;
	title: string;
	level: number;
};
export function planFor(run: Run, recipes: Recipe[]): PlanItem[] {
	const fromRequest: PlanItem[] = [
		...(run.request.target.kind === "fixture"
			? recipes
					.filter(
						(item) =>
							run.request.levels.includes(item.level) &&
							(!run.request.recipeIds ||
								run.request.recipeIds.includes(item.id)),
					)
					.map((item) => ({
						id: item.id,
						title: item.title,
						level: item.level,
					}))
			: []),
		...run.request.scenarios.map((item) => ({
			id: item.id,
			title: item.title,
			level: item.level,
		})),
	];
	for (const result of run.results)
		if (!fromRequest.some((item) => item.id === result.scenarioId))
			fromRequest.push({
				id: result.scenarioId,
				title: result.title,
				level: result.level,
			});
	return fromRequest;
}
export function ScenarioMap({
	run,
	plan,
	selected,
	onSelect,
}: {
	run: Run;
	plan: PlanItem[];
	selected: string | null;
	onSelect: (id: string) => void;
}) {
	const [zoom, setZoom] = useState(1);
	const iso = (x: number, y: number, z = 0) => [
		400 + (x - y) * 74,
		65 + (x + y) * 38 - z,
	];
	const point = (x: number, y: number, z = 0) => iso(x, y, z).join(",");
	return (
		<div className="scenario-map">
			<div className="map-caption">
				<span>Scenario field</span>
				<span>Each tile is one requested scenario</span>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: SVG group cannot be an HTML fieldset. */}
			<svg
				viewBox="0 0 800 390"
				role="group"
				aria-label="Isometric view of actual run scenarios"
			>
				<defs>
					<pattern
						id="map-dots"
						width="14"
						height="14"
						patternUnits="userSpaceOnUse"
					>
						<circle cx="1" cy="1" r=".7" fill="var(--line-strong)" />
					</pattern>
				</defs>
				<rect width="800" height="390" fill="url(#map-dots)" />
				<g
					transform={`translate(${400 - 400 * zoom} ${195 - 195 * zoom}) scale(${zoom})`}
				>
					{[-1, 0, 1, 2, 3, 4, 5].map((coordinate) => (
						<g key={coordinate} className="map-grid">
							<line
								x1={iso(coordinate, -1)[0]}
								y1={iso(coordinate, -1)[1]}
								x2={iso(coordinate, 5)[0]}
								y2={iso(coordinate, 5)[1]}
							/>
							<line
								x1={iso(-1, coordinate)[0]}
								y1={iso(-1, coordinate)[1]}
								x2={iso(5, coordinate)[0]}
								y2={iso(5, coordinate)[1]}
							/>
						</g>
					))}
					{plan.slice(0, 18).map((item, index) => {
						const x = (index % 3) * 1.45;
						const y = Math.floor(index / 3) * 1.2;
						const result = run.results.find(
							(entry) => entry.scenarioId === item.id,
						);
						const current = run.progress?.currentScenarioId === item.id;
						const height = 18 + Math.min(3, result?.attempts.length || 0) * 7;
						const [cx, cy] = iso(x + 0.48, y + 0.48, height);
						const state =
							result?.classification || (current ? "running" : "pending");
						return (
							// biome-ignore lint/a11y/useSemanticElements: SVG nodes implement both keyboard and pointer selection; the timeline is the HTML alternative.
							<g
								key={item.id}
								role="button"
								tabIndex={0}
								aria-label={`${item.title}, ${stateLabel(state)}`}
								aria-pressed={selected === item.id}
								className={`map-node ${selected === item.id ? "selected" : ""} ${state}`}
								onClick={() => onSelect(item.id)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onSelect(item.id);
									}
								}}
							>
								<polygon
									className="tile-shadow"
									points={`${point(x + 0.1, y + 0.1)} ${point(x + 1.1, y + 0.1)} ${point(x + 1.1, y + 1.1)} ${point(x + 0.1, y + 1.1)}`}
								/>
								<polygon
									className="tile-left"
									points={`${point(x, y, height)} ${point(x, y + 1, height)} ${point(x, y + 1)} ${point(x, y)}`}
								/>
								<polygon
									className="tile-right"
									points={`${point(x, y + 1, height)} ${point(x + 1, y + 1, height)} ${point(x + 1, y + 1)} ${point(x, y + 1)}`}
								/>
								<polygon
									className="tile-top"
									points={`${point(x, y, height)} ${point(x + 1, y, height)} ${point(x + 1, y + 1, height)} ${point(x, y + 1, height)}`}
								/>
								<circle className="node-light" cx={cx} cy={cy} r="4" />
								<text x={cx} y={cy + 47} textAnchor="middle">
									{item.id.length > 25 ? `${item.id.slice(0, 23)}…` : item.id}
								</text>
								<text
									className="map-node-state"
									x={cx}
									y={cy + 63}
									textAnchor="middle"
								>
									{stateLabel(state)}
								</text>
							</g>
						);
					})}
				</g>
			</svg>
			<div className="map-toolbar">
				<span>Execution schematic · no infrastructure inferred</span>
				<div>
					<button
						type="button"
						className="icon-button"
						aria-label="Zoom out"
						onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}
					>
						<Minus size={15} />
					</button>
					<button
						type="button"
						className="icon-button"
						aria-label="Reset view"
						onClick={() => setZoom(1)}
					>
						<Maximize2 size={15} />
					</button>
					<button
						type="button"
						className="icon-button"
						aria-label="Zoom in"
						onClick={() => setZoom((value) => Math.min(1.6, value + 0.15))}
					>
						<Plus size={15} />
					</button>
				</div>
			</div>
		</div>
	);
}
