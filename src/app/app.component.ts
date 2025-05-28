import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {} from '@angular/common/http';
import { DndChatComponent } from './components/dnd-chat/dnd-chat.component';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        // TODO: `HttpClientModule` should not be imported into a component directly.
        // Please refactor the code to add `provideHttpClient()` call to the provider list in the
        // application bootstrap logic and remove the `HttpClientModule` import from this component.
        HttpClientModule,
        DndChatComponent
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'dnd-ai';
}
