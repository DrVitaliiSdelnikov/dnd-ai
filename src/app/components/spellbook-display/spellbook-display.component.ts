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
import { RollOptionsPanelComponent, RollState, RollStateEnum, RollExtraToggle } from '../../shared/components/roll-options-panel/roll-options-panel.component';

@Component({
  selector: 'app-spellbook-display',
  standalone: true,
  imports: [NgIf, ButtonDirective, TooltipModule, ConfirmPopupModule, SpeedDialModule, DropdownModule, DialogModule, FormsModule, OverlayPanelModule, RollOptionsPanelComponent],
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
  private selectedSpellRollMode: WritableSignal<RollState> = signal(RollStateEnum.NORMAL);
  private lastSpellContextEvent: MouseEvent | null = null;

  // Collect toggles for current selected spell (alphabetized by label)
  readonly spellExtraToggles = computed<RollExtraToggle[]>(() => {
    const spell = this.selectedItem();
    if (!spell || !Array.isArray(spell.effects)) return [];
    // Base toggles from effects that explicitly expose a menu toggle
    const baseToggles = (spell.effects || [])
      .filter(e => !!e?.properties?.menuToggleEnabled)
      .map(e => ({ id: e.id, label: String(e?.properties?.menuToggleLabel || e?.name || ''), checked: !!e?.properties?.menuToggleChecked }))
      .filter(t => !!t.label);
    // Always include GWM/Sharpshooter with fixed labels; default checked = false when absent
    const special: RollExtraToggle[] = (spell.effects || [])
      .filter(e => e?.type === 'GREAT_WEAPON_MASTER' || e?.type === 'SHARPSHOOTER')
      .map(e => ({ id: e.id, label: e.type === 'GREAT_WEAPON_MASTER' ? 'Great Weapon Master' : 'Sharpshooter', checked: !!e?.properties?.menuToggleChecked }));
    // Include Savage Attacker as a fixed-label toggle when present on the spell; default unchecked when absent
    const savage: RollExtraToggle[] = (spell.effects || [])
      .filter(e => e?.type === 'SAVAGE_ATTACKER')
      .map(e => ({ id: e.id, label: 'Savage Attacker', checked: !!e?.properties?.menuToggleChecked }));
    const toggles = [...baseToggles, ...special, ...savage];
    const dedupMap = new Map<string, RollExtraToggle>();
    toggles.forEach(t => { if (t.label) dedupMap.set(t.id, t); });
    return Array.from(dedupMap.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  });

  // Group spells for template rendering
  readonly categorizedSpells = computed<{ [key: string]: Spell[] }>(() => {
    const groups: { [key: string]: Spell[] } = {};
    const list = this.spells() || [];
    for (const s of list) {
      let key: string;
      if (s?.isPassive) {
        key = 'Passive';
      } else if ((s?.level ?? 0) === -1) {
        key = 'Abilities';
      } else if ((s?.level ?? 0) === 0) {
        key = 'Cantrips';
      } else {
        key = `Level ${s?.level ?? 0}`;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
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
    // Left-click always resets mode to NORMAL
    this.selectedSpellRollMode.set(RollStateEnum.NORMAL);
    // Cantrips: cast immediately at slot level 0
    const spellLevel = spell.level ?? 0;
    if (spellLevel === 0) {
      this.castSpell(spell, 0, this.selectedSpellRollMode());
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
      this.castSpell(spell, defaultSlot, this.selectedSpellRollMode());
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
      this.castSpell(spell, slotLevel, this.selectedSpellRollMode());
    }
  }

  private getEffect(spell: Spell, type: string): Effect | undefined {
    return (spell.effects || []).find(e => e.type === type);
  }

  private getEffects(spell: Spell, type: string): Effect[] {
    return (spell.effects || []).filter(e => e.type === type);
  }

  private castSpell(spell: Spell, slotLevel: number, rollMode: RollState = RollStateEnum.NORMAL): void {
    // Determine character level for levelScaling
    const playerLevel = this.playerCardStateService.playerCard$()?.level ?? 1;

    // Compute Improved Critical threshold for this spell (attack_roll only)
    const improvedCritThresholds = (spell.effects || [])
      .filter(e => e?.type === 'IMPROVED_CRITICAL')
      .map(e => Number((e as any)?.properties?.critThreshold))
      .filter(v => Number.isFinite(v) && v >= 2 && v <= 19);
    const critThreshold = improvedCritThresholds.length > 0 ? Math.min(...improvedCritThresholds) : 20;

    // Build mapping from effect id -> chat value (numbers or text).
    const chatValues: { [effectId: string]: string } = {};

    if (spell.isPassive || !spell.castType) {
      // For passive/always-on, just render plain text via template (no rolls)
      this.actionResults[spell.id_suggestion] = this.templateRenderer.renderSpellText(spell);
    } else {
      // Crit tracking for attack-roll spells
      let isNatural20 = false;
      let isNatural1 = false;
      let isCritical = false;
      let firstDamageResolved = false;
      let capturedD20: number | null = null;

      // For active spells of any castType (attack, save, utility), iterate effects and compute outputs
      (spell.effects || []).forEach((eff) => {
        switch (eff.type) {
          case 'D20_ROLL': {
            const notation = (eff?.properties?.dice as string) || '1d20';
            // If this is an attack-roll spell, respect rollMode for d20 rolls and apply Halfling Lucky (spell-scoped)
            if (spell.castType === 'attack_roll' && /^\s*1[dD]20(\s*[+-]\s*\d+)?\s*$/.test(notation)) {
              const halflingLuckyStacks = (spell.effects || []).filter(e => e?.type === 'HALFLING_LUCKY').length;
              let d20: number;
              let details = '';
              if (rollMode === RollStateEnum.ADVANTAGE || rollMode === RollStateEnum.DISADVANTAGE) {
                const first = this.rollD20();
                const second = this.rollD20();
                const adjFirst = this.applyHalflingLuckyToDie(first, halflingLuckyStacks);
                const adjSecond = this.applyHalflingLuckyToDie(second, halflingLuckyStacks);
                const totalTriggers = (adjFirst.triggers || 0) + (adjSecond.triggers || 0);
                d20 = rollMode === RollStateEnum.ADVANTAGE
                  ? Math.max(adjFirst.value, adjSecond.value)
                  : Math.min(adjFirst.value, adjSecond.value);
                const annotationPlain = totalTriggers > 0 ? `Halfling Lucky x${totalTriggers}` : '';
                const rollsDisp = `${this.formatLuckyDieDisplayForSpell(first, adjFirst)}, ${this.formatLuckyDieDisplayForSpell(second, adjSecond)}`;
                const prefix = 'Rolls';
                details = `${prefix}: [${rollsDisp}] -> Used ${d20}${annotationPlain}`;
              } else {
                const initial = this.rollD20();
                const adjusted = this.applyHalflingLuckyToDie(initial, halflingLuckyStacks);
                d20 = adjusted.value;
                const annotationPlain = adjusted.triggers > 0 ? `Halfling Lucky x${adjusted.triggers}` : '';
                details = `Roll: ${this.formatLuckyDieDisplayForSpell(initial, adjusted)}${annotationPlain}`;
              }
              // Determine power-shot toggle for this spell (first by order)
              const powerShot = (spell.effects || [])
                .filter(e => (e?.type === 'GREAT_WEAPON_MASTER' || e?.type === 'SHARPSHOOTER') && !!e?.properties?.menuToggleChecked)
                .sort((a: any, b: any) => (Number(a?.order || 0) - Number(b?.order || 0)))[0];
              const base = `${d20} (${details})`;
              chatValues[eff.id] = powerShot ? `${base}-5` : base;
              if (capturedD20 === null) {
                capturedD20 = d20;
                isNatural20 = d20 === 20;
                isNatural1 = d20 === 1;
                // Improved Critical applies only to attack_roll
                isCritical = (spell.castType === 'attack_roll') && d20 !== 1 && d20 >= critThreshold;
              }
            } else if (/^\s*1[dD]20(\s*[+-]\s*\d+)?\s*$/.test(notation)) {
              // Non-attack d20 roll: apply Halfling Lucky (spell-scoped), no adv/disadv context
              const halflingLuckyStacks = (spell.effects || []).filter(e => e?.type === 'HALFLING_LUCKY').length;
              const initial = this.rollD20();
              const adjusted = this.applyHalflingLuckyToDie(initial, halflingLuckyStacks);
              const d20 = adjusted.value;
              const annotationPlain = adjusted.triggers > 0 ? `Halfling Lucky x${adjusted.triggers}` : '';
              const details = `Roll: ${this.formatLuckyDieDisplayForSpell(initial, adjusted)}${annotationPlain}`;
              chatValues[eff.id] = `${d20} (${details})`;
            } else {
              const roll = this.rollDiceNotation(notation);
              chatValues[eff.id] = String(roll.total);
            }
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
            // NEW: support multi-dice lists and separate-roll upcasting/level-scaling
            const baseDiceInput = (eff?.properties?.dice as string) || '';
            const slotScaling = eff?.properties?.slotScaling;
            const levelScaling = eff?.properties?.levelScaling;

            // If this DAMAGE effect is exposed as an optional toggle but currently unchecked,
            // suppress its placeholder output entirely
            const toggleEnabled = !!eff?.properties?.menuToggleEnabled;
            const toggleChecked = !!eff?.properties?.menuToggleChecked;
            if (toggleEnabled && !toggleChecked) {
              chatValues[eff.id] = '';
              break;
            }

            const hasGreatWeaponFighting = (spell.effects || []).some(e => e?.type === 'GREAT_WEAPON_FIGHTING');
            if (hasGreatWeaponFighting) {
              console.log('[GWF] Active for spell:', spell?.name || spell?.id_suggestion);
            }
            const eaEffect = (spell.effects || []).find(e => e?.type === 'ELEMENTAL_ADEPT');
            if (eaEffect) {
              console.log('[Elemental Adept] Active for spell:', spell?.name || spell?.id_suggestion, 'element:', eaEffect?.properties?.element);
            }

            const finalDiceList = this.applySlotAndLevelScalingToDiceList(
              this.parseDiceList(baseDiceInput),
              slotLevel,
              spell.level || 0,
              slotScaling,
              levelScaling,
              playerLevel
            );

            // Determine if Savage Attacker applies: only for attack_roll spells and only for the first DAMAGE placeholder
            let useSavageAttacker = false;
            if (spell.castType === 'attack_roll') {
              const saEffect = (spell.effects || []).find(e => e?.type === 'SAVAGE_ATTACKER');
              const saChecked = !!(saEffect && saEffect.properties && saEffect.properties.menuToggleChecked);
              if (saEffect && saChecked) {
                // Identify the first DAMAGE placeholder id in template order
                const placeholderIds: string[] = Array.from((spell.template || '').matchAll(/\{\{([^}]+)\}\}/g)).map(m => String(m[1]).trim());
                const firstDamagePlaceholderId = placeholderIds.find(pid => {
                  const effById = (spell.effects || []).find(e => e.id === pid);
                  return effById?.type === 'DAMAGE';
                });
                useSavageAttacker = firstDamagePlaceholderId === eff.id;
              }
            }

            // Function to compute totals for this DAMAGE effect (one candidate)
            const computeTotals = (): number[] => {
              const baseBreakdowns = finalDiceList.map(d => this.rollDiceNotationWithBreakdown(d, { rerollOnOneOrTwo: hasGreatWeaponFighting }));
              const totals = baseBreakdowns.map(r => r.total);
              // On critical for attack-roll spells, reroll and add each dice entry in this DAMAGE effect
              if (spell.castType === 'attack_roll' && isCritical && finalDiceList.length > 0) {
                finalDiceList.forEach((notation, idx) => {
                  const extra = this.rollDiceNotationWithBreakdown(notation, { rerollOnOneOrTwo: hasGreatWeaponFighting });
                  totals[idx] = (totals[idx] || 0) + extra.total;
                });
              }
              // Elemental Adept: treat 1s as 2s on matching element; apply after rerolls
              const damageType = eff?.properties?.damageType ? String(eff.properties.damageType) : '';
              const elementalAdept = eaEffect;
              if (elementalAdept && damageType && elementalAdept?.properties?.element === damageType) {
                const onesFromBase = baseBreakdowns.reduce((sum, b) => sum + (b.rolls?.filter(r => r === 1).length || 0), 0);
                // Crit extra ones
                if (spell.castType === 'attack_roll' && isCritical && finalDiceList.length > 0) {
                  finalDiceList.forEach(notation => {
                    const extra = this.rollDiceNotationWithBreakdown(notation, { rerollOnOneOrTwo: hasGreatWeaponFighting });
                    const ones = extra.rolls?.filter(r => r === 1).length || 0;
                    if (ones > 0 && totals.length > 0) {
                      totals[0] = (totals[0] || 0) + ones * 1;
                    }
                  });
                }
                if (onesFromBase > 0 && totals.length > 0) {
                  totals[0] = (totals[0] || 0) + onesFromBase * 1;
                }
              }
              // Ability-mod bonus via levelScaling: add after dice (not doubled on crit)
              const abilityBonuses = this.computeAbilityBonusPerEntry(levelScaling, playerLevel, finalDiceList.length);
              abilityBonuses.forEach((b, idx) => { if (b) { totals[idx] = (totals[idx] || 0) + b; } });
              return totals;
            };

            let rolls: number[];
            if (useSavageAttacker) {
              // Roll two candidates and choose the higher total across all entries; use that candidate's per-entry values
              const candidateA = computeTotals();
              const candidateB = computeTotals();
              const sumA = candidateA.reduce((a, b) => a + b, 0);
              const sumB = candidateB.reduce((a, b) => a + b, 0);
              rolls = sumB > sumA ? candidateB : candidateA;
            } else {
              // Default single candidate
              const baseBreakdowns = finalDiceList.map(d => this.rollDiceNotationWithBreakdown(d, { rerollOnOneOrTwo: hasGreatWeaponFighting }));
              rolls = baseBreakdowns.map(r => r.total);
              if (spell.castType === 'attack_roll' && isCritical && finalDiceList.length > 0) {
                const extraBreakdowns = finalDiceList.map(notation => this.rollDiceNotationWithBreakdown(notation, { rerollOnOneOrTwo: hasGreatWeaponFighting }));
                extraBreakdowns.forEach((b, idx) => { rolls[idx] = (rolls[idx] || 0) + b.total; });
              }
              const damageType = eff?.properties?.damageType ? String(eff.properties.damageType) : '';
              const elementalAdept = eaEffect;
              if (elementalAdept && damageType && elementalAdept?.properties?.element === damageType) {
                const onesFromBase = finalDiceList.map(d => this.rollDiceNotationWithBreakdown(d, { rerollOnOneOrTwo: false })).reduce((sum, b) => sum + (b.rolls?.filter(r => r === 1).length || 0), 0);
                if (onesFromBase > 0 && rolls.length > 0) { rolls[0] = (rolls[0] || 0) + onesFromBase * 1; }
              }
              const abilityBonuses = this.computeAbilityBonusPerEntry(levelScaling, playerLevel, finalDiceList.length);
              abilityBonuses.forEach((b, idx) => { if (b) { rolls[idx] = (rolls[idx] || 0) + b; } });
            }

            const joined = rolls.join(', ');
            const typeText = eff?.properties?.damageType ? ` ${String(eff.properties.damageType)} damage` : '';
            chatValues[eff.id] = `${joined}${typeText}`;
            break;
          }
          case 'HEALING': {
            const notation = (eff?.properties?.healAmount as string) || '';
            if (notation) {
              const roll = this.rollDiceNotation(notation);
              chatValues[eff.id] = `${roll.breakdown} HP`;
            }
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
      let description = this.templateRenderer.renderSpellTemplateForChat(spell, chatValues);
      // Normalize sign sequences like "+-1" -> "-1"
      description = this.normalizeSignSequences(description);
      // Prefix adv/disadv only for attack-roll spells
      if (spell.castType === 'attack_roll') {
        if (rollMode === RollStateEnum.ADVANTAGE) {
          description = `(Rolled with advantage!) ${description}`;
        } else if (rollMode === RollStateEnum.DISADVANTAGE) {
          description = `(Rolled with disadvantage!) ${description}`;
        }
        if (isNatural1) {
          description += ' (natural 1!)';
        } else if (isCritical && typeof capturedD20 === 'number') {
          description += ` (natural ${capturedD20} - critical!)`;
        }
      }

      // Append any enabled extra damage toggles that are not already present in the template
      const enabledExtras = (spell.effects || [])
        .filter(e => e?.type === 'DAMAGE' && e?.properties?.menuToggleEnabled && e?.properties?.menuToggleChecked)
        .map(e => ({ effect: e as Effect, label: String(e.properties?.menuToggleLabel || e.name || '' ) }))
        .filter(x => !!x.label)
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

      if (enabledExtras.length > 0) {
        // Collect placeholders to avoid duplication
        const placeholderIds: string[] = Array.from((spell.template || '').matchAll(/\{\{([^}]+)\}\}/g)).map(m => String(m[1]).trim());
        const additions: string[] = [];
        for (const x of enabledExtras) {
          const eff = x.effect as any;
          if (placeholderIds.includes(eff.id)) {
            continue; // already in template output
          }
          const baseDiceInput = (eff?.properties?.dice as string) || '';
          const slotScaling = eff?.properties?.slotScaling;
          const levelScaling = eff?.properties?.levelScaling;
          const hasGreatWeaponFighting = (spell.effects || []).some(e => e?.type === 'GREAT_WEAPON_FIGHTING');
          const finalDiceList = this.applySlotAndLevelScalingToDiceList(
            this.parseDiceList(baseDiceInput),
            slotLevel,
            spell.level || 0,
            slotScaling,
            levelScaling,
            playerLevel
          );
          const baseBreakdowns = finalDiceList.map(d => this.rollDiceNotationWithBreakdown(d, { rerollOnOneOrTwo: hasGreatWeaponFighting }));
          const totals = baseBreakdowns.map(r => r.total);
          // Crit doubling for attack-roll spells
          if (spell.castType === 'attack_roll' && isCritical && finalDiceList.length > 0) {
            finalDiceList.forEach((notation, idx) => {
              const extra = this.rollDiceNotationWithBreakdown(notation, { rerollOnOneOrTwo: hasGreatWeaponFighting });
              totals[idx] = (totals[idx] || 0) + extra.total;
            });
          }
          // Elemental Adept adjustment
          const eaEffect = (spell.effects || []).find(e => e?.type === 'ELEMENTAL_ADEPT');
          const damageType = eff?.properties?.damageType ? String(eff.properties.damageType) : '';
          if (eaEffect && damageType && eaEffect?.properties?.element === damageType) {
            const onesFromBase = baseBreakdowns.reduce((sum, b) => sum + (b.rolls?.filter((r: number) => r === 1).length || 0), 0);
            if (onesFromBase > 0) {
              const delta = onesFromBase * 1;
              if (totals.length > 0) { totals[0] = (totals[0] || 0) + delta; }
            }
          }
          // Ability-mod bonus via levelScaling: add after dice (not doubled on crit)
          const abilityBonuses = this.computeAbilityBonusPerEntry(levelScaling, playerLevel, finalDiceList.length);
          abilityBonuses.forEach((b, idx) => { if (b) { totals[idx] = (totals[idx] || 0) + b; } });
          const joined = totals.join(', ');
          const typeText = eff?.properties?.damageType ? ` ${String(eff.properties.damageType)} damage` : '';
          additions.push(`${x.label}: ${joined}${typeText}`);
        }
        if (additions.length > 0) {
          description += (description?.trim().endsWith('.') ? '' : '') + ` + ` + additions.join(', ');
        }
      }

      // Append +10dmg if power-shot toggle active (first by order)
      const powerShot = (spell.effects || [])
        .filter(e => (e?.type === 'GREAT_WEAPON_MASTER' || e?.type === 'SHARPSHOOTER') && !!e?.properties?.menuToggleChecked)
        .sort((a: any, b: any) => (Number(a?.order || 0) - Number(b?.order || 0)))[0];
      if (powerShot) {
        description += `+10dmg`;
      }

      this.actionResults[spell.id_suggestion] = description;
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

  private parseDiceList(input: string | string[]): string[] {
    if (Array.isArray(input)) {
      return input.filter(s => typeof s === 'string').map(s => s.trim()).filter(Boolean);
    }
    if (!input || typeof input !== 'string') return [];
    return input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  private applySlotAndLevelScalingToDiceList(
    baseDiceList: string[],
    selectedSlot: number,
    baseSpellLevel: number,
    slotScaling: any,
    levelScaling: any,
    characterLevel: number
  ): string[] {
    let result: string[] = [...baseDiceList];

    // Slot scaling: adds dice per slot above base level
    const slotsAbove = (baseSpellLevel >= 1)
      ? Math.max(0, (selectedSlot || baseSpellLevel) - baseSpellLevel)
      : 0;

    const perSlotDice: string | undefined = slotScaling && typeof slotScaling.perSlotDice === 'string' ? slotScaling.perSlotDice : undefined;
    const separateRoll: boolean = !!(slotScaling && (slotScaling.separateRoll === true));

    if (perSlotDice && slotsAbove > 0) {
      if (separateRoll) {
        for (let i = 0; i < slotsAbove; i++) {
          result.push(perSlotDice);
        }
      } else {
        for (let i = 0; i < slotsAbove; i++) {
          // Merge into the first entry (create one if empty)
          if (result.length === 0) {
            result.push(perSlotDice);
          } else {
            result[0] = this.addDice(result[0], perSlotDice);
          }
        }
      }
    }

    // Level scaling: cumulative steps
    if (Array.isArray(levelScaling)) {
      const steps = levelScaling
        .filter((step: any) => typeof step?.level === 'number' && step?.level <= characterLevel)
        .sort((a: any, b: any) => a.level - b.level);

      steps.forEach((step: any) => {
        const stepDice: string | undefined = typeof step?.addDice === 'string' ? step.addDice : undefined;
        const stepCount: number | undefined = typeof step?.addCount === 'number' ? step.addCount : undefined;
        const stepSeparate: boolean = !!step?.separateRoll;

        if (typeof stepCount === 'number' && stepCount > 0) {
          const diceToAdd = stepDice || (result[0] || '').trim();
          if (!diceToAdd) return;
          if (stepSeparate) {
            for (let i = 0; i < stepCount; i++) { result.push(diceToAdd); }
          } else {
            for (let i = 0; i < stepCount; i++) {
              if (result.length === 0) { result.push(diceToAdd); }
              else { result[0] = this.addDice(result[0], diceToAdd); }
            }
          }
        }

        if (stepDice && (typeof stepCount !== 'number')) {
          // Single dice addition
          if (stepSeparate) {
            result.push(stepDice);
          } else {
            if (result.length === 0) { result.push(stepDice); }
            else { result[0] = this.addDice(result[0], stepDice); }
          }
        }
      });
    }

    return result;
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
    diceNotation: string,
    options?: { rerollOnOneOrTwo?: boolean }
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
      let roll = Math.floor(Math.random() * diceType) + 1;
      if (options?.rerollOnOneOrTwo && (roll === 1 || roll === 2)) {
        const prev = roll;
        const reroll = Math.floor(Math.random() * diceType) + 1;
        roll = reroll; // must use the new result even if 1 or 2
        console.log('[GWF] Reroll d' + diceType + ':', prev, '->', reroll);
      }
      rolls.push(roll);
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;
    const breakdown = `${rolls.join('+')}${modifier ? (modifier > 0 ? '+' + modifier : String(modifier)) : ''}`;
    return { total, breakdown };
  }

  private rollDiceNotationWithBreakdown(
    diceNotation: string,
    options?: { rerollOnOneOrTwo?: boolean }
  ): { total: number; rolls: number[]; modifier: number; breakdown: string } {
    if (!diceNotation || typeof diceNotation !== 'string' || !diceNotation.trim()) {
      return { total: 0, rolls: [], modifier: 0, breakdown: '' };
    }

    const parts = diceNotation.trim().match(/^(\d+)[dD](\d+)(?:([+-])(\d+))?$/);
    if (!parts) {
      const staticValue = parseInt(diceNotation.trim(), 10);
      if (!isNaN(staticValue)) {
        return { total: staticValue, rolls: [staticValue], modifier: 0, breakdown: String(staticValue) };
      }
      return { total: 0, rolls: [], modifier: 0, breakdown: diceNotation };
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
      let roll = Math.floor(Math.random() * diceType) + 1;
      if (options?.rerollOnOneOrTwo && (roll === 1 || roll === 2)) {
        const prev = roll;
        const reroll = Math.floor(Math.random() * diceType) + 1;
        roll = reroll; // must use the new result even if 1 or 2
        console.log('[GWF] Reroll d' + diceType + ':', prev, '->', reroll);
      }
      rolls.push(roll);
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;
    const breakdown = `${rolls.join('+')}${modifier ? (modifier > 0 ? '+' + modifier : String(modifier)) : ''}`;
    return { total, rolls, modifier, breakdown };
  }

  private normalizeSignSequences(text: string): string {
    if (!text) { return text; }
    // Replace "+-" (with optional spaces) with "-"; keep any surrounding spacing minimal
    return text.replace(/\+\s*-\s*/g, '-');
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

  // Open roll options on right-click for attack-roll spells
  callSpellModeDialog(spell: Spell, $event: MouseEvent): void {
    if (spell.castType !== 'attack_roll') {
      return; // no mode selection for save_throw or utility
    }
    $event.preventDefault();
    this.selectedItem.set(spell);
    this.lastSpellContextEvent = $event;
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      acceptVisible: false,
      rejectVisible: false,
      closable: true
    });
  }

  // Receive selected roll mode from the options panel
  onSpellRollModeSelected(mode: RollState): void {
    this.selectedSpellRollMode.set(mode || RollStateEnum.NORMAL);
    const spell = this.selectedItem();
    if (!spell) { return; }

    // Close the popup after selection
    this.confirmationService.close();

    const spellLevel = spell.level ?? 0;
    if (spellLevel === 0) {
      // Cantrips cast immediately at level 0
      this.castSpell(spell, 0, this.selectedSpellRollMode());
      return;
    }

    // Determine available and valid slots
    const playerLevel = this.playerCardStateService.playerCard$()?.level ?? 1;
    const availableSlots = this.spellcastingService.getAvailableSlots(playerLevel);
    const baseLevel = Math.max(1, spellLevel || 1);
    const validSlots = availableSlots.filter(l => l >= baseLevel);
    const hasHigher = validSlots.some(l => l > baseLevel);
    const defaultSlot = validSlots.length ? validSlots[0] : baseLevel;

    if (!hasHigher) {
      this.castSpell(spell, defaultSlot, this.selectedSpellRollMode());
      return;
    }

    // Open slot chooser anchored to last context event
    this.slotOptions = validSlots.map(l => ({ label: `Level ${l}`, value: l }));
    if (this.slotPanel && this.lastSpellContextEvent) {
      this.slotPanel.toggle(this.lastSpellContextEvent);
    }
  }

  // Persist toggle change
  onSpellExtraToggleChanged(evt: { id: string; checked: boolean }): void {
    const spell = this.selectedItem();
    if (!spell) return;
    const updated = { ...spell, effects: (spell.effects || []).map(e => e.id === evt.id ? ({ ...e, properties: { ...e.properties, menuToggleChecked: evt.checked } }) : e) };
    // Persist in player card
    const current = this.playerCardStateService.playerCard$();
    if (current && Array.isArray(current.spells)) {
      const updatedSpells = current.spells.map(s => s.id_suggestion === updated.id_suggestion ? updated : s);
      this.playerCardStateService.updatePlayerCard({ ...current, spells: updatedSpells } as any);
      this.selectedItem.set(updated);
    }
  }

  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  private rollD20WithMode(mode: RollState): number {
    if (mode === RollStateEnum.ADVANTAGE) {
      return Math.max(this.rollD20(), this.rollD20());
    } else if (mode === RollStateEnum.DISADVANTAGE) {
      return Math.min(this.rollD20(), this.rollD20());
    } else {
      return this.rollD20();
    }
  }

  // Halfling Lucky helper (spell-scoped)
  private applyHalflingLuckyToDie(initial: number, stacks: number): { value: number; triggers: number } {
    if (stacks <= 0) return { value: initial, triggers: 0 };
    let current = initial;
    let triggers = 0;
    let remaining = stacks;
    while (remaining > 0 && current === 1) {
      current = this.rollD20();
      triggers += 1;
      remaining -= 1;
    }
    return { value: current, triggers };
  }

  private formatLuckyDieDisplayForSpell(initial: number, adjusted: { value: number; triggers: number }): string {
    if (!adjusted || adjusted.triggers <= 0) return String(initial);
    if (initial === adjusted.value) return String(initial);
    return `${initial}\u2192${adjusted.value}`;
  }

  // Compute per-entry ability-mod bonuses from levelScaling steps
  private computeAbilityBonusPerEntry(
    levelScaling: any,
    characterLevel: number,
    entriesCount: number
  ): number[] {
    const bonuses: number[] = new Array(Math.max(0, entriesCount || 0)).fill(0);
    const steps = Array.isArray(levelScaling)
      ? levelScaling.filter((s: any) => typeof s?.level === 'number' && s.level <= characterLevel)
      : [];
    if (steps.length === 0 || entriesCount <= 0) return bonuses;
    const mods = this.abilityModifiers?.() || {};
    for (const step of steps) {
      const keyRaw = typeof step?.addAbilityMod === 'string' ? step.addAbilityMod : '';
      if (!keyRaw) continue;
      const key = String(keyRaw).toLowerCase();
      const mod = Number(mods?.[key] ?? 0);
      if (!mod) continue; // ignore zero to keep chip clean
      const applyTo = step?.applyTo === 'each' ? 'each' : 'first';
      if (applyTo === 'each') {
        for (let i = 0; i < bonuses.length; i++) bonuses[i] += mod;
      } else {
        bonuses[0] = (bonuses[0] || 0) + mod;
      }
    }
    return bonuses;
  }
}
