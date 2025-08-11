import { Effect } from './effects.interface';

export type SpellCastType = 'utility' | 'attack_roll' | 'save_throw';

/**
 * Unified effect-based spell model used by the new system.
 * - Spells render via `template` with placeholders that match `effects` ids
 * - Effects are modular; scaling will be embedded in DAMAGE/HEALING (added in step 2)
 * - Passive spells set `isPassive = true` and omit `castType`
 */
export interface Spell {
  id_suggestion: string;
  name: string;
  type: 'SPELL' | 'ABILITY';
  description: string;

  /** Base spell level (0 for cantrips). Used as the default cast level. */
  level: number;

  /** If true, no cast UI should be shown. */
  isPassive: boolean;

  /** Casting classification for UI; omit when isPassive is true. */
  castType?: SpellCastType;

  /** Template string with placeholders like {{name}}, {{d20_roll}}, {{proficiency}}, {{attack_stat}}, {{save_dc}}, {{damage_*}} */
  template: string;

  /** List of modular effects; effect ids must match placeholders used in the template. */
  effects: Effect[];
} 