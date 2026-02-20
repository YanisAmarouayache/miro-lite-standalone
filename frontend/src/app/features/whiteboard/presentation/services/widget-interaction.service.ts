import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WidgetModel } from '../../domain/board.model';
import { ResizeDirection, WidgetFrame } from '../components/widget-canvas/widget-canvas.component';

interface InteractionState {
  widgetId: string;
  mode: 'drag' | 'resize';
  direction?: ResizeDirection;
  startMouseX: number;
  startMouseY: number;
  startFrame: WidgetFrame;
}

@Injectable()
export class WidgetInteractionService {
  private interaction?: InteractionState;
  private _frameOverrides: ReadonlyMap<string, WidgetFrame> = new Map();
  private readonly selectedWidgetIdSubject = new BehaviorSubject<string | null>(null);

  get frameOverrides(): ReadonlyMap<string, WidgetFrame> {
    return this._frameOverrides;
  }

  readonly selectedWidgetId$ = this.selectedWidgetIdSubject.asObservable();

  setSelectedWidgetId(widgetId: string | null): void {
    this.selectedWidgetIdSubject.next(widgetId);
  }

  clearAll(): void {
    this.interaction = undefined;
    this._frameOverrides = new Map();
    this.selectedWidgetIdSubject.next(null);
  }

  clearWidget(widgetId: string): void {
    if (this.interaction?.widgetId === widgetId) {
      this.interaction = undefined;
    }
    if (!this._frameOverrides.has(widgetId)) return;
    const next = new Map(this._frameOverrides);
    next.delete(widgetId);
    this._frameOverrides = next;
  }

  startDrag(widget: WidgetModel, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.interaction = {
      widgetId: widget.id,
      mode: 'drag',
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startFrame: this.frame(widget)
    };
  }

  startResize(widget: WidgetModel, direction: ResizeDirection, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.interaction = {
      widgetId: widget.id,
      mode: 'resize',
      direction,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startFrame: this.frame(widget)
    };
  }

  onPointerMove(event: MouseEvent, zoom: number): void {
    if (!this.interaction) return;
    const safeZoom = zoom || 1;
    const dx = (event.clientX - this.interaction.startMouseX) / safeZoom;
    const dy = (event.clientY - this.interaction.startMouseY) / safeZoom;
    const { startFrame } = this.interaction;

    if (this.interaction.mode === 'drag') {
      this.setOverride(this.interaction.widgetId, {
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
      nextWidth = Math.max(0, startFrame.width + dx);
    }
    if (direction.includes('s')) {
      nextHeight = Math.max(0, startFrame.height + dy);
    }
    if (direction.includes('w')) {
      nextWidth = Math.max(0, startFrame.width - dx);
      nextX = startFrame.x + (startFrame.width - nextWidth);
    }
    if (direction.includes('n')) {
      nextHeight = Math.max(0, startFrame.height - dy);
      nextY = startFrame.y + (startFrame.height - nextHeight);
    }

    this.setOverride(this.interaction.widgetId, {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight
    });
  }

  onPointerUp(): { widgetId: string; frame: WidgetFrame } | null {
    if (!this.interaction) return null;
    const widgetId = this.interaction.widgetId;
    const frame = this._frameOverrides.get(widgetId) ?? this.interaction.startFrame;
    const next = new Map(this._frameOverrides);
    next.delete(widgetId);
    this._frameOverrides = next;
    this.interaction = undefined;
    return { widgetId, frame };
  }

  private frame(widget: WidgetModel): WidgetFrame {
    return this._frameOverrides.get(widget.id) ?? widget;
  }

  private setOverride(widgetId: string, frame: WidgetFrame): void {
    const next = new Map(this._frameOverrides);
    next.set(widgetId, frame);
    this._frameOverrides = next;
  }
}
