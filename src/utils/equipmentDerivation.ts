/**
 * Equipment Derivation — Creates EquipmentData from PortData groupings.
 *
 * Used when loading legacy maps that have ports but no equipment entities.
 * Groups ports by (equipmentId, railId) pair to create equipment instances.
 *
 * This is a pure function with no side effects or store access.
 */

import type { EquipmentData } from "@/models/equipment";
import type { PortData } from "@/models/port";
import { generateId } from "./idGenerator";

/**
 * Composite key for grouping ports into equipment instances.
 * Ports with the same equipmentId + railId belong to the same equipment.
 */
function makeGroupKey(equipmentId: string, railId: string): string {
	return `${equipmentId}::${railId}`;
}

/**
 * Derive Equipment entities from existing Port data.
 *
 * Groups ports by (equipmentId, railId) pair. Each unique combination
 * becomes one EquipmentData instance. This handles:
 *
 * - **Normal case**: Ports sharing an equipmentId on the same rail get one equipment.
 * - **Split equipment**: Same equipmentId on different rails creates separate equipment
 *   (each with its own set of ports).
 * - **Orphan ports**: Ports with an empty equipmentId get a synthetic equipment per port.
 *
 * @param ports - Record of all ports keyed by port ID
 * @returns Record of derived equipment keyed by equipment ID
 */
export function deriveEquipmentFromPorts(
	ports: Record<string, PortData>,
): Record<string, EquipmentData> {
	const portEntries = Object.values(ports);

	if (portEntries.length === 0) {
		return {};
	}

	// 1. Group ports by (equipmentId, railId) pair
	const groups = new Map<string, PortData[]>();

	for (const port of portEntries) {
		const eqId = port.equipmentId;

		if (eqId === "") {
			// Orphan port: create a unique group per port
			const syntheticKey = makeGroupKey(generateId("EQ"), port.railId);
			groups.set(syntheticKey, [port]);
		} else {
			const key = makeGroupKey(eqId, port.railId);
			const existing = groups.get(key);
			if (existing) {
				existing.push(port);
			} else {
				groups.set(key, [port]);
			}
		}
	}

	// 2. Create EquipmentData for each group
	const result: Record<string, EquipmentData> = {};
	// Track how many times each base equipmentId is used (for uniqueness)
	const idCounter = new Map<string, number>();

	for (const [, groupPorts] of groups) {
		const firstPort = groupPorts[0];
		if (!firstPort) {
			continue;
		}

		// Generate unique equipment ID per group
		// Same sc_id on different rails → separate equipment with suffix
		let eqId: string;
		if (firstPort.equipmentId !== "") {
			const base = firstPort.equipmentId;
			const count = idCounter.get(base) ?? 0;
			eqId = count === 0 ? base : `${base}_${count}`;
			idCounter.set(base, count + 1);
		} else {
			eqId = generateId("EQ");
		}

		// Average ratio across all ports in the group
		const ratioSum = groupPorts.reduce((sum, p) => sum + p.ratio, 0);
		const avgRatio = ratioSum / groupPorts.length;

		const equipment: EquipmentData = {
			id: eqId,
			specId: "",
			category: firstPort.equipmentType,
			railId: firstPort.railId,
			ratio: avgRatio,
			side: firstPort.side,
			rotation: 0,
			portIds: groupPorts.map((p) => p.id),
			bayId: firstPort.bayId,
			fabId: firstPort.fabId,
		};

		result[eqId] = equipment;
	}

	return result;
}
