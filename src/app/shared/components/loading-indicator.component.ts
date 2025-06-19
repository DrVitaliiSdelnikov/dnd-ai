import { Component, input, InputSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  template: `
    <div class="indicator-wrapper">
      @if (label()) {
        <strong class="role-label">{{ label() }}</strong>
      }
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `,
  styleUrl: './loading-indicator.component.scss',
  selector: 'app-loading-indicator',
  standalone: true,
  imports: [CommonModule],
})
export class LoadingIndicatorComponent {
  label: InputSignal<string | undefined> = input<string | undefined>();
}
