// src/app/components/dnd-chat/dnd-chat.component.ts
import { Component, DestroyRef, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, take, tap } from 'rxjs/operators';
import { campaignInitPrompt } from '../../../assets/prompts/campaign-init-prompt';

@Component({
  selector: 'app-dnd-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dnd-chat.component.html',
  styleUrls: ['./dnd-chat.component.scss'],
})
export class DndChatComponent implements OnInit {
  private chatService = inject(ChatService);
  private destroyRef = inject(DestroyRef);
  messages: ChatMessage[] = [];
  userInput: string = '';
  isLoading: WritableSignal<boolean> = signal(false);

  ngOnInit(): void {
    this.initChatMessage();
  }

  private initChatMessage(): void {
    this.chatService.sendMessage([{ role: 'user', content: campaignInitPrompt }])
      .pipe(
        tap(result => {
          this.messages.push(result);
          this.isLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
        catchError(errorMsg => {
          this.messages.push(errorMsg);
          this.isLoading.set(false);
          return errorMsg;
        })
      )
      .subscribe();
  }

  formatMessageContent(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  sendMessage(): void {
    if (!this.userInput.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: this.userInput };
    this.messages.push(userMessage);
    this.userInput = '';
    this.isLoading.set(true);

    this.chatService.sendMessage(this.messages)
      .pipe(
        tap(result => {
          this.messages.push(result);
          this.isLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
        catchError(errorMsg => {
          this.messages.push(errorMsg);
          this.isLoading.set(false);
          return errorMsg;
        })
      )
      .subscribe();
  }
}
