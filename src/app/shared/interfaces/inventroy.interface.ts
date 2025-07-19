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

  // ARMOR / SHIELD
  armor_class_value?: number;
  armor_type?: string;
  max_dex_bonus?: number | "NO_LIMIT";
  stealth_disadvantage?: boolean;
  strength_requirement?: number;

  // CONSUMABLE
  effect_description_brief?: string; // Важно для отображения
  effect_details?: {
    type?: "HEAL" | "BUFF_STAT" | "GRANT_EFFECT" | "DAMAGE";
    heal_amount?: string;
    stat_buffed?: string;
    buff_value?: number | string;
    buff_duration_rounds?: number | string;
    effect_granted?: string;
    damage_amount?: string;
    damage_type_inflicted?: string;
  };

  // ACCESSORY
  effects_list?: string[];

  // CURRENCY
  currency_type?: "gold" | "silver" | "copper" | string;

  utility_description?: string;
  is_quest_item?: boolean;
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
