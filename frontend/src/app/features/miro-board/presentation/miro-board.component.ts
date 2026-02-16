import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
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

@Component({
  selector: 'miro-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [MiroBoardFacade],
  templateUrl: './miro-board.component.html',
  styleUrl: './miro-board.component.css'
})
export class MiroBoardComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) boardId!: string;
  private readonly facade = inject(MiroBoardFacade);
  readonly board$ = this.facade.board$;
  readonly availableWidgets = this.facade.availableWidgets;
  readonly chartTypes = ['pie', 'doughnut', 'bar', 'line'];
  private readonly frameOverrides = new Map<string, WidgetFrame>();
  private interaction?: InteractionState;
  private selectedWidgetId: string | null = null;
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
    if (this.selectedWidgetId === id) {
      this.selectedWidgetId = null;
    }
    this.frameOverrides.delete(id);
    if (this.interaction?.widgetId === id) {
      this.interaction = undefined;
    }
  }

  trackByWidgetId(_: number, widget: WidgetModel): string {
    return widget.id;
  }

  frame(widget: WidgetModel): WidgetFrame {
    return this.frameOverrides.get(widget.id) ?? widget;
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

    const dx = event.clientX - this.interaction.startMouseX;
    const dy = event.clientY - this.interaction.startMouseY;
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

  ngOnDestroy(): void {
    this.facade.destroy();
  }
}
