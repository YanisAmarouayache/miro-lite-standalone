import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { environment } from "./environments/environment";
import { AppComponent } from "./app/app.component";
import { appRoutes } from "./app/app.routes";
import { provideWhiteboard } from "./app/features/whiteboard/whiteboard.providers";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
    provideWhiteboard({ graphqlUrl: environment.graphqlUrl }),
  ],
}).catch((err) => console.error(err));
