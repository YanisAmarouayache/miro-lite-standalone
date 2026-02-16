import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, EMPTY, Subject, catchError, concatMap, debounceTime, filter, takeUntil, tap } from 'rxjs';
import { BoardModel, WidgetModel } from '../domain/board.model';
import { BoardApiRepository } from '../infrastructure/board-api.repository';
import { WidgetCatalogRepository } from '../infrastructure/widget-catalog.repository';
import { WidgetDefinition } from '../domain/widget-definition.model';

@Injectable()
export class MiroBoardFacade {
  private readonly repo = inject(BoardApiRepository);
  private readonly widgetCatalog = inject(WidgetCatalogRepository);
  private readonly destroy$ = new Subject<void>();
  private readonly saveRequests$ = new Subject<BoardModel>();
  private readonly boardSubject = new BehaviorSubject<BoardModel>({ id: '', version: 1, widgets: [] });
  private autosaveStarted = false;
  private currentBoardId = '';

  readonly board$ = this.boardSubject.asObservable();
  readonly availableWidgets: WidgetDefinition[] = this.widgetCatalog.list();

  init(boardId: string): void {
    this.currentBoardId = boardId;
    this.startAutosaveIfNeeded();
    this.loadBoard(boardId);
  }

  setWidgetFrame(id: string, x: number, y: number, width: number, height: number): void {
    const board = this.boardSubject.value;
    this.patch({
      ...board,
      widgets: board.widgets.map((w) => (w.id === id ? { ...w, x, y, width, height } : w))
    });
  }

  addWidget(type: string): void {
    const definition = this.widgetCatalog.get(type);
    if (!definition) return;
    const board = this.boardSubject.value;
    const widget: WidgetModel = {
      id: crypto.randomUUID(),
      type: definition.type,
      x: 120 + board.widgets.length * 20,
      y: 120 + board.widgets.length * 20,
      width: definition.defaultWidth,
      height: definition.defaultHeight,
      config: { ...definition.defaultConfig }
    };
    this.patch({ ...board, widgets: [...board.widgets, widget] });
  }

  updateConfig(id: string, partialConfig: Record<string, unknown>): void {
    const board = this.boardSubject.value;
    this.patch({
      ...board,
      widgets: board.widgets.map((w) =>
        w.id === id
          ? {
              ...w,
              config: { ...(w.config ?? {}), ...partialConfig }
            }
          : w
      )
    });
  }

  remove(id: string): void {
    const board = this.boardSubject.value;
    this.patch({
      ...board,
      widgets: board.widgets.filter((w) => w.id !== id)
    });
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startAutosaveIfNeeded(): void {
    if (this.autosaveStarted) return;
    this.autosaveStarted = true;

    this.saveRequests$
      .pipe(
        filter(() => !!this.boardSubject.value.id),
        debounceTime(300),
        concatMap(() => {
          const board = this.boardSubject.value;
          return this.repo.save(board).pipe(
            tap(() => {
              const current = this.boardSubject.value;
              if (current.id === board.id) {
                this.boardSubject.next({ ...current, version: current.version + 1 });
              }
            }),
            catchError((e) => {
              console.error('save failed', e);
              if (e?.status === 409 && this.currentBoardId) {
                this.loadBoard(this.currentBoardId);
              }
              return EMPTY;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private loadBoard(boardId: string): void {
    this.repo.load(boardId).subscribe({
      next: (board) => this.boardSubject.next(board),
      error: () => {
        this.boardSubject.next({ id: boardId, version: 1, widgets: [] });
      }
    });
  }

  private patch(next: BoardModel): void {
    this.boardSubject.next(next);
    this.saveRequests$.next(next);
  }
}
