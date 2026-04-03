import { Edges, Text } from "@react-three/drei";
import { useMemo } from "react";
import type { Equipment, EquipmentPort, EquipmentType, PortType } from "@/models/equipment";
import { EQUIPMENT_TYPES, PORT_TYPES } from "@/models/equipment";
import { useLayoutStore } from "@/stores/layoutStore";

// ─── Color mapping by equipment type ─────────────────────────────
const EQUIPMENT_COLORS: Record<EquipmentType, string> = {
	[EQUIPMENT_TYPES.PROCESS]: "#2b6cb0",
	[EQUIPMENT_TYPES.STOCKER]: "#276749",
	[EQUIPMENT_TYPES.OHB]: "#b7791f",
};

const EQUIPMENT_SIZES: Record<EquipmentType, [number, number, number]> = {
	[EQUIPMENT_TYPES.PROCESS]: [1, 0.5, 0.8],
	[EQUIPMENT_TYPES.STOCKER]: [2, 1, 1.5],
	[EQUIPMENT_TYPES.OHB]: [0.8, 0.3, 0.5],
};

const PORT_COLORS: Record<PortType, string> = {
	[PORT_TYPES.LOAD]: "#48bb78",
	[PORT_TYPES.UNLOAD]: "#fc8181",
	[PORT_TYPES.BIDIRECTIONAL]: "#76e4f7",
};

const SELECTED_COLOR = "#00e5ff";

// ─── Port marker sphere ─────────────────────────────────────────

function PortMarker({
	port,
	equipmentPosition,
}: {
	port: EquipmentPort;
	equipmentPosition: [number, number, number];
}): React.ReactElement {
	const color = PORT_COLORS[port.portType] ?? "#76e4f7";
	const pos: [number, number, number] = [
		equipmentPosition[0] + port.position.x,
		equipmentPosition[1] + port.position.y,
		equipmentPosition[2] + port.position.z,
	];

	return (
		<mesh position={pos}>
			<sphereGeometry args={[0.12, 8, 8]} />
			<meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
		</mesh>
	);
}

// ─── Equipment box with ports and label ─────────────────────────

function EquipmentBox({ eq }: { eq: Equipment }): React.ReactElement {
	const select = useLayoutStore((s) => s.select);
	const selectedId = useLayoutStore((s) => s.selectedEntityId);
	const isSelected = selectedId === eq.id;

	const color = EQUIPMENT_COLORS[eq.type] ?? "#888";
	const size = EQUIPMENT_SIZES[eq.type] ?? ([1, 0.5, 0.8] as [number, number, number]);

	const meshPosition = useMemo<[number, number, number]>(
		() => [eq.position.x, eq.position.y + size[1] / 2, eq.position.z],
		[eq.position.x, eq.position.y, eq.position.z, size],
	);

	const labelPosition = useMemo<[number, number, number]>(
		() => [eq.position.x, eq.position.y + size[1] + 0.3, eq.position.z],
		[eq.position.x, eq.position.y, eq.position.z, size],
	);

	const portMarkers = useMemo(
		() =>
			eq.ports.map((port) => (
				<PortMarker key={port.id} port={port} equipmentPosition={meshPosition} />
			)),
		[eq.ports, meshPosition],
	);

	return (
		<group>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: R3F mesh is not an HTML element */}
			<mesh
				position={meshPosition}
				onClick={(e) => {
					e.stopPropagation();
					select(eq.id, "equipment");
				}}
			>
				<boxGeometry args={size} />
				<meshStandardMaterial
					color={isSelected ? SELECTED_COLOR : color}
					transparent={!isSelected}
					opacity={isSelected ? 1 : 0.85}
				/>
				{isSelected && <Edges color={SELECTED_COLOR} threshold={15} />}
			</mesh>

			{/* Equipment name label */}
			<Text
				position={labelPosition}
				fontSize={0.25}
				color="#e2e8f0"
				anchorX="center"
				anchorY="bottom"
			>
				{eq.name}
			</Text>

			{/* Port markers */}
			{portMarkers}
		</group>
	);
}

// ─── Main EquipmentMeshes component ─────────────────────────────

export function EquipmentMeshes(): React.ReactElement | null {
	const equipment = useLayoutStore((s) => s.equipment);
	const entries = useMemo(() => Object.values(equipment), [equipment]);

	if (entries.length === 0) return null;

	return (
		<group name="equipment">
			{entries.map((eq) => (
				<EquipmentBox key={eq.id} eq={eq} />
			))}
		</group>
	);
}
