import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'attrName',
  standalone: true
})
export class AttributeNamePipe implements PipeTransform {
  attributes = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    cha: 'Charisma',
    wis: 'Wisdom',
  }

  transform(value: string): string {
    return this.attributes[value];
  }
}
