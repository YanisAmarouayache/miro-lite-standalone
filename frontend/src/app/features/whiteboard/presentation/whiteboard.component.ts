import { CommonModule, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { WhiteboardFacade } from '../application/whiteboard.facade';
import { WidgetModel } from '../domain/board.model';
import {
  LayerListComponent,
} from './components/layer-list/layer-list.component';
import { WidgetContextMenuComponent } from './components/widget-context-menu/widget-context-menu.component';
import { WidgetConfigPanelComponent } from './components/widget-config-panel/widget-config-panel.component';
import { WidgetCanvasComponent } from './components/widget-canvas/widget-canvas.component';
import { WidgetInteractionService } from './services/widget-interaction.service';
import { WhiteboardZoomService } from './services/whiteboard-zoom.service';
import { WidgetContextMenuService } from './services/widget-context-menu.service';
import { WhiteboardUiService } from './services/whiteboard-ui.service';
import { ContextMenuState } from "./models/widget-context-menu.model";

@Component({
    selector: 'whiteboard',
    imports: [CommonModule, LayerListComponent, WidgetConfigPanelComponent, WidgetContextMenuComponent, WidgetCanvasComponent],
    providers: [WhiteboardFacade, WidgetInteractionService, WhiteboardZoomService, WidgetContextMenuService, WhiteboardUiService],
    templateUrl: './whiteboard.component.html',
    styleUrl: './whiteboard.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhiteboardComponent implements OnChanges, OnDestroy {
  @ViewChild('canvasRef') private canvasRef?: WidgetCanvasComponent;
  @Input({ required: true }) boardId!: string;
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly facade = inject(WhiteboardFacade);
  private readonly interaction = inject(WidgetInteractionService);
  private readonly zoomState = inject(WhiteboardZoomService);
  private readonly contextMenuState = inject(WidgetContextMenuService);
  readonly ui = inject(WhiteboardUiService);
  readonly loadError$ = this.facade.loadError$;
  readonly saveError$ = this.facade.saveError$;
  readonly viewModel$ = combineLatest([
    this.facade.board$,
    this.facade.boardReady$,
    this.interaction.selectedWidgetId$,
  ]).pipe(
    map(([board, editable, selectedWidgetId]) => ({
      board,
      editable,
      selectedWidget:
        selectedWidgetId
          ? board.widgets.find((widget) => widget.id === selectedWidgetId)
          : undefined,
    }))
  );
  readonly availableWidgets = this.facade.availableWidgets;
  readonly chartTypes = ['pie', 'doughnut', 'bar', 'line'];
  fullscreen = false;
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

  selectedLayerPosition(widgets: WidgetModel[], widgetId: string): number {
    const index = widgets.findIndex((widget) => widget.id === widgetId);
    return index + 1;
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
    if (this.fullscreen) {
      this.exitFullscreen();
      return;
    }
    this.contextMenuState.close();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.contextMenuState.close();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.fullscreen = !!this.document.fullscreenElement;
  }

  toggleFullscreen(): void {
    if (this.fullscreen) {
      this.exitFullscreen();
      return;
    }
    const target = this.hostRef.nativeElement;
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {
        // no-op
      });
    }
  }

  private exitFullscreen(): void {
    if (this.document.fullscreenElement && this.document.exitFullscreen) {
      this.document.exitFullscreen().catch(() => {
        // no-op
      });
    }
  }

  ngOnDestroy(): void {
    this.zoomState.destroy();
    this.facade.destroy();
  }

}
