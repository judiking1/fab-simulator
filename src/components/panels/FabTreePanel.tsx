import { useCallback, useRef, useState } from "react";
import type { EquipmentType } from "@/models/equipment";
import { EQUIPMENT_TYPES } from "@/models/equipment";
import { useLayoutStore } from "@/stores/layoutStore";
import type { EntityId } from "@/types/common";

// ─── Type badges ─────────────────────────────────────────────────

const EQ_BADGES: Record<string, { label: string; color: string }> = {
	[EQUIPMENT_TYPES.PROCESS]: { label: "EQ", color: "bg-indigo-500" },
	[EQUIPMENT_TYPES.STOCKER]: { label: "STK", color: "bg-green-500" },
	[EQUIPMENT_TYPES.OHB]: { label: "OHB", color: "bg-amber-500" },
};

function Badge({ type }: { type: string }): React.ReactElement {
	const badge = EQ_BADGES[type] ?? { label: "?", color: "bg-gray-500" };
	return (
		<span
			className={`${badge.color} mr-1.5 inline-block rounded px-1 text-[10px] font-bold text-white`}
		>
			{badge.label}
		</span>
	);
}

// ─── Inline editable name ───────────────────────────────────────

interface InlineEditProps {
	value: string;
	onCommit: (newValue: string) => void;
}

function InlineEdit({ value, onCommit }: InlineEditProps): React.ReactElement {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);

	const startEdit = useCallback((): void => {
		setDraft(value);
		setIsEditing(true);
		// Focus on next tick after render
		setTimeout(() => inputRef.current?.select(), 0);
	}, [value]);

	const commitEdit = useCallback((): void => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== value) {
			onCommit(trimmed);
		}
		setIsEditing(false);
	}, [draft, value, onCommit]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent): void => {
			if (e.key === "Enter") {
				commitEdit();
			} else if (e.key === "Escape") {
				setIsEditing(false);
			}
		},
		[commitEdit],
	);

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="text"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commitEdit}
				onKeyDown={handleKeyDown}
				className="w-full rounded border border-gray-500 bg-gray-800 px-1 text-xs text-white outline-none focus:border-accent dark:bg-gray-800"
				onClick={(e) => e.stopPropagation()}
			/>
		);
	}

	return (
		<span
			className="truncate bg-transparent p-0 text-inherit"
			onDoubleClick={startEdit}
			onKeyDown={(e) => {
				if (e.key === "F2") startEdit();
			}}
			title="Double-click to rename"
		>
			{value}
		</span>
	);
}

// ─── Action buttons ─────────────────────────────────────────────

interface ActionButtonProps {
	label: string;
	title: string;
	onClick: (e: React.MouseEvent) => void;
	variant?: "add" | "delete";
}

function ActionButton({
	label,
	title,
	onClick,
	variant = "add",
}: ActionButtonProps): React.ReactElement {
	const colorClass =
		variant === "delete"
			? "text-red-400 hover:text-red-300 hover:bg-red-900/30"
			: "text-green-400 hover:text-green-300 hover:bg-green-900/30";

	return (
		<button
			type="button"
			title={title}
			className={`ml-0.5 rounded px-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 ${colorClass}`}
			onClick={(e) => {
				e.stopPropagation();
				onClick(e);
			}}
		>
			{label}
		</button>
	);
}

// ─── Delete confirmation ────────────────────────────────────────

function useDeleteConfirmation(): {
	pendingId: EntityId | null;
	requestDelete: (id: EntityId) => void;
	confirmDelete: () => void;
	cancelDelete: () => void;
} {
	const [pendingId, setPendingId] = useState<EntityId | null>(null);
	return {
		pendingId,
		requestDelete: (id: EntityId) => setPendingId(id),
		confirmDelete: () => setPendingId(null),
		cancelDelete: () => setPendingId(null),
	};
}

// ─── Equipment type picker ──────────────────────────────────────

interface EquipmentTypePickerProps {
	onSelect: (type: EquipmentType) => void;
	onCancel: () => void;
}

function EquipmentTypePicker({ onSelect, onCancel }: EquipmentTypePickerProps): React.ReactElement {
	return (
		<div className="ml-6 flex gap-1 py-1">
			<button
				type="button"
				className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-indigo-500"
				onClick={() => onSelect("process")}
			>
				Process
			</button>
			<button
				type="button"
				className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-green-500"
				onClick={() => onSelect("stocker")}
			>
				Stocker
			</button>
			<button
				type="button"
				className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-amber-500"
				onClick={() => onSelect("ohb")}
			>
				OHB
			</button>
			<button
				type="button"
				className="rounded bg-gray-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-gray-500"
				onClick={onCancel}
			>
				Cancel
			</button>
		</div>
	);
}

// ─── Collapsible tree node ───────────────────────────────────────

interface TreeNodeProps {
	label: string;
	entityId: EntityId;
	entityType: string;
	childCount?: number;
	children?: React.ReactNode;
	defaultOpen?: boolean;
	onRename: (newName: string) => void;
	onDelete: () => void;
	onAdd?: () => void;
	addLabel?: string;
	badge?: React.ReactNode;
}

