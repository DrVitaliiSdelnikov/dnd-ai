export interface Spells {
  id_suggestion: string,
  name: string,
  type: "SPELL | ABILITY",
  description: string,

  properties: {
    target_type: "SELF | SINGLE_ENEMY | SINGLE_ALLY | AREA | MULTIPLE",
    range: string,
    duration: string,
    casting_time: string,
    usage_cost?: {
      resource: "MANA | SPELL_SLOT | HIT_POINTS |NONE",
      amount: number
    },
    usage_limit?: {
      charges: number
    },
    is_passive?: boolean,
    school_of_magic?: string,
    spell_level?: number,
    material_component_description?: string,
    effects: [
      {
        effect_type: "DAMAGE | HEAL | BUFF_STAT | DEBUFF_STAT | GRANT_EFFECT | SUMMON | CONTROL | UTILITY",
        damage_dice?: string,
        damage_type?: string,
        heal_dice?: string,
        stat_affected?: string,
        modifier_value?: string,
        effect_granted?: string,
        area_of_effect?: {
          shape: "SPHERE | CUBE | CONE | LINE",
          size: number,
          unit: "FEET | METERS"
        },
        saving_throw?: {
          ability: "STRENGTH | DEXTERITY | CONSTITUTION | INTELLIGENCE | WISDOM | CHARISMA",
          effect_on_save: "NEGATES | HALF_DAMAGE | NO_EFFECT_CHANGE"
        },
        description: "string"
      }
  ]
}
}
