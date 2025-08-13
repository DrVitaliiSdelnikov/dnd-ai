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
        const parsedCard = JSON.parse(storedCard);
        // One-time, idempotent spell normalization to new model
        if (parsedCard && Array.isArray(parsedCard.spells)) {
          parsedCard.spells = parsedCard.spells.map((s: any) => {
            if (!s || typeof s !== 'object') return s;
            const normalized: any = { ...s };
            // Ensure required new fields
            if (typeof normalized.level !== 'number') normalized.level = 0;
            if (typeof normalized.isPassive !== 'boolean') normalized.isPassive = true;
            if (normalized.isPassive) delete normalized.castType;
            // Ensure effects is a flat array
            if (!Array.isArray(normalized.effects)) {
              // Some legacy forms nested under properties.effects
              const propsEffects = normalized?.properties?.effects;
              normalized.effects = Array.isArray(propsEffects) ? propsEffects : [];
            }
            return normalized;
          });
        }
        this.playerCardState.set(parsedCard);
      } catch (error) {
        console.error('❌ PlayerCardStateService: Error parsing stored card:', error);
        this.playerCardState.set(null);
      }
    } else {
      this.playerCardState.set(null);
    }

    const storedSummary = this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.SUMMERY);
    if (storedSummary) {
      this.campaignSummaryState.set(JSON.parse(storedSummary));
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
    if (Array.isArray(updatedCard.loot) && updatedCard.loot.length > 0) {
      if (updatedCard.loot[0].properties) {
      }
    }
    const prev = this.playerCardState();
    const prevSpellsLen = Array.isArray(prev?.spells) ? prev!.spells.length : prev?.spells === 'SAME' ? 'SAME' : undefined;
    const nextSpellsLen = Array.isArray(updatedCard?.spells) ? updatedCard.spells.length : updatedCard?.spells === 'SAME' ? 'SAME' : undefined;
    console.log('[PlayerCardStateService] updatePlayerCard called', { prevSpellsLen, nextSpellsLen });
    this.playerCardState.set(updatedCard);
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.HERO, JSON.stringify(updatedCard));
  }

  // Equip/Unequip helpers
  private isItemIdMatch(item: any, targetId: string): boolean {
    const currentItemId = (item as any).item_id_suggestion || (item as any).id_suggestion;
    return currentItemId === targetId;
  }

  equipItem(itemId: string): void {
    const currentCard = this.playerCardState();
    if (!currentCard) return;
    const currentLoot = currentCard.loot === 'SAME' ? [] : (currentCard.loot || []);
    const updatedLoot = currentLoot.map(it => this.isItemIdMatch(it, itemId) ? { ...it, equipped: true } : it);
    this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
  }

  unequipItem(itemId: string): void {
    const currentCard = this.playerCardState();
    if (!currentCard) return;
    const currentLoot = currentCard.loot === 'SAME' ? [] : (currentCard.loot || []);
    const updatedLoot = currentLoot.map(it => this.isItemIdMatch(it, itemId) ? { ...it, equipped: false } : it);
    this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
  }

  toggleEquip(itemId: string): void {
    const currentCard = this.playerCardState();
    if (!currentCard) return;
    const currentLoot = currentCard.loot === 'SAME' ? [] : (currentCard.loot || []);
    const updatedLoot = currentLoot.map(it => {
      if (!this.isItemIdMatch(it, itemId)) return it;
      const equippedNow = (it as any)?.equipped !== false; // default true
      return { ...it, equipped: !equippedNow };
    });
    this.updatePlayerCard({ ...currentCard, loot: updatedLoot });
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
      // Handle both property names for compatibility
      const updatedItemId = (updatedItem as any).item_id_suggestion || (updatedItem as any).id_suggestion;
      
      const updatedLoot = currentLoot.map(item => {
        const currentItemId = (item as any).item_id_suggestion || (item as any).id_suggestion;
        return currentItemId === updatedItemId ? updatedItem : item;
      });
      
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
