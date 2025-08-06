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

  isDiceNotation(notation: string): boolean {
    const diceNotationRegex = /^\d+d\d+([+-]\d+)?$/;
    return diceNotationRegex.test(notation);
  }

  rollDetailed(notation: string): { total: number; breakdown: string; rolls: number[] } {
    if (!this.isDiceNotation(notation)) {
      const parsedValue = parseInt(notation, 10);
      if (!isNaN(parsedValue)) {
        return { total: parsedValue, breakdown: `${parsedValue}`, rolls: [parsedValue] };
      }
      throw new Error('Invalid notation format for detailed roll.');
    }

    const mainParts = notation.split(/[+-]/);
    const dicePart = mainParts[0];
    const modifierMatch = notation.match(/[+-]\d+$/);
    const modifier = modifierMatch ? parseInt(modifierMatch[0], 10) : 0;

    const [count, sides] = dicePart.toLowerCase().split('d').map(Number);
    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    total += modifier;

    let breakdown = `[${rolls.join(', ')}]`;
    if (modifier !== 0) {
      breakdown += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    }

    return { total, breakdown, rolls };
  }
}
