/**
 * PortRenderer — Renders equipment ports as colored boxes using InstancedMesh (Layer 3).
 *
 * Three separate InstancedMeshes by equipment type:
 *   - EQ (process):  green  (#4ade80)
 *   - STK (stocker):  purple (#a78bfa)
 *   - OHB (overhead): orange (#fb923c)
 *
 * Port positions are derived from rail curves at port.ratio, with lateral
 * offset based on port.side.
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	BoxGeometry,
	Color,
	type InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	Quaternion,
	Vector3,
} from "three";
import { EQUIPMENT_TYPE, type EquipmentType } from "@/models/port";
import { selectPortCount, useMapStore } from "@/stores/mapStore";
import { buildRailCurve } from "@/utils/curveBuilder";
import { type CachedCurveData, cacheCurve, getPositionAtRatio } from "@/utils/curveCache";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT_COLORS: Record<EquipmentType, Color> = {
	[EQUIPMENT_TYPE.EQ]: new Color("#4ade80"),
	[EQUIPMENT_TYPE.STK]: new Color("#a78bfa"),
	[EQUIPMENT_TYPE.OHB]: new Color("#fb923c"),
};

/** Lateral offset (perpendicular to rail) for left/right side ports */
const SIDE_OFFSET = 1.0;

// Module-scoped temporaries
const _position = new Vector3();
const _scale = new Vector3(0.5, 0.3, 0.5);
const _quaternion = new Quaternion();
const _matrix = new Matrix4();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortRenderer(): React.JSX.Element {
	const portCount = useMapStore(selectPortCount);

	// Refs for three InstancedMeshes (one per equipment type)
	const eqMeshRef = useRef<InstancedMesh>(null);
	const stkMeshRef = useRef<InstancedMesh>(null);
	const ohbMeshRef = useRef<InstancedMesh>(null);

	// Track which ports map to which mesh indices
	const portIndexMapRef = useRef<{
		[EQUIPMENT_TYPE.EQ]: string[];
		[EQUIPMENT_TYPE.STK]: string[];
		[EQUIPMENT_TYPE.OHB]: string[];
	}>({
		[EQUIPMENT_TYPE.EQ]: [],
		[EQUIPMENT_TYPE.STK]: [],
		[EQUIPMENT_TYPE.OHB]: [],
	});

	// Rail curve cache for port position lookups
	const railCurveCacheRef = useRef<Map<string, CachedCurveData>>(new Map());

	const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);

	const eqMaterial = useMemo(
		() => new MeshBasicMaterial({ color: PORT_COLORS[EQUIPMENT_TYPE.EQ], toneMapped: false }),
		[],
	);
	const stkMaterial = useMemo(
		() => new MeshBasicMaterial({ color: PORT_COLORS[EQUIPMENT_TYPE.STK], toneMapped: false }),
		[],
	);
	const ohbMaterial = useMemo(
		() => new MeshBasicMaterial({ color: PORT_COLORS[EQUIPMENT_TYPE.OHB], toneMapped: false }),
		[],
	);

	const rebuildAllPorts = useCallback((): void => {
		const { nodes, rails, ports } = useMapStore.getState();

		// Build rail curve cache for all rails referenced by ports
		const curveCache = new Map<string, CachedCurveData>();
		const portList = Object.values(ports);

		for (const port of portList) {
			if (curveCache.has(port.railId)) continue;

			const rail = rails[port.railId];
			if (!rail) continue;

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos });

			curveCache.set(rail.id, cacheCurve(curve));
		}

		railCurveCacheRef.current = curveCache;

		// Partition ports by equipment type
		const eqPorts: string[] = [];
		const stkPorts: string[] = [];
		const ohbPorts: string[] = [];

		for (const port of portList) {
			switch (port.equipmentType) {
				case EQUIPMENT_TYPE.EQ:
					eqPorts.push(port.id);
					break;
				case EQUIPMENT_TYPE.STK:
					stkPorts.push(port.id);
					break;
				case EQUIPMENT_TYPE.OHB:
					ohbPorts.push(port.id);
					break;
			}
		}

		portIndexMapRef.current = {
			[EQUIPMENT_TYPE.EQ]: eqPorts,
			[EQUIPMENT_TYPE.STK]: stkPorts,
			[EQUIPMENT_TYPE.OHB]: ohbPorts,
		};

		// Update each mesh
		updateMesh(eqMeshRef.current, eqPorts, ports, curveCache);
		updateMesh(stkMeshRef.current, stkPorts, ports, curveCache);
		updateMesh(ohbMeshRef.current, ohbPorts, ports, curveCache);
	}, []);

	// Full rebuild when port count changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: portCount is an intentional trigger — rebuild geometry when ports are added/removed
	useEffect(() => {
		rebuildAllPorts();
	}, [portCount, rebuildAllPorts]);

	// Handle dirty ports in useFrame
	useFrame(() => {
		const dirtyPortIds = useMapStore.getState().consumeDirtyPorts();
		if (dirtyPortIds.length === 0) return;

		const { nodes, rails, ports } = useMapStore.getState();
		const curveCache = railCurveCacheRef.current;
		const indexMap = portIndexMapRef.current;

		// Rebuild curve cache for dirty ports' rails
		const dirtySet = new Set(dirtyPortIds);
		for (const portId of dirtyPortIds) {
			const port = ports[portId];
			if (!port) continue;

			const rail = rails[port.railId];
			if (!rail) continue;

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos });

			curveCache.set(rail.id, cacheCurve(curve));
		}

		// Update dirty instances in each mesh
		updateDirtyInstances(
			eqMeshRef.current,
			indexMap[EQUIPMENT_TYPE.EQ],
			dirtySet,
			ports,
			curveCache,
		);
		updateDirtyInstances(
			stkMeshRef.current,
			indexMap[EQUIPMENT_TYPE.STK],
			dirtySet,
			ports,
			curveCache,
		);
		updateDirtyInstances(
			ohbMeshRef.current,
			indexMap[EQUIPMENT_TYPE.OHB],
			dirtySet,
			ports,
			curveCache,
		);
	});

	const maxEq = Math.max(portCount, 1);
	const maxStk = Math.max(portCount, 1);
	const maxOhb = Math.max(portCount, 1);

	return (
		<>
			<instancedMesh
				ref={eqMeshRef}
				args={[geometry, eqMaterial, maxEq]}
				frustumCulled={false}
				count={0}
			/>
			<instancedMesh
				ref={stkMeshRef}
				args={[geometry, stkMaterial, maxStk]}
				frustumCulled={false}
				count={0}
			/>
			<instancedMesh
				ref={ohbMeshRef}
				args={[geometry, ohbMaterial, maxOhb]}
				frustumCulled={false}
				count={0}
			/>
		</>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateMesh(
	mesh: InstancedMesh | null,
	portIds: string[],
	ports: Record<string, import("@/models/port").PortData>,
	curveCache: Map<string, CachedCurveData>,
): void {
	if (!mesh) return;

	mesh.count = portIds.length;

	for (let i = 0; i < portIds.length; i++) {
		const portId = portIds[i];
		const port = ports[portId];
		if (!port) continue;

		computePortMatrix(port, curveCache);
		mesh.setMatrixAt(i, _matrix);
	}

	mesh.instanceMatrix.needsUpdate = true;
}

function updateDirtyInstances(
	mesh: InstancedMesh | null,
	portIds: string[],
	dirtySet: Set<string>,
	ports: Record<string, import("@/models/port").PortData>,
	curveCache: Map<string, CachedCurveData>,
): void {
	if (!mesh) return;

	let updated = false;

	for (let i = 0; i < portIds.length; i++) {
		const portId = portIds[i];
		if (!dirtySet.has(portId)) continue;

		const port = ports[portId];
		if (!port) continue;

		computePortMatrix(port, curveCache);
		mesh.setMatrixAt(i, _matrix);
		updated = true;
	}

	if (updated) {
		mesh.instanceMatrix.needsUpdate = true;
	}
}

/**
 * Compute the transform matrix for a port. Writes into module-scoped _matrix.
 */
function computePortMatrix(
	port: import("@/models/port").PortData,
	curveCache: Map<string, CachedCurveData>,
): void {
	const cached = curveCache.get(port.railId);

	if (cached) {
		const pos = getPositionAtRatio(cached, port.ratio);
		_position.copy(pos);

		// Apply lateral offset based on port.side
		// For a proper offset we'd need the rail tangent, but for M1A
		// we use a simple Y offset for overhead, and X/Z offset for left/right
		if (port.side === "left") {
			_position.x -= SIDE_OFFSET;
		} else if (port.side === "right") {
			_position.x += SIDE_OFFSET;
		} else {
			// overhead — shift slightly upward
			_position.y += SIDE_OFFSET * 0.5;
		}
	} else {
		_position.set(0, 0, 0);
	}

	_quaternion.identity();
	_matrix.compose(_position, _quaternion, _scale);
}
