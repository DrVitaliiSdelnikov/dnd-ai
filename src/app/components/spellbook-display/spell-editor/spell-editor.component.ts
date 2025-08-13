import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { Spell } from '../../../shared/interfaces/spell.interface';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import { EffectEditorComponent } from '../../effect-editor/effect-editor.component';
import { ItemWithEffects, Effect } from '../../../shared/interfaces/effects.interface';

@Component({
  selector: 'app-spell-editor',
  standalone: true,
  imports: [CommonModule, EffectEditorComponent],
  template: `
    <app-effect-editor 
      [item]="spell"
      [isSpell]="true"
      (itemChanged)="onSpellChanged($event)"
      (save)="save()"
      (cancel)="close()">
    </app-effect-editor>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class SpellEditorComponent implements OnInit {
  spell: Spell;

  private playerCardStateService = inject(PlayerCardStateService);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);

  ngOnInit(): void {
    this.spell = this.config.data.spell;
    console.log('[SpellEditor] ngOnInit with incoming spell:', this.spell);
  }

  onSpellChanged(newSpell: ItemWithEffects | Spell): void {
    this.spell = newSpell as Spell;
    console.log('[SpellEditor] onSpellChanged ->', this.spell);
  }

  save(): void {
    console.log('[SpellEditor] save() called with spell:', this.spell);
    if (!this.spell) return;
    
    const currentCard = this.playerCardStateService.playerCard$();
    console.log('[SpellEditor] current player card before save:', currentCard);
    if (!currentCard) return;

    if (Array.isArray(currentCard.spells)) {
      const exists = currentCard.spells.some(spell => spell.id_suggestion === this.spell.id_suggestion);
      console.log('[SpellEditor] does spell already exist in card?', exists);
      const updatedSpells = currentCard.spells.map(spell =>
        spell.id_suggestion === this.spell.id_suggestion ? this.spell : spell
      );
      const updatedPlayerCard = { ...currentCard, spells: updatedSpells };
      console.log('[SpellEditor] updating player card with spells length:', updatedSpells.length);
      if (!exists) {
        console.warn('[SpellEditor] Target spell was not found in playerCard.spells during save; no insertion performed.');
      }
      this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
    } else {
      console.warn('[SpellEditor] currentCard.spells is not an array; cannot save spell');
    }

    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }
}
