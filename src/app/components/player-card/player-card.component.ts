import {
  Component,
  signal,
  Signal,
  effect,
  input,
  OnInit,
  inject,
  Output, EventEmitter, WritableSignal
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
  ]
})
export class PlayerCardComponent implements OnInit {
  @Output() emitRollResults: EventEmitter<string> = new EventEmitter();
  playerCard = input(null);
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

  trackByAbilityKey(index: number, item: { key: string, value: any }): string {
    return item.key;
  }

  saveChanges(): void {
    this.playerCardForm.updateValueAndValidity();

    const concatPlayerCard = {
      ...this.playerCard(),
      ...this.playerCardForm.getRawValue()
    };

    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.HERO, JSON.stringify(concatPlayerCard))
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
    this.emitRollResults.emit(`${this.diceRollerService.getSelectedDie()} roll, result: ${$event}`);
  }

  setFromInventoryDiceRollResult($event: string): void {
    this.emitRollResults.emit($event);
  }

  rollAbilityDice(key: string, value: number): void {
    const rollResult = this.diceRollerService.roll()
    this.emitRollResults.emit(`${this.diceRollerService.getSelectedDie()} ${this.abilitiesMap[key]} roll, result: ${rollResult}`)
  }
}
