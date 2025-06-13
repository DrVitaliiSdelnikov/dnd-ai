import { Component, inject } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Router } from '@angular/router';
import { RouteNames } from '../../shared/const/route-names';

@Component({
  selector: 'start-journey',
  imports: [
    ButtonDirective
  ],
  templateUrl: './start-journey.component.html',
  standalone: true,
})
export class StartJourneyComponent {
  private readonly router: Router = inject(Router);

  startJourney(): void {
    void this.router.navigate([RouteNames.campaign]);
  }
}
