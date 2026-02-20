import { Injectable } from "@angular/core";

@Injectable()
export class WhiteboardZoomService {
  private readonly minZoom = 0.2;
  private readonly maxZoom = 3;
  private readonly zoomStep = 0.1;
  private zoomIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  zoom = 1;
  zoomIndicatorVisible = false;
  zoomIndicatorX = 0;
  zoomIndicatorY = 0;

  zoomIn(canvas: HTMLElement | undefined): void {
    this.setZoomAtPoint(this.zoom + this.zoomStep, canvas);
  }

  zoomOut(canvas: HTMLElement | undefined): void {
    this.setZoomAtPoint(this.zoom - this.zoomStep, canvas);
  }

  resetZoom(canvas: HTMLElement | undefined): void {
    this.setZoomAtPoint(1, canvas);
  }

  zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  onCanvasWheel(event: WheelEvent, canvas: HTMLElement | undefined): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? this.zoomStep : -this.zoomStep;
    this.setZoomAtPoint(this.zoom + delta, canvas, event.clientX, event.clientY);
    this.showZoomIndicator(event.clientX, event.clientY);
  }

  destroy(): void {
    if (!this.zoomIndicatorTimer) return;
    clearTimeout(this.zoomIndicatorTimer);
    this.zoomIndicatorTimer = null;
  }

  private setZoomAtPoint(
    nextZoom: number,
    canvas: HTMLElement | undefined,
    clientX?: number,
    clientY?: number
  ): void {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    if (clamped === this.zoom) return;

    if (!canvas) {
      this.zoom = clamped;
      return;
    }

    const oldZoom = this.zoom;
    const rect = canvas.getBoundingClientRect();
    const anchorX =
      clientX !== undefined ? clientX - rect.left : canvas.clientWidth / 2;
    const anchorY =
      clientY !== undefined ? clientY - rect.top : canvas.clientHeight / 2;

    const worldX = (canvas.scrollLeft + anchorX) / oldZoom;
    const worldY = (canvas.scrollTop + anchorY) / oldZoom;

    this.zoom = clamped;
    canvas.scrollLeft = worldX * clamped - anchorX;
    canvas.scrollTop = worldY * clamped - anchorY;
  }

  private showZoomIndicator(clientX: number, clientY: number): void {
    this.zoomIndicatorX = clientX + 14;
    this.zoomIndicatorY = clientY + 14;
    this.zoomIndicatorVisible = true;
    if (this.zoomIndicatorTimer) {
      clearTimeout(this.zoomIndicatorTimer);
    }
    this.zoomIndicatorTimer = setTimeout(() => {
      this.zoomIndicatorVisible = false;
      this.zoomIndicatorTimer = null;
    }, 500);
  }
}
