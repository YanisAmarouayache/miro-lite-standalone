import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MiroBoardFacade } from '../application/miro-board.facade';
import { WidgetModel } from '../domain/board.model';
import { WidgetDefinition } from '../domain/widget-definition.model';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface WidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InteractionState {
  widgetId: string;
  mode: 'drag' | 'resize';
  direction?: ResizeDirection;
  startMouseX: number;
  startMouseY: number;
  startFrame: WidgetFrame;
}

interface ContextMenuState {
  widgetId: string;
  x: number;
  y: number;
}

@Component({
  selector: 'miro-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [MiroBoardFacade],
  templateUrl: './miro-board.component.html',
  styleUrl: './miro-board.component.css'
})
export class MiroBoardComponent implements OnChanges, OnDestroy {
  @ViewChild('canvasRef') private canvasRef?: ElementRef<HTMLDivElement>;
  @Input({ required: true }) boardId!: string;
  private readonly facade = inject(MiroBoardFacade);
  readonly board$ = this.facade.board$;
  readonly availableWidgets = this.facade.availableWidgets;
  readonly chartTypes = ['pie', 'doughnut', 'bar', 'line'];
  private readonly frameOverrides = new Map<string, WidgetFrame>();
  private interaction?: InteractionState;
  private selectedWidgetId: string | null = null;
  zoom = 1;
  zoomIndicatorVisible = false;
  zoomIndicatorX = 0;
  zoomIndicatorY = 0;
  contextMenu: ContextMenuState | null = null;
  private zoomIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minZoom = 0.2;
  private readonly maxZoom = 3;
  private readonly zoomStep = 0.1;
  private readonly minWidth = 120;
  private readonly minHeight = 80;

  ngOnChanges(changes: SimpleChanges): void {
    const boardIdChange = changes['boardId'];
    if (!boardIdChange) return;
    const nextBoardId = boardIdChange.currentValue as string | undefined;
    if (!nextBoardId) return;
    this.frameOverrides.clear();
    this.interaction = undefined;
    this.facade.init(nextBoardId);
  }

  addWidget(type: string): void {
    this.facade.addWidget(type);
  }

  zoomIn(): void {
    this.setZoomAtPoint(this.zoom + this.zoomStep);
  }

  zoomOut(): void {
    this.setZoomAtPoint(this.zoom - this.zoomStep);
  }

  resetZoom(): void {
    this.setZoomAtPoint(1);
  }

  zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? this.zoomStep : -this.zoomStep;
    this.setZoomAtPoint(this.zoom + delta, event.clientX, event.clientY);
    this.showZoomIndicator(event.clientX, event.clientY);
  }

  updateText(id: string, text: string): void {
    this.facade.updateConfig(id, { text });
  }

  updateChartType(id: string, chartType: string): void {
    this.facade.updateConfig(id, { chartType });
  }

  updateCounterValue(id: string, value: string): void {
    const parsed = Number(value);
    this.facade.updateConfig(id, { value: Number.isFinite(parsed) ? parsed : 0 });
  }

  updateCounterLabel(id: string, label: string): void {
    this.facade.updateConfig(id, { label });
  }

  updateImageFromFile(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== 'string') return;
      this.facade.updateConfig(id, { src, alt: file.name });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  widgetName(type: string): string {
    const definition = this.availableWidgets.find((item) => item.type === type);
    return definition?.name ?? type;
  }

  selectedWidget(board: { widgets: WidgetModel[] }): WidgetModel | undefined {
    if (!this.selectedWidgetId) return undefined;
    return board.widgets.find((widget) => widget.id === this.selectedWidgetId);
  }

  selectWidget(widgetId: string): void {
    this.selectedWidgetId = widgetId;
  }

  clearSelection(): void {
    this.selectedWidgetId = null;
    this.contextMenu = null;
  }

  isSelected(widgetId: string): boolean {
    return this.selectedWidgetId === widgetId;
  }

  private configOf(widget: WidgetModel): Record<string, unknown> {
    return widget.config ?? {};
  }

  textValue(widget: WidgetModel): string {
    const value = this.configOf(widget)['text'];
    return typeof value === 'string' ? value : '';
  }

  chartType(widget: WidgetModel): string {
    const value = this.configOf(widget)['chartType'];
    return typeof value === 'string' ? value : 'pie';
  }

  imageSrc(widget: WidgetModel): string {
    const value = this.configOf(widget)['src'];
    return typeof value === 'string' ? value : '';
  }

  imageAlt(widget: WidgetModel): string {
    const value = this.configOf(widget)['alt'];
    return typeof value === 'string' ? value : 'Imported image';
  }

  counterValue(widget: WidgetModel): number {
    const value = this.configOf(widget)['value'];
    return typeof value === 'number' ? value : 0;
  }

  counterLabel(widget: WidgetModel): string {
    const value = this.configOf(widget)['label'];
    return typeof value === 'string' ? value : 'Metric';
  }

  trackByWidgetType(_: number, definition: WidgetDefinition): string {
    return definition.type;
  }

  remove(id: string): void {
    this.facade.remove(id);
    this.contextMenu = null;
    if (this.selectedWidgetId === id) {
      this.selectedWidgetId = null;
    }
    this.frameOverrides.delete(id);
    if (this.interaction?.widgetId === id) {
      this.interaction = undefined;
    }
  }

  bringForward(id: string): void {
    this.facade.bringForward(id);
    this.contextMenu = null;
  }

  sendBackward(id: string): void {
    this.facade.sendBackward(id);
    this.contextMenu = null;
  }

  bringToFront(id: string): void {
    this.facade.bringToFront(id);
    this.contextMenu = null;
  }

  sendToBack(id: string): void {
    this.facade.sendToBack(id);
    this.contextMenu = null;
  }

  selectedLayerPosition(board: { widgets: WidgetModel[] }, widgetId: string): number {
    const index = board.widgets.findIndex((widget) => widget.id === widgetId);
    return index + 1;
  }

  orderedWidgets(board: { widgets: WidgetModel[] }): WidgetModel[] {
    return [...board.widgets].reverse();
  }

  layerNumber(board: { widgets: WidgetModel[] }, widgetId: string): number {
    return this.selectedLayerPosition(board, widgetId);
  }

  shortId(widgetId: string): string {
    return widgetId.slice(0, 6);
  }

  openWidgetContextMenu(widgetId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedWidgetId = widgetId;
    const menuWidth = 180;
    const menuHeight = 220;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    this.contextMenu = {
      widgetId,
      x: Math.max(8, x),
      y: Math.max(8, y)
    };
  }

  closeContextMenu(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.contextMenu = null;
  }

  trackByWidgetId(_: number, widget: WidgetModel): string {
    return widget.id;
  }

  frame(widget: WidgetModel): WidgetFrame {
    return this.frameOverrides.get(widget.id) ?? widget;
  }

  surfaceWidth(board: { widgets: WidgetModel[] }): number {
    const maxX = board.widgets.reduce((acc, widget) => {
      const frame = this.frame(widget);
      return Math.max(acc, frame.x + frame.width);
    }, 0);
    return Math.max(2200, maxX + 400);
  }

  surfaceHeight(board: { widgets: WidgetModel[] }): number {
    const maxY = board.widgets.reduce((acc, widget) => {
      const frame = this.frame(widget);
      return Math.max(acc, frame.y + frame.height);
    }, 0);
    return Math.max(1400, maxY + 300);
  }

  startDrag(widget: WidgetModel, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedWidgetId = widget.id;
    const startFrame = this.frame(widget);
    this.interaction = {
      widgetId: widget.id,
      mode: 'drag',
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startFrame
    };
  }

  startDragFromSelection(widget: WidgetModel, event: MouseEvent): void {
    if (event.button !== 0) return;
    if (!this.isSelected(widget.id)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.resize-handle')) return;
    if (target?.closest('textarea, input, select, button, [contenteditable="true"]')) return;
    this.startDrag(widget, event);
  }

  startResize(widget: WidgetModel, direction: ResizeDirection, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedWidgetId = widget.id;
    const startFrame = this.frame(widget);
    this.interaction = {
      widgetId: widget.id,
      mode: 'resize',
      direction,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startFrame
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.interaction) return;

    const dx = (event.clientX - this.interaction.startMouseX) / this.zoom;
    const dy = (event.clientY - this.interaction.startMouseY) / this.zoom;
    const { startFrame } = this.interaction;

    if (this.interaction.mode === 'drag') {
      this.frameOverrides.set(this.interaction.widgetId, {
        ...startFrame,
        x: startFrame.x + dx,
        y: startFrame.y + dy
      });
      return;
    }

    const direction = this.interaction.direction;
    if (!direction) return;

    let nextX = startFrame.x;
    let nextY = startFrame.y;
    let nextWidth = startFrame.width;
    let nextHeight = startFrame.height;

    if (direction.includes('e')) {
      nextWidth = Math.max(this.minWidth, startFrame.width + dx);
    }
    if (direction.includes('s')) {
      nextHeight = Math.max(this.minHeight, startFrame.height + dy);
    }
    if (direction.includes('w')) {
      nextWidth = Math.max(this.minWidth, startFrame.width - dx);
      nextX = startFrame.x + (startFrame.width - nextWidth);
    }
    if (direction.includes('n')) {
      nextHeight = Math.max(this.minHeight, startFrame.height - dy);
      nextY = startFrame.y + (startFrame.height - nextHeight);
    }

    this.frameOverrides.set(this.interaction.widgetId, {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight
    });
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (!this.interaction) return;
    const frame = this.frameOverrides.get(this.interaction.widgetId) ?? this.interaction.startFrame;
    this.facade.setWidgetFrame(this.interaction.widgetId, frame.x, frame.y, frame.width, frame.height);
    this.frameOverrides.delete(this.interaction.widgetId);
    this.interaction = undefined;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.contextMenu = null;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.contextMenu = null;
  }

  ngOnDestroy(): void {
    if (this.zoomIndicatorTimer) {
      clearTimeout(this.zoomIndicatorTimer);
      this.zoomIndicatorTimer = null;
    }
    this.facade.destroy();
  }

  private setZoomAtPoint(nextZoom: number, clientX?: number, clientY?: number): void {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom));
    if (clamped === this.zoom) return;

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      this.zoom = clamped;
      return;
    }

    const oldZoom = this.zoom;
    const rect = canvas.getBoundingClientRect();
    const anchorX = clientX !== undefined ? clientX - rect.left : canvas.clientWidth / 2;
    const anchorY = clientY !== undefined ? clientY - rect.top : canvas.clientHeight / 2;

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
