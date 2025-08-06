export interface ItemProperties {
  // Common
  effects: any;
  attunement_required?: boolean;
  magic_bonus?: number;

  // WEAPON
  damage_dice?: string;
  damage_type?: string;
  weapon_category?: string;
  range_type?: "MELEE" | "RANGED";
  range_increment?: string;
  special_tags?: string[];

  
  attack_stat?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  proficient?: boolean;

  // ARMOR / SHIELD
  armor_class_value?: number;
  armor_type?: string;
  max_dex_bonus?: number | "NO_LIMIT";
  stealth_disadvantage?: boolean;
  strength_requirement?: number;

  // CONSUMABLE
  effect_description_brief?: string; // Важно для отображения
  action_template?: {
    // The output template that the user can edit.
    // Placeholders like {name}, {attack}, {damage} will be replaced on execution.
    outputString: string;

    // An array of all the "block" effects that make up this action.
    effects: ActionEffect[];
  }

  // ACCESSORY
  effects_list?: string[];

  // CURRENCY
  currency_type?: "gold" | "silver" | "copper" | string;

  utility_description?: string;
  is_quest_item?: boolean;
}

export interface ActionEffect {
  id: string; // Unique ID for this block in the editor
  name: string; // Display name, e.g., "Base Damage", "Bonus from Strength"
  type: 'MODIFIER' | 'DAMAGE' | 'RE_ROLL' | 'SET_CRITICAL_RANGE' | 'CONDITION';

  // Which part of the action the effect applies to
  applyTo: 'ATTACK_ROLL' | 'DAMAGE_ROLL' | 'ARMOR_CLASS' | 'ANY';

  // For 'MODIFIER' type, which stat is being affected.
  stat?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'AC';

  // The value: can be a number ("+2"), a dice string ("1d6"), or a stat reference ("strength_modifier")
  value: string;

  damageType?: string; // e.g., "Fire", "Slashing" (for type: 'DAMAGE')

  // Conditions under which the effect triggers (e.g., "when having advantage")
  // This part can be expanded in the future for more complex logic.
  condition?: 'HAS_ADVANTAGE' | 'WEAPON_IS_TWO_HANDED' | null;
}

export interface CalculatedBonuses {
  statsBonuses: {[key: string]: number};
  armorClass: number;
}

export interface InventoryItem {
  item_id_suggestion: string;
  name: string;
  type: "WEAPON" | "ARMOR" | "SHIELD" | "CONSUMABLE" | "ACCESSORY" | "CURRENCY" | "MISC_ITEM" | "TOOL" | "MATERIAL" | string;
  description?: string;
  quantity: number;
  properties: ItemProperties;
}
