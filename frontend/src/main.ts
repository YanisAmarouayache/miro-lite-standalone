import { bootstrapApplication } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { MiroBoardComponent } from './app/features/miro-board/presentation/miro-board.component';

@Component({
    selector: 'app-root',
    imports: [MiroBoardComponent],
    template: `<miro-board [boardId]="'demo-board'"></miro-board>`
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()]
}).catch((err) => console.error(err));
