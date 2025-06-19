import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DiceRollerService {
  private selectedDie: string = '1d20';

  roll() {
    const [count, sides] = this.selectedDie.toLowerCase().split('d').map(Number);
    // @ts-ignore
    return Array.from({ length: count }).reduce(acc => acc + (Math.floor(Math.random()*sides)+1), 0);
  }

  setSelectedDie(notation: string): void {
    this.selectedDie = notation;
  }

  getSelectedDie(): string {
    return this.selectedDie;
  }
}
