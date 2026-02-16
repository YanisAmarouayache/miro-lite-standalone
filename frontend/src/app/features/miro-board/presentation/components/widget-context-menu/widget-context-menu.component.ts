import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export interface ContextMenuState {
  widgetId: string;
  x: number;
  y: number;
}

export type ContextMenuAction = 'bring_to_front' | 'bring_forward' | 'send_backward' | 'send_to_back' | 'remove';

export interface ContextMenuActionEvent {
  widgetId: string;
  action: ContextMenuAction;
}

@Component({
  selector: 'app-widget-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-context-menu.component.html',
  styleUrl: './widget-context-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetContextMenuComponent {
  @Input() menu: ContextMenuState | null = null;
  @Output() action = new EventEmitter<ContextMenuActionEvent>();

  run(action: ContextMenuAction): void {
    if (!this.menu) return;
    this.action.emit({ widgetId: this.menu.widgetId, action });
  }
}
