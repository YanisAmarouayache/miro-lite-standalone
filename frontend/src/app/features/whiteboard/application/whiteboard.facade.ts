import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  debounceTime,
  filter,
  mapTo,
  of,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { BoardModel, WidgetModel } from "../domain/board.model";
import { WidgetCatalogRepository } from "../infrastructure/widget-catalog.repository";
import { WidgetDefinition } from "../domain/widget-definition.model";
import { BOARD_REPOSITORY, BoardRepositoryPort } from "../domain/ports/board-repository.port";

@Injectable()
export class WhiteboardFacade {
  private readonly repo = inject<BoardRepositoryPort>(BOARD_REPOSITORY);
  private readonly widgetCatalog = inject(WidgetCatalogRepository);
  private readonly destroy$ = new Subject<void>();
  private readonly saveRequests$ = new Subject<BoardModel>();
  private readonly boardSubject = new BehaviorSubject<BoardModel>({
    id: "",
    version: 1,
    widgets: [],
  });
  private autosaveStarted = false;
  private currentBoardId = "";
  private loadRequestId = 0;
  private readonly loadErrorSubject = new BehaviorSubject<string | null>(null);
  private readonly saveErrorSubject = new BehaviorSubject<string | null>(null);

  readonly board$ = this.boardSubject.asObservable();
  readonly loadError$ = this.loadErrorSubject.asObservable();
  readonly saveError$ = this.saveErrorSubject.asObservable();
  readonly availableWidgets: WidgetDefinition[] = this.widgetCatalog.list();

  init(boardId: string): void {
    this.currentBoardId = boardId;
    this.loadErrorSubject.next(null);
    this.startAutosaveIfNeeded();
    this.loadBoard(boardId);
  }

  setWidgetFrame(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const board = this.boardSubject.value;
    this.patch({
      ...board,
      widgets: board.widgets.map((w) =>
        w.id === id ? { ...w, x, y, width, height } : w
      ),
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
      config: { ...definition.defaultConfig },
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
              config: { ...(w.config ?? {}), ...partialConfig },
            }
          : w
      ),
    });
  }

  updateWidgetText(id: string, text: string): void {
    this.updateConfig(id, { text });
  }

  updateChartType(id: string, chartType: string): void {
    this.updateConfig(id, { chartType });
  }

  updateCounterLabel(id: string, label: string): void {
    this.updateConfig(id, { label });
  }

  updateCounterValue(id: string, value: string): void {
    const parsed = Number(value);
    this.updateConfig(id, { value: Number.isFinite(parsed) ? parsed : 0 });
  }

  updateImageFromFile(id: string, file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== "string") return;
      this.updateConfig(id, { src, alt: file.name });
    };
    reader.readAsDataURL(file);
  }

  remove(id: string): void {
    const board = this.boardSubject.value;
    this.patch({
      ...board,
      widgets: board.widgets.filter((w) => w.id !== id),
    });
  }

  bringForward(id: string): void {
    this.reorder(id, 1);
  }

  sendBackward(id: string): void {
    this.reorder(id, -1);
  }

  bringToFront(id: string): void {
    const board = this.boardSubject.value;
    const index = board.widgets.findIndex((widget) => widget.id === id);
    if (index < 0 || index === board.widgets.length - 1) return;
    const next = [...board.widgets];
    const [widget] = next.splice(index, 1);
    next.push(widget);
    this.patch({ ...board, widgets: next });
  }

  sendToBack(id: string): void {
    const board = this.boardSubject.value;
    const index = board.widgets.findIndex((widget) => widget.id === id);
    if (index <= 0) return;
    const next = [...board.widgets];
    const [widget] = next.splice(index, 1);
    next.unshift(widget);
    this.patch({ ...board, widgets: next });
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
        concatMap(() => this.persistWithLastWriteWins()),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private loadBoard(boardId: string): void {
    const requestId = ++this.loadRequestId;
    this.repo.load(boardId).subscribe({
      next: (board) => {
        if (requestId !== this.loadRequestId || boardId !== this.currentBoardId)
          return;
        this.loadErrorSubject.next(null);
        this.boardSubject.next(board);
      },
      error: (err) => {
        if (requestId !== this.loadRequestId || boardId !== this.currentBoardId)
          return;
        this.loadErrorSubject.next(this.errorMessage(err, "Unable to load board"));
      },
    });
  }

  private patch(next: BoardModel): void {
    this.boardSubject.next(next);
    this.saveRequests$.next(next);
  }

  private reorder(id: string, direction: 1 | -1): void {
    const board = this.boardSubject.value;
    const index = board.widgets.findIndex((widget) => widget.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= board.widgets.length) return;

    const next = [...board.widgets];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    this.patch({ ...board, widgets: next });
  }

  private persistWithLastWriteWins(): Observable<void> {
    const localBoard = this.boardSubject.value;
    return this.repo.save(localBoard).pipe(
      tap(() => {
        const current = this.boardSubject.value;
        if (current.id === localBoard.id) {
          this.boardSubject.next({ ...current, version: current.version + 1 });
        }
        this.saveErrorSubject.next(null);
      }),
      catchError((e) => {
        if (e?.status !== 409) {
          this.saveErrorSubject.next(this.errorMessage(e, "Save failed"));
          return EMPTY;
        }
        return this.retrySaveWithLatestServerVersion(localBoard.id);
      })
    );
  }

  private retrySaveWithLatestServerVersion(boardId: string): Observable<void> {
    return this.repo.load(boardId).pipe(
      switchMap((serverBoard) => {
        const latestLocal = this.boardSubject.value;
        if (latestLocal.id !== boardId) {
          return of(void 0);
        }
        return this.repo
          .save({
            ...latestLocal,
            version: serverBoard.version,
          })
          .pipe(
            tap(() => {
              const current = this.boardSubject.value;
              if (current.id !== boardId) return;
              this.boardSubject.next({
                ...current,
                version: serverBoard.version + 1,
              });
              this.saveErrorSubject.next(null);
            }),
            mapTo(void 0)
          );
      }),
      catchError((retryError) => {
        this.saveErrorSubject.next(
          this.errorMessage(retryError, "Save failed after conflict retry")
        );
        return EMPTY;
      })
    );
  }

  private errorMessage(error: unknown, fallback: string): string {
    const asAny = error as any;
    return (
      asAny?.message ||
      asAny?.error?.message ||
      asAny?.networkError?.result?.errors?.[0]?.message ||
      fallback
    );
  }
}
