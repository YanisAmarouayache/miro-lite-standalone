import { Injectable } from '@angular/core';
import { getDefaultWidgetConfig } from "../domain/board.model";
import { WidgetDefinition } from '../domain/widget-definition.model';
import { WidgetCatalogPort } from "../domain/ports/widget-catalog.port";

@Injectable()
export class WidgetCatalogRepository implements WidgetCatalogPort {
  private readonly definitions: WidgetDefinition[] = [
    {
      id: 'chart-data-bar',
      type: 'chart',
      name: 'Data bar',
      defaultConfig: { ...getDefaultWidgetConfig("chart"), chartType: "bar" },
      defaultWidth: 320,
      defaultHeight: 240
    },
    {
      id: 'chart-pie',
      type: 'chart',
      name: 'Pie',
      defaultConfig: { ...getDefaultWidgetConfig("chart"), chartType: "pie" },
      defaultWidth: 320,
      defaultHeight: 240
    },
    {
      id: 'chart-doughnut',
      type: 'chart',
      name: 'Doughnut',
      defaultConfig: { ...getDefaultWidgetConfig("chart"), chartType: "doughnut" },
      defaultWidth: 320,
      defaultHeight: 240
    },
    {
      id: 'chart-line',
      type: 'chart',
      name: 'Line',
      defaultConfig: { ...getDefaultWidgetConfig("chart"), chartType: "line" },
      defaultWidth: 320,
      defaultHeight: 240
    },
    {
      id: 'table',
      type: 'table',
      name: 'Table',
      defaultConfig: getDefaultWidgetConfig("table"),
      defaultWidth: 360,
      defaultHeight: 220
    },
    {
      id: 'image',
      type: 'image',
      name: 'Image',
      defaultConfig: getDefaultWidgetConfig("image"),
      defaultWidth: 300,
      defaultHeight: 220
    },
    {
      id: 'text-yellow-box',
      type: 'text',
      name: 'Yellow Box',
      defaultConfig: getDefaultWidgetConfig("text"),
      defaultWidth: 240,
      defaultHeight: 160
    },
    {
      id: 'text-free-text',
      type: 'textarea',
      name: 'Free text',
      defaultConfig: getDefaultWidgetConfig("textarea"),
      defaultWidth: 320,
      defaultHeight: 200
    }
  ];

  list(): WidgetDefinition[] {
    return [...this.definitions];
  }

  get(id: string): WidgetDefinition | undefined {
    return this.definitions.find((definition) => definition.id === id);
  }
}
