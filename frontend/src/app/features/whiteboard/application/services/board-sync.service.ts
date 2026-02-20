import { Injectable } from "@angular/core";
import {
  EMPTY,
  Observable,
  catchError,
  mapTo,
  of,
  switchMap,
  tap,
} from "rxjs";
import { BoardModel } from "../../domain/board.model";
import { BoardRepositoryPort } from "../../domain/ports/board-repository.port";

@Injectable({ providedIn: "root" })
export class BoardSyncService {
  loadBoard(repo: BoardRepositoryPort, boardId: string): Observable<BoardModel> {
    return repo.load(boardId);
  }

  subscribeBoard(
    repo: BoardRepositoryPort,
    boardId: string
  ): Observable<BoardModel> {
    return repo.subscribe(boardId);
  }

  persistWithLastWriteWins(
    repo: BoardRepositoryPort,
    localBoard: BoardModel,
    getCurrentBoard: () => BoardModel,
    onLocalVersionSynced: (version: number) => void,
    setSaveError: (message: string | null) => void
  ): Observable<void> {
    return repo.save(localBoard).pipe(
      tap((serverVersion) => {
        const current = getCurrentBoard();
        if (current.id === localBoard.id) {
          onLocalVersionSynced(Math.max(current.version, serverVersion));
        }
        setSaveError(null);
      }),
      mapTo(void 0),
      catchError((e) => {
        if (e?.status !== 409) {
          setSaveError(this.errorMessage(e, "Save failed"));
          return EMPTY;
        }
        return this.retrySaveWithLatestServerVersion(
          repo,
          localBoard.id,
          getCurrentBoard,
          onLocalVersionSynced,
          setSaveError
        );
      })
    );
  }

  private retrySaveWithLatestServerVersion(
    repo: BoardRepositoryPort,
    boardId: string,
    getCurrentBoard: () => BoardModel,
    onLocalVersionSynced: (version: number) => void,
    setSaveError: (message: string | null) => void
  ): Observable<void> {
    return repo.load(boardId).pipe(
      switchMap((serverBoard) => {
        const latestLocal = getCurrentBoard();
        if (latestLocal.id !== boardId) {
          return of(void 0);
        }
        return repo
          .save({
            ...latestLocal,
            version: serverBoard.version,
          })
          .pipe(
            tap((savedVersion) => {
              const current = getCurrentBoard();
              if (current.id !== boardId) return;
              onLocalVersionSynced(Math.max(current.version, savedVersion));
              setSaveError(null);
            }),
            mapTo(void 0)
          );
      }),
      catchError((retryError) => {
        setSaveError(
          this.errorMessage(retryError, "Save failed after conflict retry")
        );
        return EMPTY;
      })
    );
  }

  errorMessage(error: unknown, fallback: string): string {
    const asAny = error as any;
    return (
      asAny?.message ||
      asAny?.error?.message ||
      asAny?.networkError?.result?.errors?.[0]?.message ||
      fallback
    );
  }
}
