import { InjectionToken } from "@angular/core";
import { WidgetDefinition } from "../widget-definition.model";

export interface WidgetCatalogPort {
  list(): WidgetDefinition[];
  get(type: string): WidgetDefinition | undefined;
}

export const WIDGET_CATALOG = new InjectionToken<WidgetCatalogPort>(
  "WIDGET_CATALOG"
);
