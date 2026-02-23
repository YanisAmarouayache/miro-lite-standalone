import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { WidgetModel } from '../../../domain/board.model';
import { WidgetDefinition } from '../../../domain/widget-definition.model';
import {
  LayerListContextMenuEvent,
  LayerReorderEvent,
} from "../../models/layer-list.model";

@Component({
    selector: 'app-layer-list',
    imports: [CommonModule],
    templateUrl: './layer-list.component.html',
    styleUrl: './layer-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayerListComponent implements OnChanges {
  @Input({ required: true }) widgets: WidgetModel[] = [];
  @Input() selectedWidgetId: string | null = null;
  @Input() definitions: WidgetDefinition[] = [];
  draggingWidgetId: string | null = null;
  dropTargetWidgetId: string | null = null;
  orderedWidgets: WidgetModel[] = [];
  private layerNumberById = new Map<string, number>();
  private widgetNameByType = new Map<string, string>();

  @Output() selectWidget = new EventEmitter<string>();
  @Output() openContextMenu = new EventEmitter<LayerListContextMenuEvent>();
  @Output() reorderLayer = new EventEmitter<LayerReorderEvent>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widgets']) {
      this.orderedWidgets = [...this.widgets].reverse();
      this.layerNumberById.clear();
      for (let i = 0; i < this.widgets.length; i += 1) {
        this.layerNumberById.set(this.widgets[i].id, i + 1);
      }
    }
    if (changes['definitions']) {
      this.widgetNameByType.clear();
      for (const definition of this.definitions) {
        this.widgetNameByType.set(definition.type, definition.name);
      }
    }
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
    return this.layerNumberById.get(widgetId) ?? 0;
  }

  widgetName(type: string): string {
    return this.widgetNameByType.get(type) ?? type;
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
