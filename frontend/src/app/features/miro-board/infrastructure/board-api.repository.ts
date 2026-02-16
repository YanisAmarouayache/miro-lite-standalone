import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BoardModel } from '../domain/board.model';

@Injectable({ providedIn: 'root' })
export class BoardApiRepository {
  private readonly http = inject(HttpClient);

  load(boardId: string): Observable<BoardModel> {
    return this.http.get<BoardModel>(`${environment.apiUrl}/boards/${boardId}`);
  }

  save(board: BoardModel): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/boards/${board.id}`, {
      version: board.version,
      widgets: board.widgets
    });
  }
}
