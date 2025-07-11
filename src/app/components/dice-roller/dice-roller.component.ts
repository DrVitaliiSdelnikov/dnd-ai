import { Component, EventEmitter, inject, input, Output, signal, WritableSignal } from '@angular/core';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';
import { DiceRollerService } from './dice-roller.service';


@Component({
  standalone: true,
  selector: 'app-dice-roller',
  imports: [SplitButtonModule],
  templateUrl: 'dice-roller.component.html',
  styleUrls: ['./dice-roller.component.scss'],
})
export class DiceRollerComponent {
  selectedDie = signal<string>('1d20');
  styleClass = input<string>('');
  rollResult: WritableSignal<number> = signal(0);
  disabled = input(false);
  @Output() emitRollResults: EventEmitter<number> = new EventEmitter();

  readonly menuItems: MenuItem[] = this.buildMenu();
  private readonly diceRollerService: DiceRollerService = inject(DiceRollerService);

  roll() {
    const total = this.diceRollerService.roll();
    this.rollResult.set(total as number);
    this.emitRollResults.emit(total as number);
  }

  private buildMenu(): MenuItem[] {
    const dice = [4, 6, 8, 10, 12, 20];
    const mult = [1, 2, 3];

    return dice.map(sides => ({
      label: `d${sides}`,
      items: mult.map(n => ({
        label: `${n}d${sides}`,
        command: () => {
          const notation = `${n}d${sides}` as const;
          this.selectedDie.set(notation);
          this.diceRollerService.setSelectedDie(notation);
        },
      })) as MenuItem[],
    })) as MenuItem[];
  }
}
