import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter, input } from '@angular/core';
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
  abilityModifiers = input({});

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
  @Output() emitRollResults: EventEmitter<{[key: string]: string}> = new EventEmitter();

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

  rollAttack(item: InventoryItem): void {
    if (item.type !== 'WEAPON') return;

    const abilityKey = (item.properties.range_type === 'RANGED' || item.properties.special_tags?.includes('Finesse')) ? 'dex' : 'str';
    const modifier = this.abilityModifiers()[abilityKey] ?? 0;
    const magicBonus = item.properties.magic_bonus ?? 0;
    const totalBonus = modifier + magicBonus;

    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const finalResult = d20Roll + totalBonus;

    const bonusString = totalBonus === 0 ? '' : (totalBonus > 0 ? ` + ${totalBonus}` : ` - ${Math.abs(totalBonus)}`);
    const resultDescription = `Attack with ${item.name}: ${finalResult} to hit (Roll: ${d20Roll}${bonusString})`;

    this.emitRollResults.emit({
      type: `WEAPON_ATTACK_${item.item_id_suggestion}`,
      description: resultDescription
    });
  }

  rollDamage(item: InventoryItem): void {
    if (item.type !== 'WEAPON' || !item.properties.damage_dice) return;

    const diceNotation = item.properties.damage_dice;
    const damageRollResult = this.parseAndRollDice(diceNotation);

    if (damageRollResult.error) {
      this.actionResults[item.item_id_suggestion] = 'Ошибка урона';
      return;
    }

    const abilityKey = (item.properties.range_type === 'RANGED' || item.properties.special_tags?.includes('Finesse')) ? 'dex' : 'str';
    const modifier = this.abilityModifiers()[abilityKey] ?? 0;
    const magicBonus = item.properties.magic_bonus ?? 0;
    const totalBonus = modifier + magicBonus;
    const finalDamage = damageRollResult.total + totalBonus;
    const bonusString = totalBonus === 0 ? '' : (totalBonus > 0 ? ` + ${totalBonus}` : ` - ${Math.abs(totalBonus)}`);
    const resultDescription = `Damage with ${item.name}: ${finalDamage} (Roll: ${damageRollResult.total}${bonusString})`;

    this.actionResults[item.item_id_suggestion] = `Урон: ${finalDamage}`;
    this.emitRollResults.emit({
      type: `WEAPON_DAMAGE_${item.item_id_suggestion}`,
      description: resultDescription
    });
  }

  useConsumable(item: InventoryItem): void {
    if (item.type !== 'CONSUMABLE' || !item.properties.effects || !item.properties.effects.length) return;

    const effect = item.properties.effects[0]; // Берем первый эффект

    if (effect.type === 'HEAL' && effect.heal_amount) {
      const result = this.parseAndRollDice(effect.heal_amount);
      if (!result.error) {
        this.actionResults[item.item_id_suggestion] = `Исцелено: ${result.total}`;
        this.emitRollResults.emit({
          type: `CONSUMABLE_USE_${item.item_id_suggestion}`,
          description: `Used ${item.name}. Healed for: ${result.total} (from ${effect.heal_amount})`
        });
      } else {
        this.actionResults[item.item_id_suggestion] = 'Ошибка эффекта';
      }
    }
  }

  private parseAndRollDice(diceNotation: string): { total: number; error: null } | { total: null; error: string } {
    if (!diceNotation || typeof diceNotation !== 'string') {
      return { total: null, error: `Invalid dice notation: ${diceNotation}` };
    }

    let total = 0;
    let modifier = 0;
    const parts = diceNotation.trim().match(/(\d+)[dD](\d+)(?:([+-])(\d+))?/);

    if (parts) {
      const numDice = parseInt(parts[1], 10);
      const diceType = parseInt(parts[2], 10);
      if (parts[3] && parts[4]) {
        modifier = parseInt(parts[4], 10);
        if (parts[3] === '-') { modifier = -modifier; }
      }
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * diceType) + 1;
      }
      total += modifier;
      return { total, error: null };
    }

    const staticValue = parseInt(diceNotation, 10);
    if (!isNaN(staticValue)) {
      return { total: staticValue, error: null };
    }

    return { total: null, error: `Unknown dice notation format: ${diceNotation}` };
  }
}
