import { Injectable } from "@angular/core";
import { EMPTY, Observable, catchError, mapTo, of, switchMap, tap } from "rxjs";
import { BoardModel } from "../../domain/board.model";
import { BoardRepositoryPort } from "../../domain/ports/board-repository.port";

@Injectable({ providedIn: "root" })
export class BoardSyncService {
  persistWithLastWriteWins(
    repo: BoardRepositoryPort,
    localBoard: BoardModel,
    getCurrentBoard: () => BoardModel,
    onLocalVersionSynced: (version: number) => void,
    setSaveError: (message: string | null) => void
  ): Observable<void> {
    return repo.save(localBoard).pipe(
      tap((serverVersion) =>
        this.applySavedVersionIfCurrentBoard(
          getCurrentBoard,
          localBoard.id,
          serverVersion,
          onLocalVersionSynced,
          setSaveError
        )
      ),
      mapTo(void 0),
      catchError((e) =>
        e?.status === 409
          ? this.retrySaveWithLatestServerVersion(
              repo,
              localBoard.id,
              getCurrentBoard,
              onLocalVersionSynced,
              setSaveError
            )
          : this.toSaveErrorAndComplete(e, setSaveError, "Save failed")
      )
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
            tap((savedVersion) =>
              this.applySavedVersionIfCurrentBoard(
                getCurrentBoard,
                boardId,
                savedVersion,
                onLocalVersionSynced,
                setSaveError
              )
            ),
            mapTo(void 0)
          );
      }),
      catchError((retryError) =>
        this.toSaveErrorAndComplete(
          retryError,
          setSaveError,
          "Save failed after conflict retry"
        )
      )
    );
  }

  private applySavedVersionIfCurrentBoard(
    getCurrentBoard: () => BoardModel,
    expectedBoardId: string,
    savedVersion: number,
    onLocalVersionSynced: (version: number) => void,
    setSaveError: (message: string | null) => void
  ): void {
    const current = getCurrentBoard();
    if (current.id !== expectedBoardId) {
      return;
    }

    onLocalVersionSynced(Math.max(current.version, savedVersion));
    setSaveError(null);
  }

  private toSaveErrorAndComplete(
    error: unknown,
    setSaveError: (message: string | null) => void,
    fallback: string
  ): Observable<never> {
    setSaveError(this.errorMessage(error, fallback));
    return EMPTY;
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
