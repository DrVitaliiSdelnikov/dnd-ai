import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  input,
  InputSignal,
  computed, inject, WritableSignal, signal
} from '@angular/core';
import { NgIf } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MenuItem, SelectItem } from 'primeng/api';
import { RollEvent } from '../../shared/interfaces/dice-roll';
import { Spell } from '../../shared/interfaces/spell.interface';
import { DialogService } from 'primeng/dynamicdialog';
import { SpellEditorComponent } from './spell-editor/spell-editor.component';
import { SpeedDialModule } from 'primeng/speeddial';
import { TemplateRendererService } from '../../services/template-renderer.service';
import { SafeHtml } from '@angular/platform-browser';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { Effect } from '../../shared/interfaces/effects.interface';
import { PlayerCardStateService } from '../../services/player-card-state.service';
import { FormsModule } from '@angular/forms';
import { SpellcastingService } from '../../services/spellcasting.service';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';
import { ViewChild } from '@angular/core';

@Component({
  selector: 'app-spellbook-display',
  standalone: true,
  imports: [NgIf, ButtonDirective, TooltipModule, ConfirmPopupModule, SpeedDialModule, DropdownModule, DialogModule, FormsModule, OverlayPanelModule],
  providers: [ConfirmationService, DialogService],
  templateUrl: './spellbook-display.component.html',
  styleUrls: ['./spellbook-display.component.scss']
})
export class SpellbookDisplayComponent implements OnInit {
  spells = input<Spell[]>([]);
  private dialogService = inject(DialogService);
  abilityModifiers: InputSignal<{ [key: string]: number }> = input<{ [key: string]: number }>({});
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private templateRenderer = inject(TemplateRendererService);
  private playerCardStateService = inject(PlayerCardStateService);
  private spellcastingService = inject(SpellcastingService);
  @Output() spellCasted: EventEmitter<RollEvent> = new EventEmitter<RollEvent>();
  @Output() spellAdded = new EventEmitter<Spell>();
  spellAddOptions: MenuItem[];
  actionResults: { [spellId: string]: string | null } = {};

  // Anchored slot picker
  @ViewChild('slotPanel') slotPanel!: OverlayPanel;
  slotOptions: SelectItem<number>[] = [];
  selectedItem: WritableSignal<Spell | null> = signal(null);

