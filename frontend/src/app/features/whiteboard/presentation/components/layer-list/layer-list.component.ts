import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WidgetModel } from '../../../domain/board.model';
import { WidgetDefinition } from '../../../domain/widget-definition.model';

export interface LayerListContextMenuEvent {
  widgetId: string;
  event: MouseEvent;
}

export interface LayerReorderEvent {
  sourceWidgetId: string;
  targetWidgetId: string;
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
  draggingWidgetId: string | null = null;
  dropTargetWidgetId: string | null = null;

  @Output() selectWidget = new EventEmitter<string>();
  @Output() openContextMenu = new EventEmitter<LayerListContextMenuEvent>();
  @Output() reorderLayer = new EventEmitter<LayerReorderEvent>();

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

  onDragStart(widgetId: string, event: DragEvent): void {
    this.draggingWidgetId = widgetId;
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widgetId);
  }

  onDragOver(widgetId: string, event: DragEvent): void {
    if (!this.draggingWidgetId || this.draggingWidgetId === widgetId) return;
    event.preventDefault();
    this.dropTargetWidgetId = widgetId;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragEnter(widgetId: string, event: DragEvent): void {
    if (!this.draggingWidgetId || this.draggingWidgetId === widgetId) return;
    event.preventDefault();
    this.dropTargetWidgetId = widgetId;
  }

  onDrop(targetWidgetId: string, event: DragEvent): void {
    event.preventDefault();
    const sourceWidgetId = this.draggingWidgetId || event.dataTransfer?.getData('text/plain') || null;
    this.draggingWidgetId = null;
    this.dropTargetWidgetId = null;
    if (!sourceWidgetId || sourceWidgetId === targetWidgetId) return;
    this.reorderLayer.emit({ sourceWidgetId, targetWidgetId });
  }

  onDragEnd(): void {
    this.draggingWidgetId = null;
    this.dropTargetWidgetId = null;
  }
}
