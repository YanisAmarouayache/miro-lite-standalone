import { WidgetConfig, WidgetType } from './board.model';

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  defaultConfig: WidgetConfig;
  defaultWidth: number;
  defaultHeight: number;
}
