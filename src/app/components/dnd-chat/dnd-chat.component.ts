import { Component, DestroyRef, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap, take, tap } from 'rxjs/operators';
import { ChatMessage, ChatService } from '../../api/chat.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { sessionStorageKeys } from '../../shared/const/session-storage-keys';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { ButtonDirective } from 'primeng/button';
import { campaignStartPrompt, playerModelPrompt } from '../../shared/prompts/prompts';
import { Observable, of } from 'rxjs';
import { PlayerCard } from '../../shared/interfaces/player-card.interface';
import { DiceRollerComponent } from '../dice-roller/dice-roller.component';

@Component({
  selector: 'app-dnd-chat',
  imports: [
    CommonModule,
    FormsModule,
    PlayerCardComponent,
    ButtonDirective,
    DiceRollerComponent
  ],
  templateUrl: './dnd-chat.component.html',
  styleUrls: ['./dnd-chat.component.scss'],
  standalone: true,
})
export class DndChatComponent implements OnInit {
  private chatService = inject(ChatService);
  private destroyRef = inject(DestroyRef);
  private sessionStorageService = inject(SessionStorageService);
  messages: ChatMessage[] = [];
  userInput: string = '';
  isLoading: WritableSignal<boolean> = signal(false);
  isNewCampaign: WritableSignal<boolean> = signal(true)
  instructions: string = '';
  instructionsMessage: string = `${campaignStartPrompt} ${playerModelPrompt}`;
  playerCard: WritableSignal<PlayerCard> = signal(null);

  ngOnInit(): void {
    this.checkCampaignHistory();
  }

  private checkCampaignHistory(): void {
    this.isLoading.set(true);
    const messagesHistory = this.getCampaignMessages();
    this.isNewCampaign.set(!messagesHistory?.length);
    if(messagesHistory?.length) {
      this.messages = JSON.parse(messagesHistory) ?? [];
    }
    this.isLoading.set(false);
  }

  stripMarkdownJson(raw: string): string {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return match ? match[1] : raw;
  };

  private sendInstructionsAndStart(message: string): void {

    this.chatService.sendMessage([{ role: 'user', content: message }])
      .pipe(
        tap(result => {
          const parsedAnswer = JSON.parse(this.stripMarkdownJson(result?.content))

          this.messages.push({
            content: parsedAnswer.message,
            role: result.role
          });

          this.saveMessageToHistory(JSON.stringify(this.messages));

          this.saveHeroModelToSession(JSON.stringify(parsedAnswer.playerCard));
          this.playerCard.set(parsedAnswer.playerCard);
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe();
  }

  /**
   * Save messages to session storage
   */
  private saveMessageToHistory(messages: string): void {
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.MESSAGES_HISTORY, messages);
  }

  private saveHeroModelToSession(heroStats: string): void {
    this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.HERO, heroStats);
  }

  /**
   * Get messages to session storage
   */
  private getCampaignMessages(): string | null {
    return this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.MESSAGES_HISTORY);
  }

  formatMessageContent(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  sendMessage(): void {
    if (!this.userInput.trim()) return;


    this.messages.push({
      content: this.userInput,
      role: 'user'
    });

    const userMessage = `${JSON.stringify(this.messages)} ${playerModelPrompt}`;

    this.userInput = '';
    this.isLoading.set(true);

    this.chatService.sendMessage([{ role: 'user', content: userMessage }])
      .pipe(
        tap(result => {
          const parsedAnswer = JSON.parse(this.stripMarkdownJson(result?.content))

          this.messages.push({
            content: parsedAnswer.message,
            role: result.role
          });

          this.saveMessageToHistory(JSON.stringify(this.messages));
          this.saveHeroModelToSession(JSON.stringify(parsedAnswer.playerCard));
          this.playerCard.set(parsedAnswer.playerCard);
        }),
        switchMap(() => {
          return this.messages?.length >= 10
            ? this.generateSummery()
            : of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe();
  }

  private generateSummery(): Observable<ChatMessage> {
    const summeryMessage = `
    Use this message history list to generate short summery for future prompt, so you can get context from it.

    ${ JSON.stringify(this.messages) }`;

    return this.chatService.sendMessage([{ role: 'user', content: summeryMessage }])
      .pipe(
        take(1)
      )
  }

  prepareInstructions(): void {
    this.isNewCampaign.set(false);
    const preparedInstruction = `${this.instructionsMessage} -> ${this.instructions}`
    this.sendInstructionsAndStart(preparedInstruction);
  }

  setDiceRollResult($event: number) {
    this.userInput = `Dice roll result: ${$event}.`
  }
}
