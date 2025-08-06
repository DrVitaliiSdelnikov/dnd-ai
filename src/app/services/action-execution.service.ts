import { inject, Injectable } from '@angular/core';
import { InventoryItem, ActionEffect } from '../shared/interfaces/inventroy.interface';
import { PlayerCardStateService } from './player-card-state.service';
import { DiceRollerService } from '../components/dice-roller/dice-roller.service';
import { RollEvent } from '../shared/interfaces/dice-roll';

interface RollResult {
  total: number;
  breakdown: string;
}

@Injectable({ providedIn: 'root' })
export class ActionExecutionService {
  private playerCardState = inject(PlayerCardStateService);
  private diceRoller = inject(DiceRollerService);

  executeAction(item: InventoryItem): { rollEvent: RollEvent; finalString: string } {
    const template = item.properties?.action_template;
    if (!template || !template.effects) {
      const description = `${item.name} is used.`;
      return {
        rollEvent: { type: 'ITEM_USAGE', description },
        finalString: description,
      };
    }

    const playerCard = this.playerCardState.playerCard$();
    if (!playerCard) {
      const description = 'Error: Player card not found.';
      return {
        rollEvent: { type: 'ERROR', description },
        finalString: description,
      };
    }

    const getAbilityModifier = (abilityValue: number): number => Math.floor((abilityValue - 10) / 2);
    const abilityModifiers: { [key: string]: number } = {
      str: getAbilityModifier(playerCard.abilities?.str ?? 10),
      dex: getAbilityModifier(playerCard.abilities?.dex ?? 10),
      con: getAbilityModifier(playerCard.abilities?.con ?? 10),
      int: getAbilityModifier(playerCard.abilities?.int ?? 10),
      wis: getAbilityModifier(playerCard.abilities?.wis ?? 10),
      cha: getAbilityModifier(playerCard.abilities?.cha ?? 10),
    };

    const level = playerCard.level ?? 1;
    const proficiencyBonus = Math.ceil(level / 4) + 1;

    const context: { [key: string]: number } = {
      ...abilityModifiers,
      proficiency_bonus: proficiencyBonus,
    };

    const effectGroups = this.groupEffectsByApplyTo(template.effects);
    const placeholderValues: { [key: string]: RollResult } = {};

    for (const groupName in effectGroups) {
      const key = this.mapApplyToToTemplateKey(groupName);
      if (key) {
        placeholderValues[key] = this.processEffectGroup(effectGroups[groupName], context);
      }
    }

    const finalString = this.replacePlaceholders(template.outputString, {
      ...placeholderValues,
      name: { total: 0, breakdown: item.name },
      damage_dice: { total: 0, breakdown: item.properties.damage_dice || '' },
      // Add other top-level item properties if needed
    });

    const description = finalString;
    const eventType = `ITEM_ACTION_${item.name.toUpperCase().replace(/\s+/g, '_')}`;

    return {
      rollEvent: { type: eventType, description },
      finalString: description,
    };
  }

  private processEffectGroup(effects: ActionEffect[], context: { [key: string]: number }): RollResult {
    let total = 0;
    const breakdownParts: string[] = [];

    effects.forEach(effect => {
      let value = 0;
      let part = '';
      const effectValueStr = (effect.value || '').toLowerCase().replace('_modifier', '');

      if (this.diceRoller.isDiceNotation(effect.value)) {
        const roll = this.diceRoller.rollDetailed(effect.value);
        value = roll.total;
        part = `${value} (${effect.name}: ${roll.breakdown})`;
      } else if (context[effectValueStr] !== undefined) {
        value = context[effectValueStr];
        part = `${value} [${effect.name}]`;
      } else if (!isNaN(parseInt(effect.value, 10))) {
        value = parseInt(effect.value, 10);
        part = `${value} [${effect.name}]`;
      }

      total += value;
      breakdownParts.push(part);
    });

    const overallBreakdown = breakdownParts.join(' + ');
    return {
      total,
      breakdown: breakdownParts.length > 1 ? `(${overallBreakdown})` : overallBreakdown,
    };
  }

  private groupEffectsByApplyTo(effects: ActionEffect[]): { [key: string]: ActionEffect[] } {
    return effects.reduce((acc, effect) => {
      const key = effect.applyTo;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(effect);
      return acc;
    }, {} as { [key: string]: ActionEffect[] });
  }

  private mapApplyToToTemplateKey(applyTo: string): string | null {
    const map: { [key: string]: string } = {
      'ATTACK_ROLL': 'attack',
      'DAMAGE_ROLL': 'damage',
    };
    return map[applyTo] || applyTo.toLowerCase();
  }

  private replacePlaceholders(template: string, values: { [key: string]: RollResult | { total: number, breakdown: string } }): string {
    let result = template;
    for (const key in values) {
      const placeholder = `{${key}}`;
      if (result.includes(placeholder)) {
        result = result.replace(new RegExp(placeholder, 'g'), values[key].breakdown);
      }
    }
    return result;
  }
} 