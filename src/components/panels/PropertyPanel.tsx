import { useCallback } from "react";
import type { Equipment, EquipmentPort } from "@/models/equipment";
import { EQUIPMENT_TYPES, PORT_TYPES } from "@/models/equipment";
import type { Area, Bay, Fab, Module } from "@/models/layout";
import type { RailEdge, RailNode } from "@/models/rail";
import { useLayoutStore } from "@/stores/layoutStore";
import type { EntityId, Vector3 } from "@/types/common";
import { createEntityId } from "@/types/common";

// ─── Shared field components ────────────────────────────────────

interface TextFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	readOnly?: boolean;
}

function TextField({
	label,
	value,
	onChange,
	readOnly = false,
}: TextFieldProps): React.ReactElement {
	return (
		<label className="flex items-center justify-between gap-2">
			<span className="shrink-0 text-xs text-gray-400">{label}</span>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				readOnly={readOnly}
				className={`w-32 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-accent dark:border-gray-600 dark:bg-gray-800 ${readOnly ? "opacity-60" : ""}`}
			/>
		</label>
	);
}

interface NumFieldProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}

function NumField({
	label,
	value,
	onChange,
	min,
	max,
	step = 1,
}: NumFieldProps): React.ReactElement {
	return (
		<label className="flex items-center justify-between gap-2">
			<span className="shrink-0 text-xs text-gray-400">{label}</span>
			<input
				type="number"
				value={value}
				onChange={(e) => {
					const raw = Number.parseFloat(e.target.value);
					if (!Number.isNaN(raw)) {
						onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, raw)));
					}
				}}
				min={min}
				max={max}
				step={step}
				className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-accent dark:border-gray-600 dark:bg-gray-800"
			/>
		</label>
	);
}

interface Vec3FieldProps {
	label: string;
	value: Vector3;
	onChange: (value: Vector3) => void;
}

function Vec3Field({ label, value, onChange }: Vec3FieldProps): React.ReactElement {
	return (
		<div>
			<span className="mb-1 block text-xs text-gray-400">{label}</span>
			<div className="flex gap-1">
				{(["x", "y", "z"] as const).map((axis) => (
					<label key={axis} className="flex items-center gap-0.5">
						<span className="text-[10px] uppercase text-gray-500">{axis}</span>
						<input
							type="number"
							value={value[axis]}
							step={0.5}
							onChange={(e) => {
								const raw = Number.parseFloat(e.target.value);
								if (!Number.isNaN(raw)) {
									onChange({ ...value, [axis]: raw });
								}
							}}
							className="w-14 rounded border border-gray-600 bg-gray-700 px-1 py-0.5 text-[10px] text-white outline-none focus:border-accent dark:border-gray-600 dark:bg-gray-800"
						/>
					</label>
				))}
			</div>
		</div>
	);
}

function SectionDivider({ title }: { title: string }): React.ReactElement {
	return (
		<h4 className="mb-1 mt-3 border-b border-gray-600 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700">
			{title}
		</h4>
	);
}

// ─── Entity-specific property editors ───────────────────────────

function FabProperties({ fab }: { fab: Fab }): React.ReactElement {
	const updateFab = useLayoutStore((s) => s.updateFab);
	return (
		<div className="space-y-2">
			<SectionDivider title="Fab" />
			<TextField label="Name" value={fab.name} onChange={(name) => updateFab(fab.id, { name })} />
			<Vec3Field
				label="Position"
				value={fab.position}
				onChange={(position) => updateFab(fab.id, { position })}
			/>
		</div>
	);
}

function BayProperties({ bay }: { bay: Bay }): React.ReactElement {
	const updateBay = useLayoutStore((s) => s.updateBay);
	return (
		<div className="space-y-2">
			<SectionDivider title="Bay" />
			<TextField label="Name" value={bay.name} onChange={(name) => updateBay(bay.id, { name })} />
			<Vec3Field
				label="Position"
				value={bay.position}
				onChange={(position) => updateBay(bay.id, { position })}
			/>
		</div>
	);
}

