import { Routes } from '@angular/router';
import { RouteNames } from './shared/const/route-names';

export const routes: Routes = [
  {
    path: '',
    redirectTo: RouteNames.startJourney,
    pathMatch: 'full'
  },
  {
    path: RouteNames.startJourney,
    loadComponent: () => import('./components/start-journey/start-journey.component')
      .then(m => m.StartJourneyComponent)
  },
  {
    path: RouteNames.campaign,
    loadComponent: () => import('./components/dnd-chat/dnd-chat.component')
      .then(m => m.DndChatComponent)
  },
  {
    path: 'effect-editor-demo',
    loadComponent: () => import('./components/effect-editor-demo/effect-editor-demo.component')
      .then(m => m.EffectEditorDemoComponent)
  },
  { path: '**', redirectTo: RouteNames.startJourney }
];
