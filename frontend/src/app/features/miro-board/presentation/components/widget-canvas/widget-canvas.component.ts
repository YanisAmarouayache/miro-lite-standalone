import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WidgetModel } from '../../../domain/board.model';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface WidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetMouseEvent {
  widgetId: string;
  event: MouseEvent;
}

export interface WidgetResizeEvent {
  widget: WidgetModel;
  direction: ResizeDirection;
  event: MouseEvent;
}

export interface WidgetTextChangeEvent {
  widgetId: string;
  text: string;
}

@Component({
    selector: 'app-widget-canvas',
    imports: [CommonModule, FormsModule],
    templateUrl: './widget-canvas.component.html',
    styleUrl: './widget-canvas.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetCanvasComponent {
  private pendingEditableDrag?: { widgetId: string; startX: number; startY: number };
  private readonly dragThreshold = 6;

  @ViewChild('canvasRoot') private canvasRoot?: ElementRef<HTMLDivElement>;
  @Input({ required: true }) widgets: WidgetModel[] = [];
  @Input({ required: true }) frameOverrides: ReadonlyMap<string, WidgetFrame> = new Map();
  @Input() selectedWidgetId: string | null = null;
  @Input() zoom = 1;
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

  textValue(widget: WidgetModel): string {
    const value = widget.config?.['text'];
    return typeof value === 'string' ? value : '';
  }

  chartType(widget: WidgetModel): string {
    const value = widget.config?.['chartType'];
    return typeof value === 'string' ? value : 'pie';
  }

  imageSrc(widget: WidgetModel): string {
    const value = widget.config?.['src'];
    return typeof value === 'string' ? value : '';
  }

  imageAlt(widget: WidgetModel): string {
    const value = widget.config?.['alt'];
    return typeof value === 'string' ? value : 'Imported image';
  }

  counterValue(widget: WidgetModel): number {
    const value = widget.config?.['value'];
    return typeof value === 'number' ? value : 0;
  }

  counterLabel(widget: WidgetModel): string {
    const value = widget.config?.['label'];
    return typeof value === 'string' ? value : 'Metric';
  }

  onWidgetContextMenu(widgetId: string, event: MouseEvent): void {
    this.openWidgetContextMenu.emit({ widgetId, event });
  }

  requestDrag(widgetId: string, event: MouseEvent): void {
    if (event.button !== 0) return;
    if (!this.isSelected(widgetId)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.resize-handle')) return;
    if (target?.closest('textarea, input, select, button, [contenteditable="true"]')) return;
    this.startDrag.emit({ widgetId, event });
  }

  onEditableMouseDown(widgetId: string, event: MouseEvent): void {
    if (event.button !== 0) return;
    if (!this.isSelected(widgetId)) return;
    this.pendingEditableDrag = {
      widgetId,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
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

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.pendingEditableDrag = undefined;
  }

  getCanvasElement(): HTMLDivElement | undefined {
    return this.canvasRoot?.nativeElement;
  }
}
