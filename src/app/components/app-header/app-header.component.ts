import { Component, signal, WritableSignal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { StickyHeaderDirective } from '../../shared/directives/sticky-header.directive';
import { Drawer } from 'primeng/drawer';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule, StickyHeaderDirective, Drawer ],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss']
})
export class AppHeaderComponent {
  isSidebarVisible: boolean = false;
  activeSection: WritableSignal<string> = signal('HOME');

  toggleMenu(): void {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  selectSection(section: string, $event: MouseEvent): void {
    this.activeSection.set(section);
    $event.preventDefault();
  }

  toggleProfile() {
    console.log('Profile button clicked');
  }
}
