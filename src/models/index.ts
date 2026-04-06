// Data model re-exports

export type { BayData } from "./bay";
export type { ClipboardPayload, EditorMode, EntityKind, EntityRef } from "./editor";
export { EDITOR_MODE, ENTITY_KIND } from "./editor";
export type { EquipmentData, EquipmentSpec, PortSlotDef } from "./equipment";
export type {
	AreaData,
	FabMapFile,
	FabMapMetadata,
	MapValidation,
	ModuleData,
	VehiclePresetData,
} from "./map";
export type { NodeData } from "./node";
export type { EquipmentType, PortData, PortSide, PortType } from "./port";
export { EQUIPMENT_TYPE, PORT_SIDE, PORT_TYPE } from "./port";
export type { BayPreset } from "./preset";
export type { RailCreationParams, RailData, RailType } from "./rail";
export { RAIL_TYPE } from "./rail";
