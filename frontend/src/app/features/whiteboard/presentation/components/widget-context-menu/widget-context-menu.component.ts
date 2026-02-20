import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ContextMenuAction,
  ContextMenuActionEvent,
  ContextMenuState,
} from "../../models/widget-context-menu.model";

@Component({
    selector: 'app-widget-context-menu',
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
