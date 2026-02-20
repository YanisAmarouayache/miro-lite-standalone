import { Injectable } from "@angular/core";
import { WhiteboardFacade } from "../../application/whiteboard.facade";
import { WidgetModel } from "../../domain/board.model";
import {
  ResizeDirection,
  WidgetDropEvent,
  WidgetMouseEvent,
  WidgetResizeEvent,
  WidgetTextChangeEvent,
  WIDGET_TYPE_DRAG_MIME,
} from "../models/widget-interaction.model";
import {
  ContextMenuActionEvent,
} from "../models/widget-context-menu.model";
import { LayerReorderEvent } from "../models/layer-list.model";
import { WidgetInteractionService } from "./widget-interaction.service";
import { WidgetContextMenuService } from "./widget-context-menu.service";

@Injectable()
export class WhiteboardUiService {
  constructor(
    private readonly facade: WhiteboardFacade,
    private readonly interaction: WidgetInteractionService,
    private readonly contextMenu: WidgetContextMenuService
  ) {}

  onWidgetButtonDragStart(type: string, event: DragEvent, editable: boolean): void {
    if (!editable) {
      event.preventDefault();
      return;
    }
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(WIDGET_TYPE_DRAG_MIME, type);
    event.dataTransfer.setData("text/plain", type);
  }

  onWidgetDrop(
    event: WidgetDropEvent,
    canvas: HTMLElement | undefined,
    zoom: number,
    editable: boolean
  ): void {
    if (!editable || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const safeZoom = zoom || 1;
    const x = (canvas.scrollLeft + event.clientX - rect.left) / safeZoom;
    const y = (canvas.scrollTop + event.clientY - rect.top) / safeZoom;
    this.facade.addWidgetAt(event.widgetType, x, y);
  }

  selectWidget(widgetId: string): void {
    this.interaction.setSelectedWidgetId(widgetId);
    this.contextMenu.close();
  }

  clearSelection(): void {
    this.interaction.setSelectedWidgetId(null);
    this.contextMenu.close();
  }

  remove(widgetId: string, editable: boolean): void {
    if (!editable) return;
    this.facade.remove(widgetId);
    if (this.interaction.selectedWidgetId === widgetId) {
      this.interaction.setSelectedWidgetId(null);
    }
    this.interaction.clearWidget(widgetId);
    this.contextMenu.close();
  }

  openContextMenu(widgetId: string, event: MouseEvent, editable: boolean): void {
    if (!editable) return;
    this.selectWidget(widgetId);
    this.contextMenu.open(widgetId, event);
  }

  closeContextMenu(event?: MouseEvent): void {
    this.contextMenu.close(event);
  }

  onLayerReorder(event: LayerReorderEvent, editable: boolean): void {
    if (!editable) return;
    this.facade.moveWidgetAbove(event.sourceWidgetId, event.targetWidgetId);
    this.selectWidget(event.sourceWidgetId);
  }

  onContextMenuAction(event: ContextMenuActionEvent, editable: boolean): void {
    if (!editable) return;
    switch (event.action) {
      case "bring_to_front":
        this.facade.bringToFront(event.widgetId);
        break;
      case "bring_forward":
        this.facade.bringForward(event.widgetId);
        break;
      case "send_backward":
        this.facade.sendBackward(event.widgetId);
        break;
      case "send_to_back":
        this.facade.sendToBack(event.widgetId);
        break;
      case "remove":
        this.remove(event.widgetId, editable);
        break;
    }
    this.contextMenu.close();
  }

  onWidgetTextChange(event: WidgetTextChangeEvent, editable: boolean): void {
    if (!editable) return;
    this.facade.updateWidgetText(event.widgetId, event.text);
  }

  updateChartType(widgetId: string, chartType: string, editable: boolean): void {
    if (!editable) return;
    this.facade.updateChartType(widgetId, chartType);
  }

  updateCounterValue(widgetId: string, value: string, editable: boolean): void {
    if (!editable) return;
    this.facade.updateCounterValue(widgetId, value);
  }

  updateCounterLabel(widgetId: string, label: string, editable: boolean): void {
    if (!editable) return;
    this.facade.updateCounterLabel(widgetId, label);
  }

  updateImageFromFile(widgetId: string, file: File, editable: boolean): void {
    if (!editable) return;
    this.facade.updateImageFromFile(widgetId, file);
  }

  startDrag(widget: WidgetModel, event: MouseEvent, editable: boolean): void {
    if (!editable) return;
    this.interaction.setSelectedWidgetId(widget.id);
    this.interaction.startDrag(widget, event);
  }

  onStartDragRequest(
    event: WidgetMouseEvent,
    widgets: WidgetModel[],
    editable: boolean
  ): void {
    const widget = widgets.find((item) => item.id === event.widgetId);
    if (!widget) return;
    this.startDrag(widget, event.event, editable);
  }

  onStartResizeRequest(event: WidgetResizeEvent, editable: boolean): void {
    if (!editable) return;
    this.startResize(event.widget, event.direction, event.event, editable);
  }

  startResize(
    widget: WidgetModel,
    direction: ResizeDirection,
    event: MouseEvent,
    editable: boolean
  ): void {
    if (!editable) return;
    this.interaction.setSelectedWidgetId(widget.id);
    this.interaction.startResize(widget, direction, event);
  }

  onPointerMove(event: MouseEvent, zoom: number): void {
    this.interaction.onPointerMove(event, zoom);
  }

  onPointerUp(): void {
    const commit = this.interaction.onPointerUp();
    if (!commit) return;
    this.facade.setWidgetFrame(
      commit.widgetId,
      commit.frame.x,
      commit.frame.y,
      commit.frame.width,
      commit.frame.height
    );
  }
}
