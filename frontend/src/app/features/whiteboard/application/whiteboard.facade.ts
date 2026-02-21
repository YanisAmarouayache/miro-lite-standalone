import { Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  Observable,
  Subscription,
  Subject,
  concatMap,
  debounceTime,
  filter,
  of,
  takeUntil,
} from "rxjs";
import { BoardModel } from "../domain/board.model";
import { WidgetDefinition } from "../domain/widget-definition.model";
import {
  BOARD_REPOSITORY,
  BoardRepositoryPort,
} from "../domain/ports/board-repository.port";
import {
  WIDGET_CATALOG,
  WidgetCatalogPort,
} from "../domain/ports/widget-catalog.port";
import { WidgetCommandService } from "./services/widget-command.service";
import {
  IMAGE_READ_ERROR_CODE,
  ImageUploadPolicyService,
  ImageValidationErrorCode,
} from "./services/image-upload-policy.service";
import { BoardSyncService } from "./services/board-sync.service";

@Injectable()
export class WhiteboardFacade {
  private readonly repo = inject<BoardRepositoryPort>(BOARD_REPOSITORY);
  private readonly widgetCatalog = inject<WidgetCatalogPort>(WIDGET_CATALOG);
  private readonly widgetCommands = inject(WidgetCommandService);
  private readonly imageUploadPolicy = inject(ImageUploadPolicyService);
  private readonly boardSync = inject(BoardSyncService);
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
  private isCurrentBoardLoaded = false;
  private boardSubscription?: Subscription;
  private readonly loadErrorSubject = new BehaviorSubject<string | null>(null);
  private readonly saveErrorSubject = new BehaviorSubject<string | null>(null);
  private readonly boardReadySubject = new BehaviorSubject<boolean>(false);

  readonly board$ = this.boardSubject.asObservable();
  readonly loadError$ = this.loadErrorSubject.asObservable();
  readonly saveError$ = this.saveErrorSubject.asObservable();
  readonly boardReady$ = this.boardReadySubject.asObservable();
  readonly availableWidgets: WidgetDefinition[] = this.widgetCatalog.list();

  init(boardId: string): void {
    this.boardSubscription?.unsubscribe();
    this.boardSubscription = undefined;
    this.currentBoardId = boardId;
    this.isCurrentBoardLoaded = false;
    this.boardReadySubject.next(false);
    this.boardSubject.next({ id: boardId, version: 1, widgets: [] });
    this.loadErrorSubject.next(null);
    this.saveErrorSubject.next(null);
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
    this.patch(this.widgetCommands.setWidgetFrame(board, id, x, y, width, height));
  }

  addWidget(type: string): void {
    const definition = this.widgetCatalog.get(type);
    if (!definition) return;
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.addWidget(board, definition));
  }

  addWidgetAt(type: string, x: number, y: number): void {
    const definition = this.widgetCatalog.get(type);
    if (!definition) return;
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.addWidgetAt(board, definition, x, y));
  }

  updateConfig(id: string, partialConfig: Record<string, unknown>): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.updateConfig(board, id, partialConfig));
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
    const validation = this.imageUploadPolicy.validate(file);
    if (!validation.valid && validation.error) {
      this.saveErrorSubject.next(
        this.toImageValidationErrorKey(validation.error.code)
      );
      return;
    }
    this.imageUploadPolicy
      .readAsDataUrl(file)
      .then((src) => {
        this.saveErrorSubject.next(null);
        this.updateConfig(id, { src, alt: file.name });
      })
      .catch((error) => {
        const message = this.boardSync.errorMessage(
          error,
          "whiteboard.errors.image.readFailed"
        );
        this.saveErrorSubject.next(
          message === IMAGE_READ_ERROR_CODE
            ? "whiteboard.errors.image.readFailed"
            : message
        );
      });
  }

  remove(id: string): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.remove(board, id));
  }

  bringForward(id: string): void {
    this.reorder(id, 1);
  }

  sendBackward(id: string): void {
    this.reorder(id, -1);
  }

  bringToFront(id: string): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.bringToFront(board, id));
  }

  sendToBack(id: string): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.sendToBack(board, id));
  }

  moveWidgetAbove(sourceId: string, targetId: string): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.moveWidgetAbove(board, sourceId, targetId));
  }

  destroy(): void {
    this.boardSubscription?.unsubscribe();
    this.boardSubscription = undefined;
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
        this.isCurrentBoardLoaded = true;
        this.boardReadySubject.next(true);
        this.loadErrorSubject.next(null);
        this.boardSubject.next(board);
        this.startBoardSubscription(boardId);
      },
      error: (err) => {
        if (requestId !== this.loadRequestId || boardId !== this.currentBoardId)
          return;
        this.isCurrentBoardLoaded = false;
        this.boardReadySubject.next(false);
        this.loadErrorSubject.next(
          this.boardSync.errorMessage(err, "Unable to load board")
        );
      },
    });
  }

  private patch(next: BoardModel): void {
    this.boardSubject.next(next);
    if (!this.isCurrentBoardLoaded || next.id !== this.currentBoardId) return;
    this.saveRequests$.next(next);
  }

  private startBoardSubscription(boardId: string): void {
    this.boardSubscription?.unsubscribe();
    this.boardSubscription = this.repo.subscribe(boardId).subscribe({
      next: (incomingBoard) => {
        if (boardId !== this.currentBoardId) return;
        const current = this.boardSubject.value;
        if (incomingBoard.version < current.version) return;
        this.isCurrentBoardLoaded = true;
        this.boardReadySubject.next(true);
        this.loadErrorSubject.next(null);
        this.boardSubject.next(incomingBoard);
      },
      error: (err) => {
        if (boardId !== this.currentBoardId) return;
        this.loadErrorSubject.next(
          this.boardSync.errorMessage(err, "Realtime connection error")
        );
      },
    });
  }

  private reorder(id: string, direction: 1 | -1): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.reorder(board, id, direction));
  }

  private persistWithLastWriteWins(): Observable<void> {
    const localBoard = this.boardSubject.value;
    if (!this.isCurrentBoardLoaded || localBoard.id !== this.currentBoardId) {
      return of(void 0);
    }
    return this.boardSync.persistWithLastWriteWins(
      this.repo,
      localBoard,
      () => this.boardSubject.value,
      (version) => {
        const current = this.boardSubject.value;
        this.boardSubject.next({ ...current, version });
      },
      (message) => this.saveErrorSubject.next(message)
    );
  }

  private toImageValidationErrorKey(code: ImageValidationErrorCode): string {
    switch (code) {
      case ImageValidationErrorCode.INVALID_TYPE:
        return "whiteboard.errors.image.invalidType";
      case ImageValidationErrorCode.TOO_LARGE:
        return "whiteboard.errors.image.tooLarge";
    }
  }
}
