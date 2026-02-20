import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WidgetModel } from '../../../domain/board.model';
import { WidgetDefinition } from '../../../domain/widget-definition.model';

export type WidgetPanelAction = 'send_to_back' | 'send_backward' | 'bring_forward' | 'bring_to_front' | 'remove';

@Component({
    selector: 'app-widget-config-panel',
    imports: [CommonModule, FormsModule],
    templateUrl: './widget-config-panel.component.html',
    styleUrl: './widget-config-panel.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetConfigPanelComponent {
  @Input({ required: true }) selectedWidget?: WidgetModel;
  @Input({ required: true }) widgetCount = 0;
  @Input({ required: true }) layerPosition = 0;
  @Input() chartTypes: string[] = [];
  @Input() definitions: WidgetDefinition[] = [];
  @Input() editable = true;

  @Output() action = new EventEmitter<WidgetPanelAction>();
  @Output() updateText = new EventEmitter<string>();
  @Output() updateChartType = new EventEmitter<string>();
  @Output() updateCounterLabel = new EventEmitter<string>();
  @Output() updateCounterValue = new EventEmitter<string>();
  @Output() imageSelected = new EventEmitter<File>();

  widgetName(type: string): string {
    const definition = this.definitions.find((item) => item.type === type);
    return definition?.name ?? type;
  }

  textValue(widget: WidgetModel): string {
    const value = widget.config?.['text'];
    return typeof value === 'string' ? value : '';
  }

  chartType(widget: WidgetModel): string {
    const value = widget.config?.['chartType'];
    return typeof value === 'string' ? value : 'pie';
  }

  counterLabel(widget: WidgetModel): string {
    const value = widget.config?.['label'];
    return typeof value === 'string' ? value : 'Metric';
  }

  counterValue(widget: WidgetModel): number {
    const value = widget.config?.['value'];
    return typeof value === 'number' ? value : 0;
  }

  onImageFileChange(event: Event): void {
    if (!this.editable) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.imageSelected.emit(file);
    input.value = '';
  }
}