  readonly categorizedSpells = computed(() => {
    const currentSpells = this.spells();

    if (!currentSpells || !Array.isArray(currentSpells)) {
      return {};
    }

    const grouped = currentSpells.reduce((acc, spell) => {
      const level = spell.level ?? 0;
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
    this.spellAddOptions = [
      {
        icon: 'pi pi-book',
        tooltip: 'Add new spell',
        command: () => this.addNewSpell()
      }
    ];
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
  }

  renderSpellPreview(spell: Spell): SafeHtml {
    return this.templateRenderer.renderSpellTemplate(spell);
  }

  handleCastClick(event: MouseEvent, spell: Spell): void {
    // Cantrips: cast immediately at slot level 0
    const spellLevel = spell.level ?? 0;
    if (spellLevel === 0) {
      this.castSpell(spell, 0);
      return;
    }

    // Determine available and valid slots for this character
    const playerLevel = this.playerCardStateService.playerCard$()?.level ?? 1;
    const availableSlots = this.spellcastingService.getAvailableSlots(playerLevel);

    const baseLevel = Math.max(1, spellLevel || 1);
    const validSlots = availableSlots.filter(l => l >= baseLevel);
    const hasHigher = validSlots.some(l => l > baseLevel);

    // If no higher slots available, cast immediately at the lowest valid slot
    const defaultSlot = validSlots.length ? validSlots[0] : baseLevel;

    if (!hasHigher) {
      this.castSpell(spell, defaultSlot);
      return;
    }

    // Otherwise, open the anchored slot chooser with all valid levels from base → highest
    this.selectedItem.set(spell);
    this.slotOptions = validSlots.map(l => ({ label: `Level ${l}`, value: l }));
    if (this.slotPanel) {
      this.slotPanel.toggle(event);
    }
  }

  castAtSlot(slotLevel: number): void {
    const spell = this.selectedItem();
    if (spell) {
      if (this.slotPanel) {
        this.slotPanel.hide();
      }
      this.castSpell(spell, slotLevel);
    }
  }

  private getEffect(spell: Spell, type: string): Effect | undefined {
    return (spell.effects || []).find(e => e.type === type);
  }

  private getEffects(spell: Spell, type: string): Effect[] {
    return (spell.effects || []).filter(e => e.type === type);
  }

  private castSpell(spell: Spell, slotLevel: number): void {
    // Determine character level for levelScaling
    const playerLevel = this.playerCardStateService.playerCard$()?.level ?? 1;

    // Build mapping from effect id -> chat value (numbers or text).
    const chatValues: { [effectId: string]: string } = {};

    if (spell.isPassive || !spell.castType) {
      // For passive/always-on, just render plain text via template (no rolls)
      this.actionResults[spell.id_suggestion] = this.templateRenderer.renderSpellText(spell);
    } else if (spell.castType === 'utility') {
      // No dice; render plain text
      this.actionResults[spell.id_suggestion] = this.templateRenderer.renderSpellText(spell);
    } else {
      // For attack and save spells, iterate effects and compute outputs
      (spell.effects || []).forEach((eff) => {
        switch (eff.type) {
          case 'D20_ROLL': {
            const notation = (eff?.properties?.dice as string) || '1d20';
            const roll = this.rollDiceNotation(notation);
            chatValues[eff.id] = String(roll.total);
            break;
          }
          case 'PROFICIENCY': {
            const pb = this.playerCardStateService.getProficiencyBonus(playerLevel);
            chatValues[eff.id] = String(pb);
            break;
          }
          case 'ATTACK_STAT': {
            const abilityKey = (eff?.properties?.attackStat as string) || '';
            const abilityMod = abilityKey ? (this.abilityModifiers()?.[abilityKey] ?? 0) : 0;
            chatValues[eff.id] = String(abilityMod);
            break;
          }
          case 'MAGIC_BONUS': {
            const bonus = typeof eff?.properties?.bonus === 'number' ? eff.properties.bonus : 0;
            chatValues[eff.id] = String(bonus);
            break;
          }
          case 'DAMAGE': {
            const finalDice = this.applyScalingToDice(
              eff?.properties?.dice as string,
              slotLevel,
              spell.level || 0,
              eff?.properties?.slotScaling,
              eff?.properties?.levelScaling,
              playerLevel
            );
            const roll = this.rollDiceNotation(finalDice);
            const typeText = eff?.properties?.damageType ? ` ${String(eff.properties.damageType)} damage` : '';
            // Default behavior: include damage type text in the chip output for chat
            chatValues[eff.id] = `${roll.total}${typeText}`;
            break;
          }
          case 'SAVE_THROW': {
            const dc = eff?.properties?.dc;
            const abil = eff?.properties?.saveAbility ? String(eff.properties.saveAbility).toUpperCase() : '';
            if (dc && abil) {
              chatValues[eff.id] = `DC ${dc} (${abil})`;
            }
            break;
          }
          default:
            break;
        }
      });

      // Render final message using the template with computed values
      this.actionResults[spell.id_suggestion] = this.templateRenderer.renderSpellTemplateForChat(spell, chatValues);
    }

    this.spellCasted.emit({
      type: `SPELL_CAST_${spell.id_suggestion}`,
      description: this.actionResults[spell.id_suggestion] as string
    });
  }

  private addDice(a: string, b: string): string {
    // Combine dice notations a + b when sides match, otherwise join with '+'
    const parse = (s: string) => s.trim().match(/^(\d+)[dD](\d+)(?:([+-])(\d+))?$/);
    const pa = parse(a);
    const pb = parse(b);
    if (pa && pb && pa[2] === pb[2]) {
      const count = parseInt(pa[1], 10) + parseInt(pb[1], 10);
      const modA = pa[3] && pa[4] ? (pa[3] === '-' ? -parseInt(pa[4], 10) : parseInt(pa[4], 10)) : 0;
      const modB = pb[3] && pb[4] ? (pb[3] === '-' ? -parseInt(pb[4], 10) : parseInt(pb[4], 10)) : 0;
      const mod = modA + modB;
      return `${count}d${pa[2]}${mod !== 0 ? (mod > 0 ? '+' + mod : String(mod)) : ''}`;
    }
    return `${a} + ${b}`;
  }

  private applyScalingToDice(
    baseDice: string,
    selectedSlot: number,
    baseSpellLevel: number,
    slotScaling: any,
    levelScaling: any,
    characterLevel: number
  ): string {
    let result = baseDice;

    // Slot scaling: adds dice per slot above base level
    const slotsAbove = (baseSpellLevel >= 1)
      ? Math.max(0, (selectedSlot || baseSpellLevel) - baseSpellLevel)
      : 0;
    if (slotScaling && typeof slotScaling.perSlotDice === 'string' && slotsAbove > 0) {
      for (let i = 0; i < slotsAbove; i++) {
        result = this.addDice(result, slotScaling.perSlotDice);
      }
    }

    // Level scaling: cumulative steps that add dice at given character levels
    if (Array.isArray(levelScaling)) {
      levelScaling
        .filter((step: any) => typeof step?.level === 'number' && step?.level <= characterLevel && typeof step?.addDice === 'string')
        .sort((a: any, b: any) => a.level - b.level)
        .forEach((step: any) => {
          result = this.addDice(result, step.addDice);
        });
    }

    return result;
  }

  private rollDiceNotation(
    diceNotation: string
  ): { total: number; breakdown: string } {
    if (!diceNotation || typeof diceNotation !== 'string' || !diceNotation.trim()) {
      return { total: 0, breakdown: '' };
    }

    const parts = diceNotation.trim().match(/^(\d+)[dD](\d+)(?:([+-])(\d+))?$/);
    if (!parts) {
      const staticValue = parseInt(diceNotation.trim(), 10);
      if (!isNaN(staticValue)) {
        return { total: staticValue, breakdown: String(staticValue) };
      }
      return { total: 0, breakdown: diceNotation };
    }

    const numDice = parseInt(parts[1], 10);
    const diceType = parseInt(parts[2], 10);
    let modifier = 0;
    if (parts[3] && parts[4]) {
      modifier = parseInt(parts[4], 10);
      if (parts[3] === '-') { modifier = -modifier; }
    }

    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * diceType) + 1);
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;
    const breakdown = `${rolls.join('+')}${modifier ? (modifier > 0 ? '+' + modifier : String(modifier)) : ''}`;
    return { total, breakdown };
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
        // State updated via service inside editor
      }
    });
  }

  addNewSpell(): void {
    const newSpell: Spell = {
      id_suggestion: `new-${Math.random().toString(36).substring(2, 9)}`,
      name: 'New Spell',
      description: '',
      type: 'SPELL',
      level: 0,
      isPassive: true,
      template: '{{name}}',
      effects: []
    };
    this.spellAdded.emit(newSpell);
    this.openEditModal(newSpell);
  }
}
