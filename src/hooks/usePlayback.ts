import { useCallback, useEffect, useRef, useState } from "react";
import { useSimResultStore } from "@/stores/simResultStore";
import type { SimSnapshot } from "@/types/simulation";

// ─── Playback Speed Options ─────────────────────────────────────

export const PLAYBACK_SPEEDS = [1, 2, 5, 10, 50, 100] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// ─── usePlayback Hook ───────────────────────────────────────────
// Manages playback state for simulation results using requestAnimationFrame.
// Uses useRef for animation-frame-level data to avoid re-renders every frame.

interface UsePlaybackReturn {
	/** Current simulation time (state, for UI updates) */
	currentTime: number;
	isPlaying: boolean;
	playbackSpeed: PlaybackSpeed;
	/** Total simulation duration */
	duration: number;
	/** Current snapshot for OHT position rendering */
	currentSnapshot: SimSnapshot | null;
	play: () => void;
	pause: () => void;
	togglePlay: () => void;
	seek: (time: number) => void;
	setSpeed: (speed: PlaybackSpeed) => void;
}

/** Binary search for the snapshot closest to (but not exceeding) the given time. */
function findSnapshotAtTime(snapshots: SimSnapshot[], time: number): SimSnapshot | null {
	if (snapshots.length === 0) return null;

	let lo = 0;
	let hi = snapshots.length - 1;

	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		const snap = snapshots[mid];
		if (!snap) break;
		if (snap.time <= time) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}

	return snapshots[lo] ?? null;
}

export function usePlayback(): UsePlaybackReturn {
	const result = useSimResultStore((s) => s.result);

	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
	const [currentTime, setCurrentTime] = useState(0);
	const [currentSnapshot, setCurrentSnapshot] = useState<SimSnapshot | null>(null);

	// Refs for animation frame loop (avoid closure stale values)
	const currentTimeRef = useRef(0);
	const isPlayingRef = useRef(false);
	const playbackSpeedRef = useRef<PlaybackSpeed>(1);
	const lastRafTimestampRef = useRef<number | null>(null);
	const rafIdRef = useRef<number | null>(null);

	const duration = result?.duration ?? 0;
	const snapshots = result?.snapshots ?? [];

	// Sync refs when state changes
	useEffect(() => {
		isPlayingRef.current = isPlaying;
	}, [isPlaying]);

	useEffect(() => {
		playbackSpeedRef.current = playbackSpeed;
	}, [playbackSpeed]);

	// Reset playback when result changes
	useEffect(() => {
		currentTimeRef.current = 0;
		lastRafTimestampRef.current = null;
		setCurrentTime(0);
		setIsPlaying(false);
		isPlayingRef.current = false;

		if (result && result.snapshots.length > 0) {
			setCurrentSnapshot(result.snapshots[0] ?? null);
		} else {
			setCurrentSnapshot(null);
		}
	}, [result]);

	// The animation frame loop
	const tick = useCallback(
		(timestamp: number): void => {
			if (!isPlayingRef.current) {
				lastRafTimestampRef.current = null;
				return;
			}

			if (lastRafTimestampRef.current !== null) {
				const realDeltaMs = timestamp - lastRafTimestampRef.current;
				const simDelta = (realDeltaMs / 1000) * playbackSpeedRef.current;
				const newTime = Math.min(currentTimeRef.current + simDelta, duration);
				currentTimeRef.current = newTime;

				// Update state for UI (~60fps is fine)
				setCurrentTime(newTime);
				const snap = findSnapshotAtTime(snapshots, newTime);
				setCurrentSnapshot(snap);

				// Stop at end
				if (newTime >= duration) {
					setIsPlaying(false);
					isPlayingRef.current = false;
					lastRafTimestampRef.current = null;
					return;
				}
			}

			lastRafTimestampRef.current = timestamp;
			rafIdRef.current = requestAnimationFrame(tick);
		},
		[duration, snapshots],
	);

	// Start/stop the animation loop
	useEffect(() => {
		if (isPlaying) {
			lastRafTimestampRef.current = null;
			rafIdRef.current = requestAnimationFrame(tick);
		} else {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			lastRafTimestampRef.current = null;
		}

		return () => {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [isPlaying, tick]);

	const play = useCallback((): void => {
		if (!result || duration === 0) return;
		// If at end, restart
		if (currentTimeRef.current >= duration) {
			currentTimeRef.current = 0;
			setCurrentTime(0);
		}
		setIsPlaying(true);
	}, [result, duration]);

	const pause = useCallback((): void => {
		setIsPlaying(false);
	}, []);

	const togglePlay = useCallback((): void => {
		if (isPlayingRef.current) {
			pause();
		} else {
			play();
		}
	}, [play, pause]);

	const seek = useCallback(
		(time: number): void => {
			const clamped = Math.max(0, Math.min(time, duration));
			currentTimeRef.current = clamped;
			setCurrentTime(clamped);
			const snap = findSnapshotAtTime(snapshots, clamped);
			setCurrentSnapshot(snap);
		},
		[duration, snapshots],
	);

	const setSpeed = useCallback((speed: PlaybackSpeed): void => {
		setPlaybackSpeed(speed);
	}, []);

	return {
		currentTime,
		isPlaying,
		playbackSpeed,
		duration,
		currentSnapshot,
		play,
		pause,
		togglePlay,
		seek,
		setSpeed,
	};
}
