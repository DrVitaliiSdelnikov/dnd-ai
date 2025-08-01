import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { cloneDeep } from 'lodash';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { Spell, DamageEffect } from '../../../shared/interfaces/spells';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import { TextareaModule } from 'primeng/textarea';
import { Component, inject, OnInit } from '@angular/core';
import { Tooltip, TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
  selector: 'app-spell-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, DialogModule, ButtonModule,
    TooltipModule, NgForOf, NgIf, DropdownModule,
    InputTextModule, TextareaModule, InputNumberModule, CheckboxModule, Tooltip,
    ConfirmDialogModule
  ],
  templateUrl: './spell-editor.component.html',
  styleUrls: ['./spell-editor.component.scss'],
  providers: [ConfirmationService]
})
export class SpellEditorComponent implements OnInit {
  spellForm: FormGroup;
  spell: Spell;
  readonly targetTypes = [
    { label: 'Self', value: 'SELF' }, { label: 'Single Enemy', value: 'SINGLE_ENEMY' },
    { label: 'Single Ally', value: 'SINGLE_ALLY' }, { label: 'Area', value: 'AREA' },
    { label: 'Multiple', value: 'MULTIPLE' }, { label: 'Object', value: 'OBJECT' }
  ];

  readonly schoolsOfMagic = [
    { label: 'Abjuration', value: 'Abjuration' }, { label: 'Conjuration', value: 'Conjuration' },
    { label: 'Divination', value: 'Divination' }, { label: 'Enchantment', value: 'Enchantment' },
    { label: 'Evocation', value: 'Evocation' }, { label: 'Illusion', value: 'Illusion' },
    { label: 'Necromancy', value: 'Necromancy' }, { label: 'Transmutation', value: 'Transmutation' }
  ];

  readonly attackAbilities = [
    { label: 'Strength', value: 'STR' }, { label: 'Dexterity', value: 'DEX' },
    { label: 'Constitution', value: 'CON' }, { label: 'Intelligence', value: 'INT' },
    { label: 'Wisdom', value: 'WIS' }, { label: 'Charisma', value: 'CHA' }
  ];

  readonly attackTypes = [
    { label: 'Attack Roll', value: 'ATTACK_ROLL' },
    { label: 'Saving Throw', value: 'SAVING_THROW' },
    { label: 'Utility', value: 'UTILITY' },
    { label: 'Contested Check', value: 'CONTESTED_CHECK' }
  ];

  readonly damageOnSaveTypes = [
    { label: 'Half Damage', value: 'HALF' },
    { label: 'No Damage', value: 'NONE' },
    { label: 'Special Effect', value: 'SPECIAL_EFFECT' }
  ];

  readonly damageTypes = [
    { label: 'Fire', value: 'Fire' },
    { label: 'Cold', value: 'Cold' },
    { label: 'Slashing', value: 'Slashing' },
  ];

  private fb = inject(FormBuilder);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private playerCardStateService = inject(PlayerCardStateService);
  private confirmationService = inject(ConfirmationService);

  ngOnInit(): void {
    this.spell = cloneDeep(this.config.data.spell);
    this.buildForm();
  }

  private buildForm(): void {
    const props = this.spell.properties;

    this.spellForm = this.fb.group({
      name: [this.spell.name, Validators.required],
      description: [this.spell.description || ''],
      properties: this.fb.group({
        target_type: [props.target_type || ''],
        range: [props.range || ''],
        is_passive: [props.is_passive || false],
        school_of_magic: [props.school_of_magic || ''],
        spell_components: [props.spell_components || ''],
        spell_level: [props.spell_level ?? 0, Validators.min(0)],
        attack_info: this.fb.group({
          action_type: [props.attack_info?.action_type || ''],
          ability: [props.attack_info?.ability || '']
        }),

        damage_info: this.fb.group({
          effects: this.fb.array(
            props.damage_info?.effects?.map(effect => this.createDamageEffectGroup(effect)) || []
          )
        })
      })
    });
  }

  private createDamageEffectGroup(effect?: DamageEffect): FormGroup {
    return this.fb.group({
      dice: [effect?.dice || '', Validators.required],
      type: [effect?.type || '', Validators.required],
      on_save: [effect?.on_save || 'NONE', Validators.required]
    });
  }


  get damageEffects(): FormArray {
    return this.spellForm.get('properties.damage_info.effects') as FormArray;
  }

  addDamageEffect(): void {
    this.damageEffects.push(this.createDamageEffectGroup());
  }

  removeDamageEffect(index: number): void {
    this.damageEffects.removeAt(index);
  }


  save(): void {
    if (this.spellForm.invalid) return;

    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) return;
    const formValues = this.spellForm.getRawValue();
    const updatedSpell = cloneDeep(this.spell);

    updatedSpell.name = formValues.name;
    updatedSpell.description = formValues.description;

    updatedSpell.properties = {
      ...updatedSpell.properties,
      ...formValues.properties
    };

    const updatedSpells = currentCard.spells.map(spell =>
      spell.id_suggestion === updatedSpell.id_suggestion ? updatedSpell : spell
    );

    const updatedPlayerCard = { ...currentCard, spells: updatedSpells };

    this.playerCardStateService.updatePlayerCard(updatedPlayerCard);

    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }

  delete(): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${this.spell.name}?`,
      header: 'Delete Spell',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        const currentCard = this.playerCardStateService.playerCard$();
        if (!currentCard) return;

        const updatedSpells = currentCard.spells.filter(spell => spell.id_suggestion !== this.spell.id_suggestion);
        const updatedPlayerCard = { ...currentCard, spells: updatedSpells };

        this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
        this.dialogRef.close(true);
      }
    });
  }
}
