import { useEffect, useRef } from "react";
/** Photo-sampled ASCII; decorative pixels, never execution telemetry. */
export default function AsciiVeil({
	src,
	intensity = 0.6,
}: {
	src: string;
	intensity?: number;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		const target: HTMLCanvasElement = element;
		const context = target.getContext("2d");
		if (!context) return;
		const image = new Image();
		image.src = src;
		const sample = document.createElement("canvas");
		sample.width = 76;
		sample.height = 36;
		const sampler = sample.getContext("2d", { willReadFrequently: true });
		let pixels: Uint8ClampedArray | null = null;
		let disposed = false;
		let frame = 0;
		let pointer = [-500, -500];
		const chars = " .:+01*";
		function draw() {
			frame = 0;
			if (!context || !pixels || disposed || document.hidden) return;
			const width = target.clientWidth;
			const height = target.clientHeight;
			target.width = width;
			target.height = height;
			context.clearRect(0, 0, width, height);
			context.font = '9px "JetBrains Mono", monospace';
			context.textAlign = "center";
			for (let row = 0; row < 36; row++)
				for (let col = 0; col < 76; col++) {
					const x = (col / 76) * width;
					const y = (row / 36) * height;
					const field = Math.max(
						0,
						1 - Math.hypot((col - 48) / 23, (row - 14) / 15),
					);
					if (field < 0.12) continue;
					const index = (row * 76 + col) * 4;
					const luma =
						(pixels[index] * 0.2126 +
							pixels[index + 1] * 0.7152 +
							pixels[index + 2] * 0.0722) /
						255;
					if (luma < 0.5) continue;
					const distance = Math.hypot(x - pointer[0], y - pointer[1]);
					const warp = Math.max(0, 1 - distance / 100);
					context.fillStyle = `rgba(255,255,255,${field * intensity * (0.35 + luma * 0.65)})`;
					context.fillText(
						chars[
							Math.min(chars.length - 1, Math.floor(luma * (chars.length - 1)))
						],
						x + warp * 4,
						y - warp * 5,
					);
				}
		}
		const request = () => {
			if (!frame) frame = requestAnimationFrame(draw);
		};
		image.onload = () => {
			if (disposed || !sampler) return;
			sampler.drawImage(image, 0, 0, 76, 36);
			try {
				pixels = sampler.getImageData(0, 0, 76, 36).data;
				request();
			} catch {
				/* local photography remains a complete fallback */
			}
		};
		const parent = target.parentElement;
		if (!parent) return;
		const move = (event: PointerEvent) => {
			const rect = target.getBoundingClientRect();
			pointer = [event.clientX - rect.left, event.clientY - rect.top];
			request();
		};
		const leave = () => {
			pointer = [-500, -500];
			request();
		};
		const resize = new ResizeObserver(request);
		resize.observe(target);
		parent.addEventListener("pointermove", move, { passive: true });
		parent.addEventListener("pointerleave", leave);
		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			resize.disconnect();
			image.onload = null;
			parent.removeEventListener("pointermove", move);
			parent.removeEventListener("pointerleave", leave);
		};
	}, [src, intensity]);
	return (
		<canvas
			className="ascii-veil"
			ref={canvas}
			tabIndex={-1}
			aria-hidden="true"
		/>
	);
}
