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
      (cancel)="close()"
      (delete)="delete()">
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
  }

  onSpellChanged(newSpell: ItemWithEffects | Spell): void {
    this.spell = newSpell as Spell;
  }

  save(): void {
    if (!this.spell) return;
    
    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) return;

    if (Array.isArray(currentCard.spells)) {
      const updatedSpells = currentCard.spells.map(spell =>
        spell.id_suggestion === this.spell.id_suggestion ? this.spell : spell
      );
      const updatedPlayerCard = { ...currentCard, spells: updatedSpells };
      this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
    }

    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }

  delete(): void {
    if (!this.spell) { this.dialogRef.close({ deleted: true }); return; }
    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) { this.dialogRef.close({ deleted: true }); return; }
    const updated = Array.isArray(currentCard.spells) ? currentCard.spells.filter(s => s.id_suggestion !== this.spell.id_suggestion) : [];
    this.playerCardStateService.updatePlayerCard({ ...currentCard, spells: updated });
    this.dialogRef.close({ deleted: true });
  }
}
