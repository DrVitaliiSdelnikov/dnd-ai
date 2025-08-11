import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnInit, Signal,
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
  CORE_DM_BEHAVIOR,
  FORMAT_JSON_RESPONSE,
  RULES_DICE_AND_CHECKS,
  TASK_CONTINUE_GAMEPLAY,
  TASK_NEW_CAMPAIGN,
  TASK_SUMMARIZE_HISTORY
} from '../../shared/prompts/prompts';
import { Observable, of } from 'rxjs';
import { PlayerCard } from '../../shared/interfaces/player-card.interface';
import { Tooltip } from 'primeng/tooltip';
import { LoadingIndicatorComponent } from '../../shared/components/loading-indicator.component';
import { PlayerCardStateService } from '../../services/player-card-state.service';
import { AdventureSummary } from '../../shared/interfaces/sammery';

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
  playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);
  playerCard: Signal<PlayerCard | null> = this.playerCardStateService.playerCard$;
  campaignSummary: Signal<AdventureSummary | null> = this.playerCardStateService.campaignSummary$;

  @ViewChild('messagesArea') private messagesArea!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    this.checkCampaignHistory();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
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
    if (!this.campaignSummary()) {
      return this.wipeMessagesIds()
    }
    const stringifySummery = JSON.stringify(this.campaignSummary());

    const preparedMessages = this.wipeMessagesIds();
    const unsummarised = preparedMessages.length % 10 || 10;
    const tail = preparedMessages.slice(-unsummarised);

    return [
      { role: 'system', content: stringifySummery },
      ...tail
    ];
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
    if (!raw) {
      return '';
    }
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

  private getCampaignMessages(): string | null {
    return this.sessionStorageService.getItemFromSessionStorage(sessionStorageKeys.MESSAGES_HISTORY);
  }

  formatMessageContent(content: string): string {
    if (!content) {
      return '';
    }
    let formattedContent = content.replace(/\\n|\n/g, '<br>');
    formattedContent = formattedContent.replace(/\t/g, '    ');

    if (formattedContent.startsWith('"') && formattedContent.endsWith('"')) {
      formattedContent = formattedContent.substring(1, formattedContent.length - 1);
    }

    return formattedContent;
  }

  sendMessage(): void {
    if (!this.userInput.trim()) return;

    this.pushMessage({
      content: this.userInput,
      role: 'user'
    });

    this.userInput = '';
    this.isLoading.set(true);

    const systemPrompt = `
      ${CORE_DM_BEHAVIOR}
      ---
      ${RULES_DICE_AND_CHECKS}
      ---
      ${TASK_CONTINUE_GAMEPLAY}
      ---
      ${FORMAT_JSON_RESPONSE}
    `;

    const userPrompt = `
      Player current playerCard state -> ${JSON.stringify(this.playerCard())}
      ---
      **Game Context (History):**
      ${JSON.stringify(this.buildOutgoingHistory())}
      ---
      Previous summery: ${this.campaignSummary()}
    `;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    if(this.messages?.length < 20) {
      messages.push({ role: 'system', content: TASK_NEW_CAMPAIGN });
    }

    this.chatService.sendMessage(messages)
      .pipe(
        tap(result => this.parseMessage(result)),
        switchMap(result => {
          const count = this.messages?.length ?? 0;
          return this.resolveGenerateSummeryObservble(count, result);
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe();
  }

  private resolveGenerateSummeryObservble(count: number, result: ChatMessage): Observable<ChatMessage> {
    return count !== 0 && (count - 1) % 10 === 0
      ? this.generateSummery(result)
      : of(result);
  }

  private parseMessage(result: {content: string, role: string}): void {
    const rawContent = this.stripMarkdownJson(result?.content);
    try {
      const parsedAnswer = JSON.parse(rawContent);

      this.pushMessage({
        content: parsedAnswer.message,
        role: result.role
      });

      const newCardFromAI = parsedAnswer.playerCard;
      const currentCard = this.playerCard();
      const finalUpdatedCard = { ...currentCard };

      Object.assign(finalUpdatedCard, {
        hp: newCardFromAI.hp,
        currency: newCardFromAI.currency,
        name: newCardFromAI.name,
        race: newCardFromAI.race,
        class: newCardFromAI.class,
        level: newCardFromAI.level,
        exp: newCardFromAI.exp,
        skills: newCardFromAI.skills,
        abilities: newCardFromAI.abilities,
        notes: newCardFromAI.notes,
        isUpdated: newCardFromAI.isUpdated,
      });


      if (newCardFromAI.loot !== 'SAME') {
        finalUpdatedCard.loot = newCardFromAI.loot;
      }

      if (newCardFromAI.spells !== 'SAME') {
        const normalizedSpells = Array.isArray(newCardFromAI.spells)
          ? newCardFromAI.spells.map((s: any) => {
              if (!s || typeof s !== 'object') return s;
              const n: any = { ...s };
              if (typeof n.level !== 'number') n.level = 0;
              if (typeof n.isPassive !== 'boolean') n.isPassive = true;
              if (n.isPassive) delete n.castType;
              if (!Array.isArray(n.effects)) {
                const propsEffects = n?.properties?.effects;
                n.effects = Array.isArray(propsEffects) ? propsEffects : [];
              }
              return n;
            })
          : [];
        finalUpdatedCard.spells = normalizedSpells;
      }

      this.playerCardStateService.updatePlayerCard(finalUpdatedCard as PlayerCard);
      this.saveMessageToHistory(JSON.stringify(this.messages));
    } catch (error) {
      console.error("Failed to parse AI response as JSON.", error, { rawContent: rawContent });
      this.messages.push({
        content: "Unfortunately, an error occurred. Please, repeat your answer.",
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
    const existingSummary = this.campaignSummary() ?? '';
    this.isLoading.set(false);

    const summarizationPrompt = `
    ${TASK_SUMMARIZE_HISTORY}
    ---
    ${JSON.stringify(this.messages)}
    ---
    **Data for Summarization:**

    Previous Summary
    ${existingSummary || 'No previous summary.'}
  `;

    return this.chatService.getSummarize([{ role: 'user', content: summarizationPrompt }])
      .pipe(
        delay(1000),
        take(1),
        tap(result => {
          this.playerCardStateService.parseAndSaveSummery(result.content);
        }),
        map(() => message),
      )
  }

  prepareInstructions(): void {
    this.isNewCampaign.set(false);
    this.sendInstructionsAndStart();
  }

  setDiceRollResult(rollEvent: {[key: string]: string}): void {
    const newRollMarker = `${rollEvent.description}.`;

    this.userInput = this.userInput.trim()
      ? `${this.userInput.trim()} ${newRollMarker}`
      : newRollMarker;
  }
}
