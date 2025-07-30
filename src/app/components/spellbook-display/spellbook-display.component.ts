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
import { ButtonDirective } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { RollEvent } from '../../shared/interfaces/dice-roll';
import { RollOptionsPanelComponent, RollState, RollStateEnum } from '../../shared/components/roll-options-panel/roll-options-panel.component';
import { Spell } from '../../shared/interfaces/spells';
import { DialogService } from 'primeng/dynamicdialog';
import { SpellEditorComponent } from './spell-editor/spell-editor.component';

@Component({
  selector: 'app-spellbook-display',
  standalone: true,
  imports: [NgForOf, NgIf, ButtonDirective, TooltipModule, ConfirmPopupModule, RollOptionsPanelComponent],
  providers: [ConfirmationService, DialogService],
  templateUrl: './spellbook-display.component.html',
  styleUrls: ['./spellbook-display.component.scss']
})
export class SpellbookDisplayComponent implements OnInit {
  spells = input<Spell[]>([]);
  selectedItem: WritableSignal<Spell | null> = signal(null);
  private selectedMode: WritableSignal<RollState> = signal(RollStateEnum.NORMAL);
  private dialogService = inject(DialogService);
  abilityModifiers: InputSignal<{ [key: string]: number }> = input<{ [key: string]: number }>({});
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  @Output() spellCast: EventEmitter<RollEvent> = new EventEmitter<RollEvent>();
  actionResults: { [spellId: string]: string | null } = {};

  readonly categorizedSpells = computed(() => {
    const currentSpells = this.spells();
    console.log('Computed categorizedSpells is running...');

    if (!currentSpells || !Array.isArray(currentSpells)) {
      return {};
    }

    const grouped = currentSpells.reduce((acc, spell) => {
      const level = spell.properties?.spell_level ?? (spell.properties as any)?.level ?? 0; // иногда генерится как level, иногда как spell_level. 0 вместо -1 чтобы не выкидывало ошибку
      const key = level === 0 ? 'Cantrips' : (level > 0 ? `Level ${level}` : 'Abilities');
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(spell);
      return acc;
    }, {} as { [key: string]: any[] });

    return grouped;
  });

  ngOnInit(): void { }

  objectKeys(obj: any): string[] {
    return Object.keys(obj).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
  }


  castSpell(spell: Spell, rollState: RollState = 'NORMAL'): void {
    const mainEffect = spell.properties.damage_info?.effects[0];

    let resultDescription = `Casts ${spell.name}`;
    let diceNotation: string | null = null;
    let resultType: 'Damage' | 'Heal' | null = null;

    if (mainEffect && mainEffect.dice) {
      diceNotation = mainEffect.dice;
      resultType = 'Damage';
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

        if (roll.details.isNat20) {
          rollString += ' (natural 20!)';
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
  ): {
    total: number;
    details: { rolls: number[], used: number, isNat20?: boolean };
    error: null
  } | { total: null; details: null; error: string } {

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

      const isNat20 = numDice === 1 && diceType === 20 && baseRollResult === 20;

      return {
        total: baseRollResult + modifier,
        details: { rolls: allRolls.sort((a, b) => b - a), used: baseRollResult, isNat20 },
        error: null
      };

    } catch (e) {
      return { total: null, details: null, error: `Error parsing numbers` };
    }
  }

  openEditModal(spell: Spell): void {
    const ref = this.dialogService.open(SpellEditorComponent, {
      header: `Edit Spell: ${spell.name}`,
      width: '60vw',
      data: {
        spell: spell
      }
    });

    ref.onClose.subscribe((wasSaved: boolean) => {
      if (wasSaved) {
        console.log('Spell was saved. State updated via service.');
      }
    });
  }

  callModeDialog(item: Spell, $event: MouseEvent): void {
    $event.preventDefault();
    this.selectedItem.set(item);
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      acceptVisible: false,
      rejectVisible: false,
      closable: true,
    });
  }


  executeRollFromPanel(rollState: RollState): void {
    const spellToCast = this.selectedItem();
    if (spellToCast) {
      this.castSpell(spellToCast, rollState);
    }
  }
}
