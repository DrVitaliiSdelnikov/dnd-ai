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
import { TemplateRendererService } from '../../services/template-renderer.service';
import { SafeHtml } from '@angular/platform-browser';
import { NgClass } from '@angular/common';

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
    SpeedDialModule,
    NgClass
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
  private templateRenderer = inject(TemplateRendererService);

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

  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  private rollD20WithMode(mode: RollState): number {
    if (mode === RollStateEnum.ADVANTAGE) {
      return Math.max(this.rollD20(), this.rollD20());
    } else if (mode === RollStateEnum.DISADVANTAGE) {
      return Math.min(this.rollD20(), this.rollD20());
    } else {
      return this.rollD20();
    }
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {})
      .filter(displayName => obj[displayName] && obj[displayName].length > 0);
  }

  getRenderedTemplate(item: InventoryItem): SafeHtml {
    const result = this.templateRenderer.renderItemTemplate(item);
    return result;
  }

  isItemEquipped(item: InventoryItem): boolean {
    return (item as any)?.equipped !== false;
  }

  toggleEquip(item: InventoryItem): void {
    const itemId = (item as any).item_id_suggestion || (item as any).id_suggestion;
    this.playerCardStateService.toggleEquip(itemId);
    const nowEquipped = !((item as any)?.equipped === true ? false : (item as any)?.equipped === false ? true : false);
    this.messageService.add({ severity: nowEquipped ? 'success' : 'warn', summary: nowEquipped ? 'Equipped' : 'Unequipped', detail: item.name });
  }

  rollAttackAndDamage(item: InventoryItem, mode: RollState = RollStateEnum.NORMAL): void {
    console.log('⚔️ rollAttackAndDamage called for item:', item.name, item);
    
    if ((item.type !== 'WEAPON') || !item.properties.effects) { 
      console.log('❌ Item is not a weapon or missing effects');
      return; 
    }

    const effects = item.properties.effects;
    console.log('🎯 Weapon effects:', effects);

    // Collect placeholders present in the item's template (this defines desired output structure)
    const template = item.template || '';
    const placeholderIds: string[] = Array.from(template.matchAll(/\{\{([^}]+)\}\}/g)).map(m => String(m[1]).trim());

    // Helper: detect intended type from placeholder id
    const inferTypeFromId = (id: string): string | null => {
      const low = id.toLowerCase();
      if (low.includes('d20')) return 'D20_ROLL';
      if (low === 'proficiency' || low === 'pb' || low.includes('prof')) return 'PROFICIENCY';
      if (low === 'attack_stat' || low === 'attack' || low.includes('atk')) return 'ATTACK_STAT';
      if (low === 'magic_bonus' || low === 'magic' || low.includes('bonus')) return 'MAGIC_BONUS';
      if (low.startsWith('damage') || low.includes('damage')) return 'DAMAGE';
      return null;
    };

    // Build mapping placeholderId -> effect (try exact id, then by inferred type in order)
    const usedEffects = new Set<string>();
    const placeholderToEffect: { [id: string]: any | null } = {};

    // Ensure D20 effect exists if template asks for it (auto-fix minimal)
    if (placeholderIds.some(id => inferTypeFromId(id) === 'D20_ROLL') && !effects.some(e => e.type === 'D20_ROLL')) {
      effects.push({ id: 'd20_roll', name: 'D20 Roll', type: 'D20_ROLL', properties: { dice: '1d20' }, order: (effects?.length || 0) + 1 });
    }

    placeholderIds.forEach(pid => {
      const exact = effects.find(e => e.id === pid);
      if (exact) {
        placeholderToEffect[pid] = exact; usedEffects.add(exact.id); return;
      }
      const inferred = inferTypeFromId(pid);
      if (!inferred) { placeholderToEffect[pid] = null; return; }
      const candidate = effects.find(e => e.type === inferred && !usedEffects.has(e.id));
      if (candidate) { placeholderToEffect[pid] = candidate; usedEffects.add(candidate.id); }
      else { placeholderToEffect[pid] = null; }
    });

    // Pull core bonuses
    const attackStatEffect = effects.find(e => e.type === 'ATTACK_STAT');
    const proficiencyEffect = effects.find(e => e.type === 'PROFICIENCY');
    const magicBonusEffect = effects.find(e => e.type === 'MAGIC_BONUS');

    const attackStatKey = attackStatEffect?.properties?.attackStat;
    const abilityMod = attackStatKey ? (this.abilityModifiers()?.[attackStatKey] || 0) : 0;
    const proficiencyBonus = proficiencyEffect ? this.playerCardStateService.getProficiencyBonus(this.playerCardStateService.playerCard$().level) : 0;
    const magicBonus = magicBonusEffect?.properties?.bonus || 0;
    const totalBonus = abilityMod + proficiencyBonus + magicBonus;

    // Roll attack d20 (respect advantage/disadvantage)
    const d20Roll = this.rollD20WithMode(mode);
    const isNatural20 = d20Roll === 20;
    const isNatural1 = d20Roll === 1;

    // Build rollResults for every placeholder present in template
    const rollResults: { [effectId: string]: string } = {};

    // Track first DAMAGE for crit doubling
    let firstDamageResolved = false;

    for (const pid of placeholderIds) {
      const eff = placeholderToEffect[pid];
      const inferredType = inferTypeFromId(pid);
      const type = eff?.type || inferredType;

      switch (type) {
        case 'D20_ROLL': {
          rollResults[pid] = String(d20Roll);
          break;
        }
        case 'PROFICIENCY': {
          rollResults[pid] = String(proficiencyBonus);
          break;
        }
        case 'ATTACK_STAT': {
          rollResults[pid] = String(abilityMod);
          break;
        }
        case 'MAGIC_BONUS': {
          rollResults[pid] = String(magicBonus);
          break;
        }
        case 'DAMAGE': {
          // Roll dice for this damage effect; double dice on crit for the FIRST damage only (bonuses not doubled)
          const dice = eff?.properties?.dice as string;
          if (!dice) { rollResults[pid] = ''; break; }

          // Parse basic XdY(+/-Z) using existing helper
          const base = this.parseAndRollDice(dice);
          if ((base as any).error) { rollResults[pid] = ''; break; }
          let damageTotal = (base as any).total as number;

          if (isNatural20 && !firstDamageResolved) {
            const extra = this.parseAndRollDice(dice);
            if (!(extra as any).error) {
              damageTotal += (extra as any).total as number;
            }
            firstDamageResolved = true;
          }

          const damageType = eff?.properties?.damageType ? String(eff.properties.damageType) : '';
          // Do NOT add ability/magic bonuses here; template can include + {{attack_stat}} / + {{magic_bonus}}
          rollResults[pid] = `${damageTotal}${damageType ? ' ' + damageType : ''}`;
          break;
        }
        default: {
          // Unknown or non-combat effect: leave empty so renderer drops it
          rollResults[pid] = '';
          break;
        }
      }
    }

    // Render a single chat line based on the item's template
    let description = this.templateRenderer.renderTemplateForChat(item, rollResults);

    // Normalize sign sequences like "+-1" -> "-1"
    description = this.normalizeSignSequences(description);

    // Append crit annotation if relevant
    if (isNatural1) {
      description += ' (natural 1!)';
    } else if (isNatural20) {
      description += ' (natural 20!)';
    }

    // Emit one unified message
    this.emitRollResults.emit({
      type: `WEAPON_ATTACK_${item.item_id_suggestion}`,
      description
    });

    // Save last action text for UI (optional)
    this.actionResults[item.item_id_suggestion] = description;

    this.confirmationService.close();
  }

  private normalizeSignSequences(text: string): string {
    if (!text) { return text; }
    // Replace "+-" (with optional spaces) with "-"; keep any surrounding spacing minimal
    return text.replace(/\+\s*-\s*/g, '-');
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
      newItem.template = '{{name}} {{attack_stat}} ({{proficiency}}) deals {{damage_1}}.';
      newItem.properties.effects = [
        {
          id: 'attack_stat',
          name: 'Attack Stat',
          type: 'ATTACK_STAT',
          properties: { attackStat: 'str' },
          order: 1
        },
        {
          id: 'proficiency',
          name: 'Proficiency',
          type: 'PROFICIENCY',
          properties: {},
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
    console.log('🪟 InventoryDisplay:openEditModal with item:', item);
    const ref = this.dialogService.open(ItemEditorComponent, {
      header: `Edit Item: ${item.name || 'New Item'}`,
      width: '50vw',
      data: {
        item: item
      }
    });

    ref.onClose.subscribe((result: {item: InventoryItem, isNew: boolean} | undefined) => {
      console.log('🪟 InventoryDisplay:edit dialog closed with result:', result);
      if (result) {
        if(result.isNew) {
          console.log('➕ InventoryDisplay:addItemToInventory', result.item);
          this.playerCardStateService.addItemToInventory(result.item);
        } else {
          console.log('✏️ InventoryDisplay:updateItemInInventory', result.item);
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