import { Injectable } from '@angular/core';
import { WidgetDefinition } from '../domain/widget-definition.model';
import { WidgetCatalogPort } from "../domain/ports/widget-catalog.port";

@Injectable()
export class WidgetCatalogRepository implements WidgetCatalogPort {
  private readonly definitions: WidgetDefinition[] = [
    {
      type: 'chart',
      name: 'Chart',
      defaultConfig: { chartType: 'pie' },
      defaultWidth: 320,
      defaultHeight: 240
    },
    {
      type: 'table',
      name: 'Table',
      defaultConfig: { rows: [] },
      defaultWidth: 360,
      defaultHeight: 220
    },
    {
      type: 'counter',
      name: 'Counter',
      defaultConfig: { value: 0, label: 'Metric' },
      defaultWidth: 220,
      defaultHeight: 140
    },
    {
      type: 'text',
      name: 'Yellow Box',
      defaultConfig: { text: 'Yellow box' },
      defaultWidth: 240,
      defaultHeight: 160
    },
    {
      type: 'image',
      name: 'Image',
      defaultConfig: { src: '', alt: 'Imported image' },
      defaultWidth: 300,
      defaultHeight: 220
    },
    {
      type: 'textarea',
      name: 'Textarea',
      defaultConfig: { text: '' },
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
