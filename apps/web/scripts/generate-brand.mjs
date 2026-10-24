import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "design", "brand");
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const font = (
	await readFile(
		require.resolve(
			"@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
		),
	)
).toString("base64");
for (const [name, ink] of [
	["light", "#252e2a", "#fcfdfb"],
	["dark", "#edf2ed", "#1e282c"],
]) {
	const mark = `<path fill="${ink}" fill-rule="evenodd" d="M14 2H42V30H30V42H2V14H14ZM14 14V30H30V14Z"/>`;
	await writeFile(
		join(output, `mark-${name}.svg`),
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><title>hardcase mark</title>${mark}</svg>`,
	);
	await writeFile(
		join(output, `wordmark-${name}.svg`),
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 78"><title>hardcase</title><defs><style>@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800}text{font-family:Manrope,sans-serif;font-weight:800;letter-spacing:-3px}</style></defs><g transform="translate(4,14)">${mark}</g><text x="66" y="57" fill="${ink}" font-size="53">hardcase<tspan fill="#7b9b65">.</tspan></text></svg>`,
	);
}
await writeFile(
	join(output, "tokens.json"),
	JSON.stringify(
		{
			name: "hardcase",
			version: 1,
			palette: {
				chalk: "#fcfdfb",
				cloud: "#e6eff5",
				meadow: "#dce8d5",
				leaf: "#426441",
				graphite: "#252e2a",
				night: "#1e282c",
			},
			type: {
				heading: "Manrope",
				body: "Inter",
				editorial: "Fraunces",
				code: "JetBrains Mono",
			},
		},
		null,
		2,
	),
);
console.log("Generated four local SVG brand assets and tokens.json.");
