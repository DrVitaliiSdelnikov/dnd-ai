import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statBonus',
  standalone: true
})
export class StatBonusPipe implements PipeTransform {

  transform(statBonusNumber: number): string {
    if(statBonusNumber > 0) {
      return `+${statBonusNumber}`
    } else if(statBonusNumber < 0) {
      return `${statBonusNumber}`
    } else {
      return `0`
    }
  }
}
