import { Component, signal, computed, Signal, Input, InputSignal, effect, input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
         // Импортируйте то, что у вас уже подключено
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
    ValueChangeRippleDirective
  ]
})
export class PlayerCardComponent implements OnInit {
  playerCard = input(null);
  playerCardForm: FormGroup = new FormGroup<CharacterBase>({
    hp: new FormGroup({
      current: new FormControl(null),
      maximum: new FormControl(null),
    }),
    name: new FormControl('Mysterious traveler'),
    race: new FormControl(null),
    class: new FormControl(null),
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
    notes: new FormControl('')
  });
  private sessionStorageService = inject(SessionStorageService);
  readonly editMode = signal(false);


  // character = this.characterSig.asReadonly();
  abilities: Signal<{ [k: string]: FormControl<number | null> }> = computed(() => this.playerCardForm.get('abilities').getRawValue());
  inventory = computed(() => this.playerCardForm.get('inventory').getRawValue());
  name = computed(() => this.playerCardForm.get('name').getRawValue() || 'Безымянный странник');
  toggleEdit = () => this.editMode.set(!this.editMode());

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

  saveChanges(): void {
    this.playerCardForm.updateValueAndValidity();
    this.abilities = computed(() => this.playerCardForm.get('abilities').getRawValue());

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

    this.playerCardForm.patchValue(patch, { emitEvent: false });
  }

  cancel() {
    this.editMode.set(false);
  }
}