function AreaProperties({ area }: { area: Area }): React.ReactElement {
	const updateArea = useLayoutStore((s) => s.updateArea);
	return (
		<div className="space-y-2">
			<SectionDivider title="Area" />
			<TextField
				label="Name"
				value={area.name}
				onChange={(name) => updateArea(area.id, { name })}
			/>
			<Vec3Field
				label="Position"
				value={area.position}
				onChange={(position) => updateArea(area.id, { position })}
			/>
		</div>
	);
}

function ModuleProperties({ mod }: { mod: Module }): React.ReactElement {
	const updateModule = useLayoutStore((s) => s.updateModule);
	return (
		<div className="space-y-2">
			<SectionDivider title="Module" />
			<TextField
				label="Name"
				value={mod.name}
				onChange={(name) => updateModule(mod.id, { name })}
			/>
			<Vec3Field
				label="Position"
				value={mod.position}
				onChange={(position) => updateModule(mod.id, { position })}
			/>
		</div>
	);
}

// ─── Port sub-editor ────────────────────────────────────────────

interface PortEditorProps {
	ports: EquipmentPort[];
	onUpdate: (ports: EquipmentPort[]) => void;
}

function PortEditor({ ports, onUpdate }: PortEditorProps): React.ReactElement {
	const addPort = useCallback((): void => {
		const newPort: EquipmentPort = {
			id: createEntityId("PORT"),
			railNodeId: null,
			hasFoup: false,
			foupId: null,
			position: { x: 0, y: 0, z: 0 },
			portType: PORT_TYPES.BIDIRECTIONAL,
		};
		onUpdate([...ports, newPort]);
	}, [ports, onUpdate]);

	const removePort = useCallback(
		(portId: EntityId): void => {
			onUpdate(ports.filter((p) => p.id !== portId));
		},
		[ports, onUpdate],
	);

	return (
		<div>
			<div className="flex items-center justify-between">
				<span className="text-xs text-gray-400">Ports ({ports.length})</span>
				<button
					type="button"
					className="rounded bg-cyan-700 px-1.5 py-0.5 text-[10px] text-white hover:bg-cyan-600"
					onClick={addPort}
				>
					+ Port
				</button>
			</div>
			{ports.length > 0 && (
				<ul className="mt-1 space-y-0.5">
					{ports.map((port) => (
						<li
							key={port.id}
							className="flex items-center justify-between rounded bg-gray-700 px-2 py-0.5 text-[10px] dark:bg-gray-800"
						>
							<span className="text-gray-300">{port.id.slice(0, 12)}</span>
							<span className={port.hasFoup ? "text-green-400" : "text-gray-500"}>
								{port.hasFoup ? "FOUP" : "empty"}
							</span>
							<button
								type="button"
								className="text-red-400 hover:text-red-300"
								onClick={() => removePort(port.id)}
							>
								x
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

// ─── Equipment property editor ──────────────────────────────────

function EquipmentProperties({ eq }: { eq: Equipment }): React.ReactElement {
	const updateEquipment = useLayoutStore((s) => s.updateEquipment);

	const typeLabel =
		eq.type === EQUIPMENT_TYPES.PROCESS
			? "Process"
			: eq.type === EQUIPMENT_TYPES.STOCKER
				? "Stocker"
				: "OHB";

	return (
		<div className="space-y-2">
			<SectionDivider title="Equipment" />
			<TextField
				label="Name"
				value={eq.name}
				onChange={(name) => updateEquipment(eq.id, { name })}
			/>
			<TextField label="Type" value={typeLabel} onChange={() => {}} readOnly />
			<Vec3Field
				label="Position"
				value={eq.position}
				onChange={(position) => updateEquipment(eq.id, { position })}
			/>

			{eq.type === EQUIPMENT_TYPES.PROCESS && (
				<NumField
					label="Process Time (s)"
					value={eq.processTime}
					onChange={(processTime) =>
						updateEquipment(eq.id, { processTime } as Partial<
							Omit<Equipment, "id" | "moduleId" | "type">
						>)
					}
					min={0}
				/>
			)}

			{(eq.type === EQUIPMENT_TYPES.STOCKER || eq.type === EQUIPMENT_TYPES.OHB) && (
				<NumField
					label="Capacity"
					value={eq.capacity}
					onChange={(capacity) =>
						updateEquipment(eq.id, { capacity } as Partial<
							Omit<Equipment, "id" | "moduleId" | "type">
						>)
					}
					min={1}
				/>
			)}

			<PortEditor ports={eq.ports} onUpdate={(ports) => updateEquipment(eq.id, { ports })} />
		</div>
	);
}

// ─── Rail Node property editor ──────────────────────────────────

function RailNodeProperties({ node }: { node: RailNode }): React.ReactElement {
	return (
		<div className="space-y-2">
			<SectionDivider title="Rail Node" />
			<TextField label="ID" value={node.id} onChange={() => {}} readOnly />
			<TextField label="Type" value={node.type} onChange={() => {}} readOnly />
			<Vec3Field label="Position" value={node.position} onChange={() => {}} />
		</div>
	);
}

// ─── Rail Edge property editor ──────────────────────────────────

function RailEdgeProperties({ edge }: { edge: RailEdge }): React.ReactElement {
	return (
		<div className="space-y-2">
			<SectionDivider title="Rail Edge" />
			<TextField label="ID" value={edge.id} onChange={() => {}} readOnly />
			<TextField label="From" value={edge.fromNodeId} onChange={() => {}} readOnly />
			<TextField label="To" value={edge.toNodeId} onChange={() => {}} readOnly />
			<NumField label="Max Speed" value={edge.maxSpeed} onChange={() => {}} min={0.1} step={0.1} />
			<NumField label="Distance" value={edge.distance} onChange={() => {}} />
		</div>
	);
}

// ─── Main Panel ─────────────────────────────────────────────────

export function PropertyPanel(): React.ReactElement {
	const selectedEntityId = useLayoutStore((s) => s.selectedEntityId);
	const selectedEntityType = useLayoutStore((s) => s.selectedEntityType);
	const fabs = useLayoutStore((s) => s.fabs);
	const bays = useLayoutStore((s) => s.bays);
	const areas = useLayoutStore((s) => s.areas);
	const modules = useLayoutStore((s) => s.modules);
	const equipment = useLayoutStore((s) => s.equipment);
	const railNodes = useLayoutStore((s) => s.railNodes);
	const railEdges = useLayoutStore((s) => s.railEdges);
	const clearSelection = useLayoutStore((s) => s.clearSelection);

	if (!selectedEntityId || !selectedEntityType) {
		return (
			<div>
				<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
					Properties
				</h3>
				<p className="text-xs text-gray-500">Select an entity to edit its properties.</p>
			</div>
		);
	}

	let content: React.ReactNode = null;

	switch (selectedEntityType) {
		case "fab": {
			const fab = fabs[selectedEntityId];
			if (fab) content = <FabProperties fab={fab} />;
			break;
		}
		case "bay": {
			const bay = bays[selectedEntityId];
			if (bay) content = <BayProperties bay={bay} />;
			break;
		}
		case "area": {
			const area = areas[selectedEntityId];
			if (area) content = <AreaProperties area={area} />;
			break;
		}
		case "module": {
			const mod = modules[selectedEntityId];
			if (mod) content = <ModuleProperties mod={mod} />;
			break;
		}
		case "equipment": {
			const eq = equipment[selectedEntityId];
			if (eq) content = <EquipmentProperties eq={eq} />;
			break;
		}
		case "rail_node": {
			const node = railNodes[selectedEntityId];
			if (node) content = <RailNodeProperties node={node} />;
			break;
		}
		case "rail_edge": {
			const edge = railEdges[selectedEntityId];
			if (edge) content = <RailEdgeProperties edge={edge} />;
			break;
		}
	}

	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
					Properties
				</h3>
				<button
					type="button"
					className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-700 hover:text-white"
					onClick={clearSelection}
				>
					Deselect
				</button>
			</div>
			{content ?? <p className="text-xs text-gray-500">Entity not found.</p>}
		</div>
	);
}
