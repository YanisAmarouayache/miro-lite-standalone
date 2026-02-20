import { Injectable } from '@angular/core';
import { getDefaultWidgetConfig } from "../domain/board.model";
import { WidgetDefinition } from '../domain/widget-definition.model';
import { WidgetCatalogPort } from "../domain/ports/widget-catalog.port";

@Injectable()
export class WidgetCatalogRepository implements WidgetCatalogPort {
  private readonly definitions: WidgetDefinition[] = [
    {
      type: 'chart',
      name: 'Chart',
      defaultConfig: getDefaultWidgetConfig("chart"),
      defaultWidth: 320,
      defaultHeight: 240
    },
    {
      type: 'table',
      name: 'Table',
      defaultConfig: getDefaultWidgetConfig("table"),
      defaultWidth: 360,
      defaultHeight: 220
    },
    {
      type: 'counter',
      name: 'Counter',
      defaultConfig: getDefaultWidgetConfig("counter"),
      defaultWidth: 220,
      defaultHeight: 140
    },
    {
      type: 'text',
      name: 'Yellow Box',
      defaultConfig: getDefaultWidgetConfig("text"),
      defaultWidth: 240,
      defaultHeight: 160
    },
    {
      type: 'image',
      name: 'Image',
      defaultConfig: getDefaultWidgetConfig("image"),
      defaultWidth: 300,
      defaultHeight: 220
    },
    {
      type: 'textarea',
      name: 'Textarea',
      defaultConfig: getDefaultWidgetConfig("textarea"),
      defaultWidth: 320,
      defaultHeight: 200
    }
  ];

  list(): WidgetDefinition[] {
    return [...this.definitions];
  }

  get(type: string): WidgetDefinition | undefined {
    return this.definitions.find((definition) => definition.type === type);
  }
}
