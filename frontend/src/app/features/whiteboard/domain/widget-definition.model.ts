import { WidgetType } from './board.model';

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  defaultConfig: Record<string, unknown>;
  defaultWidth: number;
  defaultHeight: number;
}

