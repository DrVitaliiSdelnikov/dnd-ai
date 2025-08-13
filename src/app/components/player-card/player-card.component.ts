import {
  Component,
  signal,
  Signal,
  effect,
  input,
  OnInit,
  inject,
  Output, EventEmitter, WritableSignal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { PlayerCard } from '../../shared/interfaces/player-card.interface';
import { SessionStorageService } from '../../services/session-storage.service';
import { sessionStorageKeys } from '../../shared/const/session-storage-keys';
import {
  ValueChangeRippleDirective
} from '../../shared/directives/field-update-ui/value-change-ripple-directive.directive';
import { toSignal } from '@angular/core/rxjs-interop';
import { DiceRollerComponent } from '../dice-roller/dice-roller.component';
import { DiceRollerService } from '../dice-roller/dice-roller.service';
import { InventoryDisplayComponent } from '../inventory-display/inventory-display.component';
import { AttributeNamePipe } from './attribute-name.pipe';
import { CalculatedBonuses, InventoryItem } from '../../shared/interfaces/inventory.interface';
import { Spell } from '../../shared/interfaces/spell.interface';
import { SpellbookDisplayComponent } from '../spellbook-display/spellbook-display.component';
import { RollEvent } from '../../shared/interfaces/dice-roll';
import { ConfirmPopup } from 'primeng/confirmpopup';
import {
  RollOptionsPanelComponent,
  RollState, RollStateEnum
} from '../../shared/components/roll-options-panel/roll-options-panel.component';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SkillsDisplayComponent } from '../skills-display/skills-display.component';
import { PlayerCardStateService } from '../../services/player-card-state.service';
import { ToastModule } from 'primeng/toast';
import { StatBonusPipe } from '../../shared/stat-bonus.pipe';
import { AdventureSummaryComponent } from '../campaign-sammary/adventure-summary.component';

interface AbilityMap { [k: string]: FormControl<number | null> }
interface Item { name: string; qty: number }
interface CharacterBase {
  name: FormControl<string | null>;
  race: FormControl<string | null>;
  class: FormControl<string | null>;
  level: FormControl<number | null>;
  exp: FormControl<number | null>;
  abilities: FormGroup<AbilityMap>;
  inventory: FormControl<Item[] | null>;
  notes: FormControl<string | null>;
}

