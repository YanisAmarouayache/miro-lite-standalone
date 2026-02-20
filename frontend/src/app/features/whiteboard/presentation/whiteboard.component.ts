import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map } from 'rxjs';
import { WhiteboardFacade } from '../application/whiteboard.facade';
import { WidgetModel } from '../domain/board.model';
import { LayerListContextMenuEvent, LayerListComponent } from './components/layer-list/layer-list.component';
import { ContextMenuActionEvent, ContextMenuState, WidgetContextMenuComponent } from './components/widget-context-menu/widget-context-menu.component';
import { WidgetConfigPanelComponent } from './components/widget-config-panel/widget-config-panel.component';
import { ResizeDirection, WidgetCanvasComponent, WidgetMouseEvent, WidgetResizeEvent, WidgetTextChangeEvent } from './components/widget-canvas/widget-canvas.component';
import { WidgetInteractionService } from './services/widget-interaction.service';

@Component({
    selector: 'whiteboard',
    imports: [CommonModule, LayerListComponent, WidgetConfigPanelComponent, WidgetContextMenuComponent, WidgetCanvasComponent],
    providers: [WhiteboardFacade, WidgetInteractionService],
    templateUrl: './whiteboard.component.html',
    styleUrl: './whiteboard.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhiteboardComponent implements OnChanges, OnDestroy {
  @ViewChild('canvasRef') private canvasRef?: WidgetCanvasComponent;
  @Input({ required: true }) boardId!: string;
  private readonly facade = inject(WhiteboardFacade);
  private readonly interaction = inject(WidgetInteractionService);
  readonly board$ = this.facade.board$;
  readonly loadError$ = this.facade.loadError$;
  readonly saveError$ = this.facade.saveError$;
  readonly boardReady = toSignal(this.facade.boardReady$, { initialValue: false });
  readonly selectedWidget = toSignal(
    combineLatest([
      this.facade.board$,
      this.interaction.selectedWidgetId$
    ]).pipe(
      map(([board, selectedWidgetId]) => {
        if (!selectedWidgetId) return undefined;
        return board.widgets.find((widget) => widget.id === selectedWidgetId);
      })
    ),
    { initialValue: undefined }
  );
  readonly availableWidgets = this.facade.availableWidgets;
  readonly chartTypes = ['pie', 'doughnut', 'bar', 'line'];
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

  ngOnChanges(changes: SimpleChanges): void {
    const boardIdChange = changes['boardId'];
    if (!boardIdChange) return;
    const nextBoardId = boardIdChange.currentValue as string | undefined;
    if (!nextBoardId) return;
    this.interaction.clearAll();
    this.facade.init(nextBoardId);
  }

  get frameOverrides() {
    return this.interaction.frameOverrides;
  }

  addWidget(type: string): void {
    if (!this.boardReady()) return;
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
    if (!this.boardReady()) return;
    this.facade.updateWidgetText(id, text);
  }

  updateChartType(id: string, chartType: string): void {
    if (!this.boardReady()) return;
    this.facade.updateChartType(id, chartType);
  }

  updateCounterValue(id: string, value: string): void {
    if (!this.boardReady()) return;
    this.facade.updateCounterValue(id, value);
  }

  updateCounterLabel(id: string, label: string): void {
    if (!this.boardReady()) return;
    this.facade.updateCounterLabel(id, label);
  }

  updateImageFromFile(id: string, file: File): void {
    if (!this.boardReady()) return;
    this.facade.updateImageFromFile(id, file);
  }

  selectWidget(widgetId: string): void {
    this.selectedWidgetId = widgetId;
    this.interaction.setSelectedWidgetId(widgetId);
    this.clearContextMenu();
  }

  clearSelection(): void {
    this.selectedWidgetId = null;
    this.interaction.setSelectedWidgetId(null);
    this.contextMenu = null;
  }

  remove(id: string): void {
    if (!this.boardReady()) return;
    this.facade.remove(id);
    this.clearContextMenu();
    if (this.selectedWidgetId === id) {
      this.selectedWidgetId = null;
      this.interaction.setSelectedWidgetId(null);
    }
    this.interaction.clearWidget(id);
  }

  selectedLayerPosition(board: { widgets: WidgetModel[] }, widgetId: string): number {
    const index = board.widgets.findIndex((widget) => widget.id === widgetId);
    return index + 1;
  }

  openWidgetContextMenu(widgetId: string, event: MouseEvent): void {
    if (!this.boardReady()) return;
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
    this.clearContextMenu();
  }

  openWidgetContextMenuFromLayer(event: LayerListContextMenuEvent): void {
    this.openWidgetContextMenu(event.widgetId, event.event);
  }

  onWidgetContextMenu(event: WidgetMouseEvent): void {
    this.openWidgetContextMenu(event.widgetId, event.event);
  }

  onWidgetTextChange(event: WidgetTextChangeEvent): void {
    this.updateText(event.widgetId, event.text);
  }

  onContextMenuAction(event: ContextMenuActionEvent): void {
    if (!this.boardReady()) return;
    switch (event.action) {
      case 'bring_to_front':
        this.facade.bringToFront(event.widgetId);
        break;
      case 'bring_forward':
        this.facade.bringForward(event.widgetId);
        break;
      case 'send_backward':
        this.facade.sendBackward(event.widgetId);
        break;
      case 'send_to_back':
        this.facade.sendToBack(event.widgetId);
        break;
      case 'remove':
        this.remove(event.widgetId);
        break;
    }
    this.clearContextMenu();
  }

  startDrag(widget: WidgetModel, event: MouseEvent): void {
    if (!this.boardReady()) return;
    this.selectedWidgetId = widget.id;
    this.interaction.startDrag(widget, event);
  }

  onStartDragRequest(event: WidgetMouseEvent, widgets: WidgetModel[]): void {
    const widget = widgets.find((item) => item.id === event.widgetId);
    if (!widget) return;
    this.startDrag(widget, event.event);
  }

  onStartResizeRequest(event: WidgetResizeEvent): void {
    if (!this.boardReady()) return;
    this.startResize(event.widget, event.direction, event.event);
  }

  startResize(widget: WidgetModel, direction: ResizeDirection, event: MouseEvent): void {
    this.selectedWidgetId = widget.id;
    this.interaction.startResize(widget, direction, event);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.interaction.onPointerMove(event, this.zoom);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    const commit = this.interaction.onPointerUp();
    if (!commit) return;
    this.facade.setWidgetFrame(commit.widgetId, commit.frame.x, commit.frame.y, commit.frame.width, commit.frame.height);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.clearContextMenu();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.clearContextMenu();
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

    const canvas = this.canvasRef?.getCanvasElement();
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

  private clearContextMenu(): void {
    this.contextMenu = null;
  }
}
