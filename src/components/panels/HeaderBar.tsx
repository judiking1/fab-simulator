/**
 * HeaderBar — Top application bar with title and step-by-step VOS import panel.
 *
 * Import flow: Nodes -> Rails -> Ports (each a separate file input).
 * Dependency enforcement: Rails disabled until Nodes loaded, Ports disabled until Rails loaded.
 */

import { useCallback, useRef, useState } from "react";
import type { UseMapImporterReturn } from "@/hooks/useMapImporter";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeaderBarProps {
	importer: UseMapImporterReturn;
}

// ---------------------------------------------------------------------------
// Import step row
// ---------------------------------------------------------------------------

interface ImportStepRowProps {
	step: number;
	label: string;
	enabled: boolean;
	loaded: boolean;
	count: number | null;
	countLabel: string;
	isLoading: boolean;
	onFileSelected: (file: File) => void;
}

function ImportStepRow({
	step,
	label,
	enabled,
	loaded,
	count,
	countLabel,
	isLoading,
	onFileSelected,
}: ImportStepRowProps): React.JSX.Element {
	const inputRef = useRef<HTMLInputElement | null>(null);

	const handleClick = useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>): void => {
			const file = e.target.files?.[0];
			if (file) {
				onFileSelected(file);
			}
			// Reset so the same file can be re-selected
			e.target.value = "";
		},
		[onFileSelected],
	);

	return (
		<div className="flex items-center gap-2">
			{/* Step number */}
			<span
				className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
					loaded
						? "bg-[var(--color-status-success)] text-white"
						: enabled
							? "bg-[var(--color-accent)] text-white"
							: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
				}`}
			>
				{loaded ? "\u2713" : step}
			</span>

			{/* Label */}
			<span
				className={`w-12 text-xs ${
					enabled ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
				}`}
			>
				{label}
			</span>

			{/* Hidden file input */}
			<input
				ref={inputRef}
				type="file"
				accept=".map,.csv,.txt"
				className="hidden"
				onChange={handleChange}
			/>

			{/* Browse button */}
			<button
				type="button"
				onClick={handleClick}
				disabled={!enabled || isLoading}
				className="rounded border border-[var(--color-border)] bg-[var(--color-bg-panel)] px-2 py-0.5 text-[11px] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
			>
				Browse
			</button>

			{/* Count indicator */}
			{loaded && count !== null && (
				<span className="text-[11px] text-[var(--color-status-success)]">
					{count.toLocaleString()} {countLabel}
				</span>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// HeaderBar
// ---------------------------------------------------------------------------

export function HeaderBar({ importer }: HeaderBarProps): React.JSX.Element {
	const [isOpen, setIsOpen] = useState(false);

	const togglePanel = useCallback((): void => {
		setIsOpen((prev) => !prev);
	}, []);

	const hasAnyData = importer.nodesLoaded || importer.railsLoaded || importer.portsLoaded;

	return (
		<header className="relative flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
			{/* Left: Title */}
			<h1 className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">
				FAB Simulator
			</h1>

			{/* Right: Import button + stats */}
			<div className="flex items-center gap-3">
				{/* Compact stats when panel is closed */}
				{hasAnyData && !isOpen && (
					<div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
						{importer.nodesLoaded && <span>N:{importer.nodeCount.toLocaleString()}</span>}
						{importer.railsLoaded && <span>R:{importer.railCount.toLocaleString()}</span>}
						{importer.portsLoaded && <span>P:{importer.portCount.toLocaleString()}</span>}
					</div>
				)}

				{/* Error indicator */}
				{importer.error && (
					<button
						type="button"
						onClick={importer.clearError}
						className="max-w-48 truncate text-xs text-[var(--color-status-error)] hover:underline"
						title={importer.error}
					>
						{importer.error}
					</button>
				)}

				{/* Import toggle button */}
				<button
					type="button"
					onClick={togglePanel}
					className={`rounded border px-3 py-1 text-xs transition-colors ${
						isOpen
							? "border-[var(--color-accent)] text-[var(--color-accent)]"
							: "border-[var(--color-border)] bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
					}`}
				>
					Import VOS Map {isOpen ? "\u25B2" : "\u25BC"}
				</button>
			</div>

			{/* Dropdown panel */}
			{isOpen && (
				<div className="absolute right-4 top-full z-50 mt-1 w-64 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 shadow-lg">
					<div className="flex flex-col gap-2">
						{/* Step 1: Nodes */}
						<ImportStepRow
							step={1}
							label="Nodes"
							enabled={true}
							loaded={importer.nodesLoaded}
							count={importer.nodeCount}
							countLabel="nodes"
							isLoading={importer.isLoading}
							onFileSelected={importer.importNodes}
						/>

						{/* Step 2: Rails */}
						<ImportStepRow
							step={2}
							label="Rails"
							enabled={importer.nodesLoaded}
							loaded={importer.railsLoaded}
							count={importer.railCount}
							countLabel="rails"
							isLoading={importer.isLoading}
							onFileSelected={importer.importRails}
						/>

						{/* Step 3: Ports */}
						<ImportStepRow
							step={3}
							label="Ports"
							enabled={importer.railsLoaded}
							loaded={importer.portsLoaded}
							count={importer.portCount}
							countLabel="ports"
							isLoading={importer.isLoading}
							onFileSelected={importer.importPorts}
						/>

						{/* Bay count (informational, derived from rails) */}
						{importer.bayCount > 0 && (
							<div className="mt-1 border-t border-[var(--color-border)] pt-1 text-[11px] text-[var(--color-text-secondary)]">
								{importer.bayCount.toLocaleString()} bays detected
							</div>
						)}

						{/* Loading indicator */}
						{importer.isLoading && (
							<div className="text-[11px] text-[var(--color-accent)]">Parsing...</div>
						)}

						{/* Clear All */}
						{hasAnyData && (
							<button
								type="button"
								onClick={importer.clearImport}
								disabled={importer.isLoading}
								className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-status-error)] hover:text-[var(--color-status-error)] disabled:opacity-40"
							>
								Clear All
							</button>
						)}
					</div>
				</div>
			)}
		</header>
	);
}