@Component({
  selector: 'app-player-card',
  standalone: true,
  templateUrl: './player-card.component.html',
  styleUrls: ['./player-card.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    PanelModule,
    DividerModule,
    AccordionModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    ReactiveFormsModule,
    ValueChangeRippleDirective,
    DiceRollerComponent,
    InventoryDisplayComponent,
    AttributeNamePipe,
    SpellbookDisplayComponent,
    ConfirmPopup,
    RollOptionsPanelComponent,
    SkillsDisplayComponent,
    ToastModule,
    StatBonusPipe,
    AdventureSummaryComponent
  ],
  providers: [
    ConfirmationService,
    MessageService
  ]
})
export class PlayerCardComponent implements OnInit {
  @Output() emitRollResults: EventEmitter<{ [key: string]: string }> = new EventEmitter();
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private messageService: MessageService = inject(MessageService);
  playerCard = input(null);
  readonly proficiencyBonus = computed(() => {
    const level = this.playerCardForm.get('level').value ?? 1;
    return Math.ceil(level / 4) + 1;
  });
  private playerCardStateService = inject(PlayerCardStateService);
  selectedItem: WritableSignal<string> = signal(null);
  readonly skillsDisabled = computed(() => {
    const skills = this.playerCard()?.skills;
    if (!skills) return true;
    return !Object.values(skills).some(s => !!(s as {proficient: boolean})?.proficient);
  });
  readonly equipmentBonuses: Signal<CalculatedBonuses> = computed(() => {
    if(!this.playerCard()) return;

    const allItems = this.playerCard()?.loot ?? [];
    const allSpells = this.playerCard()?.spells ?? [];
    const bonuses: CalculatedBonuses = {
      armorClass: 0,
      statsBonuses: {}
    };

    bonuses.statsBonuses = this.calculateStatsBonuses(allItems, this.playerCard()?.abilities);
    bonuses.armorClass = this.calculateArmorClass(allItems, bonuses?.statsBonuses, Array.isArray(allSpells) ? allSpells : []);

    if(!bonuses?.statsBonuses || !bonuses?.armorClass) return;
    return bonuses;
  });
  campaignSummary = input(null);
  private readonly diceRollerService: DiceRollerService = inject(DiceRollerService)
  playerCardForm: FormGroup = new FormGroup<CharacterBase>({
    hp: new FormGroup({
      current: new FormControl(null),
      maximum: new FormControl(null),
    }),
    name: new FormControl('Mysterious traveler'),
    race: new FormControl('-'),
    class: new FormControl('-'),
    level: new FormControl(1),
    exp: new FormControl(0),
    // @ts-ignore
    abilities: new FormGroup(
      {
        str: new FormControl(null),
        dex: new FormControl(null),
        con: new FormControl(null),
        int: new FormControl(null),
        wis: new FormControl(null),
        cha: new FormControl(null)
      }
    ),
    skills: new FormControl(null),
    inventory: new FormControl([]),
  });
  private sessionStorageService = inject(SessionStorageService);
  readonly editMode = signal(false);
  readonly abilitiesMap = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma'
  }
  abilities: Signal<{[ key: string ]: number | null}> = toSignal(
    this.playerCardForm.get('abilities').valueChanges,
    { initialValue: [] }
  );
  inventory = toSignal(
    this.playerCardForm.get('inventory').valueChanges,
  );
  name = toSignal(
    this.playerCardForm.get('name').valueChanges,
  );
  toggleEdit = () => this.editMode.set(!this.editMode());
  loading: WritableSignal<boolean> = signal(true);
  armorClass = computed(() => {
    return this.equipmentBonuses()?.armorClass > 0 ? this.equipmentBonuses()?.armorClass : 0;
  });
  private selectedMode: WritableSignal<string> = signal(RollStateEnum.NORMAL);

  constructor() {
    effect(() => {
      const pc = this.playerCard();

      if (!pc) { return; }
      this.updateHeroForm(pc);
    });
  }

  ngOnInit(): void {
    this.setInitPlayerCard();
  }

  callModeDialog(item: string, $event: MouseEvent): void {
    $event.preventDefault();
    this.selectedItem.set(item);
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      acceptVisible: false,
      rejectVisible: false,
      closable: true
    });
  }

  private isItemEquipped(item: InventoryItem): boolean {
    return (item as any)?.equipped !== false; // default to true when missing
  }

  private calculateStatsBonuses(
    allItems: InventoryItem[],
    baseAbilities: { [key: string]: number | null }
  ): { [key: string]: number } {

    if (!baseAbilities) return {};
    const finalModifiers: { [key: string]: number } = {};
    const itemBonuses: { [key: string]: number } = {};

    const equippedItems = (allItems || []).filter(i => this.isItemEquipped(i));

    equippedItems.forEach(item => {
      const props = item?.properties;

      // Legacy: effect_details
      if (props?.effect_details && Array.isArray(props.effect_details)) {
        props.effect_details.forEach(effect => {
          if (effect.type === 'BUFF_STAT' && effect.stat_buffed && typeof effect.buff_value === 'number') {
            const statKey = String(effect.stat_buffed).toLowerCase();
            const bonusValue = effect.buff_value;
            itemBonuses[statKey] = (itemBonuses[statKey] || 0) + bonusValue;
          }
        });
      }

      // New model: properties.effects with BUFF_STAT
      const newEffects = (props as any)?.effects;
      if (Array.isArray(newEffects)) {
        newEffects.forEach((eff: any) => {
          if (eff?.type === 'BUFF_STAT') {
            const statKey = String(eff?.properties?.stat || '').toLowerCase();
            const bonusValue = Number(eff?.properties?.buffValue ?? 0);
            if (statKey && !Number.isNaN(bonusValue)) {
              itemBonuses[statKey] = (itemBonuses[statKey] || 0) + bonusValue;
            }
          }
        });
      }
    });

    Object.keys(baseAbilities).forEach(key => {
      const baseValue = baseAbilities[key] ?? 0;
      const itemBonus = itemBonuses[key] ?? 0;
      const totalValue = baseValue + itemBonus;

      finalModifiers[key] = this.getAbilityModifier(totalValue);
    });

    return finalModifiers;
  }

  trackByAbilityKey(index: number, item: { key: string, value: any }): string {
    return item.key;
  }

  getAbilityModifier(value: number): number {
    if (value === null || value === undefined) return 0;
    return Math.floor((value - 10) / 2);
  }

  saveChanges(): void {
    this.playerCardForm.updateValueAndValidity();

    const concatPlayerCard = {
      ...this.playerCard(),
      ...this.playerCardForm.getRawValue()
    };

    this.playerCardStateService.updatePlayerCard(concatPlayerCard);
    this.editMode.set(false);
  }

  private setInitPlayerCard(): void {
    const playerStats = JSON.parse(this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.HERO));
    this.updateHeroForm(playerStats);
  }

  private updateHeroForm(playerStats: PlayerCard): void {
    const patch = {
      hp: playerStats?.hp ?? null,
      name: playerStats?.name ?? null,
      race: playerStats?.race ?? null,
      class: playerStats?.class ?? null,
      level: playerStats?.level,
      exp: playerStats?.exp,
      skills: playerStats?.skills ?? null,
      abilities: {
        str: playerStats?.abilities?.str,
        dex: playerStats?.abilities?.dex,
        con: playerStats?.abilities?.con,
        int: playerStats?.abilities?.int,
        wis: playerStats?.abilities?.wis,
        cha: playerStats?.abilities?.cha,
      },
      notes: playerStats?.notes ?? ''
    };

    this.playerCardForm.patchValue(patch);
    this.loading.set(false);
  }

  cancel() {
    this.editMode.set(false);
  }

  setDiceRollResult($event: number): void {
    this.emitRollResults.emit({
      type: `FREE_DICE_ROLL`,
      description: String($event)
    });
  }

  setFromInventoryDiceRollResult($event:  { [key: string]: string }): void {
    this.emitRollResults.emit($event);
  }

  rollAbilityCheck(abilityKey: string, rollMode: string = RollStateEnum.NORMAL): void {
    const abilityData = this.equipmentBonuses()?.statsBonuses;
    const modifier = abilityData[abilityKey];

    let d20Roll: number;
    let rollsString: string;

    if (rollMode === RollStateEnum.ADVANTAGE) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      d20Roll = Math.max(roll1, roll2);
      rollsString = `Rolls: [${roll1}, ${roll2}] -> Used ${d20Roll}`;
    } else if (rollMode === RollStateEnum.DISADVANTAGE) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      d20Roll = Math.min(roll1, roll2);
      rollsString = `Rolls: [${roll1}, ${roll2}] -> Used ${d20Roll}`;
    } else {
      d20Roll = Math.floor(Math.random() * 20) + 1;
      rollsString = `Roll: ${d20Roll}`;
    }

    if (d20Roll === 20) {
      rollsString += ' (natural 20!)';
    }

    const finalResult = d20Roll + modifier;

    const abilityName = this.abilitiesMap[abilityKey] || 'Unknown';
    const modifierString = modifier === 0 ? '' : (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`);
    const resultString = `Check for ${abilityName}: ${finalResult} (${rollsString}${modifierString})`;

    this.emitRollResults.emit({
      type: `ABILITY_CHECK_${abilityKey.toUpperCase()}`,
      description: resultString
    });
    this.confirmationService.close();
  }

  private calculateArmorClass(
    allItems: InventoryItem[],
    statsBonuses: { [key: string]: number },
    allSpells: Spell[] = []
  ): number {
    // Helper to fetch effects from items (new model lives under properties.effects; fall back to item.effects if present)
    const getEffects = (item: InventoryItem): any[] => {
      const propsEffects = (item as any)?.properties?.effects;
      const directEffects = (item as any)?.effects;
      if (Array.isArray(propsEffects)) return propsEffects;
      if (Array.isArray(directEffects)) return directEffects;
      return [];
    };

    const items = (allItems || []).filter(i => this.isItemEquipped(i));
    const hasArmorEquipped = items.some(i => i?.type === 'ARMOR');
    const hasShieldEquipped = items.some(i => i?.type === 'SHIELD');

    // Ability modifiers: prefer precomputed modifiers when provided
    const getAbilityMod = (abilityKey: string): number => {
      const baseScore = this.playerCardForm.get(`abilities.${abilityKey}`)?.value ?? 0;
      const fallback = this.getAbilityModifier(baseScore);
      const precomputed = (typeof statsBonuses?.[abilityKey] === 'number') ? statsBonuses[abilityKey] : null;
      return (precomputed ?? fallback) as number;
    };

    // Ability add rule: cap == 0 → ignore; cap > 0 → positives are clamped to cap; negatives are fully applied
    const addWithCap = (mod: number, cap: number | undefined | null, allowNegative: boolean): number => {
      if (!cap || cap <= 0) return 0;
      if (mod < 0) return allowNegative ? mod : 0;
      return Math.min(mod, cap);
    };

    // Collect all ARMOR_CLASS effects from equipped items and passive spells
    type ArmorCandidate = {
      base: number;
      dexCap: number | undefined;
      conCap: number | undefined;
      wisCap: number | undefined;
      isMainArmor: boolean;
      noArmorOnly: boolean;
      shieldAllowed: boolean;
      sourceKind: 'ITEM' | 'ARMOR_ITEM' | 'SPELL' | 'OTHER_ITEM';
    };

    const mainArmorCandidates: ArmorCandidate[] = [];
    

    // From items
    items.forEach(item => {
      const effects = getEffects(item);
      if (!Array.isArray(effects) || effects.length === 0) return;

      effects.filter(e => e?.type === 'ARMOR_CLASS').forEach(eff => {
        const props = eff?.properties || {};
        const isMainArmor = props?.isMainArmor === true || (item.type === 'ARMOR' && props?.isMainArmor !== false);
        const noArmorOnly = !!props?.noArmorOnly;
        const shieldAllowed = props?.shieldAllowed !== false;

        // Legacy mapping for maxDexBonus
        const legacyMaxDex = typeof props?.maxDexBonus === 'number' ? Number(props.maxDexBonus) : undefined;
        const dexCap = (typeof props?.dexBonusCap === 'number') ? Number(props.dexBonusCap) : legacyMaxDex;
        const conCap = (typeof props?.conBonusCap === 'number') ? Number(props.conBonusCap) : undefined;
        const wisCap = (typeof props?.wisBonusCap === 'number') ? Number(props.wisBonusCap) : undefined;

        const acValue = Number(props?.acValue ?? 10);

        if (isMainArmor) {
          mainArmorCandidates.push({
            base: acValue,
            dexCap,
            conCap,
            wisCap,
            isMainArmor: true,
            noArmorOnly,
            shieldAllowed,
            sourceKind: item.type === 'ARMOR' ? 'ARMOR_ITEM' : 'ITEM'
          });
        } else {
          // Flat adder handled in additive pass
        }
      });
    });

    // From passive spells
    const passiveSpells = Array.isArray(allSpells) ? allSpells.filter(s => !!s?.isPassive) : [];
    passiveSpells.forEach(spell => {
      const effects = Array.isArray((spell as any)?.effects) ? (spell as any).effects : [];
      effects.filter((e: any) => e?.type === 'ARMOR_CLASS').forEach((eff: any) => {
        const props = eff?.properties || {};
        const isMainArmor = props?.isMainArmor === true; // default for spells is explicit
        const noArmorOnly = !!props?.noArmorOnly;
        const shieldAllowed = props?.shieldAllowed !== false;
        const legacyMaxDex = typeof props?.maxDexBonus === 'number' ? Number(props.maxDexBonus) : undefined;
        const dexCap = (typeof props?.dexBonusCap === 'number') ? Number(props.dexBonusCap) : legacyMaxDex;
        const conCap = (typeof props?.conBonusCap === 'number') ? Number(props.conBonusCap) : undefined;
        const wisCap = (typeof props?.wisBonusCap === 'number') ? Number(props.wisBonusCap) : undefined;
        const acValue = Number(props?.acValue ?? 10);

        if (isMainArmor) {
          mainArmorCandidates.push({
            base: acValue,
            dexCap,
            conCap,
            wisCap,
            isMainArmor: true,
            noArmorOnly,
            shieldAllowed,
            sourceKind: 'SPELL'
          });
        } else {
          // Flat adder handled in additive pass
        }
      });
    });

    // Validate candidates by conditions and compute their totals
    const dexMod = getAbilityMod('dex');
    const conMod = getAbilityMod('con');
    const wisMod = getAbilityMod('wis');

    const evaluatedBases: number[] = [];
    mainArmorCandidates.forEach(c => {
      // Condition checks
      if (c.noArmorOnly && hasArmorEquipped) return;
      if (!c.shieldAllowed && hasShieldEquipped) return;

      let total = c.base;

      // Ability adds: negatives allowed when cap > 0
      total += addWithCap(dexMod, c.dexCap, true);
      total += addWithCap(conMod, c.conCap, true);
      total += addWithCap(wisMod, c.wisCap, true);

      evaluatedBases.push(total);
    });

    // Default base if no candidates
    let baseAc: number;
    if (evaluatedBases.length > 0) {
      baseAc = evaluatedBases.reduce((a, b) => (b > a ? b : a));
    } else {
      // Fallback behavior: if any equipped ARMOR has legacy ARMOR_CLASS, compute using that with legacy/derived caps
      // Otherwise default to 10 + Dex (negatives allowed)
      const armorEffects: any[] = [];
      items.filter(i => i?.type === 'ARMOR').forEach(armorItem => {
        const eff = getEffects(armorItem).find(e => e?.type === 'ARMOR_CLASS');
        if (eff) armorEffects.push(eff);
      });

      if (armorEffects.length > 0) {
        // Choose highest acValue armor, apply dex using cap rule if provided; negatives allowed when cap > 0
        let best = 10;
        let bestDexCap: number | undefined = undefined;
        armorEffects.forEach(eff => {
          const props = eff?.properties || {};
          const acVal = Number(props?.acValue ?? 10);
          const legacyMaxDex = typeof props?.maxDexBonus === 'number' ? Number(props.maxDexBonus) : undefined;
          const dexCap = (typeof props?.dexBonusCap === 'number') ? Number(props.dexBonusCap) : legacyMaxDex;
          if (acVal > best) { best = acVal; bestDexCap = dexCap; }
        });
        baseAc = best + addWithCap(dexMod, bestDexCap, true);
      } else {
        baseAc = 10 + dexMod; // unarmored default, negatives allowed
      }
    }

    let totalAc = baseAc;

    // Additive AC effects from equipped items and passive spells
    const addBuffStatAndFlatFromContainer = (effects: any[], containerType: string | null) => {
      if (!Array.isArray(effects) || effects.length === 0) return;

      // ARMOR_CLASS as flat adder
      effects
        .filter(e => e?.type === 'ARMOR_CLASS')
        .forEach(eff => {
          const props = eff?.properties || {};
          const isMainArmor = !!props?.isMainArmor;
          // Flat adders stack regardless of container type
          if (!isMainArmor) {
            const add = Number(props?.acValue ?? 0);
            if (!Number.isNaN(add)) totalAc += add;
          }
        });

      // BUFF_STAT new model: properties.stat and properties.buffValue
      effects
        .filter(e => e?.type === 'BUFF_STAT')
        .forEach(eff => {
          const stat = String(eff?.properties?.stat || '').toLowerCase();
          const add = Number(eff?.properties?.buffValue ?? 0);
          if (stat === 'ac' && !Number.isNaN(add)) {
            totalAc += add;
          }
        });

      // MAGIC_BONUS adds to AC only for armor, shield, or accessory (items only)
      if (containerType === 'ARMOR' || containerType === 'SHIELD' || containerType === 'ACCESSORY') {
        effects
          .filter(e => e?.type === 'MAGIC_BONUS')
          .forEach(eff => {
            const add = Number(eff?.properties?.bonus ?? 0);
            if (!Number.isNaN(add)) totalAc += add;
          });
      }
    };

    // Items
    items.forEach(item => addBuffStatAndFlatFromContainer(getEffects(item), item.type));

    // Spells (treat containerType as null; MAGIC_BONUS not applicable)
    passiveSpells.forEach(spell => {
      const effects = Array.isArray((spell as any)?.effects) ? (spell as any).effects : [];
      addBuffStatAndFlatFromContainer(effects, null);
    });

    return totalAc;
  }

  handleSpellCast($event: RollEvent): void {
    this.emitRollResults.emit({
      type: $event.type,
      description: $event.description
    });
  }

  handleSkillCheck($event: RollEvent): void {
    this.emitRollResults.emit({
      type: $event.type,
      description: $event.description
    });
  }

  handleItemAdded(newItem: InventoryItem): void {
    this.playerCardStateService.addItemToInventory(newItem);
  }

  handleSpellAdded(newSpell: any): void {
    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) return;
    const currentSpells = Array.isArray(currentCard.spells) ? currentCard.spells : [];
    const exists = currentSpells.some(s => s.id_suggestion === newSpell.id_suggestion);
    if (exists) {
      return;
    }
    const updatedSpells = [...currentSpells, newSpell];
    this.playerCardStateService.updatePlayerCard({ ...currentCard, spells: updatedSpells });
  }
}
