import { Component, inject, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { InventoryItem, ItemEffect } from '../../../shared/interfaces/inventroy.interface';
import { JsonPipe, NgIf } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import cloneDeep from 'lodash/cloneDeep';
import { Textarea } from 'primeng/textarea';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';

@Component({
  selector: 'app-item-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    ButtonDirective,
    Textarea,
    InputText,
    JsonPipe,
    InputNumber
  ],
  templateUrl: 'item-editor.component.html',
  styleUrl: 'item-editor.component.scss'
})
export class ItemEditorComponent implements OnInit {
  itemForm: FormGroup;
  item: InventoryItem;
  playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);

  private fb = inject(FormBuilder);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);

  ngOnInit(): void {
    this.item = this.config.data.item;
    this.buildForm();
    if (this.item) {
      this.itemForm.patchValue(this.item);
    }
  }

  private buildForm(): void {
    this.itemForm = this.fb.group({
      name: [this.item.name, Validators.required],
      description: [this.item.description || ''],

      properties: this.fb.group({
        damage_dice: [this.item.properties.damage_dice || ''],
        damage_type: [this.item.properties.damage_type || ''],
        effect_details: this.fb.array(
          this.item.properties.effect_details?.map(effect => this.createEffectDetailGroup(effect)) || []
        )
      })
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

  private createEffectDetailGroup(effect?: ItemEffect): FormGroup {
    return this.fb.group({
      type: [effect?.type || 'BUFF_STAT', Validators.required],
      description: [effect?.description || ''],
      stat_buffed: [effect?.stat_buffed || ''],
      buff_value: [effect?.buff_value || null]
    });
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

    updatedItem.properties.damage_dice = formValues.properties.damage_dice;
    updatedItem.properties.damage_type = formValues.properties.damage_type;


    const updatedLoot = currentCard.loot.map(lootItem =>
      lootItem.item_id_suggestion === updatedItem.item_id_suggestion ? updatedItem : lootItem
    );

    const updatedPlayerCard = {
      ...currentCard,
      loot: updatedLoot
    };

    this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
    this.dialogRef.close(true);
  }


  close(): void {
    this.dialogRef.close();
  }
}
