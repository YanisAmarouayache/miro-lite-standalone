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
import { FormsModule } from '@angular/forms';
import { WidgetModel } from '../../../domain/board.model';
import { DataSourceDefinitionModel } from '../../../domain/datasource-definition.model';
import { OverlaySummary, UnitSummary } from '../../../domain/overlay-summary.model';

export type WidgetPanelAction = 'send_to_back' | 'send_backward' | 'bring_forward' | 'bring_to_front' | 'remove';
export type WidgetConfigCommand =
  | { type: 'action'; action: WidgetPanelAction }
  | { type: 'update_text'; text: string }
  | { type: 'update_chart_type'; chartType: string }
  | { type: 'update_chart_data_source'; dataSourceCode: string }
  | { type: 'update_chart_overlay_huid'; overlayHuid: string }
  | { type: 'update_chart_unit_huid'; unitHuid: string }
  | { type: 'fetch_snapshot' }
  | { type: 'update_counter_label'; label: string }
  | { type: 'update_counter_value'; value: string }
  | { type: 'image_selected'; file: File };

export interface WidgetConfigPanelVm {
  widgetId: string;
  widgetType: WidgetModel['type'];
  widgetName: string;
  layerPosition: number;
  widgetCount: number;
  chartTypes: string[];
  dataSourceDefinitions: DataSourceDefinitionModel[];
  accessibleOverlays: OverlaySummary[];
  overlayUnits: UnitSummary[];
  editable: boolean;
  textValue: string;
  chartType: string;
  chartDataSourceCode: string;
  chartOverlayHuid: string;
  chartUnitHuid: string;
  counterLabel: string;
  counterValue: number;
}

@Component({
    selector: 'app-widget-config-panel',
    imports: [CommonModule, FormsModule],
    templateUrl: './widget-config-panel.component.html',
    styleUrl: './widget-config-panel.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetConfigPanelComponent implements OnChanges {
  @Input() vm?: WidgetConfigPanelVm;
  @Output() command = new EventEmitter<WidgetConfigCommand>();
  private lastWidgetID = '';
  private lastEmittedText = '';
  textDraft = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['vm'] || !this.vm) {
      return;
    }
    if (this.vm.widgetId !== this.lastWidgetID) {
      this.lastWidgetID = this.vm.widgetId;
      this.lastEmittedText = this.vm.textValue;
      this.textDraft = this.vm.textValue;
      return;
    }
    if (this.vm.textValue !== this.lastEmittedText) {
      this.lastEmittedText = this.vm.textValue;
      this.textDraft = this.vm.textValue;
    }
  }

  onImageFileChange(event: Event): void {
    if (!this.vm?.editable) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.command.emit({ type: 'image_selected', file });
    input.value = '';
  }

  onTextDraftChange(value: string): void {
    this.textDraft = value;
  }

  onTextBlur(): void {
    this.emitTextIfChanged(this.textDraft);
  }

  private emitTextIfChanged(value: string): void {
    if (!this.vm?.editable) {
      return;
    }
    if (value === this.lastEmittedText) {
      return;
    }
    this.lastEmittedText = value;
    this.command.emit({ type: 'update_text', text: value });
  }
}
