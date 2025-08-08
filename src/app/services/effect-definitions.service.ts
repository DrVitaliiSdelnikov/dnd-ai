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
      description: 'Deals damage with dice and type',
      fields: [
        { key: 'dice', label: 'Damage Dice', type: 'text', required: true, placeholder: '1d6+2' },
        { key: 'damageType', label: 'Damage Type', type: 'select', required: true, 
          options: ['Slashing', 'Piercing', 'Bludgeoning', 'Fire', 'Cold', 'Lightning', 'Thunder', 'Acid', 'Poison', 'Necrotic', 'Radiant', 'Psychic', 'Force'] }
      ],
      outputTemplate: (props: EffectProperties) => {
        const flavorText = getDamageFlavorText(props.damageType);
        return `${props.dice} ${flavorText} damage`;
      }
    },

    HEALING: {
      name: 'Healing',
      description: 'Restores hit points',
      fields: [
        { key: 'healAmount', label: 'Healing Amount', type: 'text', required: true, placeholder: '2d4+2' }
      ],
      outputTemplate: (props: EffectProperties) => `heals ${props.healAmount} HP`
    },

    BUFF_STAT: {
      name: 'Buff Stat',
      description: 'Temporarily or permanently buffs a stat.',
      fields: [
        { key: 'stat', label: 'Stat', type: 'select', required: true, options: ['str', 'dex', 'con', 'int', 'wis', 'cha', 'ac'] },
        { key: 'buffValue', label: 'Buff Value', type: 'number', required: true },
        { key: 'duration', label: 'Duration (in rounds)', type: 'number', placeholder: 'Leave empty for permanent' }
      ],
      outputTemplate: (props: EffectProperties) => `${props.buffValue > 0 ? '+' : ''}${props.buffValue} to ${props.stat.toUpperCase()}`
    },

    GREAT_WEAPON_FIGHTING: {
      name: 'Great Weapon Fighting',
      description: 'Rerolls 1s and 2s on damage dice',
      fields: [],
      outputTemplate: () => 'with Great Weapon Fighting'
    },

    STATIC_TEXT: {
      name: 'Static Text',
      description: 'Custom text that appears in preview',
      fields: [
        { key: 'text', label: 'Text', type: 'text', required: true, placeholder: 'Enter custom text' }
      ],
      outputTemplate: (props: EffectProperties) => props.text || ''
    },

    // System Effects (don't appear in preview)
    WEAPON_PROFICIENCY: {
      name: 'Weapon Proficiency',
      description: 'Character has proficiency with this weapon',
      fields: [
        { key: 'proficient', label: 'Proficient', type: 'checkbox' }
      ],
      outputTemplate: (props: EffectProperties) => props.proficient ? 'proficiency' : ''
    },

    ARMOR_CLASS: {
      name: 'Armor Class',
      description: 'Provides AC bonus',
      fields: [
        { key: 'acValue', label: 'AC Value', type: 'number', required: true },
        { key: 'maxDexBonus', label: 'Max Dex Bonus', type: 'number', placeholder: 'Leave empty for no limit' }
      ],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    SPELL_LEVEL: {
      name: 'Spell Level',
      description: 'Defines the spell level',
      fields: [
        { key: 'level', label: 'Spell Level', type: 'number', required: true }
      ],
      outputTemplate: () => '',
      isSystemEffect: true
    },

    SPELL_PASSIVE: {
      name: 'Passive Spell',
      description: 'Marks spell as passive ability',
      fields: [
        { key: 'isPassive', label: 'Is Passive', type: 'checkbox' }
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

    CONDITION: {
      name: 'Condition',
      description: 'Applies a condition to a target.',
      fields: [
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'] },
        { key: 'duration', label: 'Duration (in rounds)', type: 'number', placeholder: 'Leave empty for permanent' }
      ],
      outputTemplate: (props: EffectProperties) => `applies the ${props.condition} condition`
    },

    MAGIC_BONUS: {
      name: 'Magic Bonus',
      description: 'Enhancement bonus (e.g., +1 weapon)',
      fields: [
        { key: 'bonus', label: 'Magic Bonus', type: 'number', required: true }
      ],
      outputTemplate: (props: EffectProperties) => `+${props.bonus}`
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

    // Dice roll display effect (chip appears in preview)
    D20_ROLL: {
      name: 'D20 Roll',
      description: 'Represents a 1d20 attack roll placeholder in templates',
      fields: [
        { key: 'dice', label: 'Dice', type: 'text', required: true, placeholder: '1d20' }
      ],
      outputTemplate: (props: EffectProperties) => props.dice || '1d20'
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
    return Object.keys(this.effectDefinitions) as EffectType[];
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
    'Fire': 'fiery',
    'Cold': 'freezing',
    'Lightning': 'shocking',
    'Thunder': 'thunderous',
    'Acid': 'corrosive',
    'Poison': 'venomous',
    'Necrotic': 'necrotic',
    'Radiant': 'radiant',
    'Psychic': 'psychic',
    'Force': 'force',
    'Slashing': 'slashing',
    'Piercing': 'piercing',
    'Bludgeoning': 'bludgeoning'
  };
  
  return flavorMap[damageType] || damageType.toLowerCase();
} 