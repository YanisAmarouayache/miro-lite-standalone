import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map } from 'rxjs';
import { WhiteboardFacade } from '../application/whiteboard.facade';
import { WidgetModel } from '../domain/board.model';
import {
  LayerListContextMenuEvent,
  LayerListComponent,
  LayerReorderEvent
} from './components/layer-list/layer-list.component';
import { ContextMenuActionEvent, ContextMenuState, WidgetContextMenuComponent } from './components/widget-context-menu/widget-context-menu.component';
import { WidgetConfigPanelComponent } from './components/widget-config-panel/widget-config-panel.component';
import {
  ResizeDirection,
  WidgetCanvasComponent,
  WidgetDropEvent,
  WidgetMouseEvent,
  WidgetResizeEvent,
  WidgetTextChangeEvent,
  WIDGET_TYPE_DRAG_MIME
} from './components/widget-canvas/widget-canvas.component';
import { WidgetInteractionService } from './services/widget-interaction.service';
import { WhiteboardZoomService } from './services/whiteboard-zoom.service';
import { WidgetContextMenuService } from './services/widget-context-menu.service';

@Component({
    selector: 'whiteboard',
    imports: [CommonModule, LayerListComponent, WidgetConfigPanelComponent, WidgetContextMenuComponent, WidgetCanvasComponent],
    providers: [WhiteboardFacade, WidgetInteractionService, WhiteboardZoomService, WidgetContextMenuService],
    templateUrl: './whiteboard.component.html',
    styleUrl: './whiteboard.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhiteboardComponent implements OnChanges, OnDestroy {
  @ViewChild('canvasRef') private canvasRef?: WidgetCanvasComponent;
  @Input({ required: true }) boardId!: string;
  private readonly facade = inject(WhiteboardFacade);
  private readonly interaction = inject(WidgetInteractionService);
  private readonly zoomState = inject(WhiteboardZoomService);
  private readonly contextMenuState = inject(WidgetContextMenuService);
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
  get zoom(): number {
    return this.zoomState.zoom;
  }
  get zoomIndicatorVisible(): boolean {
    return this.zoomState.zoomIndicatorVisible;
  }
  get zoomIndicatorX(): number {
    return this.zoomState.zoomIndicatorX;
  }
  get zoomIndicatorY(): number {
    return this.zoomState.zoomIndicatorY;
  }
  get contextMenu(): ContextMenuState | null {
    return this.contextMenuState.contextMenu;
  }

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

  onWidgetButtonDragStart(type: string, event: DragEvent): void {
    if (!this.boardReady()) {
      event.preventDefault();
      return;
    }
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(WIDGET_TYPE_DRAG_MIME, type);
    event.dataTransfer.setData('text/plain', type);
  }

  onWidgetDrop(event: WidgetDropEvent): void {
    if (!this.boardReady()) return;
    const canvas = this.canvasRef?.getCanvasElement();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const safeZoom = this.zoom || 1;
    const x = (canvas.scrollLeft + event.clientX - rect.left) / safeZoom;
    const y = (canvas.scrollTop + event.clientY - rect.top) / safeZoom;
    this.facade.addWidgetAt(event.widgetType, x, y);
  }

  zoomIn(): void {
    this.zoomState.zoomIn(this.canvasRef?.getCanvasElement());
  }

  zoomOut(): void {
    this.zoomState.zoomOut(this.canvasRef?.getCanvasElement());
  }

  resetZoom(): void {
    this.zoomState.resetZoom(this.canvasRef?.getCanvasElement());
  }

  zoomPercent(): number {
    return this.zoomState.zoomPercent();
  }

  onCanvasWheel(event: WheelEvent): void {
    this.zoomState.onCanvasWheel(event, this.canvasRef?.getCanvasElement());
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
    this.contextMenuState.close();
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
    this.selectedWidgetId = widgetId;
    this.interaction.setSelectedWidgetId(widgetId);
    this.contextMenuState.open(widgetId, event);
  }

  closeContextMenu(event?: MouseEvent): void {
    this.contextMenuState.close(event);
  }

  openWidgetContextMenuFromLayer(event: LayerListContextMenuEvent): void {
    this.openWidgetContextMenu(event.widgetId, event.event);
  }

  onLayerReorder(event: LayerReorderEvent): void {
    if (!this.boardReady()) return;
    this.facade.moveWidgetAbove(event.sourceWidgetId, event.targetWidgetId);
    this.selectWidget(event.sourceWidgetId);
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
    this.interaction.setSelectedWidgetId(widget.id);
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
    this.interaction.setSelectedWidgetId(widget.id);
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
    this.contextMenuState.close();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.contextMenuState.close();
  }

  ngOnDestroy(): void {
    this.zoomState.destroy();
    this.facade.destroy();
  }

  private clearContextMenu(): void {
    this.contextMenuState.close();
  }
}
