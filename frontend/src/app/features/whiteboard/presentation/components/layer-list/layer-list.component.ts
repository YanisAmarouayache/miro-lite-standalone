import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WidgetModel } from '../../../domain/board.model';
import { WidgetDefinition } from '../../../domain/widget-definition.model';

export interface LayerListContextMenuEvent {
  widgetId: string;
  event: MouseEvent;
}

@Component({
    selector: 'app-layer-list',
    imports: [CommonModule],
    templateUrl: './layer-list.component.html',
    styleUrl: './layer-list.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayerListComponent {
  @Input({ required: true }) widgets: WidgetModel[] = [];
  @Input() selectedWidgetId: string | null = null;
  @Input() definitions: WidgetDefinition[] = [];

  @Output() selectWidget = new EventEmitter<string>();
  @Output() openContextMenu = new EventEmitter<LayerListContextMenuEvent>();

  orderedWidgets(): WidgetModel[] {
    return [...this.widgets].reverse();
  }

  isSelected(widgetId: string): boolean {
    return this.selectedWidgetId === widgetId;
  }

  shortId(widgetId: string): string {
    return widgetId.slice(0, 6);
  }

  trackByWidgetId(_: number, widget: WidgetModel): string {
    return widget.id;
  }

  layerNumber(widgetId: string): number {
    const index = this.widgets.findIndex((widget) => widget.id === widgetId);
    return index + 1;
  }

  widgetName(type: string): string {
    const definition = this.definitions.find((item) => item.type === type);
    return definition?.name ?? type;
  }

  onContextMenu(widgetId: string, event: MouseEvent): void {
    this.openContextMenu.emit({ widgetId, event });
  }
}
