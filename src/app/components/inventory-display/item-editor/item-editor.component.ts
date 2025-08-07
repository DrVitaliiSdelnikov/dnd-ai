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
      (cancel)="close()">
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
    console.log('ITEM EDITOR | Item received in editor:', JSON.parse(JSON.stringify(this.item)));
    console.log('ITEM EDITOR | Item converted for editor:', JSON.parse(JSON.stringify(this.convertedItem)));
  }

  private convertOldItemToNewFormat(oldItem: InventoryItem): ItemWithEffects {
    const effects: Effect[] = [];
    let order = 0;

    // Convert old properties to effects
    if (oldItem.properties) {
      // Weapon proficiency
      if (oldItem.properties.proficient !== undefined) {
        effects.push({
          id: 'proficiency',
          name: 'Weapon Proficiency',
          type: 'WEAPON_PROFICIENCY',
          properties: { proficient: oldItem.properties.proficient },
          isSystemEffect: true,
          order: order++
        });
      }

      // Attack stat
      if (oldItem.properties.attack_stat) {
        effects.push({
          id: 'attack_stat',
          name: 'Attack Stat',
          type: 'ATTACK_STAT',
          properties: { attackStat: oldItem.properties.attack_stat },
          isSystemEffect: true,
          order: order++
        });
      }

      // Damage
      if (oldItem.properties.damage_dice && oldItem.properties.damage_type) {
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
        effects.push({
          id: 'magic_bonus',
          name: 'Magic Bonus',
          type: 'MAGIC_BONUS',
          properties: { bonus: oldItem.properties.magic_bonus },
          isSystemEffect: true,
          order: order++
        });
      }

      // Convert old effect details to healing effects
      if (oldItem.properties.effect_details) {
        oldItem.properties.effect_details.forEach((effect, index) => {
          if (effect.type === 'HEAL' && effect.heal_amount) {
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

    return {
      id_suggestion: oldItem.item_id_suggestion,
      name: oldItem.name,
      type: oldItem.type,
      description: oldItem.description || '',
      quantity: oldItem.quantity,
      effects: effects,
      template: template
    };
  }

  onItemChanged(newItem: ItemWithEffects): void {
    this.convertedItem = newItem;
  }

  save(): void {
    if (!this.convertedItem) return;

    // Convert back to old format for compatibility
    const updatedOldItem = this.convertNewItemToOldFormat(this.convertedItem);
    console.log('ITEM EDITOR | Item converted back to old format:', JSON.parse(JSON.stringify(updatedOldItem)));
    
    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) return;

    if (Array.isArray(currentCard.loot)) {
      const updatedItems = currentCard.loot.map(item =>
        item.item_id_suggestion === updatedOldItem.item_id_suggestion ? updatedOldItem : item
      );

      const isNew = !currentCard.loot.some(i => i.item_id_suggestion === updatedOldItem.item_id_suggestion);
      console.log('ITEM EDITOR | Is new item?', isNew);

      const updatedPlayerCard = { ...currentCard, loot: updatedItems };
      this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
    }

    this.dialogRef.close(updatedOldItem);
  }

  private convertNewItemToOldFormat(newItem: ItemWithEffects): InventoryItem {
    const properties: any = {};

    // Convert effects back to old properties
    newItem.effects.forEach(effect => {
      switch (effect.type) {
        case 'WEAPON_PROFICIENCY':
          properties.proficient = effect.properties.proficient;
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

    const itemType = newItem.type as InventoryItem['type'];

    return {
      item_id_suggestion: newItem.id_suggestion,
      name: newItem.name,
      type: itemType,
      description: newItem.description,
      quantity: newItem.quantity || 1,
      properties: properties,
      template: newItem.template
    };
  }

  close(): void {
    console.log('ITEM EDITOR | Closing dialog without saving.');
    this.dialogRef.close();
  }
}
