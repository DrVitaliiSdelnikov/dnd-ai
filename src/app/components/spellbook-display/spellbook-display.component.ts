import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  input,
  InputSignal,
  computed, inject, WritableSignal, signal
} from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RollEvent } from '../../shared/interfaces/dice-roll';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  RollOptionsPanelComponent,
  RollState,
  RollStateEnum
} from '../../shared/components/roll-options-panel/roll-options-panel.component';
import { ConfirmPopup } from 'primeng/confirmpopup';

@Component({
  selector: 'app-spellbook-display',
  standalone: true,
  imports: [NgForOf, NgIf, ButtonDirective, TooltipModule, ButtonIcon, ConfirmPopup, RollOptionsPanelComponent],
  providers: [
    ConfirmationService,
    MessageService
  ],
  templateUrl: './spellbook-display.component.html',
  styleUrls: ['./spellbook-display.component.scss']
})
export class SpellbookDisplayComponent implements OnInit {
  spells = input([]);
  selectedItem: WritableSignal<any> = signal(null);
  private selectedMode: WritableSignal<string> = signal(RollStateEnum.NORMAL);
  abilityModifiers: InputSignal<{ [key: string]: number }> = input<{ [key: string]: number }>({});
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private messageService: MessageService = inject(MessageService);
  @Output() spellCast: EventEmitter<RollEvent> = new EventEmitter<RollEvent>();
  actionResults: { [spellId: string]: string | null } = {};
  readonly categorizedSpells = computed(() => {
    const currentSpells = this.spells();
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

  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj).sort();
  }

  castSpell(spell: any, rollState: RollState = 'NORMAL'): void {
    const mainEffect = spell.properties.effects[0];
    if (!mainEffect) return;

    let resultDescription = `Casts ${spell.name}`;
    let diceNotation: string | null = null;
    let resultType: 'Damage' | 'Heal' | null = null;

    if (mainEffect.effect_type === 'DAMAGE' && mainEffect.damage_dice) {
      diceNotation = mainEffect.damage_dice;
      resultType = 'Damage';
    } else if (mainEffect.effect_type === 'HEAL' && mainEffect.heal_dice) {
      diceNotation = mainEffect.heal_dice;
      resultType = 'Heal';
    }

    if (diceNotation) {
      const roll = this.parseAndRollDice(diceNotation, rollState);

      if (!roll.error) {
        const resultValue = roll.total;
        const rollDetails = roll.details;
        let rollString = '';

        if (rollState === 'ADVANTAGE') {
          rollString = ` with Advantage (Rolls: [${rollDetails.rolls.join(', ')}] -> Used ${rollDetails.used})`;
        } else if (rollState === 'DISADVANTAGE') {
          rollString = ` with Disadvantage (Rolls: [${rollDetails.rolls.join(', ')}] -> Used ${rollDetails.used})`;
        } else {
          rollString = ` (Roll: ${rollDetails.used})`;
        }

        resultDescription += `. ${resultType}: ${resultValue} from ${diceNotation}${rollString}`;
        this.actionResults[spell.id_suggestion] = `${resultType}: ${resultValue}`;
      } else {
        this.actionResults[spell.id_suggestion] = 'Roll error';
      }
    }

    this.spellCast.emit({
      type: `SPELL_CAST_${spell.id_suggestion}`,
      description: resultDescription
    });
    this.confirmationService.close();
  }

  private parseAndRollDice(
    diceNotation: string,
    rollState: RollState = 'NORMAL'
  ): { total: number; details: { rolls: number[], used: number }; error: null } | { total: null; details: null; error: string } {

    if (!diceNotation || typeof diceNotation !== 'string' || !diceNotation.trim()) {
      return { total: null, details: null, error: `Invalid notation` };
    }
    const trimmedNotation = diceNotation.trim();

    const parts = trimmedNotation.match(/^(\d+)[dD](\d+)(?:([+-])(\d+))?$/);
    if (!parts) {
      const staticValue = parseInt(trimmedNotation, 10);
      if (!isNaN(staticValue)) {
        return { total: staticValue, details: { rolls: [staticValue], used: staticValue }, error: null };
      }
      return { total: null, details: null, error: `Unknown notation format` };
    }

    try {
      const numDice = parseInt(parts[1], 10);
      const diceType = parseInt(parts[2], 10);
      let modifier = 0;
      if (parts[3] && parts[4]) {
        modifier = parseInt(parts[4], 10);
        if (parts[3] === '-') { modifier = -modifier; }
      }

      const rollOnce = (): number => {
        let total = 0;
        for (let i = 0; i < numDice; i++) {
          total += Math.floor(Math.random() * diceType) + 1;
        }
        return total;
      };

      let baseRollResult: number;
      const allRolls: number[] = [];
      const roll1 = rollOnce();
      allRolls.push(roll1);

      if (rollState === 'ADVANTAGE' || rollState === 'DISADVANTAGE') {
        const roll2 = rollOnce();
        allRolls.push(roll2);
        baseRollResult = (rollState === 'ADVANTAGE') ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
      } else {
        baseRollResult = roll1;
      }

      return {
        total: baseRollResult + modifier,
        details: { rolls: allRolls.sort((a, b) => b - a), used: baseRollResult },
        error: null
      };

    } catch (e) {
      return { total: null, details: null, error: `Error parsing numbers` };
    }
  }

  callModeDialog(item: any, $event: MouseEvent): void {
    $event.preventDefault();
    this.selectedItem.set(item);
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      acceptVisible: false,
      rejectVisible: false,
      closable: true
    });
  }
}
