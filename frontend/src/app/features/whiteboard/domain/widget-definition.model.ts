import { WidgetConfig, WidgetType } from './board.model';

export interface WidgetDefinition {
  id: string;
  type: WidgetType;
  name: string;
  defaultConfig: WidgetConfig;
  defaultWidth: number;
  defaultHeight: number;
}
