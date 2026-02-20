import { WidgetModel } from "../../domain/board.model";

export const WIDGET_TYPE_DRAG_MIME = "application/x-whiteboard-widget-type";

export type ResizeDirection =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

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

export interface WidgetDropEvent {
  widgetType: string;
  clientX: number;
  clientY: number;
}
