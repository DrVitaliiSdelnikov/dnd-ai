export type SpellType = 'SPELL' | 'ABILITY';
export type TargetType = 'SELF' | 'SINGLE_ENEMY' | 'SINGLE_ALLY' | 'AREA' | 'MULTIPLE' | 'OBJECT';
export type ActionType = 'ATTACK_ROLL' | 'SAVING_THROW' | 'UTILITY' | 'CONTESTED_CHECK';
export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface DamageEffect {
  dice: string;
  type: string;
  on_save: 'HALF' | 'NONE' | 'SPECIAL_EFFECT';
}

export interface SpellProperties {
  target_type: TargetType;
  range: string;
  charges?: number;
  is_passive: boolean;
  reset_condition?: string;

  school_of_magic?: string;
  spell_level: number;
  spell_components?: string;
  action_type: ActionType;

  attack_info?: {
    attack_type: string;
    ability?: AbilityKey;
  } | null;

  saving_throw_info?: {
    ability: AbilityKey;
    dc_calculation: 'SPELLCASTING_ABILITY' | 'FIXED';
    fixed_dc?: number;
  } | null;

  damage_info?: {
    effects: DamageEffect[];
  } | null;
}

export interface Spell {
  id_suggestion: string;
  name: string;
  type: SpellType;
  description: string;
  properties: SpellProperties;
}