function TreeNode({
	label,
	entityId,
	entityType,
	childCount,
	children,
	defaultOpen = false,
	onRename,
	onDelete,
	onAdd,
	addLabel = "+",
	badge,
}: TreeNodeProps): React.ReactElement {
	const [open, setOpen] = useState(defaultOpen);
	const select = useLayoutStore((s) => s.select);
	const selectedId = useLayoutStore((s) => s.selectedEntityId);
	const isSelected = selectedId === entityId;
	const hasChildren = children !== undefined;

	const { pendingId, requestDelete, confirmDelete, cancelDelete } = useDeleteConfirmation();
	const isConfirming = pendingId === entityId;

	return (
		<li className="ml-2">
			<div
				className={`group flex w-full items-center rounded px-1 py-0.5 text-xs ${
					isSelected ? "bg-accent/20 text-accent" : "hover:bg-gray-200 dark:hover:bg-gray-700"
				}`}
			>
				{hasChildren ? (
					<button
						type="button"
						className="mr-1 w-4 shrink-0 text-center text-gray-400"
						onClick={() => setOpen(!open)}
						aria-label={open ? "Collapse" : "Expand"}
					>
						{open ? "\u25BE" : "\u25B8"}
					</button>
				) : (
					<span className="mr-1 w-4 shrink-0" />
				)}
				<div
					role="button"
					tabIndex={0}
					className="flex min-w-0 flex-1 cursor-pointer items-center text-left"
					onClick={() => select(entityId, entityType)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") select(entityId, entityType);
					}}
				>
					{badge}
					<InlineEdit value={label} onCommit={onRename} />
					{childCount !== undefined && childCount > 0 && (
						<span className="ml-1 shrink-0 rounded bg-gray-600 px-1 text-[9px] text-gray-300">
							{childCount}
						</span>
					)}
				</div>
				{onAdd && <ActionButton label={addLabel} title="Add child" onClick={onAdd} />}
				<ActionButton
					label="\u2715"
					title={`Delete ${entityType}`}
					onClick={() => requestDelete(entityId)}
					variant="delete"
				/>
			</div>
			{isConfirming && (
				<div className="ml-6 flex items-center gap-1 py-0.5 text-[10px]">
					<span className="text-red-400">Delete?</span>
					<button
						type="button"
						className="rounded bg-red-600 px-1.5 text-white hover:bg-red-500"
						onClick={() => {
							onDelete();
							confirmDelete();
						}}
					>
						Yes
					</button>
					<button
						type="button"
						className="rounded bg-gray-600 px-1.5 text-white hover:bg-gray-500"
						onClick={cancelDelete}
					>
						No
					</button>
				</div>
			)}
			{open && hasChildren && (
				<ul className="ml-2 border-l border-gray-300 pl-1 dark:border-gray-600">{children}</ul>
			)}
		</li>
	);
}

// ─── Equipment leaf node ────────────────────────────────────────

interface EquipmentLeafProps {
	eqId: EntityId;
}

function EquipmentLeaf({ eqId }: EquipmentLeafProps): React.ReactElement | null {
	const eq = useLayoutStore((s) => s.equipment[eqId]);
	const select = useLayoutStore((s) => s.select);
	const selectedId = useLayoutStore((s) => s.selectedEntityId);
	const updateEquipment = useLayoutStore((s) => s.updateEquipment);
	const removeEquipment = useLayoutStore((s) => s.removeEquipment);

	const { pendingId, requestDelete, confirmDelete, cancelDelete } = useDeleteConfirmation();

	if (!eq) return null;
	const isSelected = selectedId === eqId;
	const isConfirming = pendingId === eqId;

	return (
		<li className="ml-2">
			<div
				className={`group flex w-full items-center rounded px-1 py-0.5 text-xs ${
					isSelected ? "bg-accent/20 text-accent" : "hover:bg-gray-200 dark:hover:bg-gray-700"
				}`}
			>
				<span className="mr-1 w-4 shrink-0" />
				<button
					type="button"
					className="flex min-w-0 flex-1 cursor-pointer items-center text-left"
					onClick={() => select(eqId, "equipment")}
				>
					<Badge type={eq.type} />
					<InlineEdit value={eq.name} onCommit={(name) => updateEquipment(eqId, { name })} />
				</button>
				<ActionButton
					label="\u2715"
					title="Delete equipment"
					onClick={() => requestDelete(eqId)}
					variant="delete"
				/>
			</div>
			{isConfirming && (
				<div className="ml-6 flex items-center gap-1 py-0.5 text-[10px]">
					<span className="text-red-400">Delete?</span>
					<button
						type="button"
						className="rounded bg-red-600 px-1.5 text-white hover:bg-red-500"
						onClick={() => {
							removeEquipment(eqId);
							confirmDelete();
						}}
					>
						Yes
					</button>
					<button
						type="button"
						className="rounded bg-gray-600 px-1.5 text-white hover:bg-gray-500"
						onClick={cancelDelete}
					>
						No
					</button>
				</div>
			)}
		</li>
	);
}

