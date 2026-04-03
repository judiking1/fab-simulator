// ─── Simulation Clock ───────────────────────────────────────────
// Tracks the current simulation time (in seconds) and event count.
// Pure data holder — no side effects, no framework dependencies.

export class SimulationClock {
	private _currentTime = 0;
	private _eventsProcessed = 0;

	/** Current simulation time in seconds */
	get currentTime(): number {
		return this._currentTime;
	}

	/** Total number of events processed so far */
	get eventsProcessed(): number {
		return this._eventsProcessed;
	}

	/** Advance the clock to the given time. Must be >= current time. */
	advanceTo(time: number): void {
		if (time < this._currentTime) {
			throw new Error(
				`Cannot advance clock backwards: current=${this._currentTime}, requested=${time}`,
			);
		}
		this._currentTime = time;
	}

	/** Increment the processed event counter */
	recordEvent(): void {
		this._eventsProcessed++;
	}

	/** Reset to initial state */
	reset(): void {
		this._currentTime = 0;
		this._eventsProcessed = 0;
	}
}
