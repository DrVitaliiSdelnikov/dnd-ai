export interface RollEvent {
  type: string;
  description: string;
}

export type RollEventTypes = 'ABILITY_CHECK' | 'WEAPON_ATTACK' | 'WEAPON_DAMAGE' | 'GENERAL_DICE' | 'SPELL_CHECK' | 'SPELL_CAST';
