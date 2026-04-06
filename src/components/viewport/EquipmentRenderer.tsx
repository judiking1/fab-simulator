/**
 * EquipmentRenderer — Renders equipment as colored boxes using InstancedMesh (Layer 3).
 *
 * Three separate InstancedMeshes by EquipmentType:
 *   - EQ  (process equipment): green  (#22c55e) — wider, shorter boxes on floor
 *   - STK (stocker):           purple (#8b5cf6) — taller boxes on floor
 *   - OHB (overhead buffer):   amber  (#f59e0b) — flat boxes near rail height
 *
 * Equipment positions are derived from rail curves at equipment.ratio, with
 * lateral offset based on equipment.side and Y-axis rotation from equipment.rotation.
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
import { EQUIPMENT_TYPE } from "@/models/port";
import { selectEquipmentCount, useMapStore } from "@/stores/mapStore";
import { registerMesh } from "@/systems/instanceRegistry";
import { buildRailCurve } from "@/utils/curveBuilder";
import {
	type CachedCurveData,
	cacheCurve,
	getPositionAtRatio,
	getQuaternionAtRatio,
} from "@/utils/curveCache";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EQ_COLOR = new Color("#22c55e");
const STK_COLOR = new Color("#8b5cf6");
const OHB_COLOR = new Color("#f59e0b");

const EQ_SCALE = new Vector3(1.2, 0.6, 0.8);
const STK_SCALE = new Vector3(0.8, 1.2, 0.8);
const OHB_SCALE = new Vector3(0.5, 0.15, 0.5);

const EQ_Y_OFFSET = 0.3;
const STK_Y_OFFSET = 0.6;
const OHB_Y_OFFSET = -0.5;

/** Lateral offset (perpendicular to rail tangent) — matches VOS/PortRenderer value */
const LATERAL_OFFSET = 0.485;

// ---------------------------------------------------------------------------
// Module-scoped temporaries (avoid per-frame allocation)
// ---------------------------------------------------------------------------

