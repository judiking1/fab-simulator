import { useState } from "react";
import { EQUIPMENT_TYPES } from "@/models/equipment";
import { useLayoutStore } from "@/stores/layoutStore";
import type { EntityId } from "@/types/common";

// ─── Type badges ─────────────────────────────────────────────────

const EQ_BADGES: Record<string, { label: string; color: string }> = {
	[EQUIPMENT_TYPES.PROCESS]: { label: "EQ", color: "bg-indigo-500" },
	[EQUIPMENT_TYPES.STOCKER]: { label: "STK", color: "bg-green-500" },
	[EQUIPMENT_TYPES.OHB]: { label: "OHB", color: "bg-amber-500" },
};

function Badge({ type }: { type: string }) {
	const badge = EQ_BADGES[type] ?? { label: "?", color: "bg-gray-500" };
	return (
		<span
			className={`${badge.color} mr-1.5 inline-block rounded px-1 text-[10px] font-bold text-white`}
		>
			{badge.label}
		</span>
	);
}

// ─── Collapsible tree node ───────────────────────────────────────

function TreeNode({
	label,
	entityId,
	entityType,
	children,
	defaultOpen = false,
}: {
	label: string;
	entityId: EntityId;
	entityType: string;
	children?: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const select = useLayoutStore((s) => s.select);
	const selectedId = useLayoutStore((s) => s.selectedEntityId);
	const isSelected = selectedId === entityId;
	const hasChildren = children !== undefined;

	return (
		<div className="ml-2">
			<button
				type="button"
				className={`flex w-full cursor-pointer items-center rounded px-1 py-0.5 text-left text-xs hover:bg-gray-200 dark:hover:bg-gray-700 ${
					isSelected ? "bg-accent/20 text-accent" : ""
				}`}
				onClick={() => select(entityId, entityType)}
			>
				{hasChildren ? (
					<button
						type="button"
						className="mr-1 w-4 text-center text-gray-400"
						onClick={(e) => {
							e.stopPropagation();
							setOpen(!open);
						}}
					>
						{open ? "\u25BE" : "\u25B8"}
					</button>
				) : (
					<span className="mr-1 w-4" />
				)}
				<span className="truncate">{label}</span>
			</button>
			{open && children && (
				<div className="ml-2 border-l border-gray-300 pl-1 dark:border-gray-600">{children}</div>
			)}
		</div>
	);
}

// ─── Main panel ──────────────────────────────────────────────────

export function FabTreePanel() {
	const fabs = useLayoutStore((s) => s.fabs);
	const bays = useLayoutStore((s) => s.bays);
	const areas = useLayoutStore((s) => s.areas);
	const modules = useLayoutStore((s) => s.modules);
	const equipment = useLayoutStore((s) => s.equipment);
	const fabBays = useLayoutStore((s) => s.fabBays);
	const bayAreas = useLayoutStore((s) => s.bayAreas);
	const areaModules = useLayoutStore((s) => s.areaModules);
	const moduleEquipment = useLayoutStore((s) => s.moduleEquipment);

	const fabIds = Object.keys(fabs);

	if (fabIds.length === 0) {
		return <p className="text-xs text-gray-500">No layout loaded</p>;
	}

	return (
		<div className="text-xs">
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Layout</h3>
			{fabIds.map((fabId) => {
				const fab = fabs[fabId];
				if (!fab) return null;
				const bayIds = fabBays[fabId] ?? [];

				return (
					<TreeNode key={fabId} label={fab.name} entityId={fabId} entityType="fab" defaultOpen>
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
									defaultOpen
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
												defaultOpen
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
															defaultOpen
														>
															{eqIds.map((eqId) => {
																const eq = equipment[eqId];
																if (!eq) return null;
																return (
																	<button
																		key={eqId}
																		type="button"
																		className={`ml-2 flex w-full cursor-pointer items-center rounded px-1 py-0.5 text-left hover:bg-gray-200 dark:hover:bg-gray-700 ${
																			useLayoutStore.getState().selectedEntityId === eqId
																				? "bg-accent/20 text-accent"
																				: ""
																		}`}
																		onClick={() =>
																			useLayoutStore.getState().select(eqId, "equipment")
																		}
																	>
																		<Badge type={eq.type} />
																		<span className="truncate">{eq.name}</span>
																	</button>
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
					</TreeNode>
				);
			})}
		</div>
	);
}
