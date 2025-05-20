import { Routes } from '@angular/router';
import { HelloComponent } from './components/hello.component';

export const routes: Routes = [
  {
    path: 'hello',
    loadComponent: () => import('./components/hello.component').then(m => m.HelloComponent),
  },
  {
    path: 'api/hello',
    loadComponent: () => import('./components/hello.component').then(m => m.HelloComponent),
  },
];
