import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { InventoryItem } from '../../../shared/interfaces/inventory.interface';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import { EffectEditorComponent } from '../../effect-editor/effect-editor.component';
import { ItemWithEffects, Effect } from '../../../shared/interfaces/effects.interface';

@Component({
  selector: 'app-item-editor',
  standalone: true,
  imports: [CommonModule, EffectEditorComponent],
  template: `
    <app-effect-editor 
      [item]="convertedItem"
      [isSpell]="false"
      (itemChanged)="onItemChanged($event)"
      (save)="save()"
      (cancel)="close()"
      (delete)="delete()">
    </app-effect-editor>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class ItemEditorComponent implements OnInit {
  item: InventoryItem;
  convertedItem: ItemWithEffects | null = null;

  private playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);

  ngOnInit(): void {
    this.item = this.config.data.item;
    this.convertedItem = this.convertOldItemToNewFormat(this.item);
    console.log('🧰 ItemEditor: ngOnInit original item:', this.item);
    console.log('🧰 ItemEditor: ngOnInit convertedItem:', this.convertedItem);
  }

  private convertOldItemToNewFormat(oldItem: InventoryItem): ItemWithEffects {
    console.log('🔄 ItemEditor: convertOldItemToNewFormat called with:', oldItem);
    console.log('🔍 ItemEditor: oldItem.properties:', oldItem.properties);
    
    const effects: Effect[] = [];
    let order = 0;

    // Handle both property names for compatibility
    const itemId = (oldItem as any).item_id_suggestion || (oldItem as any).id_suggestion;

    // Check if we have the new effects format
    if (oldItem.properties && oldItem.properties.effects && Array.isArray(oldItem.properties.effects)) {
      console.log('✅ ItemEditor: Found new effects format, using directly:', oldItem.properties.effects);
      return {
        id_suggestion: itemId,
        name: oldItem.name || '',
        description: oldItem.description || '',
        template: oldItem.template || '',
        type: oldItem.type || 'MISC_ITEM',
        quantity: oldItem.quantity || 1,
        effects: oldItem.properties.effects
      };
    }

    console.log('⚠️ ItemEditor: No new effects format found, trying to convert old format...');

    // Convert old properties to effects
    if (oldItem.properties) {
      // Proficiency (presence means proficient)
      const legacyProficient = (oldItem.properties as any)?.['proficient'];
      if (legacyProficient !== undefined && legacyProficient) {
        console.log('🔧 ItemEditor: Converting proficiency -> PROFICIENCY');
        effects.push({
          id: 'proficiency',
          name: 'Proficiency',
          type: 'PROFICIENCY',
          properties: {},
          order: order++
        });
      }

      // Attack stat
      if (oldItem.properties.attack_stat) {
        console.log('🔧 ItemEditor: Converting attack_stat');
        effects.push({
          id: 'attack_stat',
          name: 'Attack Stat',
          type: 'ATTACK_STAT',
          properties: { attackStat: oldItem.properties.attack_stat },
          order: order++
        });
      }

      // Damage
      if (oldItem.properties.damage_dice && oldItem.properties.damage_type) {
        console.log('🔧 ItemEditor: Converting damage');
        effects.push({
          id: 'damage',
          name: 'Damage',
          type: 'DAMAGE',
          properties: {
            dice: oldItem.properties.damage_dice,
            damageType: oldItem.properties.damage_type
          },
          order: order++
        });
      }

      // Armor Class
      if (oldItem.properties.armor_class_value) {
        console.log('🔧 ItemEditor: Converting armor class');
        effects.push({
          id: 'armor_class',
          name: 'Armor Class',
          type: 'ARMOR_CLASS',
          properties: {
            acValue: oldItem.properties.armor_class_value,
            maxDexBonus: oldItem.properties.max_dex_bonus
          },
          isSystemEffect: true,
          order: order++
        });
      }

      // Magic bonus
      if (oldItem.properties.magic_bonus) {
        console.log('🔧 ItemEditor: Converting magic bonus');
        effects.push({
          id: 'magic_bonus',
          name: 'Magic Bonus',
          type: 'MAGIC_BONUS',
          properties: { bonus: oldItem.properties.magic_bonus },
          order: order++
        });
      }

      // Convert old effect details to healing effects
      if (oldItem.properties.effect_details) {
        console.log('🔧 ItemEditor: Converting effect_details');
        oldItem.properties.effect_details.forEach((effect, index) => {
          if (effect.type === 'HEAL' && effect.heal_amount) {
            console.log('🔧 ItemEditor: Converting healing effect');
            effects.push({
              id: `healing_${index}`,
              name: 'Healing Effect',
              type: 'HEALING',
              properties: { healAmount: effect.heal_amount },
              order: order++
            });
          }
        });
      }
    }

    console.log('🎯 ItemEditor: Final converted effects array:', effects);

    // Generate a default template
    let template = `{{name}}`;
    const combatEffects = effects.filter(e => !e.isSystemEffect);
    if (combatEffects.length > 0) {
      const effectRefs = combatEffects.map(e => `{{${e.id}}}`).join(' and ');
      if (oldItem.type === 'WEAPON') {
        template = `{{name}} attacks dealing ${effectRefs}.`;
      } else if (oldItem.type === 'CONSUMABLE') {
        template = `{{name}} provides ${effectRefs}.`;
      } else {
        template = `{{name}} has ${effectRefs}.`;
      }
    } else {
      template = `{{name}} is a ${oldItem.type.toLowerCase()}.`;
    }

    const newFormatItem: ItemWithEffects = {
      id_suggestion: itemId,
      name: oldItem.name || '',
      type: oldItem.type,
      description: oldItem.description || '',
      quantity: oldItem.quantity,
      effects: effects,
      template: oldItem.template || ''
    };

    console.log('🧪 ItemEditor: convertOldItemToNewFormat result:', newFormatItem);
    return newFormatItem;
  }

  onItemChanged(newItem: ItemWithEffects): void {
    this.convertedItem = newItem;
    console.log('📥 ItemEditor:onItemChanged received:', newItem);
  }

  save(): void {
    if (!this.convertedItem) {
      return;
    }

    // Convert back to old format for compatibility
    const updatedOldItem = this.convertNewItemToOldFormat(this.convertedItem);
    console.log('💾 ItemEditor: save -> convertNewItemToOldFormat result:', updatedOldItem);

    const currentLoot = this.playerCardStateService.playerCard$().loot;
    
    const isNew = Array.isArray(currentLoot) && !currentLoot.some(i => {
      const lootItemId = (i as any).item_id_suggestion || (i as any).id_suggestion;
      return lootItemId === updatedOldItem.item_id_suggestion;
    });

    console.log('📦 ItemEditor: save closing dialog with isNew:', isNew);
    this.dialogRef.close({item: updatedOldItem, isNew: isNew});
  }

  private convertNewItemToOldFormat(newItem: ItemWithEffects): InventoryItem {
    const properties: any = {};

    // Convert effects back to old properties
    newItem.effects.forEach(effect => {
      console.log('🔁 ItemEditor:convertNewItemToOldFormat processing effect:', effect);
      switch (effect.type) {
        case 'PROFICIENCY':
          // presence only; no boolean plumbing in new system
          break;
        case 'ATTACK_STAT':
          properties.attack_stat = effect.properties.attackStat;
          break;
        case 'DAMAGE':
          properties.damage_dice = effect.properties.dice;
          properties.damage_type = effect.properties.damageType;
          break;
        case 'ARMOR_CLASS':
          properties.armor_class_value = effect.properties.acValue;
          properties.max_dex_bonus = effect.properties.maxDexBonus;
          break;
        case 'MAGIC_BONUS':
          properties.magic_bonus = effect.properties.bonus;
          break;
        case 'HEALING':
          if (!properties.effect_details) properties.effect_details = [];
          properties.effect_details.push({
            type: 'HEAL',
            heal_amount: effect.properties.healAmount
          });
          break;
      }
    });

    // Preserve full effects array in the saved item to support the new renderer
    properties.effects = newItem.effects;

    // Handle both property names for compatibility - use the original item's ID
    const originalId = (this.item as any).item_id_suggestion || (this.item as any).id_suggestion;

    const oldFormatItem: InventoryItem = {
      item_id_suggestion: originalId, // Keep original ID
      name: newItem.name,
      description: newItem.description,
      type: newItem.type as any,
      quantity: newItem.quantity || this.item.quantity || 1,
      properties: properties,
      template: newItem.template
    };

    console.log('🧯 ItemEditor:convertNewItemToOldFormat final oldFormatItem:', oldFormatItem);
    return oldFormatItem;
  }

  close(): void {
    this.dialogRef.close();
  }

  delete(): void {
    if (!this.item) { this.dialogRef.close({ deleted: true }); return; }
    // Handle both property names for compatibility
    const itemId = (this.item as any).item_id_suggestion || (this.item as any).id_suggestion;
    if (itemId) {
      this.playerCardStateService.removeItemFromInventory(itemId);
    }
    this.dialogRef.close({ deleted: true });
  }
}
