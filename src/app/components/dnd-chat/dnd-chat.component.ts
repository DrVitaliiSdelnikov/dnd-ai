import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnInit,
  signal,
  ViewChild,
  WritableSignal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { delay, finalize, map, switchMap, take, tap } from 'rxjs/operators';
import { ChatMessage, ChatService } from '../../api/chat.service';
import { SessionStorageService } from '../../services/session-storage.service';
import { sessionStorageKeys } from '../../shared/const/session-storage-keys';
import { PlayerCardComponent } from '../player-card/player-card.component';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import {
  CORE_DM_BEHAVIOR, FORMAT_JSON_RESPONSE, LOOT_AND_INVENTORY_MANAGEMENT, RULES_DICE_AND_CHECKS, TASK_CONTINUE_GAMEPLAY,
  TASK_NEW_CAMPAIGN, TASK_SUMMARIZE_HISTORY
} from '../../shared/prompts/prompts';
import { Observable, of } from 'rxjs';
import { PlayerCard } from '../../shared/interfaces/player-card.interface';
import { Tooltip } from 'primeng/tooltip';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator.component';

@Component({
  selector: 'app-dnd-chat',
  imports: [
    CommonModule,
    FormsModule,
    PlayerCardComponent,
    ButtonDirective,
    Tooltip,
    ButtonLabel,
    ButtonIcon,
    LoadingIndicatorComponent
  ],
  templateUrl: './dnd-chat.component.html',
  styleUrls: ['./dnd-chat.component.scss'],
  standalone: true,
})
export class DndChatComponent implements OnInit, AfterViewInit {
  private chatService = inject(ChatService);
  private destroyRef = inject(DestroyRef);
  private zone: NgZone = inject(NgZone);
  private sessionStorageService = inject(SessionStorageService);
  messages: ChatMessage[] = [];
  userInput: string = '';
  isLoading: WritableSignal<boolean> = signal(false);
  isNewCampaign: WritableSignal<boolean> = signal(true)
  instructions: string = '';
  playerCard: WritableSignal<PlayerCard> = signal(null);
  campaignSummary: WritableSignal<string> = signal(null);

  @ViewChild('messagesArea') private messagesArea!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    this.checkCampaignHistory();
    this.setPlayerCard();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  private setPlayerCard(): void {
    const playerCard = this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.HERO);
    if(!playerCard) return;

    const parsedPlayerCard = JSON.parse(playerCard);
    this.playerCard.set(parsedPlayerCard);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9)
  };

  private pushMessage(message: ChatMessage): void {
    const newMessage: ChatMessage = {
      ...message,
      id: this.generateId(),
    };
    this.messages.push(newMessage);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.zone.runOutsideAngular(() => {
      queueMicrotask(() => {
        const el = this.messagesArea?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  private wipeMessagesIds(): ChatMessage[] {
    return this.messages.map(({content, role}) => ({content, role}))
  }

  private buildOutgoingHistory(): ChatMessage[] {
    const summary = this.campaignSummary();
    if (!summary) {
      return this.wipeMessagesIds()
    };

    const preparedMessages = this.wipeMessagesIds();
    const unsummarised = preparedMessages.length % 10 || 10;
    const tail = preparedMessages.slice(-unsummarised);

    return [
      { role: 'system', content: summary },
      ...tail
    ];
  }

  private checkCampaignHistory(): void {
    this.isLoading.set(true);
    const messagesHistory = this.getCampaignMessages();
    this.campaignSummary.set(JSON.parse(this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.SUMMERY)));
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

  private sendInstructionsAndStart(): void {
    const initialPrompt = `
    ${CORE_DM_BEHAVIOR}
    ---
    ${TASK_NEW_CAMPAIGN}
    ---
    ${FORMAT_JSON_RESPONSE}

    **Game Context:**
    The player has provided these initial instructions: "${this.instructions}"
  `;

    this.chatService.sendMessage([{ role: 'user', content: initialPrompt }])
      .pipe(
        tap(result => {
          this.parseMessage(result);
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

    this.pushMessage({
      content: this.userInput,
      role: 'user'
    });

    const history = this.buildOutgoingHistory();
    const userMessage = `${JSON.stringify(history)}, Previous summery: ${this.campaignSummary()}`;

    this.userInput = '';
    this.isLoading.set(true);

    const gameTurnPrompt = `
    ${CORE_DM_BEHAVIOR}
    ---
    ${RULES_DICE_AND_CHECKS}
    ---
    ${TASK_CONTINUE_GAMEPLAY}
    ---
    ${FORMAT_JSON_RESPONSE}
    ---
    ${LOOT_AND_INVENTORY_MANAGEMENT}
    ---
    **Game Context (History):**
    ${JSON.stringify(userMessage)}
  `;

    this.chatService.sendMessage([{ role: 'user', content: gameTurnPrompt }])
      .pipe(
        switchMap(result => {
          const count = this.messages?.length ?? 0;
          return count !== 0 && count % 10 === 0
            ? this.generateSummery(result)
            : of(result);
        }),
        tap(result => this.parseMessage(result)),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe();
  }


  private parseMessage(result: {content: string, role: string}) {
    const rawContent = this.stripMarkdownJson(result?.content);
    try {
      const parsedAnswer = JSON.parse(rawContent);
      this.pushMessage({
        content: parsedAnswer.message,
        role: result.role
      });
      this.saveMessageToHistory(JSON.stringify(this.messages));
      this.saveHeroModelToSession(JSON.stringify(parsedAnswer.playerCard));
      this.playerCard.set(parsedAnswer.playerCard);
    } catch (error) {
      console.error("Failed to parse AI response as JSON. Treating as plain text.", error);
      this.messages.push({
        content: "Unfortunately, error occurred. Please, repeat your answer",
        role: result.role
      });
    }
  }

  startEditing(messageId: string): void {
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      this.messages.forEach(m => m.isEditing = false);
      message.isEditing = true;
    }
  }

  cancelEdit(messageToUpdate: ChatMessage): void {
    messageToUpdate.isEditing = false;
  }

  saveEdit(messageToUpdate: ChatMessage, newContent: string): void {
    messageToUpdate.content = newContent;
    messageToUpdate.isEditing = false;
    this.saveMessageToHistory(JSON.stringify(this.messages));
  }

  private generateSummery(message: ChatMessage): Observable<ChatMessage> {
    const lastTenBlock = this.lastN(this.messages, 10);
    const existingSummary = JSON.parse(this.campaignSummary()) ?? '';

    const summarizationPrompt = `
    ${TASK_SUMMARIZE_HISTORY}

    ---
    **Data for Summarization:**

    ### Previous Summary
    ${existingSummary?.content || 'No previous summary.'}

    ### Recent Messages
    ${JSON.stringify(lastTenBlock)}
  `;

    return this.chatService.sendMessage([{ role: 'user', content: summarizationPrompt }])
      .pipe(
        delay(1000),
        take(1),
        tap(result => {
          this.campaignSummary.set(result.content);
          this.sessionStorageService.saveItemToSessionStorage(sessionStorageKeys.SUMMERY, JSON.stringify(result));
        }),
        map(() => message),
      )
  }

  private lastN(messages: ChatMessage[], n = 10): string {
    return messages
      .slice(-n)
      .map(m => `${m.role} -> ${m.content}`)
      .join('\n');
  }

  prepareInstructions(): void {
    this.isNewCampaign.set(false);
    this.sendInstructionsAndStart();
  }

  setDiceRollResult($event: string) {
    this.userInput = `${$event}.`
  }
}
