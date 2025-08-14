import { Injectable } from '@angular/core';
import { EffectDefinition, EffectType, EffectProperties } from '../shared/interfaces/effects.interface';

@Injectable({
  providedIn: 'root'
})
export class EffectDefinitionsService {
  
  private readonly effectDefinitions: Record<EffectType, EffectDefinition> = {
    // Combat Effects (appear in preview)
    DAMAGE: {
      name: 'Damage',
      description: 'Deals damage with dice and type. Supports optional slot/level scaling. You can enter multiple dice, comma-separated (e.g., 1d4+1, 1d4+1, 1d4+1). If a damage type is set, avoid adding the word "damage" in the template to prevent duplication.',
      fields: [
        { key: 'dice', label: 'Damage Dice', type: 'text', required: true, placeholder: '1d6+2 or 1d4+1, 1d4+1, 1d4+1' },
        { key: 'damageType', label: 'Damage Type', type: 'select', required: false, 
          options: ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison', 'necrotic', 'radiant', 'psychic', 'force'] },
        // New: optional right-click toggle exposure
        { key: 'menuToggleEnabled', label: 'Expose in right-click menu', type: 'checkbox' },
        { key: 'menuToggleLabel', label: 'Menu label', type: 'text', placeholder: 'e.g., Sneak Attack' },
        { key: 'menuToggleChecked', label: 'Default checked', type: 'checkbox' }
      ],
      outputTemplate: (props: EffectProperties) => {
        const typeText = props.damageType ? ` ${props.damageType}` : '';
        return `${props.dice}${typeText ? ' ' + typeText : ''}`;
      }
    },

    HEALING: {
      name: 'Healing',
      description: 'Restores hit points. Supports optional slot/level scaling.',
      fields: [
        { key: 'healAmount', label: 'Healing Amount', type: 'text', required: true, placeholder: '2d4+2' }
      ],
      outputTemplate: (props: EffectProperties) => `${props.healAmount} HP`
    },

    BUFF_STAT: {
      name: 'Buff Stat',
      description: 'Temporarily or permanently buffs a stat.',
      fields: [
        { key: 'stat', label: 'Stat', type: 'select', required: true, options: ['str', 'dex', 'con', 'int', 'wis', 'cha', 'ac'] },
        { key: 'buffValue', label: 'Buff Value', type: 'number', required: true },
        { key: 'duration', label: 'Duration (in rounds)', type: 'number', placeholder: 'Leave empty for permanent' }
      ],
      outputTemplate: (props: EffectProperties) => `${props.buffValue > 0 ? '+' : ''}${props.buffValue} to ${props.stat?.toUpperCase()}`
    },

    CONDITION: {
      name: 'Condition',
      description: 'Applies a condition to a target.',
      fields: [
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'] },
        { key: 'duration', label: 'Duration (text)', type: 'text', placeholder: 'e.g., 1 minute' },
        { key: 'text', label: 'Extra Text', type: 'text', placeholder: 'e.g., until end of your next turn' }
      ],
      outputTemplate: (props: EffectProperties) => `${props.condition}${props.duration ? ' (' + props.duration + ')' : ''}${props.text ? ': ' + props.text : ''}`
    },

    STATIC_TEXT: {
      name: 'Static Text',
      description: 'Custom text that appears inline',
      fields: [
        { key: 'text', label: 'Text', type: 'text', required: true, placeholder: 'Enter custom text' }
      ],
      outputTemplate: (props: EffectProperties) => props.text || ''
    },

    CONDITIONAL_EFFECT: {
      name: 'Conditional Effect',
      description: 'Effect that triggers under certain conditions',
      fields: [
        { key: 'condition', label: 'Condition', type: 'text', required: true, placeholder: 'on critical hit' },
        { key: 'effect', label: 'Effect', type: 'text', required: true, placeholder: 'target catches fire' }
      ],
      outputTemplate: (props: EffectProperties) => `${props.condition}: ${props.effect}`
    },

    // System / mechanics-related
    ARMOR_CLASS: {
      name: 'Armor Class',
      description: 'Provides AC baseline and ability-based bonuses with optional conditions',
      fields: [
        { key: 'acValue', label: 'AC Value', type: 'number', required: true },
        // Ability caps: 0 means ability is ignored; >0 means apply modifier with positives clamped to cap and negatives allowed
        { key: 'dexBonusCap', label: 'Dex Bonus Cap', type: 'number', placeholder: '0 = ignore; >0 = cap; negatives allowed' },
        { key: 'conBonusCap', label: 'Con Bonus Cap', type: 'number', placeholder: '0 = ignore; >0 = cap; negatives allowed' },
        { key: 'wisBonusCap', label: 'Wis Bonus Cap', type: 'number', placeholder: '0 = ignore; >0 = cap; negatives allowed' },
        // Back-compat legacy field (may be present in existing data); editor will not show it but logic will read it
        // { key: 'maxDexBonus', label: 'Max Dex Bonus (legacy)', type: 'number' },
        // Conditional flags
        { key: 'noArmorOnly', label: 'No Armor Only', type: 'checkbox' },
        { key: 'shieldAllowed', label: 'Shield Allowed', type: 'checkbox' },
        { key: 'isMainArmor', label: 'Is Main Armor?', type: 'checkbox' }
      ],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    ATTACK_STAT: {
      name: 'Attack Stat',
      description: 'Which ability score to use for attacks',
      fields: [
        { key: 'attackStat', label: 'Attack Stat', type: 'select', required: true,
          options: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }
      ],
      outputTemplate: (props: EffectProperties) => `using ${props.attackStat?.toUpperCase()}`
    },

    MAGIC_BONUS: {
      name: 'Magic Bonus',
      description: 'Enhancement bonus (e.g., +1)',
      fields: [
        { key: 'bonus', label: 'Magic Bonus', type: 'number', required: true }
      ],
      outputTemplate: (props: EffectProperties) => `+${props.bonus}`
    },

    PROFICIENCY: {
      name: 'Proficiency',
      description: 'Presence means you add proficiency bonus',
      fields: [],
      outputTemplate: () => 'PB' // Render succinct chip text; numeric value is computed elsewhere
    },

    SAVE_THROW: {
      name: 'Save DC',
      description: 'Fixed DC and target ability for saving throw spells',
      fields: [
        { key: 'dc', label: 'DC', type: 'number', required: true },
        { key: 'saveAbility', label: 'Ability', type: 'select', required: true, options: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }
      ],
      outputTemplate: (props: EffectProperties) => `DC ${props.dc} (${props.saveAbility?.toUpperCase()})`
    },

    // Dice roll display effect (chip appears in preview)
    D20_ROLL: {
      name: 'Dice',
      description: 'Generic dice roll placeholder for templates. Accepts any dice notation (e.g., 1d4, 2d6+3). Defaults to 1d20 if empty.',
      fields: [
        { key: 'dice', label: 'Dice', type: 'text', required: true, placeholder: '1d20' }
      ],
      outputTemplate: (props: EffectProperties) => props.dice || '1d20'
    },

    // System-only: Great Weapon Fighting (reroll 1s and 2s on damage dice once)
    GREAT_WEAPON_FIGHTING: {
      name: 'Great Weapon Fighting',
      description: 'When rolling damage, reroll any 1s or 2s once and use the new results. Applies only if this effect is present on the current weapon/spell.',
      fields: [],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    // System-only: Elemental Adept (treat 1s as 2s for chosen element damage dice)
    ELEMENTAL_ADEPT: {
      name: 'Elemental Adept',
      description: 'For damage of the chosen element, any damage die result of 1 is treated as 2. Applies after any rerolls (e.g., Great Weapon Fighting).',
      fields: [
        { key: 'element', label: 'Element', type: 'select', required: true, options: ['fire','cold','lightning','thunder','acid','poison','necrotic','radiant','psychic','force'] }
      ],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    // System-only: Halfling Lucky (reroll d20 result of 1; stacks)
    HALFLING_LUCKY: {
      name: 'Halfling Lucky',
      description: 'When you roll a 1 on a d20 (skill checks when passive; host-only for active spell/item), reroll the die and use the new result. Stacks add extra rerolls if the result is still 1.',
      fields: [],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    // System-only: Improved Critical (custom critical threshold)
    IMPROVED_CRITICAL: {
      name: 'Improved Critical',
      description: 'Your attacks score a critical hit on a roll equal to or above the set number (2–19). Applies only to this weapon or attack-roll spell.',
      fields: [
        { key: 'critThreshold', label: 'Critical Threshold (2–19)', type: 'number', required: true, placeholder: 'e.g., 19' }
      ],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    // System-only: Great Weapon Master (-5 to hit, +10 damage when toggled)
    GREAT_WEAPON_MASTER: {
      name: 'Great Weapon Master',
      description: 'When toggled, apply -5 to the attack roll (to-hit) and +10 damage on hit. Treated as a right-click toggle.',
      fields: [],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    // System-only: Sharpshooter (-5 to hit, +10 damage when toggled)
    SHARPSHOOTER: {
      name: 'Sharpshooter',
      description: 'When toggled, apply -5 to the attack roll (to-hit) and +10 damage on hit. Treated as a right-click toggle.',
      fields: [],
      outputTemplate: () => '',
      isSystemEffect: true
    }
  };

  getEffectDefinition(type: EffectType): EffectDefinition {
    const def = this.effectDefinitions[type];
    if (!def) {
      // Fallback to a safe definition to prevent runtime crashes
      return { name: 'Unknown', description: 'Unknown effect', fields: [], outputTemplate: () => '', isSystemEffect: true };
    }
    return def;
  }

  getAllEffectDefinitions(): Record<EffectType, EffectDefinition> {
    return this.effectDefinitions;
  }

  getAvailableEffectTypes(): EffectType[] {
    return (Object.keys(this.effectDefinitions) as EffectType[]);
  }

  getCombatEffectTypes(): EffectType[] {
    return this.getAvailableEffectTypes().filter(type => 
      !this.effectDefinitions[type].isSystemEffect
    );
  }

  getSystemEffectTypes(): EffectType[] {
    return this.getAvailableEffectTypes().filter(type => 
      this.effectDefinitions[type].isSystemEffect
    );
  }
}

// Helper function moved outside the class
function getDamageFlavorText(damageType: string): string {
  const flavorMap: Record<string, string> = {
    'fire': 'fire',
    'cold': 'cold',
    'lightning': 'lightning',
    'thunder': 'thunder',
    'acid': 'acid',
    'poison': 'poison',
    'necrotic': 'necrotic',
    'radiant': 'radiant',
    'psychic': 'psychic',
    'force': 'force',
    'slashing': 'slashing',
    'piercing': 'piercing',
    'bludgeoning': 'bludgeoning'
  };
  
  return flavorMap[damageType] || (damageType ? damageType.toLowerCase() : '');
} 