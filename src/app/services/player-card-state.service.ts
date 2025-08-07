import { Injectable, signal, WritableSignal, computed } from '@angular/core';
import { PlayerCard } from '../shared/interfaces/player-card.interface';
import { SessionStorageService } from './session-storage.service';
import { sessionStorageKeys } from '../shared/const/session-storage-keys';
import { InventoryItem } from '../shared/interfaces/inventory.interface';
import { AdventureSummary } from '../shared/interfaces/sammery';

@Injectable({
  providedIn: 'root'
})
export class PlayerCardStateService {
  private readonly playerCardState: WritableSignal<PlayerCard | null> = signal(null);
  public readonly playerCard$ = this.playerCardState.asReadonly();
  private readonly campaignSummaryState: WritableSignal<AdventureSummary | null> = signal(null);
  public readonly campaignSummary$ = this.campaignSummaryState.asReadonly();
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

    const storedSummary = this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.SUMMERY);
    if (storedSummary) {
      try {
        const { adventureHistory, keyRelationships, importantDecisions } = JSON.parse(storedSummary);
        this.campaignSummaryState.set({
          adventureHistory,
          keyRelationships,
          importantDecisions
        });
      } catch {
        console.warn('Summery parsing problem')
      }
    }
  }

  updateCampaignSummary(updatedSummery: AdventureSummary): void {
    this.campaignSummaryState.set(updatedSummery);
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.SUMMERY, JSON.stringify({
      adventureHistory: updatedSummery.adventureHistory,
      keyRelationships: updatedSummery.keyRelationships,
      importantDecisions: updatedSummery.importantDecisions
    }));
  }

  parseAndSaveSummery(newSummary: string): void {
    const { summery } = JSON.parse(newSummary)

    this.campaignSummaryState.set({
      adventureHistory: summery.adventureHistory,
      keyRelationships: summery.keyRelationships,
      importantDecisions: summery.importantDecisions
    });
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.SUMMERY, JSON.stringify({
      adventureHistory: summery.adventureHistory,
      keyRelationships: summery.keyRelationships,
      importantDecisions: summery.importantDecisions
    }));
  }

  updatePlayerCard(updatedCard: PlayerCard): void {
    this.playerCardState.set(updatedCard);
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.HERO, JSON.stringify(updatedCard));
    console.log('PlayerCardStateService: State updated and saved.');
  }

  addItemToInventory(newItem: InventoryItem): void {
    const currentCard = this.playerCardState();
    if (currentCard) {
      const currentLoot = currentCard.loot === 'SAME' ? [] : (currentCard.loot || []);
      const updatedLoot = [...currentLoot, newItem];
      this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
    }
  }

  updateItemInInventory(updatedItem: InventoryItem): void {
    const currentCard = this.playerCardState();
    if (currentCard) {
      const currentLoot = currentCard.loot === 'SAME' ? [] : (currentCard.loot || []);
      const updatedLoot = currentLoot.map(item =>
        item.item_id_suggestion === updatedItem.item_id_suggestion ? updatedItem : item
      );
      this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
    }
  }

  removeItemFromInventory(itemId: string): void {
    const currentCard = this.playerCardState();
    if (currentCard) {
      const currentLoot = currentCard.loot === 'SAME' ? [] : (currentCard.loot || []);
      const updatedLoot = currentLoot.filter(item => item.item_id_suggestion !== itemId);
      this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
    }
  }

  getProficiencyBonus(level: number): number {
    if (level < 1) return 0;
    return 1 + Math.ceil(level / 4);
  }
}
