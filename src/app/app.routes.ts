import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'campaign',
    loadComponent: () => import('./components/dnd-chat/dnd-chat.component')
      .then(m => m.DndChatComponent)
  },
];
