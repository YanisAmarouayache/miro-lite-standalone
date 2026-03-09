import { Injectable, inject } from "@angular/core";
import {
  EMPTY,
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  concatMap,
  debounceTime,
  filter,
  of,
  switchMap,
  tap,
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
import { CapaOpsDoughnutSnapshot } from "../domain/capaops.model";
import { WidgetSnapshotService } from "./services/widget-snapshot.service";
import { BoardSessionService } from "./services/board-session.service";
import { DataSourceDefinitionsService } from "./services/data-source-definitions.service";
import { ChartBindingService } from "./services/chart-binding.service";
import { OverlaySummary, UnitSummary } from "../domain/overlay-summary.model";

const HARD_CODED_USER_HUID = "user105";

@Injectable()
export class WhiteboardFacade {
  private readonly repo = inject<BoardRepositoryPort>(BOARD_REPOSITORY);
  private readonly widgetCatalog = inject<WidgetCatalogPort>(WIDGET_CATALOG);
  private readonly widgetCommands = inject(WidgetCommandService);
  private readonly imageUploadPolicy = inject(ImageUploadPolicyService);
  private readonly boardSync = inject(BoardSyncService);
  private readonly widgetSnapshots = inject(WidgetSnapshotService);
  private readonly boardSession = inject(BoardSessionService);
  private readonly dataSources = inject(DataSourceDefinitionsService);
  private readonly chartBindings = inject(ChartBindingService);
  private readonly destroy$ = new Subject<void>();
  private readonly saveRequests$ = new Subject<BoardModel>();
  private readonly boardSubject = new BehaviorSubject<BoardModel>({
    id: "",
    title: "",
    version: 1,
    widgets: [],
  });
  private autosaveStarted = false;
  private isCurrentBoardLoaded = false;
  private overlaysRequestId = 0;
  private readonly overlayUnitsRequestIds = new Map<string, number>();
  private readonly loadErrorSubject = new BehaviorSubject<string | null>(null);
  private readonly saveErrorSubject = new BehaviorSubject<string | null>(null);
  private readonly boardReadySubject = new BehaviorSubject<boolean>(false);
  private readonly accessibleOverlaysSubject = new BehaviorSubject<OverlaySummary[]>([]);
  private readonly overlayUnitsByOverlayHuidSubject = new BehaviorSubject<
    ReadonlyMap<string, UnitSummary[]>
  >(new Map());
  private readonly chartSnapshotsSubject = new BehaviorSubject<
    ReadonlyMap<string, CapaOpsDoughnutSnapshot>
  >(new Map());

  readonly board$ = this.boardSubject.asObservable();
  readonly loadError$ = this.loadErrorSubject.asObservable();
  readonly saveError$ = this.saveErrorSubject.asObservable();
  readonly boardReady$ = this.boardReadySubject.asObservable();
  readonly dataSourceDefinitions$ = this.dataSources.definitions$;
  readonly accessibleOverlays$ = this.accessibleOverlaysSubject.asObservable();
  readonly overlayUnitsByOverlayHuid$ =
    this.overlayUnitsByOverlayHuidSubject.asObservable();
  readonly chartSnapshots$ = this.chartSnapshotsSubject.asObservable();
  readonly availableWidgets: WidgetDefinition[] = this.widgetCatalog.list();

  init(boardId: string): void {
    this.boardSession.begin(this.repo, boardId, this.sessionCallbacks());
    this.isCurrentBoardLoaded = false;
    this.boardReadySubject.next(false);
    this.dataSources.reset();
    this.overlaysRequestId++;
    this.overlayUnitsRequestIds.clear();
    this.accessibleOverlaysSubject.next([]);
    this.overlayUnitsByOverlayHuidSubject.next(new Map());
    this.chartSnapshotsSubject.next(new Map());
    this.boardSubject.next({ id: boardId, title: boardId, version: 1, widgets: [] });
    this.loadErrorSubject.next(null);
    this.saveErrorSubject.next(null);
    this.startAutosaveIfNeeded();
    this.loadDataSourceDefinitions();
    this.loadAccessibleOverlays();
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

  addWidget(widgetCatalogId: string): string | null {
    const definition = this.widgetCatalog.get(widgetCatalogId);
    if (!definition) return null;
    const board = this.boardSubject.value;
    const nextBoard = this.widgetCommands.addWidget(board, definition);
    this.patch(nextBoard);
    return nextBoard.widgets[nextBoard.widgets.length - 1]?.id ?? null;
  }

  addWidgetAt(widgetCatalogId: string, x: number, y: number): string | null {
    const definition = this.widgetCatalog.get(widgetCatalogId);
    if (!definition) return null;
    const board = this.boardSubject.value;
    const nextBoard = this.widgetCommands.addWidgetAt(board, definition, x, y);
    this.patch(nextBoard);
    return nextBoard.widgets[nextBoard.widgets.length - 1]?.id ?? null;
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

  updateChartDataSource(id: string, dataSourceCode: string): void {
    const board = this.boardSubject.value;
    const widget = board.widgets.find((item) => item.id === id);
    if (!widget || widget.type !== "chart") return;
    const currentBinding = widget.config.bindings?.[0];
    const knownDataSource = this.dataSources.getByCode(dataSourceCode);
    this.patchLocal({
      ...board,
      widgets: this.widgetCommands.updateConfig(board, id, {
      bindings: [
        this.chartBindings.forDataSource(
          currentBinding,
          knownDataSource ? dataSourceCode : ""
        ),
      ],
      }).widgets,
    });
  }

  updateChartUnitHuid(id: string, unitHuid: string): void {
    const board = this.boardSubject.value;
    const widget = board.widgets.find((item) => item.id === id);
    if (!widget || widget.type !== "chart") return;
    const currentBinding = widget.config.bindings?.[0];
    const dataSourceCode = currentBinding?.dataSourceCode ?? "";
    if (!dataSourceCode.trim()) {
      this.saveErrorSubject.next("Select a datasource first.");
      return;
    }
    this.patchLocal({
      ...board,
      widgets: this.widgetCommands.updateConfig(board, id, {
      bindings: [this.chartBindings.forUnitHuid(currentBinding, unitHuid)],
      }).widgets,
    });
  }

  updateChartOverlayHuid(id: string, overlayHuid: string): void {
    const board = this.boardSubject.value;
    const widget = board.widgets.find((item) => item.id === id);
    if (!widget || widget.type !== "chart") return;
    const currentBinding = widget.config.bindings?.[0];
    const dataSourceCode = currentBinding?.dataSourceCode ?? "";
    if (!dataSourceCode.trim()) {
      this.saveErrorSubject.next("Select a datasource first.");
      return;
    }
    this.patchLocal({
      ...board,
      widgets: this.widgetCommands.updateConfig(board, id, {
      bindings: [this.chartBindings.forOverlayHuid(currentBinding, overlayHuid)],
      }).widgets,
    });
    this.ensureOverlayUnitsLoaded(overlayHuid);
  }

  fetchWidgetSnapshot(widgetId: string): void {
    const current = this.boardSubject.value;
    if (!this.isCurrentBoardLoaded || current.id !== this.boardSession.getCurrentBoardId()) {
      this.saveErrorSubject.next("Board is not ready yet.");
      return;
    }
    const widget = current.widgets.find((item) => item.id === widgetId);
    if (!widget || widget.type !== "chart") {
      this.saveErrorSubject.next("Widget snapshot is only supported for chart widgets.");
      return;
    }

    const dataSourceCode = widget.config.bindings?.[0]?.dataSourceCode ?? "";
    if (!this.dataSources.getByCode(dataSourceCode)) {
      this.saveErrorSubject.next("Unknown datasource. Select a predefined datasource first.");
      return;
    }
    const unitHuid = widget.config.bindings?.[0]?.unitHuid ?? "";
    if (!unitHuid.trim()) {
      this.saveErrorSubject.next("Select a unit before fetching snapshot.");
      return;
    }

    this.repo
      .save(current)
      .pipe(
        tap((serverVersion) => {
          const latest = this.boardSubject.value;
          if (latest.id !== current.id) {
            return;
          }
          this.boardSubject.next({
            ...latest,
            version: Math.max(latest.version, serverVersion),
          });
        }),
        catchError((error) => {
          this.saveErrorSubject.next(
            this.boardSync.errorMessage(error, "Save before snapshot failed")
          );
          return EMPTY;
        }),
        switchMap(() => this.widgetSnapshots.fetch(this.repo, current.id, widgetId))
      )
      .subscribe({
        next: (payload) => {
          const snapshot = payload.snapshot;
          if (!snapshot) {
            this.saveErrorSubject.next("Snapshot payload is invalid");
            return;
          }
          this.chartSnapshotsSubject.next(
            this.widgetSnapshots.store(
              this.chartSnapshotsSubject.value,
              payload.widgetId,
              snapshot
            )
          );
          this.saveErrorSubject.next(null);
        },
        error: (error) => {
          this.saveErrorSubject.next(
            this.boardSync.errorMessage(error, "Snapshot fetch failed")
          );
        },
      });
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
    this.boardSession.destroy();
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
        concatMap(() => this.persistWithOptimisticConcurrency()),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private patch(next: BoardModel): void {
    this.boardSubject.next(next);
    if (!this.isCurrentBoardLoaded || next.id !== this.boardSession.getCurrentBoardId()) return;
    this.saveRequests$.next(next);
  }

  private patchLocal(next: BoardModel): void {
    this.boardSubject.next(next);
  }

  private reorder(id: string, direction: 1 | -1): void {
    const board = this.boardSubject.value;
    this.patch(this.widgetCommands.reorder(board, id, direction));
  }

  private persistWithOptimisticConcurrency(): Observable<void> {
    const localBoard = this.boardSubject.value;
    if (!this.isCurrentBoardLoaded || localBoard.id !== this.boardSession.getCurrentBoardId()) {
      return of(void 0);
    }
    return this.boardSync.persistWithOptimisticConcurrency(
      this.repo,
      localBoard,
      () => this.boardSubject.value,
      (version) => {
        const current = this.boardSubject.value;
        this.boardSubject.next({ ...current, version });
      },
      (message) => this.saveErrorSubject.next(message),
      () => this.boardSession.reload(this.repo, this.sessionCallbacks())
    );
  }

  private toImageValidationErrorKey(code: ImageValidationErrorCode): string {
    switch (code) {
      case ImageValidationErrorCode.INVALID_TYPE:
        return "whiteboard.errors.image.invalidType";
      case ImageValidationErrorCode.TOO_LARGE:
        return "whiteboard.errors.image.tooLarge";
      default:
        return "whiteboard.errors.image.readFailed";
    }
  }

  private loadDataSourceDefinitions(): void {
    this.dataSources.load(
      this.repo,
      (message) => this.loadErrorSubject.next(message)
    );
  }

  private loadAccessibleOverlays(): void {
    const boardID = this.boardSession.getCurrentBoardId();
    const requestID = ++this.overlaysRequestId;
    this.repo.listAccessibleOverlays(HARD_CODED_USER_HUID).subscribe({
      next: (overlays) => {
        if (
          requestID !== this.overlaysRequestId ||
          boardID !== this.boardSession.getCurrentBoardId()
        ) {
          return;
        }
        this.accessibleOverlaysSubject.next(overlays);
      },
      error: (error) => {
        if (
          requestID !== this.overlaysRequestId ||
          boardID !== this.boardSession.getCurrentBoardId()
        ) {
          return;
        }
        this.loadErrorSubject.next(
          this.boardSync.errorMessage(error, "Unable to load accessible overlays")
        );
      },
    });
  }

  private ensureOverlayUnitsLoaded(overlayHuid: string): void {
    const trimmed = overlayHuid.trim();
    if (!trimmed) {
      return;
    }
    const boardID = this.boardSession.getCurrentBoardId();
    const currentMap = this.overlayUnitsByOverlayHuidSubject.value;
    if (currentMap.has(trimmed)) {
      return;
    }
    const requestID = (this.overlayUnitsRequestIds.get(trimmed) ?? 0) + 1;
    this.overlayUnitsRequestIds.set(trimmed, requestID);
    this.repo.listOverlayUnits(trimmed).subscribe({
      next: (units) => {
        if (
          this.overlayUnitsRequestIds.get(trimmed) !== requestID ||
          boardID !== this.boardSession.getCurrentBoardId()
        ) {
          return;
        }
        const next = new Map(this.overlayUnitsByOverlayHuidSubject.value);
        next.set(trimmed, units);
        this.overlayUnitsByOverlayHuidSubject.next(next);
      },
      error: (error) => {
        if (
          this.overlayUnitsRequestIds.get(trimmed) !== requestID ||
          boardID !== this.boardSession.getCurrentBoardId()
        ) {
          return;
        }
        this.saveErrorSubject.next(
          this.boardSync.errorMessage(error, "Unable to load overlay units")
        );
      },
    });
  }

  private sessionCallbacks() {
    return {
      errorMessage: (error: unknown, fallback: string) =>
        this.boardSync.errorMessage(error, fallback),
      onLoadSuccess: (board: BoardModel) => {
        this.isCurrentBoardLoaded = true;
        this.boardReadySubject.next(true);
        this.loadErrorSubject.next(null);
        this.chartSnapshotsSubject.next(this.widgetSnapshots.extract(board));
        this.boardSubject.next(board);
        this.ensureOverlayUnitsForBoard(board);
      },
      onLoadError: (message: string) => {
        this.isCurrentBoardLoaded = false;
        this.boardReadySubject.next(false);
        this.loadErrorSubject.next(message);
      },
      onSubscriptionBoard: (incomingBoard: BoardModel) => {
        const current = this.boardSubject.value;
        if (incomingBoard.version < current.version) return;
        this.isCurrentBoardLoaded = true;
        this.boardReadySubject.next(true);
        this.loadErrorSubject.next(null);
        this.chartSnapshotsSubject.next(
          this.widgetSnapshots.merge(
            incomingBoard,
            current,
            this.chartSnapshotsSubject.value
          )
        );
        this.boardSubject.next(incomingBoard);
        this.ensureOverlayUnitsForBoard(incomingBoard);
      },
      onSubscriptionError: (message: string) => {
        this.loadErrorSubject.next(message);
      },
    };
  }

  private ensureOverlayUnitsForBoard(board: BoardModel): void {
    const overlayHuids = new Set<string>();
    for (const widget of board.widgets) {
      if (widget.type !== "chart") {
        continue;
      }
      const overlayHuid = widget.config.bindings?.[0]?.overlayHuid?.trim() ?? "";
      if (overlayHuid) {
        overlayHuids.add(overlayHuid);
      }
    }
    for (const overlayHuid of overlayHuids) {
      this.ensureOverlayUnitsLoaded(overlayHuid);
    }
  }
}
