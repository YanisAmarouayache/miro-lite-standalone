import { Injectable } from "@angular/core";
import { ContextMenuState } from "../models/widget-context-menu.model";

@Injectable()
export class WidgetContextMenuService {
  contextMenu: ContextMenuState | null = null;

  open(widgetId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 180;
    const menuHeight = 220;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    this.contextMenu = {
      widgetId,
      x: Math.max(8, x),
      y: Math.max(8, y),
    };
  }

  close(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.contextMenu = null;
  }
}
