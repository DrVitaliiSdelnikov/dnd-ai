import { InventoryItem } from './inventory.interface';
import { Spell } from './spell.interface';

export interface PlayCardAbilities {
    str: number,
    dex: number,
    con: number,
    int: number,
    wis: number,
    cha: number
}

export interface PlayerCardSkill {
  proficient: boolean;
}

export interface PlayerCardSkills {
  acrobatics: PlayerCardSkill;
  animal_handling: PlayerCardSkill;
  arcana: PlayerCardSkill;
  athletics: PlayerCardSkill;
  deception: PlayerCardSkill;
  history: PlayerCardSkill;
  insight: PlayerCardSkill;
  intimidation: PlayerCardSkill;
  investigation: PlayerCardSkill;
  medicine: PlayerCardSkill;
  nature: PlayerCardSkill;
  perception: PlayerCardSkill;
  performance: PlayerCardSkill;
  persuasion: PlayerCardSkill;
  religion: PlayerCardSkill;
  sleight_of_hand: PlayerCardSkill;
  stealth: PlayerCardSkill;
  survival: PlayerCardSkill;
}

export interface PlayerCard {
  hp: {
    current: number,
    maximum: number,
  },
  currency: number,
  name: string;
  race: string;
  class: string;
  background: string;
  level: number;
  loot: InventoryItem[] | 'SAME';
  spells: Spell[] | 'SAME';
  exp: number;
  abilities: PlayCardAbilities;
  skills: PlayerCardSkills | 'SAME';
  notes: string;
  isUpdated: boolean
}
