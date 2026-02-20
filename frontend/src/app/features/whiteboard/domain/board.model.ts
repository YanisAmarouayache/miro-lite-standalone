export type WidgetType = 'chart' | 'table' | 'counter' | 'text' | 'image' | 'textarea';

export interface WidgetModel {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
}

export interface BoardModel {
  id: string;
  version: number;
  widgets: WidgetModel[];
}
