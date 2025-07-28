import { Injectable, signal, WritableSignal } from '@angular/core';
import { PlayerCard } from '../shared/interfaces/player-card.interface';
import { SessionStorageService } from './session-storage.service';
import { sessionStorageKeys } from '../shared/const/session-storage-keys';

@Injectable({
  providedIn: 'root'
})
export class PlayerCardStateService {
  private readonly playerCardState: WritableSignal<PlayerCard | null> = signal(null);
  public readonly playerCard$ = this.playerCardState.asReadonly();

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
}
