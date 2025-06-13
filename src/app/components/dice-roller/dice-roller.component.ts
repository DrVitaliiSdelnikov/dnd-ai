import { Component, EventEmitter, Output, signal, WritableSignal } from '@angular/core';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';
import { NgIf } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-dice-roller',
  imports: [SplitButtonModule, NgIf],
  templateUrl: 'dice-roller.component.html',
  styleUrls: ['./dice-roller.component.scss'],
})
export class DiceRollerComponent {
  selectedDie = signal<string>('1d20');
  rollResult: WritableSignal<number> = signal(0);
  @Output() emitRollResults: EventEmitter<number> = new EventEmitter();

  readonly menuItems: MenuItem[] = this.buildMenu();

  roll(notation: string) {
    const [count, sides] = notation.toLowerCase().split('d').map(Number);
    // @ts-ignore
    const total = Array.from({ length: count }).reduce(acc => acc + (Math.floor(Math.random()*sides)+1), 0);
    this.rollResult.set(total as number);
    this.emitRollResults.emit(total as number)
  }

  private buildMenu(): MenuItem[] {
    const dice  = [4, 6, 8, 10, 12, 20];
    const mult  = [1, 2, 3];

    return dice.map(sides => ({
      label : `d${sides}`,
      items : mult.map(n => ({
        label   : `${n}d${sides}`,
        command : () => {
          const notation = `${n}d${sides}` as const;
          this.selectedDie.set(notation);
          this.roll(notation);
        }
      })) as MenuItem[]
    })) as MenuItem[];
  }
}
