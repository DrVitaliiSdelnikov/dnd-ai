import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, JsonPipe, NgForOf, NgIf } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { InventoryItem, ActionEffect } from '../../../shared/interfaces/inventroy.interface';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import cloneDeep from 'lodash/cloneDeep';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  debounceTime,
  distinctUntilChanged,
  startWith,
  tap
} from 'rxjs/operators';

@Component({
  selector: 'app-item-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgIf,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    DropdownModule,
    TooltipModule,
    CheckboxModule,
    ConfirmDialogModule
  ],
  templateUrl: 'item-editor.component.html',
  styleUrl: 'item-editor.component.scss',
  providers: [ConfirmationService]
})
export class ItemEditorComponent implements OnInit {
  itemForm: FormGroup;
  item: InventoryItem;

  // Injections
  private playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);
  private fb = inject(FormBuilder);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private confirmationService = inject(ConfirmationService);

  readonly attackStatTypes = [
    { label: 'Strength', value: 'str' },
    { label: 'Dexterity', value: 'dex' },
    { label: 'Constitution', value: 'con' },
    { label: 'Intelligence', value: 'int' },
    { label: 'Wisdom', value: 'wis' },
    { label: 'Charisma', value: 'cha' }
  ];
  readonly damageTypes = [
    { label: 'Slashing', value: 'Slashing' }, { label: 'Piercing', value: 'Piercing' },
    { label: 'Bludgeoning', value: 'Bludgeoning' }, { label: 'Fire', value: 'Fire' },
    { label: 'Cold', value: 'Cold' }, { label: 'Poison', value: 'Poison' },
    { label: 'Acid', value: 'Acid' }, { label: 'Lightning', value: 'Lightning' },
    { label: 'Thunder', value: 'Thunder' }, { label: 'Force', value: 'Force' },
    { label: 'Necrotic', value: 'Necrotic' }, { label: 'Radiant', value: 'Radiant' },
    { label: 'Psychic', value: 'Psychic' }
  ];
  readonly effectTypes = [
    { label: 'Modifier', value: 'MODIFIER' },
    { label: 'Damage', value: 'DAMAGE' },
    { label: 'Re-roll', value: 'RE_ROLL' },
    { label: 'Set Critical Range', value: 'SET_CRITICAL_RANGE' },
    { label: 'Condition', value: 'CONDITION' }
  ];

  readonly applyToTypes = [
    { label: 'Attack Roll', value: 'ATTACK_ROLL' },
    { label: 'Damage Roll', value: 'DAMAGE_ROLL' },
    { label: 'Armor Class', value: 'ARMOR_CLASS' },
    { label: 'Any', value: 'ANY' }
  ];

  readonly conditionTypes = [
    { label: 'Has Advantage', value: 'HAS_ADVANTAGE' },
    { label: 'Weapon is Two-Handed', value: 'WEAPON_IS_TWO_HANDED' }
  ];

  readonly statsToBuff = [
    { label: 'Strength (str)', value: 'str' }, { label: 'Dexterity (dex)', value: 'dex' },
    { label: 'Constitution (con)', value: 'con' }, { label: 'Intelligence (int)', value: 'int' },
    { label: 'Wisdom (wis)', value: 'wis' }, { label: 'Charisma (cha)', value: 'cha' },
    { label: 'Armor Class (AC)', value: 'AC' }
  ];

  ngOnInit(): void {
    this.item = this.config.data.item;
    this.buildForm();
    if (this.item) {
      this.itemForm.patchValue(this.item);
    }
    this.setupEffectsSubscription();
  }

  private buildForm(): void {
    const props = this.item.properties;
    const actionTemplate = props.action_template;

    this.itemForm = this.fb.group({
      name: [this.item.name, Validators.required],
      description: [this.item.description],
      properties: this.fb.group({
        damage_dice: [props.damage_dice],
        damage_type: [props.damage_type],
        attack_stat: [props.attack_stat],
        proficient: [props.proficient || false],
        action_template: this.fb.group({
          outputString: [actionTemplate?.outputString || ''],
          effects: this.fb.array(
            actionTemplate?.effects?.map(effect => this.createEffectGroup(effect)) || []
          )
        })
      })
    });
  }

  private createEffectGroup(effect?: ActionEffect): FormGroup {
    return this.fb.group({
      id: [effect?.id || crypto.randomUUID()],
      name: [effect?.name || '', Validators.required],
      type: [effect?.type || 'DAMAGE', Validators.required],
      applyTo: [effect?.applyTo || 'ANY', Validators.required],
      value: [effect?.value || '', Validators.required],
      stat: [effect?.stat],
      damageType: [effect?.damageType],
      condition: [effect?.condition]
    });
  }

  get effects(): FormArray {
    return this.itemForm.get('properties.action_template.effects') as FormArray;
  }

  addEffect(): void {
    this.effects.push(this.createEffectGroup());
  }

  removeEffect(index: number): void {
    this.effects.removeAt(index);
  }

  private setupEffectsSubscription(): void {
    this.effects.valueChanges.pipe(
      startWith(this.effects.value),
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      tap((effects: ActionEffect[]) => {
        const outputString = this.generateOutputString(effects);
        this.itemForm.get('properties.action_template.outputString').setValue(outputString, {
          emitEvent: false
        });
      })
    ).subscribe();
  }

  private generateOutputString(effects: ActionEffect[]): string {
    if (!effects || effects.length === 0) {
      return '';
    }

    const attackEffects = effects.filter(e => e.applyTo === 'ATTACK_ROLL');
    const damageEffects = effects.filter(e => e.applyTo === 'DAMAGE_ROLL');

    let output = '{name} attacks with their weapon.';

    if (attackEffects.length > 0) {
      const attackRolls = attackEffects.map(e => e.value).join(' + ');
      output += ` Attack: {attack_roll} (${attackRolls}).`;
    }

    if (damageEffects.length > 0) {
      const damageParts = damageEffects.map(e => {
        let part = e.value;
        if (e.damageType) {
          part += ` ${e.damageType}`;
        }
        return part;
      });
      output += ` Damage: {damage_roll} (${damageParts.join(' + ')}).`;
    }

    return output;
  }

  save(): void {
    if (this.itemForm.invalid) return;
    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) {
      console.error("Cannot save item, player card is not available.");
      return;
    }
    const formValues = this.itemForm.getRawValue();
    const updatedItem = cloneDeep(this.item);

    updatedItem.name = formValues.name;
    updatedItem.description = formValues.description;

    updatedItem.properties = {
      ...updatedItem.properties,
      ...formValues.properties
    };

    const updatedLoot = currentCard.loot.map(lootItem =>
      lootItem.item_id_suggestion === updatedItem.item_id_suggestion ? updatedItem : lootItem
    );

    const updatedPlayerCard = { ...currentCard, loot: updatedLoot };
    this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }

  delete(): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${this.item.name}?`,
      header: 'Delete Item',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        const currentCard = this.playerCardStateService.playerCard$();
        if (!currentCard) return;

        const updatedLoot = currentCard.loot.filter(item => item.item_id_suggestion !== this.item.item_id_suggestion);
        const updatedPlayerCard = { ...currentCard, loot: updatedLoot };

        this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
        this.dialogRef.close(true);
      }
    });
  }
}
