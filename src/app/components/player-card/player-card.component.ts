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
import { CalculatedBonuses, InventoryItem } from '../../shared/interfaces/inventroy.interface';
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
    const allItems = this.playerCard()?.loot ?? [];
    const bonuses: CalculatedBonuses = {
      armorClass: 0,
      statsBonuses: {}
    };

    bonuses.statsBonuses = this.calculateStatsBonuses(allItems, this.playerCard()?.abilities);
    bonuses.armorClass = this.calculateArmorClass(allItems, bonuses?.statsBonuses);

    if(!bonuses?.statsBonuses || !bonuses?.armorClass) return;

    const baseDex = this.playerCardForm.get('abilities.dex').value;
    const bonusDexFromItems = bonuses?.statsBonuses.dex || 0;
    const totalDex = (baseDex || 0) + bonusDexFromItems;
    const dexModifier = this.getAbilityModifier(totalDex);

    const heavyArmor = allItems.find(item => item.properties?.armor_type === 'Heavy Armor');
    if (!heavyArmor) {
      bonuses.armorClass += dexModifier;
    }

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
    inventory: new FormControl([]),
  });
  private sessionStorageService = inject(SessionStorageService);
  readonly editMode = signal(false);
  private readonly abilitiesMap = {
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

  private calculateStatsBonuses(
    allItems: InventoryItem[],
    baseAbilities: { [key: string]: number | null }
  ): { [key: string]: number } {

    if (!baseAbilities) return {};
    const finalModifiers: { [key: string]: number } = {};
    const itemBonuses: { [key: string]: number } = {};
    allItems.forEach(item => {
      const props = item?.properties;

      if (props?.effect_details && Array.isArray(props.effect_details)) {
        props.effect_details.forEach(effect => {
          if (effect.type === 'BUFF_STAT' && effect.stat_buffed && typeof effect.buff_value === 'number') {
            const statKey = effect.stat_buffed.toLowerCase();
            const bonusValue = effect.buff_value;

            itemBonuses[statKey] = (itemBonuses[statKey] || 0) + bonusValue;
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
    statsBonuses: { [key: string]: number }
  ): number {
    const mainArmor = allItems.find(item => item.type === 'ARMOR');

    let baseAc = 10;
    let armorType: string | null = null;
    let maxDexBonus: number = null;

    if (mainArmor && mainArmor.properties) // ИСПРАВИЛ БАГ: больше не пытается читать properties у предметов, которые не имеют его
      {
      baseAc = mainArmor.properties.armor_class_value ?? baseAc;
      armorType = mainArmor.properties.armor_type || null;
      maxDexBonus = mainArmor.properties.max_dex_bonus === 'NO_LIMIT'
        ? Infinity
        : Number(mainArmor.properties.max_dex_bonus ?? Infinity);
    }

    const baseDex = this.playerCardForm.get('abilities.dex').value ?? 0;
    const bonusDexFromItems = statsBonuses?.dex || 0;
    const totalDex = baseDex + bonusDexFromItems;
    const dexModifier = this.getAbilityModifier(totalDex);

    let finalDexBonusForAc = dexModifier;

    if (armorType === 'Heavy Armor') {
      finalDexBonusForAc = 0;
    } else if (armorType === 'Medium Armor') {
      finalDexBonusForAc = Math.min(dexModifier, maxDexBonus);
    }
    let totalAc = baseAc;

    totalAc += finalDexBonusForAc;

    allItems.forEach(item => {
      if (item.properties) // ИСПРАВИЛ БАГ: больше не пытается читать properties у предметов, которые не имеют его
        {
        if (item.type === 'SHIELD' && typeof item.properties.armor_class_value === 'number') {
          totalAc += item.properties.armor_class_value;
        }

        if (typeof item.properties.magic_bonus === 'number') {
          if (item.type === 'ARMOR' || item.type === 'SHIELD' || item.type === 'ACCESSORY') {
            totalAc += item.properties.magic_bonus;
          }
        }

        if (Array.isArray(item.properties.effect_details)) {
          item.properties.effect_details.forEach(effect => {
            if (effect.type === 'BUFF_STAT' && effect.stat_buffed?.toUpperCase() === 'AC' && typeof effect.buff_value === 'number') {
              totalAc += effect.buff_value;
            }
          });
        }
      }
    });

    return totalAc;
  }

  handleSpellCast($event: RollEvent): void {
    this.emitRollResults.emit({
      type: $event.type,
      description: $event.description
    });
  }

  setRollMode($event: RollState): void {
    this.selectedMode.set($event);
  }

  handleSkillCheck($event: RollEvent): void {
    this.emitRollResults.emit({
      type: $event.type,
      description: $event.description
    });
  }
}
