import { Injectable, signal, WritableSignal, computed } from '@angular/core';
import { PlayerCard } from '../shared/interfaces/player-card.interface';
import { SessionStorageService } from './session-storage.service';
import { sessionStorageKeys } from '../shared/const/session-storage-keys';
import { InventoryItem } from '../shared/interfaces/inventroy.interface';

@Injectable({
  providedIn: 'root'
})
export class PlayerCardStateService {
  private readonly playerCardState: WritableSignal<PlayerCard | null> = signal(null);
  public readonly playerCard$ = this.playerCardState.asReadonly();
  public readonly abilityModifiers$ = computed(() => {
    const card = this.playerCardState();
    if (!card) return {};
    const modifiers: { [key: string]: number } = {};
    for (const key in card.abilities) {
      const value = card.abilities[key as keyof typeof card.abilities];
      modifiers[key] = Math.floor((value - 10) / 2);
    }
    return modifiers;
  });

  constructor(private sessionStorageService: SessionStorageService) {
    this.loadFromSession();
  }


  private loadFromSession(): void {
    const storedCard = this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.HERO);
    if (storedCard) {
      try {
        this.playerCardState.set(JSON.parse(storedCard));
      } catch (e) {
        console.error("Failed to parse player card from session storage", e);
      }
    }
  }


  updatePlayerCard(updatedCard: PlayerCard): void {
    this.playerCardState.set(updatedCard);
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.HERO, JSON.stringify(updatedCard));
    console.log('PlayerCardStateService: State updated and saved.');
  }

  addItemToInventory(newItem: InventoryItem): void {
    const currentCard = this.playerCardState();
    if (currentCard) {
      const updatedLoot = [...(currentCard.loot || []), newItem];
      this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
    }
  }

  getProficiencyBonus(level: number): number {
    if (level < 1) return 0;
    return 1 + Math.ceil(level / 4);
  }
}
