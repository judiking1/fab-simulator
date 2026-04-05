/**
 * convertVosMap.ts — Convert VOS .map CSV files to our custom CSV format.
 *
 * Usage: npx tsx scripts/convertVosMap.ts
 *
 * Reads:
 *   - VOS node.map, edge.map, station.map from the source directory
 *
 * Writes:
 *   - public/railConfig/nodes.csv
 *   - public/railConfig/rails.csv
 *   - public/railConfig/ports.csv
 *
 * Then deletes the old .map files from public/railConfig/.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root: walk up from scripts/ dir.
// In a worktree, __dirname may be deep — find the first dir with package.json
// whose parent is NOT inside .claude/worktrees (i.e., find the real project root).
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find project root (no package.json found)");
}

const PROJECT_ROOT = findProjectRoot(__dirname);

// VOS source: accept from CLI arg or env, or default to sibling project.
// Usage: npx tsx scripts/convertVosMap.ts [vos-rail-config-dir]
const vosArg = process.argv[2];
const VOS_DIR = vosArg
  ? path.resolve(vosArg)
  : process.env["VOS_DIR"]
    ? path.resolve(process.env["VOS_DIR"])
    : path.resolve(PROJECT_ROOT, "../fab/vos/vosui-develop_rms/public/railConfig");
const OUT_DIR = path.resolve(__dirname, "../public/railConfig");

// ---------------------------------------------------------------------------
// CSV parsing helpers (standalone — no src/ imports)
// ---------------------------------------------------------------------------

type CsvRow = Record<string, string>;

function parseCsvText(csvText: string): CsvRow[] {
  const lines = csvText.split("\n");
  let headers: string[] = [];
  let headerFound = false;
  const rows: CsvRow[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      continue;
    }

    if (!headerFound) {
      headers = trimmed
        .replace(/^\uFEFF/, "")
        .split(",")
        .map((h) => h.trim());
      headerFound = true;
      continue;
    }

    const values = trimmed.split(",").map((v) => v.trim());
    if (values.length !== headers.length) continue;

    const row: CsvRow = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]!] = values[i]!;
    }
    rows.push(row);
  }

  return rows;
}

function parseBracketList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return [];
  const inner = trimmed.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (inner === "") return [];
  return inner.split(/\s+/).filter((s) => s.length > 0);
}

function safeFloat(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// VOS rail type mapping
// ---------------------------------------------------------------------------

const VOS_RAIL_TYPE_MAP: Record<string, string> = {
  LINEAR: "LINEAR",
  CURVE: "CURVE",
  LEFT_CURVE: "LEFT_CURVE",
  RIGHT_CURVE: "RIGHT_CURVE",
  S_CURVE: "S_CURVE",
  S_CURVE_50: "S_CURVE",
  CSC_CURVE_HOMO: "CSC_CURVE_HOMO",
  CSC_CURVE_HETE: "CSC_CURVE_HETE",
};

function mapRailType(vosType: string): string {
  return VOS_RAIL_TYPE_MAP[vosType.trim().toUpperCase()] ?? "LINEAR";
}

// ---------------------------------------------------------------------------
// VOS port type / side mapping
// ---------------------------------------------------------------------------

function mapPortType(code: string): string {
  switch (code.trim()) {
    case "2":
      return "unload";
    case "3":
      return "bidirectional";
    case "4":
      return "load";
    default:
      return "bidirectional";
  }
}

function mapEquipmentType(vosType: string): string {
  const upper = vosType.trim().toUpperCase();
  if (upper === "OHB" || upper === "STK" || upper === "EQ") return upper;
  return "EQ";
}

function mapPortSide(directionCode: string, stationName: string): string {
  const code = directionCode.trim();
  if (code === "3") return "overhead";

  const firstChar = stationName.charAt(0);
  if (firstChar === "1") return "left";
  if (firstChar === "2") return "right";

  if (code === "1") return "left";
  if (code === "2") return "right";

  return "overhead";
}

// ---------------------------------------------------------------------------
// Barcode resolution (for station -> rail+ratio)
// ---------------------------------------------------------------------------

interface BarcodeEntry {
  nodeId: string;
  barcode: number;
}

interface RailRef {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

function findBracketingNodes(
  targetBarcode: number,
  sorted: BarcodeEntry[],
): { startIdx: number; endIdx: number } | null {
  if (sorted.length === 0) return null;
  if (
    targetBarcode < sorted[0]!.barcode ||
    targetBarcode > sorted[sorted.length - 1]!.barcode
  ) {
    return null;
  }

  let left = 0;
  let right = sorted.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (targetBarcode === sorted[mid]!.barcode) {
      return { startIdx: mid, endIdx: mid };
    }
    if (targetBarcode < sorted[mid]!.barcode) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  if (right < 0 || left >= sorted.length) return null;
  return { startIdx: right, endIdx: left };
}

function buildNodePairToRail(
  rails: RailRef[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rails) {
    map.set(`${r.fromNodeId}-${r.toNodeId}`, r.id);
    map.set(`${r.toNodeId}-${r.fromNodeId}`, r.id);
  }
  return map;
}

function computeRatioOnRail(
  fromNodeId: string,
  toNodeId: string,
  barcodeX: number,
  barcodeLookup: Record<string, number>,
): number {
  const fromBarcode = barcodeLookup[fromNodeId];
  const toBarcode = barcodeLookup[toNodeId];
  if (fromBarcode === undefined || toBarcode === undefined) return 0;
  const denom = toBarcode - fromBarcode;
  if (Math.abs(denom) < 1e-12) return 0;
  const ratio = (barcodeX - fromBarcode) / denom;
  return Math.max(0, Math.min(1, ratio));
}

// ---------------------------------------------------------------------------
// Escape CSV value (quote if it contains commas or quotes)
// ---------------------------------------------------------------------------

function csvVal(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Reading VOS .map files...");

  const nodeText = fs.readFileSync(path.join(VOS_DIR, "node.map"), "utf-8");
  const edgeText = fs.readFileSync(path.join(VOS_DIR, "edge.map"), "utf-8");
  const stationText = fs.readFileSync(
    path.join(VOS_DIR, "station.map"),
    "utf-8",
  );

  // --- Phase 1: Nodes ---
  const nodeRows = parseCsvText(nodeText);
  const barcodeLookup: Record<string, number> = {};
  const barcodeEntries: BarcodeEntry[] = [];

  const nodesLines: string[] = ["id,x,y,z"];

  for (const row of nodeRows) {
    const id = row["node_name"] ?? "";
    if (!id) continue;

    const editorX = safeFloat(row["editor_x"], 0);
    const editorY = safeFloat(row["editor_y"], 0);
    const editorZ = safeFloat(row["editor_z"], 0);
    const barcode = safeFloat(row["barcode"], 0);

    // Coordinate swap: editor_x->X, editor_z->Y(up), editor_y->Z(depth)
    nodesLines.push(`${id},${editorX},${editorZ},${editorY}`);

    barcodeLookup[id] = barcode;
    barcodeEntries.push({ nodeId: id, barcode });
  }

  barcodeEntries.sort((a, b) => a.barcode - b.barcode);
  console.log(`  Nodes: ${nodeRows.length}`);

  // --- Phase 2: Rails ---
  const edgeRows = parseCsvText(edgeText);
  const railRefs: RailRef[] = [];
  // rail_name -> rail_id mapping for station resolution (stations reference rail_name)
  const railNameToId: Record<string, string> = {};
  // rail_id -> rail info for ratio computation
  const railIdInfo: Record<string, { fromNodeId: string; toNodeId: string }> =
    {};

  const railsLines: string[] = [
    "id,fromNodeId,toNodeId,railType,bayId,fabId,speed,acc,dec,radius,originFromX,originFromY,originFromZ,originToX,originToY,originToZ,fle,tle,ole,curveNodes",
  ];

  for (const row of edgeRows) {
    const railName = row["rail_name"] ?? "";
    const railId = row["rail_id"] ?? railName;
    const fromNodeId = row["from_node"] ?? "";
    const toNodeId = row["to_node"] ?? "";
    if (!railName || !fromNodeId || !toNodeId) continue;

    const vosRailType = row["vos_rail_type"] ?? "LINEAR";
    const railType = mapRailType(vosRailType);
    const bayId = row["bay_name"] ?? "";
    const fabId = row["fab_id"] ?? "";
    const speed = safeFloat(row["speed"], 300);
    const acc = safeFloat(row["acc"], 2);
    const dec = safeFloat(row["dec"], -3);
    const radius = safeFloat(row["radius"], -1);

    // Origin coordinates with Y/Z swap
    const originFromX = safeFloat(row["origin_from_x"], 0);
    const originFromY = safeFloat(row["origin_from_z"], 0); // Z->Y swap
    const originFromZ = safeFloat(row["origin_from_y"], 0); // Y->Z swap
    const originToX = safeFloat(row["origin_to_x"], 0);
    const originToY = safeFloat(row["origin_to_z"], 0); // Z->Y swap
    const originToZ = safeFloat(row["origin_to_y"], 0); // Y->Z swap

    const fle = safeFloat(row["fle"], 0);
    const tle = safeFloat(row["tle"], 0);
    const ole = safeFloat(row["ole"], 0);

    // Parse intermediate curve nodes
    const nodesField = row["nodes"] ?? "";
    const allNodes = parseBracketList(nodesField);
    let curveNodesStr = "";
    if (
      railType === "CSC_CURVE_HETE" ||
      railType === "CSC_CURVE_HOMO"
    ) {
      if (allNodes.length > 2) {
        const intermediates = allNodes.slice(1, -1);
        curveNodesStr = `[${intermediates.join(" ")}]`;
      }
    }

    railsLines.push(
      [
        railId,
        fromNodeId,
        toNodeId,
        railType,
        bayId,
        fabId,
        speed,
        acc,
        dec,
        radius,
        originFromX,
        originFromY,
        originFromZ,
        originToX,
        originToY,
        originToZ,
        fle,
        tle,
        ole,
        csvVal(curveNodesStr),
      ].join(","),
    );

    railNameToId[railName] = railId;
    railIdInfo[railId] = { fromNodeId, toNodeId };
    railRefs.push({ id: railId, fromNodeId, toNodeId });
  }

  // Also build a node-pair map using rail_name as the ID for station resolution,
  // since stations reference rail_name
  const railNameRefs: RailRef[] = [];
  for (const row of edgeRows) {
    const railName = row["rail_name"] ?? "";
    const fromNodeId = row["from_node"] ?? "";
    const toNodeId = row["to_node"] ?? "";
    if (!railName || !fromNodeId || !toNodeId) continue;
    railNameRefs.push({ id: railName, fromNodeId, toNodeId });
  }
  const nodePairToRailName = buildNodePairToRail(railNameRefs);

  console.log(`  Rails: ${edgeRows.length}`);

  // --- Phase 3: Ports ---
  const stationRows = parseCsvText(stationText);

  const portsLines: string[] = [
    "id,railId,ratio,equipmentType,equipmentId,portType,bayId,fabId,side,zoneId,moduleId",
  ];

  let skippedPorts = 0;

  for (const row of stationRows) {
    const stationName = row["station_name"] ?? "";
    if (!stationName) continue;

    const barcodeX = safeFloat(row["barcode_x"], 0);
    const stationType = row["station_type"] ?? "EQ";
    const bayName = row["bay_name"] ?? "";
    const portId = row["port_id"] ?? row["sc_id"] ?? stationName;
    const portTypeCode = row["port_type_code"] ?? "3";
    const directionCode = row["direction_code"] ?? "3";
    const vosRailName = row["rail_name"] ?? "";
    const zoneId = row["zone_id"] ?? "";
    const moduleId = row["sc_id"] ?? "";

    // Resolve railId and ratio
    let resolvedRailId = "";
    let ratio = 0;

    if (vosRailName) {
      // Station specifies which rail_name it's on
      const mappedRailId = railNameToId[vosRailName];
      if (mappedRailId) {
        resolvedRailId = mappedRailId;
        const info = railIdInfo[mappedRailId];
        if (info) {
          ratio = computeRatioOnRail(
            info.fromNodeId,
            info.toNodeId,
            barcodeX,
            barcodeLookup,
          );
        }
      }
    }

    if (!resolvedRailId) {
      // Fallback: resolve barcode across all rails
      const bracket = findBracketingNodes(barcodeX, barcodeEntries);
      if (!bracket) {
        skippedPorts++;
        continue;
      }

      const startEntry = barcodeEntries[bracket.startIdx]!;
      const endEntry = barcodeEntries[bracket.endIdx]!;

      if (startEntry.nodeId === endEntry.nodeId) {
        // Exact match on a node — find any connected rail
        const foundRailName = findRailWithNode(
          startEntry.nodeId,
          nodePairToRailName,
        );
        if (!foundRailName) {
          skippedPorts++;
          continue;
        }
        const mapped = railNameToId[foundRailName];
        if (!mapped) {
          skippedPorts++;
          continue;
        }
        resolvedRailId = mapped;
        ratio = 0;
      } else {
        const railName =
          nodePairToRailName.get(
            `${startEntry.nodeId}-${endEntry.nodeId}`,
          ) ??
          nodePairToRailName.get(
            `${endEntry.nodeId}-${startEntry.nodeId}`,
          );
        if (!railName) {
          skippedPorts++;
          continue;
        }
        const mapped = railNameToId[railName];
        if (!mapped) {
          skippedPorts++;
          continue;
        }
        resolvedRailId = mapped;

        const startBarcode = barcodeLookup[startEntry.nodeId];
        const endBarcode = barcodeLookup[endEntry.nodeId];
        if (
          startBarcode !== undefined &&
          endBarcode !== undefined &&
          Math.abs(endBarcode - startBarcode) > 1e-12
        ) {
          const rawRatio =
            (barcodeX - startBarcode) / (endBarcode - startBarcode);
          const forwardKey = `${startEntry.nodeId}-${endEntry.nodeId}`;
          const isForward = nodePairToRailName.has(forwardKey);
          ratio = Math.max(
            0,
            Math.min(1, isForward ? rawRatio : 1 - rawRatio),
          );
        }
      }
    }

    // Find fabId from bay's rails
    let fabId = "";
    const info = railIdInfo[resolvedRailId];
    if (info) {
      // Look up from edge rows
      for (const eRow of edgeRows) {
        if (
          eRow["rail_id"] === resolvedRailId ||
          railNameToId[eRow["rail_name"] ?? ""] === resolvedRailId
        ) {
          if ((eRow["bay_name"] ?? "") === bayName) {
            fabId = eRow["fab_id"] ?? "";
            break;
          }
          if (!fabId) fabId = eRow["fab_id"] ?? "";
        }
      }
    }

    portsLines.push(
      [
        stationName,
        resolvedRailId,
        Math.round(ratio * 1000) / 1000, // 3 decimal places
        mapEquipmentType(stationType),
        portId,
        mapPortType(portTypeCode),
        bayName,
        fabId,
        mapPortSide(directionCode, stationName),
        zoneId,
        moduleId,
      ].join(","),
    );
  }

  console.log(`  Ports: ${stationRows.length - skippedPorts} (skipped: ${skippedPorts})`);

  // --- Write output ---
  fs.mkdirSync(OUT_DIR, { recursive: true });

  fs.writeFileSync(path.join(OUT_DIR, "nodes.csv"), nodesLines.join("\n"), "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "rails.csv"), railsLines.join("\n"), "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "ports.csv"), portsLines.join("\n"), "utf-8");

  console.log(`\nWritten to ${OUT_DIR}:`);
  console.log(`  nodes.csv  (${nodesLines.length - 1} rows)`);
  console.log(`  rails.csv  (${railsLines.length - 1} rows)`);
  console.log(`  ports.csv  (${portsLines.length - 1} rows)`);

  // --- Delete old .map files from public/railConfig/ ---
  const mapFiles = ["node.map", "edge.map", "station.map"];
  for (const f of mapFiles) {
    const filePath = path.join(OUT_DIR, f);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  Deleted ${f}`);
    }
  }

  console.log("\nDone.");
}

function findRailWithNode(
  nodeId: string,
  nodePairToRail: Map<string, string>,
): string | null {
  for (const [key, railId] of nodePairToRail) {
    if (key.startsWith(`${nodeId}-`) || key.endsWith(`-${nodeId}`)) {
      return railId;
    }
  }
  return null;
}

main();
