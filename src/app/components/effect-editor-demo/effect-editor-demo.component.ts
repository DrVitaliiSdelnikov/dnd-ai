import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { EffectEditorComponent } from '../effect-editor/effect-editor.component';
import { ItemWithEffects, SpellWithEffects, Effect } from '../../shared/interfaces/effects.interface';

@Component({
  selector: 'app-effect-editor-demo',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule, EffectEditorComponent],
  template: `
    <div class="demo-container">
      <h1>Effect Editor Demo</h1>
      
      <div class="demo-actions">
        <button pButton label="Edit Sample Weapon" icon="pi pi-pencil" 
                (click)="editSampleWeapon()" class="p-button-success"></button>
        <button pButton label="Edit Sample Spell" icon="pi pi-pencil" 
                (click)="editSampleSpell()" class="p-button-info"></button>
        <button pButton label="Create New Item" icon="pi pi-plus" 
                (click)="createNewItem()" class="p-button-secondary"></button>
      </div>

      <div *ngIf="currentItem" class="current-item-info">
        <h3>Current Item: {{ currentItem.name }}</h3>
        <p>{{ currentItem.description }}</p>
        <p><strong>Effects:</strong> {{ currentItem.effects.length }}</p>
      </div>
    </div>

    <p-dialog 
      header="Effect Editor" 
      [(visible)]="showEditor" 
      [modal]="true" 
      [style]="{width: '95vw', height: '90vh'}"
      [maximizable]="true"
      (onHide)="closeEditor()">
      
      <app-effect-editor 
        [item]="currentItem"
        [isSpell]="isEditingSpell"
        (itemChanged)="onItemChanged($event)"
        (save)="onSave()"
        (cancel)="closeEditor()">
      </app-effect-editor>
    </p-dialog>
  `,
  styles: [`
    .demo-container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;

      h1 {
        text-align: center;
        margin-bottom: 2rem;
        color: var(--primary-color);
      }

      .demo-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin-bottom: 2rem;
        flex-wrap: wrap;
      }

      .current-item-info {
        background: var(--surface-100);
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--surface-300);

        h3 {
          margin-top: 0;
          color: var(--text-color);
        }

        p {
          margin-bottom: 0.5rem;
          color: var(--text-color-secondary);
        }
      }
    }
  `]
})
export class EffectEditorDemoComponent {
  showEditor = false;
  currentItem: ItemWithEffects | SpellWithEffects | null = null;
  isEditingSpell = false;

  editSampleWeapon(): void {
    this.currentItem = this.createSampleWeapon();
    this.isEditingSpell = false;
    this.showEditor = true;
  }

  editSampleSpell(): void {
    this.currentItem = this.createSampleSpell();
    this.isEditingSpell = true;
    this.showEditor = true;
  }

  createNewItem(): void {
    this.currentItem = {
      id_suggestion: 'new_item_' + Date.now(),
      name: 'New Item',
      type: 'WEAPON',
      description: '',
      quantity: 1,
      effects: [],
      template: '{{name}} is a basic item.'
    };
    this.isEditingSpell = false;
    this.showEditor = true;
  }

  private createSampleWeapon(): ItemWithEffects {
    const damageEffect: Effect = {
      id: 'damage_1',
      name: 'Slashing Damage',
      type: 'DAMAGE',
      properties: {
        dice: '1d8+2',
        damageType: 'Slashing'
      },
      order: 0
    };

    const fireEffect: Effect = {
      id: 'fire_damage',
      name: 'Fire Damage',
      type: 'DAMAGE',
      properties: {
        dice: '1d6',
        damageType: 'Fire'
      },
      order: 1
    };

    const proficiencyEffect: Effect = {
      id: 'proficiency',
      name: 'Weapon Proficiency',
      type: 'WEAPON_PROFICIENCY',
      properties: {
        proficient: true
      },
      isSystemEffect: true,
      order: 2
    };

    const attackStatEffect: Effect = {
      id: 'attack_stat',
      name: 'Attack Stat',
      type: 'ATTACK_STAT',
      properties: {
        attackStat: 'str'
      },
      isSystemEffect: true,
      order: 3
    };

    return {
      id_suggestion: 'flame_tongue_sword',
      name: 'Flame Tongue Longsword',
      type: 'WEAPON',
      description: 'A magical longsword that bursts into flames when activated.',
      quantity: 1,
      effects: [damageEffect, fireEffect, proficiencyEffect, attackStatEffect],
      template: '{{name}} attacks dealing {{damage_1}} plus {{fire_damage}}.'
    };
  }

  private createSampleSpell(): SpellWithEffects {
    const damageEffect: Effect = {
      id: 'spell_damage',
      name: 'Fire Damage',
      type: 'DAMAGE',
      properties: {
        dice: '3d6',
        damageType: 'Fire'
      },
      order: 0
    };

    const spellLevelEffect: Effect = {
      id: 'spell_level',
      name: 'Spell Level',
      type: 'SPELL_LEVEL',
      properties: {
        level: 2
      },
      isSystemEffect: true,
      order: 1
    };

    return {
      id_suggestion: 'scorching_ray',
      name: 'Scorching Ray',
      type: 'SPELL',
      description: 'You create three rays of fire and hurl them at targets within range.',
      effects: [damageEffect, spellLevelEffect],
      template: '{{name}} creates rays that deal {{spell_damage}} each.'
    };
  }

  onItemChanged(item: ItemWithEffects | SpellWithEffects): void {
    this.currentItem = item;
    console.log('Item changed:', item);
  }

  onSave(): void {
    console.log('Saving item:', this.currentItem);
    this.closeEditor();
  }

  closeEditor(): void {
    this.showEditor = false;
  }
} 