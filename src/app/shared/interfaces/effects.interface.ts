export interface Effect {
  id: string;
  name: string;
  type: EffectType;
  description?: string;
  properties: EffectProperties;
  isSystemEffect?: boolean; // For effects like proficiency, AC, spell level that don't appear in preview
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
  | 'BUFF_STAT'
  | 'CONDITION'
  // System Effects (don't appear in preview)
  | 'WEAPON_PROFICIENCY'
  | 'ARMOR_CLASS'
  | 'SPELL_LEVEL'
  | 'SPELL_PASSIVE'
  | 'ATTACK_STAT'
  | 'MAGIC_BONUS'
  // Future expandable effects
  | 'STATIC_TEXT'
  | 'CONDITIONAL_EFFECT';

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