import { Routes } from "@angular/router";

export const appRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "boards/demo-board",
  },
  {
    path: "boards/:boardId",
    loadComponent: () =>
      import(
        "./features/miro-board/presentation/miro-board-page.component"
      ).then((m) => m.MiroBoardPageComponent),
  },
];
