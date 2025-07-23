import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  input,
  InputSignal,
  computed
} from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RollEvent } from '../../shared/interfaces/dice-roll';

@Component({
  selector: 'app-spellbook-display',
  standalone: true,
  imports: [NgForOf, NgIf, ButtonDirective, TooltipModule, ButtonIcon],
  templateUrl: './spellbook-display.component.html',
  styleUrls: ['./spellbook-display.component.scss']
})
export class SpellbookDisplayComponent implements OnInit {
  spells = input([]);
  abilityModifiers: InputSignal<{ [key: string]: number }> = input<{ [key: string]: number }>({});
  @Output() spellCast: EventEmitter<RollEvent> = new EventEmitter<RollEvent>();
  actionResults: { [spellId: string]: string | null } = {};
  // categorizedSpells: WritableSignal<{ [key: string]: any[] }> = signal({});
  readonly categorizedSpells = computed(() => {
    const currentSpells = this.spells(); // Читаем значение из InputSignal

    console.log('Computed categorizedSpells is running...');

    if (!currentSpells || !Array.isArray(currentSpells)) {
      return {};
    }

    const grouped = currentSpells.reduce((acc, spell) => {
      const level = spell.properties.spell_level ?? -1;
      const key = level === 0 ? 'Cantrips' : (level > 0 ? `Level ${level}` : 'Abilities');
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(spell);
      return acc;
    }, {} as { [key: string]: any[] });

    return grouped;
  });

  ngOnInit(): void {
    // this.categorizeSpells();
  }

  // private categorizeSpells(): void {
  //   if (!this.spells() || !Array.isArray(this.spells())) {
  //     this.categorizedSpells.set({});
  //     return;
  //   }
  //
  //   const grouped = this.spells().reduce((acc, spell) => {
  //     const level = spell.properties.spell_level ?? -1;
  //     const key = level === 0 ? 'Cantrips' : (level > 0 ? `Level ${level}` : 'Abilities');
  //     if (!acc[key]) {
  //       acc[key] = [];
  //     }
  //     acc[key].push(spell);
  //     return acc;
  //   }, {} as { [key: string]: any[] });
  //
  //   this.categorizedSpells.set(grouped);
  //   console.log(this.categorizedSpells(), 'this.categorizedSpells');
  // }


  objectKeys(obj: any): string[] {
    return Object.keys(obj).sort();
  }


  castSpell(spell: any): void {
    const mainEffect = spell.properties.effects[0];
    if (!mainEffect) return;

    let resultDescription = `Casts ${spell.name}.`;
    let resultValue: number | null = null;
    let resultType: 'Damage' | 'Heal' | null = null;

    if (mainEffect.effect_type === 'DAMAGE' && mainEffect.damage_dice) {
      const roll = this.parseAndRollDice(mainEffect.damage_dice);
      if (!roll?.error) {
        resultValue = roll?.total;
        resultType = 'Damage';
        resultDescription += ` ${resultType}: ${resultValue} (from ${mainEffect.damage_dice})`;
      }
    } else if (mainEffect.effect_type === 'HEAL' && mainEffect.heal_dice) {
      const roll = this.parseAndRollDice(mainEffect.heal_dice);
      if (!roll?.error) {
        resultValue = roll?.total;
        resultType = 'Heal';
        resultDescription += ` ${resultType}: ${resultValue} (from ${mainEffect.heal_dice})`;
      }
    }

    if (resultType && resultValue !== null) {
      this.actionResults[spell.id_suggestion] = `${resultType}: ${resultValue}`;
    }


    this.spellCast.emit({
      type: `SPELL_CAST_${spell.id_suggestion}`,
      description: resultDescription
    });
  }


  private parseAndRollDice(diceNotation: string): { total: number; error: null } | { total: null; error: string } {
    // 1. Проверка на корректность входных данных
    if (!diceNotation || typeof diceNotation !== 'string' || diceNotation.trim() === '') {
      return { total: null, error: `Invalid or empty dice notation provided: '${diceNotation}'` };
    }

    const trimmedNotation = diceNotation.trim();

    // 2. Регулярное выражение для парсинга нотации "XdY" с опциональным модификатором "+Z" или "-Z"
    //    (\d+) - захватывает одну или более цифр (количество кубиков)
    //    [dD]  - соответствует букве 'd' или 'D'
    //    (\d+) - захватывает одну или более цифр (количество граней)
    //    (?:([+-])(\d+))? - опциональная (незахватывающая) группа для модификатора
    //      ([+-]) - захватывает знак '+' или '-'
    //      (\d+)  - захватывает одну или более цифр (значение модификатора)
    const parts = trimmedNotation.match(/^(\d+)[dD](\d+)(?:([+-])(\d+))?$/);

    // 3. Обработка случая, если строка соответствует формату "XdY..."
    if (parts) {
      try {
        const numDice = parseInt(parts[1], 10);
        const diceType = parseInt(parts[2], 10);
        let modifier = 0;

        // Проверяем, был ли найден модификатор
        if (parts[3] && parts[4]) {
          modifier = parseInt(parts[4], 10);
          if (parts[3] === '-') {
            modifier = -modifier;
          }
        }

        // Проверка на валидность (нельзя бросать 0 кубиков или кубики с 0 граней)
        if (numDice <= 0 || diceType <= 0) {
          return {
            total: null,
            error: `Number of dice and dice sides must be positive in notation: '${trimmedNotation}'`
          };
        }

        let total = 0;
        // Симуляция броска каждого кубика
        for (let i = 0; i < numDice; i++) {
          total += Math.floor(Math.random() * diceType) + 1;
        }

        // Прибавляем модификатор
        total += modifier;

        return { total, error: null };
      } catch (e) {
        // На случай, если parseInt выдаст ошибку для очень больших чисел
        return { total: null, error: `Error parsing dice notation numbers: '${trimmedNotation}'` };
      }
    }
  }
}
