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
import { WidgetCanvasComponent, WidgetDropEvent, WidgetMouseEvent, WidgetResizeEvent, WidgetTextChangeEvent } from './components/widget-canvas/widget-canvas.component';
import { WidgetInteractionService } from './services/widget-interaction.service';
import { WhiteboardZoomService } from './services/whiteboard-zoom.service';
import { WidgetContextMenuService } from './services/widget-context-menu.service';
import { WhiteboardUiService } from './services/whiteboard-ui.service';

@Component({
    selector: 'whiteboard',
    imports: [CommonModule, LayerListComponent, WidgetConfigPanelComponent, WidgetContextMenuComponent, WidgetCanvasComponent],
    providers: [WhiteboardFacade, WidgetInteractionService, WhiteboardZoomService, WidgetContextMenuService, WhiteboardUiService],
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
  private readonly ui = inject(WhiteboardUiService);
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
    this.ui.onWidgetButtonDragStart(type, event, this.boardReady());
  }

  onWidgetDrop(event: WidgetDropEvent): void {
    this.ui.onWidgetDrop(
      event,
      this.canvasRef?.getCanvasElement(),
      this.zoom,
      this.boardReady()
    );
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
    this.ui.onWidgetTextChange({ widgetId: id, text }, this.boardReady());
  }

  updateChartType(id: string, chartType: string): void {
    this.ui.updateChartType(id, chartType, this.boardReady());
  }

  updateCounterValue(id: string, value: string): void {
    this.ui.updateCounterValue(id, value, this.boardReady());
  }

  updateCounterLabel(id: string, label: string): void {
    this.ui.updateCounterLabel(id, label, this.boardReady());
  }

  updateImageFromFile(id: string, file: File): void {
    this.ui.updateImageFromFile(id, file, this.boardReady());
  }

  selectWidget(widgetId: string): void {
    this.ui.selectWidget(widgetId);
  }

  clearSelection(): void {
    this.ui.clearSelection();
  }

  remove(id: string): void {
    this.ui.remove(id, this.boardReady());
  }

  selectedLayerPosition(board: { widgets: WidgetModel[] }, widgetId: string): number {
    const index = board.widgets.findIndex((widget) => widget.id === widgetId);
    return index + 1;
  }

  openWidgetContextMenu(widgetId: string, event: MouseEvent): void {
    this.ui.openContextMenu(widgetId, event, this.boardReady());
  }

  closeContextMenu(event?: MouseEvent): void {
    this.ui.closeContextMenu(event);
  }

  openWidgetContextMenuFromLayer(event: LayerListContextMenuEvent): void {
    this.openWidgetContextMenu(event.widgetId, event.event);
  }

  onLayerReorder(event: LayerReorderEvent): void {
    this.ui.onLayerReorder(event, this.boardReady());
  }

  onWidgetContextMenu(event: WidgetMouseEvent): void {
    this.openWidgetContextMenu(event.widgetId, event.event);
  }

  onWidgetTextChange(event: WidgetTextChangeEvent): void {
    this.ui.onWidgetTextChange(event, this.boardReady());
  }

  onContextMenuAction(event: ContextMenuActionEvent): void {
    this.ui.onContextMenuAction(event, this.boardReady());
  }

  onStartDragRequest(event: WidgetMouseEvent, widgets: WidgetModel[]): void {
    this.ui.onStartDragRequest(event, widgets, this.boardReady());
  }

  onStartResizeRequest(event: WidgetResizeEvent): void {
    this.ui.onStartResizeRequest(event, this.boardReady());
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.ui.onPointerMove(event, this.zoom);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.ui.onPointerUp();
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

}