// ─── Main panel ──────────────────────────────────────────────────

export function FabTreePanel(): React.ReactElement {
	const fabs = useLayoutStore((s) => s.fabs);
	const bays = useLayoutStore((s) => s.bays);
	const areas = useLayoutStore((s) => s.areas);
	const modules = useLayoutStore((s) => s.modules);
	const fabBays = useLayoutStore((s) => s.fabBays);
	const bayAreas = useLayoutStore((s) => s.bayAreas);
	const areaModules = useLayoutStore((s) => s.areaModules);
	const moduleEquipment = useLayoutStore((s) => s.moduleEquipment);

	const addFab = useLayoutStore((s) => s.addFab);
	const removeFab = useLayoutStore((s) => s.removeFab);
	const updateFab = useLayoutStore((s) => s.updateFab);
	const addBay = useLayoutStore((s) => s.addBay);
	const removeBay = useLayoutStore((s) => s.removeBay);
	const updateBay = useLayoutStore((s) => s.updateBay);
	const addArea = useLayoutStore((s) => s.addArea);
	const removeArea = useLayoutStore((s) => s.removeArea);
	const updateArea = useLayoutStore((s) => s.updateArea);
	const addModule = useLayoutStore((s) => s.addModule);
	const removeModule = useLayoutStore((s) => s.removeModule);
	const updateModule = useLayoutStore((s) => s.updateModule);
	const addEquipment = useLayoutStore((s) => s.addEquipment);

	// Track which module is showing the equipment type picker
	const [addingEqForModule, setAddingEqForModule] = useState<EntityId | null>(null);

	const fabIds = Object.keys(fabs);

	return (
		<div className="text-xs">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
					Layout
				</h3>
				<button
					type="button"
					className="rounded bg-cyan-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-cyan-500"
					onClick={() => addFab("New Fab")}
				>
					+ Fab
				</button>
			</div>

			{fabIds.length === 0 && (
				<p className="text-xs text-gray-500">No layout loaded. Add a fab to start.</p>
			)}

			<ul>
				{fabIds.map((fabId) => {
					const fab = fabs[fabId];
					if (!fab) return null;
					const bayIds = fabBays[fabId] ?? [];

					return (
						<TreeNode
							key={fabId}
							label={fab.name}
							entityId={fabId}
							entityType="fab"
							childCount={bayIds.length}
							defaultOpen
							onRename={(name) => updateFab(fabId, { name })}
							onDelete={() => removeFab(fabId)}
							onAdd={() => addBay(fabId, "New Bay")}
							addLabel="+ Bay"
						>
							{bayIds.map((bayId) => {
								const bay = bays[bayId];
								if (!bay) return null;
								const areaIds = bayAreas[bayId] ?? [];

								return (
									<TreeNode
										key={bayId}
										label={bay.name}
										entityId={bayId}
										entityType="bay"
										childCount={areaIds.length}
										defaultOpen
										onRename={(name) => updateBay(bayId, { name })}
										onDelete={() => removeBay(bayId)}
										onAdd={() => addArea(bayId, "New Area")}
										addLabel="+ Area"
									>
										{areaIds.map((areaId) => {
											const area = areas[areaId];
											if (!area) return null;
											const modIds = areaModules[areaId] ?? [];

											return (
												<TreeNode
													key={areaId}
													label={area.name}
													entityId={areaId}
													entityType="area"
													childCount={modIds.length}
													defaultOpen
													onRename={(name) => updateArea(areaId, { name })}
													onDelete={() => removeArea(areaId)}
													onAdd={() => addModule(areaId, "New Module")}
													addLabel="+ Mod"
												>
													{modIds.map((modId) => {
														const mod = modules[modId];
														if (!mod) return null;
														const eqIds = moduleEquipment[modId] ?? [];

														return (
															<TreeNode
																key={modId}
																label={mod.name}
																entityId={modId}
																entityType="module"
																childCount={eqIds.length}
																defaultOpen
																onRename={(name) =>
																	updateModule(modId, {
																		name,
																	})
																}
																onDelete={() => removeModule(modId)}
																onAdd={() => setAddingEqForModule(modId)}
																addLabel="+ Eq"
															>
																{eqIds.map((eqId) => (
																	<EquipmentLeaf key={eqId} eqId={eqId} />
																))}
																{addingEqForModule === modId && (
																	<li>
																		<EquipmentTypePicker
																			onSelect={(type) => {
																				addEquipment(modId, type, `New ${type}`);
																				setAddingEqForModule(null);
																			}}
																			onCancel={() => setAddingEqForModule(null)}
																		/>
																	</li>
																)}
															</TreeNode>
														);
													})}
												</TreeNode>
											);
										})}
									</TreeNode>
								);
							})}
						</TreeNode>
					);
				})}
			</ul>
		</div>
	);
}
