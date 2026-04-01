import type { Equipment } from "@/models/equipment";
import { EQUIPMENT_TYPES } from "@/models/equipment";
import { useLayoutStore } from "@/stores/layoutStore";

// ─── Color mapping by equipment type ─────────────────────────────
const EQUIPMENT_COLORS: Record<string, string> = {
	[EQUIPMENT_TYPES.PROCESS]: "#5c6bc0",
	[EQUIPMENT_TYPES.STOCKER]: "#66bb6a",
	[EQUIPMENT_TYPES.OHB]: "#ffa726",
};

const EQUIPMENT_SIZES: Record<string, [number, number, number]> = {
	[EQUIPMENT_TYPES.PROCESS]: [2, 1.5, 2],
	[EQUIPMENT_TYPES.STOCKER]: [3, 2.5, 3],
	[EQUIPMENT_TYPES.OHB]: [1, 0.8, 1],
};

function EquipmentBox({ eq }: { eq: Equipment }) {
	const select = useLayoutStore((s) => s.select);
	const selectedId = useLayoutStore((s) => s.selectedEntityId);
	const isSelected = selectedId === eq.id;

	const color = EQUIPMENT_COLORS[eq.type] ?? "#888";
	const size = EQUIPMENT_SIZES[eq.type] ?? [1, 1, 1];

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: R3F mesh is not an HTML element
		<mesh
			position={[eq.position.x, eq.position.y + size[1] / 2, eq.position.z]}
			onClick={(e) => {
				e.stopPropagation();
				select(eq.id, "equipment");
			}}
		>
			<boxGeometry args={size} />
			<meshStandardMaterial
				color={isSelected ? "#00e5ff" : color}
				transparent={!isSelected}
				opacity={isSelected ? 1 : 0.85}
			/>
		</mesh>
	);
}

export function EquipmentMeshes() {
	const equipment = useLayoutStore((s) => s.equipment);
	const entries = Object.values(equipment);

	if (entries.length === 0) return null;

	return (
		<group name="equipment">
			{entries.map((eq) => (
				<EquipmentBox key={eq.id} eq={eq} />
			))}
		</group>
	);
}
