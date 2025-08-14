export interface Effect {
  id: string;
  name: string;
  type: EffectType;
  description?: string;
  properties: EffectProperties;
  isSystemEffect?: boolean; // For effects like AC that don't appear in preview (weapon effects now do appear)
  order: number; // For ordering in the list
}

export interface EffectProperties {
  [key: string]: any;
}

export interface EffectDefinition {
  name: string;
  description: string;
  fields: EffectField[];
  outputTemplate: (props: EffectProperties) => string;
  isSystemEffect?: boolean;
}

export interface EffectField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export type EffectType = 
  // Combat Effects
  | 'DAMAGE'
  | 'HEALING' 
  | 'GREAT_WEAPON_FIGHTING'
  | 'ELEMENTAL_ADEPT'
  | 'BUFF_STAT'
  | 'CONDITION'
  // System Effects (don't appear in preview)
  | 'ARMOR_CLASS'
  | 'ATTACK_STAT'
  | 'MAGIC_BONUS'
  // New generic proficiency and save throw for spells/items
  | 'PROFICIENCY'
  | 'SAVE_THROW'
  // Future expandable effects
  | 'STATIC_TEXT'
  | 'CONDITIONAL_EFFECT'
  // Dice roll effect for templates
  | 'D20_ROLL';

export interface ItemWithEffects {
  id_suggestion: string;
  name: string;
  type: string;
  description: string;
  quantity?: number;
  effects: Effect[];
  template: string; // Template for preview generation
}

export interface SpellWithEffects {
  id_suggestion: string;
  name: string;
  type: 'SPELL' | 'ABILITY';
  description: string;
  effects: Effect[];
  template: string; // Template for preview generation
} 