import { useEffect, useRef, useState } from "react";
import Dither from "./vendor/Dither";
export default function ComputationalVeil({
	intensity = 0.28,
	animated = false,
}: {
	intensity?: number;
	animated?: boolean;
}) {
	const root = useRef<HTMLDivElement>(null);
	const [lost, setLost] = useState(false);
	useEffect(() => {
		const canvas = root.current?.querySelector("canvas");
		const loss = (event: Event) => {
			event.preventDefault();
			setLost(true);
		};
		canvas?.addEventListener("webglcontextlost", loss);
		return () => canvas?.removeEventListener("webglcontextlost", loss);
	}, []);
	if (lost) return null;
	return (
		<div
			ref={root}
			className="computational-veil"
			style={{ opacity: intensity }}
			aria-hidden="true"
		>
			<Dither
				waveColor="#f9fff2"
				backgroundColor="transparent"
				waveSpeed={0.018}
				waveFrequency={2.2}
				waveAmplitude={0.22}
				colorNum={2}
				pixelSize={3}
				ditherMode="bayer4"
				scale={1.4}
				contrast={1.2}
				brightness={-0.17}
				mouseEffect="reveal"
				mouseRadius={0.35}
				mouseStrength={0.65}
				trail={0.16}
				clickRipple={false}
				intro={false}
				disableAnimation={!animated}
				enableMouseInteraction
				dpr={0.8}
			/>
		</div>
	);
}
