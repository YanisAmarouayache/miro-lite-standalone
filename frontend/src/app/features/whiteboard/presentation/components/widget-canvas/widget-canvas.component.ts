import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CapaOpsDoughnutSnapshot } from "../../../domain/capaops.model";
import { WidgetModel } from "../../../domain/board.model";
import {
  getChartType,
  getCounterLabel,
  getCounterValue,
  getImageAlt,
  getImageSrc,
  getWidgetText,
  isChartWidget,
} from "../../../domain/widget-selectors";
import { CapaopsDoughnutComponent } from "../capaops-doughnut/capaops-doughnut.component";
import {
  ResizeDirection,
  WidgetDropEvent,
  WidgetFrame,
  WidgetMouseEvent,
  WidgetResizeEvent,
  WidgetTextChangeEvent,
  WIDGET_TYPE_DRAG_MIME,
} from "../../models/widget-interaction.model";

@Component({
  selector: "app-widget-canvas",
  standalone: true,
  imports: [CommonModule, FormsModule, CapaopsDoughnutComponent],
  templateUrl: "./widget-canvas.component.html",
  styleUrl: "./widget-canvas.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCanvasComponent implements OnChanges {
  private pendingEditableDrag?: {
    widgetId: string;
    startX: number;
    startY: number;
  };
  private readonly dragThreshold = 6;
  private readonly inlineTextDrafts = new Map<string, string>();

  @ViewChild("canvasRoot") private canvasRoot?: ElementRef<HTMLDivElement>;
  @Input({ required: true }) widgets: WidgetModel[] = [];
  @Input() chartSnapshots: ReadonlyMap<string, CapaOpsDoughnutSnapshot> =
    new Map();
  @Input({ required: true }) frameOverrides: ReadonlyMap<string, WidgetFrame> =
    new Map();
  @Input() selectedWidgetId: string | null = null;
  @Input() zoom = 1;
  @Input() editable = true;
  @Input() zoomIndicatorVisible = false;
  @Input() zoomIndicatorX = 0;
  @Input() zoomIndicatorY = 0;

  @Output() canvasClick = new EventEmitter<void>();
  @Output() canvasWheel = new EventEmitter<WheelEvent>();
  @Output() canvasContextMenu = new EventEmitter<MouseEvent>();
  @Output() selectWidget = new EventEmitter<string>();
  @Output() openWidgetContextMenu = new EventEmitter<WidgetMouseEvent>();
  @Output() startDrag = new EventEmitter<WidgetMouseEvent>();
  @Output() startResize = new EventEmitter<WidgetResizeEvent>();
  @Output() updateText = new EventEmitter<WidgetTextChangeEvent>();
  @Output() widgetDrop = new EventEmitter<WidgetDropEvent>();

  trackByWidgetId(_: number, widget: WidgetModel): string {
    return widget.id;
  }

  isSelected(widgetId: string): boolean {
    return this.selectedWidgetId === widgetId;
  }

  frame(widget: WidgetModel): WidgetFrame {
    return this.frameOverrides.get(widget.id) ?? widget;
  }

  surfaceWidth(): number {
    const maxX = this.widgets.reduce((acc, widget) => {
      const frame = this.frame(widget);
      return Math.max(acc, frame.x + frame.width);
    }, 0);
    return Math.max(2200, maxX + 400);
  }

  surfaceHeight(): number {
    const maxY = this.widgets.reduce((acc, widget) => {
      const frame = this.frame(widget);
      return Math.max(acc, frame.y + frame.height);
    }, 0);
    return Math.max(1400, maxY + 300);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes["widgets"]) {
      return;
    }
    const existingIDs = new Set(this.widgets.map((widget) => widget.id));
    for (const widgetID of this.inlineTextDrafts.keys()) {
      if (existingIDs.has(widgetID)) {
        continue;
      }
      this.inlineTextDrafts.delete(widgetID);
    }
  }

  textValue(widget: WidgetModel): string {
    const draft = this.inlineTextDrafts.get(widget.id);
    if (draft !== undefined) {
      return draft;
    }
    return getWidgetText(widget);
  }

  onInlineTextChange(widgetId: string, value: string): void {
    this.inlineTextDrafts.set(widgetId, value);
  }

  onInlineTextBlur(widget: WidgetModel): void {
    const widgetID = widget.id;
    const draft = this.inlineTextDrafts.get(widgetID);
    if (draft === undefined) {
      return;
    }
    const current = getWidgetText(widget);
    if (draft !== current) {
      this.updateText.emit({ widgetId: widgetID, text: draft });
    }
  }

  chartType(widget: WidgetModel): string {
    return getChartType(widget);
  }

  isDoughnut(widget: WidgetModel): boolean {
    return isChartWidget(widget) && this.chartType(widget) === "doughnut";
  }

  hasDoughnutData(widget: WidgetModel): boolean {
    return this.isDoughnut(widget) && this.chartSnapshots.has(widget.id);
  }

  doughnutData(widget: WidgetModel): CapaOpsDoughnutSnapshot | null {
    return this.chartSnapshots.get(widget.id) ?? null;
  }

  imageSrc(widget: WidgetModel): string {
    return getImageSrc(widget);
  }

  imageAlt(widget: WidgetModel): string {
    return getImageAlt(widget);
  }

  counterValue(widget: WidgetModel): number {
    return getCounterValue(widget);
  }

  counterLabel(widget: WidgetModel): string {
    return getCounterLabel(widget);
  }

  onWidgetContextMenu(widgetId: string, event: MouseEvent): void {
    if (!this.editable) return;
    this.openWidgetContextMenu.emit({ widgetId, event });
  }

  requestDrag(widgetId: string, event: MouseEvent): void {
    if (!this.editable) return;
    if (event.button !== 0) return;
    if (!this.isSelected(widgetId)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".resize-handle")) return;
    if (
      target?.closest(
        'textarea, input, select, button, [contenteditable="true"]'
      )
    )
      return;
    this.startDrag.emit({ widgetId, event });
  }

  onEditableMouseDown(widgetId: string, event: MouseEvent): void {
    if (!this.editable) return;
    if (event.button !== 0) return;
    if (!this.isSelected(widgetId)) return;
    this.pendingEditableDrag = {
      widgetId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  @HostListener("document:mousemove", ["$event"])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.editable) return;
    if (!this.pendingEditableDrag) return;
    if ((event.buttons & 1) === 0) {
      this.pendingEditableDrag = undefined;
      return;
    }
    const dx = event.clientX - this.pendingEditableDrag.startX;
    const dy = event.clientY - this.pendingEditableDrag.startY;
    const distance = Math.hypot(dx, dy);
    if (distance < this.dragThreshold) return;

    window.getSelection()?.removeAllRanges();
    this.startDrag.emit({ widgetId: this.pendingEditableDrag.widgetId, event });
    this.pendingEditableDrag = undefined;
  }

  @HostListener("document:mouseup")
  onDocumentMouseUp(): void {
    this.pendingEditableDrag = undefined;
  }

  requestResize(
    widget: WidgetModel,
    direction: ResizeDirection,
    event: MouseEvent
  ): void {
    if (!this.editable) return;
    this.startResize.emit({ widget, direction, event });
  }

  onCanvasDragOver(event: DragEvent): void {
    if (!this.editable) return;
    if (!this.canAcceptWidgetDrop(event)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  onCanvasDrop(event: DragEvent): void {
    if (!this.editable) return;
    const widgetType = this.getDroppedWidgetType(event);
    if (!widgetType) return;
    event.preventDefault();
    this.widgetDrop.emit({
      widgetType,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  getCanvasElement(): HTMLDivElement | undefined {
    return this.canvasRoot?.nativeElement;
  }

  private getDroppedWidgetType(event: DragEvent): string | null {
    const dt = event.dataTransfer;
    if (!dt) return null;
    const typeFromMime = dt.getData(WIDGET_TYPE_DRAG_MIME);
    if (typeFromMime) return typeFromMime;
    const typeFromText = dt.getData("text/plain");
    return typeFromText || null;
  }

  private canAcceptWidgetDrop(event: DragEvent): boolean {
    const dt = event.dataTransfer;
    if (!dt) return false;
    const types = Array.from(dt.types ?? []);
    return (
      types.includes(WIDGET_TYPE_DRAG_MIME) || types.includes("text/plain")
    );
  }
}
