import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { InventoryItem } from '../../shared/interfaces/inventroy.interface';
import { NgForOf, NgIf } from '@angular/common';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'app-inventory-display',
  templateUrl: './inventory-display.component.html',
  styleUrls: ['./inventory-display.component.scss'],
  imports: [
    NgForOf,
    NgIf,
    ButtonDirective
  ],
  standalone: true
})
export class InventoryDisplayComponent implements OnInit, OnChanges {
  @Input() inventoryItems: InventoryItem[] = [];

  categorizedItems: { [key: string]: InventoryItem[] } = {};
  categoryOrder: string[] = ['WEAPON', 'ARMOR', 'CONSUMABLE', 'MISC_ITEM', 'OTHER'];
  categoryDisplayNames: { [key: string]: string } = {
    'WEAPON': 'Weapon',
    'ARMOR': 'Armor',
    'CONSUMABLE': 'Consumable',
    'MISC_ITEM': 'Misc items',
    'OTHER': 'Other'
  };
  damageRollResults: { [itemId: string]: number | null } = {};
  actionResults: { [itemId: string]: string | null } = {};
  @Output() emitRollResults: EventEmitter<string> = new EventEmitter();

  ngOnInit(): void {
    this.categorizeItems();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inventoryItems']) {
      this.categorizeItems();
      this.damageRollResults = {};
      this.actionResults = {};
    }
  }

  private categorizeItems(): void {
    if(!this.inventoryItems || !Array.isArray(this.inventoryItems)) return;

    this.categorizedItems = {};
    this.categoryOrder.forEach(categoryKey => {
      if (this.categoryDisplayNames[categoryKey]) {
        this.categorizedItems[this.categoryDisplayNames[categoryKey]] = [];
      }
    });

    this.inventoryItems.forEach(item => {
      let categoryName = this.categoryDisplayNames[item.type] || this.categoryDisplayNames['OTHER'];
      if (!this.categorizedItems[categoryName]) {
        this.categorizedItems[categoryName] = [];
      }
      this.categorizedItems[categoryName].push(item);
    });
  }

  objectKeys(obj: any): string[] {
    return this.categoryOrder
      .map(key => this.categoryDisplayNames[key])
      .filter(displayName => obj[displayName] && obj[displayName].length > 0);
  }

  rollDamage(item: InventoryItem): void {
    if (item.type === 'WEAPON' && item.properties.damage_dice) {
      const diceNotation = item.properties.damage_dice;
      let totalDamage = 0;
      let modifier = 0;

      const parts = diceNotation.match(/(\d+)[dD](\d+)(?:([+-])(\d+))?/);

      if (parts) {
        const numDice = parseInt(parts[1], 10);
        const diceType = parseInt(parts[2], 10);

        if (parts[3] && parts[4]) {
          modifier = parseInt(parts[4], 10);
          if (parts[3] === '-') {
            modifier = -modifier;
          }
        }

        for (let i = 0; i < numDice; i++) {
          totalDamage += Math.floor(Math.random() * diceType) + 1;
        }
        totalDamage += modifier;

        this.damageRollResults[item.item_id_suggestion] = totalDamage;
        this.emitRollResults.emit(`Damage ${item.name}: ${totalDamage} (roll: ${diceNotation})`);
      } else {
        this.damageRollResults[item.item_id_suggestion] = null;
      }
    }
  }

  useConsumable(item: InventoryItem): void {
    if (item.type !== 'CONSUMABLE' || !item.properties.effect_details) return;
    const effect = item.properties.effect_details;

    if (effect.type === 'HEAL' && effect.heal_amount) {
      const result = this.parseAndRollDice(effect.heal_amount);
      if (result !== null) {
        this.actionResults[item.item_id_suggestion] = `Heal: ${result}`;
        this.emitRollResults.emit(`Used ${item.name}. Healed for: ${result} (from ${effect.heal_amount})`);
      } else {
        this.actionResults[item.item_id_suggestion] = 'Ошибка эффекта';
      }
    }
  }

  private parseAndRollDice(diceNotation: string): number | null {
    let total = 0;
    let modifier = 0;

    const parts = diceNotation.match(/(\d+)[dD](\d+)(?:([+-])(\d+))?/);

    if (parts) {
      const numDice = parseInt(parts[1], 10);
      const diceType = parseInt(parts[2], 10);

      if (parts[3] && parts[4]) {
        modifier = parseInt(parts[4], 10);
        if (parts[3] === '-') {
          modifier = -modifier;
        }
      }
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * diceType) + 1;
      }
      total += modifier;
      return total;
    } else if (!isNaN(parseInt(diceNotation, 10))) {
      return parseInt(diceNotation, 10);
    }

    console.error('Неверный формат дайсов:', diceNotation);
    return null;
  }
}
