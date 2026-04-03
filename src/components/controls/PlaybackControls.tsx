import { useCallback } from "react";
import type { PlaybackSpeed } from "@/hooks/usePlayback";
import { PLAYBACK_SPEEDS } from "@/hooks/usePlayback";

// ─── Props ──────────────────────────────────────────────────────

interface PlaybackControlsProps {
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	playbackSpeed: PlaybackSpeed;
	onTogglePlay: () => void;
	onSeek: (time: number) => void;
	onSetSpeed: (speed: PlaybackSpeed) => void;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	}
	return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────────────

export function PlaybackControls({
	currentTime,
	duration,
	isPlaying,
	playbackSpeed,
	onTogglePlay,
	onSeek,
	onSetSpeed,
}: PlaybackControlsProps): React.ReactElement {
	const hasResult = duration > 0;

	const handleSliderChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>): void => {
			onSeek(Number.parseFloat(e.target.value));
		},
		[onSeek],
	);

	const handleSpeedChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>): void => {
			onSetSpeed(Number.parseInt(e.target.value, 10) as PlaybackSpeed);
		},
		[onSetSpeed],
	);

	const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<div className="flex h-full items-center gap-3 px-4">
			{/* Play/Pause */}
			<button
				type="button"
				onClick={onTogglePlay}
				disabled={!hasResult}
				className="flex h-7 w-7 items-center justify-center rounded text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-gray-700"
				title={isPlaying ? "Pause" : "Play"}
			>
				{isPlaying ? "\u23F8" : "\u25B6"}
			</button>

			{/* Time display */}
			<span className="min-w-[90px] text-xs font-mono text-gray-600 dark:text-gray-400">
				{formatTime(currentTime)} / {formatTime(duration)}
			</span>

			{/* Timeline slider */}
			<div className="relative flex flex-1 items-center">
				<div className="absolute h-1 w-full rounded bg-gray-300 dark:bg-gray-600" />
				<div
					className="absolute h-1 rounded bg-cyan-500"
					style={{ width: `${progressPercent}%` }}
				/>
				<input
					type="range"
					min={0}
					max={duration || 1}
					step={0.1}
					value={currentTime}
					onChange={handleSliderChange}
					disabled={!hasResult}
					className="relative z-10 h-1 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
				/>
			</div>

			{/* Speed selector */}
			<label className="flex items-center gap-1">
				<span className="text-[10px] text-gray-500 dark:text-gray-400">Speed</span>
				<select
					value={playbackSpeed}
					onChange={handleSpeedChange}
					disabled={!hasResult}
					className="rounded border border-gray-300 bg-transparent px-1.5 py-0.5 text-xs outline-none disabled:opacity-30 dark:border-gray-600"
				>
					{PLAYBACK_SPEEDS.map((s) => (
						<option key={s} value={s}>
							{s}x
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
