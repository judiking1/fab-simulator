import { CanvasTexture, LinearFilter } from "three";

export interface TextAtlasConfig {
  atlasW: number;
  atlasH: number;
  cellW: number;
  cellH: number;
  font: string;
  fontSize: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export const DEFAULT_ATLAS_CONFIG: TextAtlasConfig = {
  atlasW: 2048,
  atlasH: 2048,
  cellW: 128,
  cellH: 48,
  font: "bold 28px 'Noto Sans KR', Arial, sans-serif",
  fontSize: 28,
  fillColor: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 3,
};

/**
 * Canvas 2D 기반 텍스트 아틀라스.
 *
 * 문자열을 cellW×cellH 셀에 렌더링하고 CanvasTexture로 GPU 업로드.
 * InstancedMesh per-instance UV로 각 셀 참조.
 * 멀티라인(\n) 지원.
 */
export class TextAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: CanvasTexture;
  readonly config: TextAtlasConfig;
  readonly cols: number;
  readonly rows: number;
  readonly maxCells: number;

  private idToCell = new Map<string, number>();
  private cellToId: (string | null)[];
  private cellToText: (string | null)[];
  private freeCells: number[];
  dirty = false;
  private _lastFlushTime = 0;

  constructor(config?: Partial<TextAtlasConfig>) {
    this.config = { ...DEFAULT_ATLAS_CONFIG, ...config };
    const { atlasW, atlasH, cellW, cellH } = this.config;

    this.cols = (atlasW / cellW) | 0;
    this.rows = (atlasH / cellH) | 0;
    this.maxCells = this.cols * this.rows;

    const canvas = document.createElement("canvas");
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true })!;

    this.canvas = canvas;
    this.ctx = ctx;

    const tex = new CanvasTexture(canvas);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    // colorSpace 명시하지 않음 — ShaderMaterial에서 직접 texel.rgb 사용
    // premultiplyAlpha = false — Canvas 2D 데이터를 straight alpha로 업로드
    tex.premultiplyAlpha = false;
    this.texture = tex;

    this.cellToId = new Array(this.maxCells).fill(null);
    this.cellToText = new Array(this.maxCells).fill(null);
    this.freeCells = [];
    for (let i = this.maxCells - 1; i >= 0; i--) this.freeCells.push(i);
  }

  /** id에 대한 셀을 가져오거나 할당. text가 변경되면 재렌더링. */
  getOrAllocate(id: string, text: string): number {
    const existing = this.idToCell.get(id);
    if (existing !== undefined) {
      if (this.cellToText[existing] !== text) {
        this.renderCell(existing, text);
        this.cellToText[existing] = text;
        this.dirty = true;
      }
      return existing;
    }

    if (this.freeCells.length === 0) {
      const oldest = this.findOldestUsedCell();
      if (oldest >= 0) this.releaseByIndex(oldest);
      else return 0;
    }

    const cell = this.freeCells.pop()!;
    this.idToCell.set(id, cell);
    this.cellToId[cell] = id;
    this.cellToText[cell] = text;
    this.renderCell(cell, text);
    this.dirty = true;
    return cell;
  }

  /** 기존 셀의 텍스트를 업데이트. 변경 시 true 반환. */
  updateText(id: string, text: string): boolean {
    const cell = this.idToCell.get(id);
    if (cell === undefined) return false;
    if (this.cellToText[cell] === text) return false;
    this.renderCell(cell, text);
    this.cellToText[cell] = text;
    this.dirty = true;
    return true;
  }

  release(id: string): void {
    const cell = this.idToCell.get(id);
    if (cell === undefined) return;
    this.idToCell.delete(id);
    this.cellToId[cell] = null;
    this.cellToText[cell] = null;
    this.freeCells.push(cell);
  }

  getCellUV(cellIndex: number): [number, number, number, number] {
    const { cellW, cellH, atlasW, atlasH } = this.config;
    const col = cellIndex % this.cols;
    const row = (cellIndex / this.cols) | 0;
    const u0 = (col * cellW) / atlasW;
    const v0 = 1 - ((row + 1) * cellH) / atlasH;
    const u1 = ((col + 1) * cellW) / atlasW;
    const v1 = 1 - (row * cellH) / atlasH;
    return [u0, v0, u1, v1];
  }

  flushIfDirty(): void {
    if (this.dirty) {
      // GPU-accelerated canvas flush workaround:
      // getImageData를 호출하면 브라우저가 canvas 렌더링 파이프라인을 동기화
      this.ctx.getImageData(0, 0, 1, 1);
      this.texture.needsUpdate = true;
      this.dirty = false;
      this._lastFlushTime = performance.now();
    }
  }

  /**
   * Throttled flush: dirty 상태여도 intervalMs 이내 재업로드 방지.
   * texSubImage2D (전체 캔버스 GPU 업로드) 비용 절감용.
   * Canvas 2D 렌더링은 즉시 일어나지만 GPU 업로드만 지연.
   */
  flushThrottled(intervalMs: number): void {
    if (!this.dirty) return;
    const now = performance.now();
    if (now - this._lastFlushTime < intervalMs) return;
    this._lastFlushTime = now;
    this.ctx.getImageData(0, 0, 1, 1);
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  /** 디버그: 아틀라스 캔버스를 화면에 오버레이로 표시 */
  debugShow(): void {
    const existing = document.getElementById("__atlas-debug");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.id = "__atlas-debug";
    div.style.cssText =
      "position:fixed;top:10px;right:10px;z-index:99999;background:#222;padding:8px;border:2px solid #4ecdc4;border-radius:8px;max-width:512px;";
    const close = document.createElement("button");
    close.textContent = "X";
    close.style.cssText = "position:absolute;top:2px;right:6px;color:#fff;background:none;border:none;cursor:pointer;font-size:16px;";
    close.onclick = () => div.remove();
    div.appendChild(close);
    const img = document.createElement("img");
    img.src = this.canvas.toDataURL();
    img.style.cssText = "width:100%;image-rendering:pixelated;";
    div.appendChild(img);
    document.body.appendChild(div);
  }

  get allocatedCount(): number {
    return this.idToCell.size;
  }

  dispose(): void {
    this.texture.dispose();
    // canvas.width/height를 0으로 설정하지 않음!
    // React Strict Mode에서 useMemo 캐시된 atlas가 재사용되므로
    // canvas를 0×0으로 만들면 texSubImage2D: no canvas 에러 발생
    this.idToCell.clear();
    this.cellToId.fill(null);
    this.cellToText.fill(null);
    this.freeCells.length = 0;
    for (let i = this.maxCells - 1; i >= 0; i--) this.freeCells.push(i);
  }

  private renderCell(cellIndex: number, text: string): void {
    const { cellW, cellH, font, fontSize, fillColor, strokeColor, strokeWidth } = this.config;
    const col = cellIndex % this.cols;
    const row = (cellIndex / this.cols) | 0;
    const x = col * cellW;
    const y = row * cellH;

    const ctx = this.ctx;
    ctx.clearRect(x, y, cellW, cellH);

    const lines = text.split("\n");

    // ★ 텍스트가 셀보다 넓으면 폰트 자동 축소
    ctx.font = font;
    const pad = 4; // 좌우 여백
    const maxTextW = cellW - pad * 2;
    let maxLineW = 0;
    for (let i = 0; i < lines.length; i++) {
      const w = ctx.measureText(lines[i]).width;
      if (w > maxLineW) maxLineW = w;
    }

    let usedFontSize = fontSize;
    if (maxLineW > maxTextW) {
      usedFontSize = Math.max(10, (fontSize * maxTextW / maxLineW) | 0);
      ctx.font = font.replace(/\d+px/, `${usedFontSize}px`);
    }

    const lineH = usedFontSize * 1.3;
    const totalH = lines.length * lineH;
    const startY = y + (cellH - totalH) / 2 + lineH / 2;
    const cx = x + cellW * 0.5;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < lines.length; i++) {
      const ly = startY + i * lineH;
      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(lines[i], cx, ly);
      }
      ctx.fillStyle = fillColor;
      ctx.fillText(lines[i], cx, ly);
    }
  }

  private releaseByIndex(cellIndex: number): void {
    const id = this.cellToId[cellIndex];
    if (id) this.release(id);
  }

  private findOldestUsedCell(): number {
    for (let i = 0; i < this.maxCells; i++) {
      if (this.cellToId[i] !== null) return i;
    }
    return -1;
  }
}