const _position = new Vector3();
const _forward = new Vector3();
const _perpendicular = new Vector3();
const _quaternion = new Quaternion();
const _rotQuat = new Quaternion();
const _matrix = new Matrix4();
const _up = new Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EquipmentRenderer(): React.JSX.Element {
	const equipmentCount = useMapStore(selectEquipmentCount);

	// Refs for three InstancedMeshes (one per equipment type)
	const eqMeshRef = useRef<InstancedMesh>(null);
	const stkMeshRef = useRef<InstancedMesh>(null);
	const ohbMeshRef = useRef<InstancedMesh>(null);

	// Track which equipment IDs map to which mesh indices
	const eqIndexMapRef = useRef<{
		[EQUIPMENT_TYPE.EQ]: string[];
		[EQUIPMENT_TYPE.STK]: string[];
		[EQUIPMENT_TYPE.OHB]: string[];
	}>({
		[EQUIPMENT_TYPE.EQ]: [],
		[EQUIPMENT_TYPE.STK]: [],
		[EQUIPMENT_TYPE.OHB]: [],
	});

	// Rail curve cache for equipment position lookups
	const railCurveCacheRef = useRef<Map<string, CachedCurveData>>(new Map());

	const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);

	const eqMaterial = useMemo(
		() => new MeshBasicMaterial({ color: EQ_COLOR, toneMapped: false }),
		[],
	);
	const stkMaterial = useMemo(
		() => new MeshBasicMaterial({ color: STK_COLOR, toneMapped: false }),
		[],
	);
	const ohbMaterial = useMemo(
		() => new MeshBasicMaterial({ color: OHB_COLOR, toneMapped: false }),
		[],
	);

	/**
	 * Rebuild all equipment instance matrices from scratch.
	 * Called on mount and when equipment count changes.
	 */
	const rebuildAllEquipment = useCallback((): void => {
		const { nodes, rails, equipment } = useMapStore.getState();

		// Build rail curve cache for all rails referenced by equipment
		const curveCache = new Map<string, CachedCurveData>();
		const eqList = Object.values(equipment);

		for (const eq of eqList) {
			if (curveCache.has(eq.railId)) continue;

			const rail = rails[eq.railId];
			if (!rail) continue;

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos, nodePositions: nodes });
			curveCache.set(rail.id, cacheCurve(curve));
		}

		railCurveCacheRef.current = curveCache;

		// Partition equipment by type
		const eqIds: string[] = [];
		const stkIds: string[] = [];
		const ohbIds: string[] = [];

		for (const eq of eqList) {
			switch (eq.category) {
				case EQUIPMENT_TYPE.EQ:
					eqIds.push(eq.id);
					break;
				case EQUIPMENT_TYPE.STK:
					stkIds.push(eq.id);
					break;
				case EQUIPMENT_TYPE.OHB:
					ohbIds.push(eq.id);
					break;
			}
		}

		eqIndexMapRef.current = {
			[EQUIPMENT_TYPE.EQ]: eqIds,
			[EQUIPMENT_TYPE.STK]: stkIds,
			[EQUIPMENT_TYPE.OHB]: ohbIds,
		};

		// Update each mesh
		updateMesh(eqMeshRef.current, eqIds, equipment, curveCache);
		updateMesh(stkMeshRef.current, stkIds, equipment, curveCache);
		updateMesh(ohbMeshRef.current, ohbIds, equipment, curveCache);

		// Register with instance registry for raycasting
		if (eqMeshRef.current) registerMesh(eqMeshRef.current.uuid, "equipment", eqIds);
		if (stkMeshRef.current) registerMesh(stkMeshRef.current.uuid, "equipment", stkIds);
		if (ohbMeshRef.current) registerMesh(ohbMeshRef.current.uuid, "equipment", ohbIds);
	}, []);

	// Full rebuild when equipment count changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: equipmentCount is an intentional trigger — rebuild geometry when equipment is added/removed
	useEffect(() => {
		rebuildAllEquipment();
	}, [equipmentCount, rebuildAllEquipment]);

	// Handle dirty equipment in useFrame
	useFrame(() => {
		const dirtyEqIds = useMapStore.getState().consumeDirtyEquipment();
		if (dirtyEqIds.length === 0) return;

		const { nodes, rails, equipment } = useMapStore.getState();
		const curveCache = railCurveCacheRef.current;
		const indexMap = eqIndexMapRef.current;

		// Rebuild curve cache for dirty equipment's rails
		const dirtySet = new Set(dirtyEqIds);
		for (const eqId of dirtyEqIds) {
			const eq = equipment[eqId];
			if (!eq) continue;

			const rail = rails[eq.railId];
			if (!rail) continue;

			const fromNode = nodes[rail.fromNodeId];
			const toNode = nodes[rail.toNodeId];
			if (!fromNode || !toNode) continue;

			const fromPos = new Vector3(fromNode.x, fromNode.y, fromNode.z);
			const toPos = new Vector3(toNode.x, toNode.y, toNode.z);

			const curve = buildRailCurve({ rail, fromPos, toPos, nodePositions: nodes });
			curveCache.set(rail.id, cacheCurve(curve));
		}

		// Update dirty instances in each mesh
		updateDirtyInstances(
			eqMeshRef.current,
			indexMap[EQUIPMENT_TYPE.EQ],
			dirtySet,
			equipment,
			curveCache,
		);
		updateDirtyInstances(
			stkMeshRef.current,
			indexMap[EQUIPMENT_TYPE.STK],
			dirtySet,
			equipment,
			curveCache,
		);
		updateDirtyInstances(
			ohbMeshRef.current,
			indexMap[EQUIPMENT_TYPE.OHB],
			dirtySet,
			equipment,
			curveCache,
		);
	});

	const maxInstances = Math.max(equipmentCount, 1);

	return (
		<>
			<instancedMesh
				ref={eqMeshRef}
				args={[geometry, eqMaterial, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
			<instancedMesh
				ref={stkMeshRef}
				args={[geometry, stkMaterial, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
			<instancedMesh
				ref={ohbMeshRef}
				args={[geometry, ohbMaterial, maxInstances]}
				frustumCulled={false}
				count={0}
			/>
		</>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write all equipment matrices into an InstancedMesh.
 */
function updateMesh(
	mesh: InstancedMesh | null,
	eqIds: string[],
	equipment: Record<string, import("@/models/equipment").EquipmentData>,
	curveCache: Map<string, CachedCurveData>,
): void {
	if (!mesh) return;

	mesh.count = eqIds.length;

	for (let i = 0; i < eqIds.length; i++) {
		const eqId = eqIds[i];
		const eq = equipment[eqId];
		if (!eq) continue;

		computeEquipmentMatrix(eq, curveCache);
		mesh.setMatrixAt(i, _matrix);
	}

	mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Update only dirty equipment instances within a mesh.
 */
function updateDirtyInstances(
	mesh: InstancedMesh | null,
	eqIds: string[],
	dirtySet: Set<string>,
	equipment: Record<string, import("@/models/equipment").EquipmentData>,
	curveCache: Map<string, CachedCurveData>,
): void {
	if (!mesh) return;

	let updated = false;

	for (let i = 0; i < eqIds.length; i++) {
		const eqId = eqIds[i];
		if (!dirtySet.has(eqId)) continue;

		const eq = equipment[eqId];
		if (!eq) continue;

		computeEquipmentMatrix(eq, curveCache);
		mesh.setMatrixAt(i, _matrix);
		updated = true;
	}

	if (updated) {
		mesh.instanceMatrix.needsUpdate = true;
	}
}

/**
 * Compute the transform matrix for an equipment instance. Writes into module-scoped _matrix.
 *
 * Positioning logic:
 *   1. Get base position at equipment.ratio along the rail curve
 *   2. Apply lateral offset perpendicular to rail tangent based on equipment.side
 *   3. Apply Y offset based on equipment category (EQ/STK at floor, OHB near rail)
 *   4. Apply Y-axis rotation from equipment.rotation (degrees)
 *   5. Apply category-specific scale
 */
function computeEquipmentMatrix(
	eq: import("@/models/equipment").EquipmentData,
	curveCache: Map<string, CachedCurveData>,
): void {
	const cached = curveCache.get(eq.railId);

	if (cached) {
		const pos = getPositionAtRatio(cached, eq.ratio);
		_position.copy(pos);

		// Lateral offset using rail tangent direction
		const quat = getQuaternionAtRatio(cached, eq.ratio);
		_forward.set(1, 0, 0).applyQuaternion(quat);
		// Perpendicular in XZ plane (90 degree rotation)
		_perpendicular.set(-_forward.z, 0, _forward.x);

		const sideSign = eq.side === "left" ? 1 : eq.side === "right" ? -1 : 0;
		_position.addScaledVector(_perpendicular, sideSign * LATERAL_OFFSET);

		// Y offset based on equipment category
		switch (eq.category) {
			case EQUIPMENT_TYPE.EQ:
				_position.y += EQ_Y_OFFSET;
				break;
			case EQUIPMENT_TYPE.STK:
				_position.y += STK_Y_OFFSET;
				break;
			case EQUIPMENT_TYPE.OHB:
				_position.y += OHB_Y_OFFSET;
				break;
		}
	} else {
		_position.set(0, 0, 0);
	}

	// Y-axis rotation from equipment.rotation (degrees → radians)
	_quaternion.identity();
	if (eq.rotation !== 0) {
		_rotQuat.setFromAxisAngle(_up, (eq.rotation * Math.PI) / 180);
		_quaternion.multiply(_rotQuat);
	}

	// Select scale based on equipment category
	let scale: Vector3;
	switch (eq.category) {
		case EQUIPMENT_TYPE.STK:
			scale = STK_SCALE;
			break;
		case EQUIPMENT_TYPE.OHB:
			scale = OHB_SCALE;
			break;
		default:
			scale = EQ_SCALE;
			break;
	}

	_matrix.compose(_position, _quaternion, scale);
}
