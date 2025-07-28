export interface PlayCardAbilities {
    str: number,
    dex: number,
    con: number,
    int: number,
    wis: number,
    cha: number
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
  loot: any;
  spells: any;
  exp: number;
  abilities: PlayCardAbilities;
  notes: string;
  isUpdated: boolean
}
