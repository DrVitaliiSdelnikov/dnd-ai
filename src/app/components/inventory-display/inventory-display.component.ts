import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  inject,
  WritableSignal, signal, computed
} from '@angular/core';
import { InventoryItem } from '../../shared/interfaces/inventory.interface';
import { NgForOf, NgIf } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import {
  RollOptionsPanelComponent,
  RollState, RollStateEnum
} from '../../shared/components/roll-options-panel/roll-options-panel.component';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { ItemEditorComponent } from './item-editor/item-editor.component';
import { DialogService } from 'primeng/dynamicdialog';
import { PlayerCardStateService } from '../../services/player-card-state.service';
import { SpeedDialModule } from 'primeng/speeddial';

@Component({
  selector: 'app-inventory-display',
  templateUrl: './inventory-display.component.html',
  styleUrls: ['./inventory-display.component.scss'],
  imports: [
    NgForOf,
    NgIf,
    ButtonDirective,
    Tooltip,
    ConfirmPopupModule,
    RollOptionsPanelComponent,
    SpeedDialModule
  ],
  providers: [
    MessageService,
    ConfirmationService,
    DialogService
  ],
  standalone: true
})
export class InventoryDisplayComponent implements OnInit, OnChanges {
  @Input() inventoryItems: InventoryItem[] = [];
  selectedMode: WritableSignal<string> = signal(RollStateEnum.NORMAL);
  selectedItem: WritableSignal<InventoryItem> = signal(null);
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private dialogService: DialogService = inject(DialogService);
  private messageService: MessageService = inject(MessageService);
  private playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);

  abilityModifiers = computed(() => {
    return this.playerCardStateService.abilityModifiers$();
  });
  groupedByCategory = computed(() => {
    return this.inventoryItems.reduce((acc, item) => {
      const categoryName = this.categoryDisplayNames[item.type] || this.categoryDisplayNames['OTHER'];
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(item);
      return acc;
    }, {} as { [key: string]: InventoryItem[] });
  });
  modeLabels = {
    [RollStateEnum.ADVANTAGE]: 'Advantage',
    [RollStateEnum.NORMAL]: 'Normal',
    [RollStateEnum.DISADVANTAGE]: 'Disadvantage'
  };

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
  @Output() itemUsed = new EventEmitter<InventoryItem>();
  @Output() itemAdded = new EventEmitter<InventoryItem>();
  itemAddOptions: MenuItem[];

  ngOnInit(): void {
    this.categorizeItems();
    this.itemAddOptions = [
      {
        icon: 'pi pi-shield',
        tooltip: 'Add Armor',
        command: () => this.addNewItem('ARMOR')
      },
      {
        icon: 'pi pi-bolt',
        tooltip: 'Add Weapon',
        command: () => this.addNewItem('WEAPON')
      },
      {
        icon: 'pi pi-fw pi-box',
        tooltip: 'Add Item',
        command: () => this.addNewItem('MISC_ITEM')
      }
    ];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inventoryItems'] && this.inventoryItems) {
      this.inventoryItems.forEach(item => {
        if (!item.properties) {
          item.properties = { effects: [] };
        }
      });
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

  rollAttackAndDamage(item: InventoryItem, mode: RollState = RollStateEnum.NORMAL): void {
    if (item.type !== 'WEAPON' || !item.properties.effects) { return; }

    const effects = item.properties.effects;
    const attackStatEffect = effects.find(e => e.type === 'ATTACK_STAT');
    const proficiencyEffect = effects.find(e => e.type === 'WEAPON_PROFICIENCY');
    const damageEffects = effects.filter(e => e.type === 'DAMAGE');
    const magicBonusEffect = effects.find(e => e.type === 'MAGIC_BONUS');

    if (!attackStatEffect || damageEffects.length === 0) {
      this.actionResults[item.item_id_suggestion] = 'Cannot attack with this item';
      return;
    }

    const abilityKey = attackStatEffect.properties.attackStat ?? 'str';
    const modifier = this.abilityModifiers()[abilityKey] ?? 0;
    const magicBonus = magicBonusEffect?.properties.bonus ?? 0;
    const isProficient = proficiencyEffect?.properties.proficient ?? false;
    const proficiencyBonus = isProficient ? this.playerCardStateService.getProficiencyBonus(this.playerCardStateService.playerCard$().level) : 0;
    const totalBonus = modifier + magicBonus + proficiencyBonus;

    let d20Roll: number;
    let attackRollsString: string;

    if (mode === RollStateEnum.ADVANTAGE) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      d20Roll = Math.max(roll1, roll2);
      attackRollsString = ` ADVANTAGE: [${roll1}, ${roll2}] -> ${d20Roll}`;
    } else if (mode === RollStateEnum.DISADVANTAGE) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      d20Roll = Math.min(roll1, roll2);
      attackRollsString = ` DISADVANTAGE: [${roll1}, ${roll2}] -> ${d20Roll}`;
    } else {
      d20Roll = Math.floor(Math.random() * 20) + 1;
      attackRollsString = '';
    }

    if (d20Roll === 20) {
      attackRollsString += ' (natural 20!)';
    }

    const finalAttackResult = d20Roll + totalBonus;
    const attackResultDescription = `${item.name}: ${finalAttackResult} to hit${attackRollsString}`;

    this.emitRollResults.emit({
      type: `WEAPON_ATTACK_${item.item_id_suggestion}`,
      description: attackResultDescription
    });

    const damageBonus = modifier + magicBonus;
    let totalDamage = 0;
    const damageDescriptions = [];
    let template = item.template || '';

    damageEffects.forEach(effect => {
      const diceNotation = effect.properties.dice;
      const damageRollResult = this.parseAndRollDice(diceNotation);
      if (damageRollResult.error) {
        this.actionResults[item.item_id_suggestion] = 'Damage roll error';
        return;
      }
      const damageType = effect.properties.damageType || '';
      const finalDamageForEffect = damageRollResult.total + damageBonus;
      totalDamage += finalDamageForEffect;
      damageDescriptions.push(`${finalDamageForEffect} ${damageType}`);
      if (template) {
        template = template.replace(`{{${effect.id}}}`, `${finalDamageForEffect} ${damageType}`);
      }
    });

    if (damageDescriptions.length > 0) {
      const damageResultDescription = template || `DMG: ${damageDescriptions.join(' + ')}`;
      this.emitRollResults.emit({
        type: `WEAPON_DAMAGE_${item.item_id_suggestion}`,
        description: damageResultDescription
      });
      this.actionResults[item.item_id_suggestion] = `Damage: ${totalDamage}`;
    }

    this.confirmationService.close();
  }

  useConsumable(item: InventoryItem): void {
    if (item.type !== 'CONSUMABLE' || !item.properties.effects || !item.properties.effects.length) return;

    const effect = item.properties.effects[0];

    if (effect.type === 'HEAL' && effect.heal_amount) {
      const result = this.parseAndRollDice(effect.heal_amount);
      if (!result.error) {
        this.actionResults[item.item_id_suggestion] = `Healed: ${result.total}`;
        this.emitRollResults.emit({
          type: `CONSUMABLE_USE_${item.item_id_suggestion}`,
          description: `Used ${item.name}. Healed for: ${result.total} (from ${effect.heal_amount})`
        });
      } else {
        this.actionResults[item.item_id_suggestion] = 'Effect issue';
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

  callModeDialog(item: InventoryItem, $event: MouseEvent): void {
    $event.preventDefault();
    this.selectedItem.set(item);
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      acceptVisible: false,
      rejectVisible: false,
      closable: true
    });
  }

  addNewItem(itemType: 'WEAPON' | 'ARMOR' | 'MISC_ITEM'): void {
    const newItem: InventoryItem = {
      item_id_suggestion: `new-${Math.random().toString(36).substring(2, 9)}`,
      name: 'New Item',
      quantity: 1,
      type: itemType,
      description: '',
      properties: {
        effects: []
      }
    };

    if (itemType === 'WEAPON') {
      newItem.template = '{{name}} attacks for {{damage_1}}';
      newItem.properties.effects = [
        {
          id: 'attack_stat',
          name: 'Attack Stat',
          type: 'ATTACK_STAT',
          properties: { attackStat: 'str' },
          isSystemEffect: true,
          order: 1
        },
        {
          id: 'proficiency',
          name: 'Proficiency',
          type: 'WEAPON_PROFICIENCY',
          properties: { proficient: true },
          isSystemEffect: true,
          order: 2
        },
        {
          id: 'damage_1',
          name: 'Damage',
          type: 'DAMAGE',
          properties: {
            dice: '1d6',
            damageType: 'slashing'
          },
          order: 3
        }
      ];
    } else if (itemType === 'ARMOR') {
      newItem.properties = {
        ...newItem.properties,
        armor_class_value: 10,
        armor_type: 'Light Armor',
        max_dex_bonus: 'NO_LIMIT'
      };
    }

    this.itemAdded.emit(newItem);
    this.openEditModal(newItem, true);
  }

  openEditModal(item: InventoryItem, isNew: boolean = false): void {
    const ref = this.dialogService.open(ItemEditorComponent, {
      header: `Edit Item: ${item.name || 'New Item'}`,
      width: '50vw',
      data: {
        item: item
      }
    });

    ref.onClose.subscribe((result: {item: InventoryItem, isNew: boolean} | undefined) => {
      if (result) {
        if(result.isNew) {
          this.playerCardStateService.addItemToInventory(result.item);
        } else {
          this.playerCardStateService.updateItemInInventory(result.item);
        }
      } else {
        if(isNew) {
          // Handle both property names for compatibility
          const itemId = (item as any).item_id_suggestion || (item as any).id_suggestion;
          this.playerCardStateService.removeItemFromInventory(itemId);
        }
      }
    });
  }
}