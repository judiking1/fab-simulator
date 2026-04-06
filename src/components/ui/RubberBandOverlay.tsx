/**
 * RubberBandOverlay — HTML overlay for marquee/rubber-band selection.
 *
 * Positioned absolutely over the Canvas. Reads rubberBand rect from uiStore
 * and renders a semi-transparent blue selection rectangle.
 */

import { useUiStore } from "@/stores/uiStore";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RubberBandOverlay(): React.JSX.Element | null {
	const rubberBand = useUiStore((s) => s.rubberBand);

	if (!rubberBand) return null;

	const left = Math.min(rubberBand.x0, rubberBand.x1);
	const top = Math.min(rubberBand.y0, rubberBand.y1);
	const width = Math.abs(rubberBand.x1 - rubberBand.x0);
	const height = Math.abs(rubberBand.y1 - rubberBand.y0);

	return (
		<div
			style={{
				position: "absolute",
				left: `${left}px`,
				top: `${top}px`,
				width: `${width}px`,
				height: `${height}px`,
				border: "1px dashed rgba(56, 189, 248, 0.8)",
				backgroundColor: "rgba(56, 189, 248, 0.1)",
				pointerEvents: "none",
				zIndex: 10,
			}}
		/>
	);
}
