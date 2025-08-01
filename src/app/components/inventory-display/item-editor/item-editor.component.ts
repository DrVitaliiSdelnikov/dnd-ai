import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { InventoryItem, ItemEffect } from '../../../shared/interfaces/inventroy.interface';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import cloneDeep from 'lodash/cloneDeep';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';

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
    TooltipModule
  ],
  templateUrl: 'item-editor.component.html',
  styleUrl: 'item-editor.component.scss'
})
export class ItemEditorComponent implements OnInit {
  itemForm: FormGroup;
  item: InventoryItem;

  // Injections
  private playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);
  private fb = inject(FormBuilder);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);

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
    { label: 'Buff Stat', value: 'BUFF_STAT' }, { label: 'Heal', value: 'HEAL' },
    { label: 'Grant Ability', value: 'GRANT_ABILITY' }, { label: 'Text Description', value: 'TEXT_DESCRIPTION' }
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
  }

  private buildForm(): void {
    const props = this.item.properties;
    this.itemForm = this.fb.group({
      name: [this.item.name, Validators.required],
      description: [this.item.description || ''],
      properties: this.fb.group({
        damage_dice: [props.damage_dice || ''],
        damage_type: [props.damage_type || ''],
        effect_details: this.fb.array(
          props.effect_details?.map(effect => this.createEffectDetailGroup(effect)) || []
        )
      })
    });
  }

  private createEffectDetailGroup(effect?: ItemEffect): FormGroup {
    return this.fb.group({
      type: [effect?.type || 'BUFF_STAT', Validators.required],
      description: [effect?.description || ''],
      stat_buffed: [effect?.stat_buffed || ''],
      buff_value: [effect?.buff_value || null]
    });
  }

  get effectDetails(): FormArray {
    return this.itemForm.get('properties.effect_details') as FormArray;
  }

  addEffectDetail(): void {
    this.effectDetails.push(this.createEffectDetailGroup());
  }

  removeEffectDetail(index: number): void {
    this.effectDetails.removeAt(index);
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
}
