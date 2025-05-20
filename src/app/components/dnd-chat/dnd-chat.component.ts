// src/app/components/dnd-chat/dnd-chat.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService, ChatMessage } from '../../services/chat.service';

@Component({
  selector: 'app-dnd-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dnd-chat.component.html',
  styleUrls: ['./dnd-chat.component.scss'],
})
export class DndChatComponent implements OnInit {
  private chatService = inject(ChatService);

  messages: ChatMessage[] = [];
  userInput: string = '';
  isLoading: boolean = false;
  // Начальное сообщение можно добавить здесь или получить от API при инициализации
  // initialMessage: ChatMessage = { role: 'assistant', content: "Приветствую, искатели приключений! Готовы начать?" };

  ngOnInit(): void {
    // Можно отправить пустое сообщение или специальное "init" сообщение,
    // чтобы получить приветствие от DM. Или просто добавить его вручную.
    // this.messages.push(this.initialMessage);
    // Для простоты MVP, пусть пользователь начнет диалог первым или добавьте
    // приветственное сообщение в Cloudflare Function для первого пустого запроса.
    // Либо можно сразу отправить "привет" для инициации:
    // this.sendInitialGreeting();
  }

  // Опционально: отправить "привет" для начала игры
  // sendInitialGreeting() {
  //   this.isLoading = true;
  //   // Отправляем только системный промпт (неявно через Cloudflare Function)
  //   // и одно "user" сообщение, чтобы инициировать ответ.
  //   const initialUserMessage: ChatMessage = { role: 'user', content: "Привет, Мастер! Мы готовы начать." };
  //   this.messages.push(initialUserMessage);

  //   this.chatService.sendMessage([initialUserMessage]).subscribe({
  //     next: (response) => {
  //       this.messages.push(response);
  //       this.isLoading = false;
  //     },
  //     error: (errorMsg) => {
  //       this.messages.push(errorMsg); // errorMsg уже ChatMessage
  //       this.isLoading = false;
  //     }
  //   });
  // }

  // ... внутри DndChatComponent
  formatMessageContent(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  sendMessage(): void {
    if (!this.userInput.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: this.userInput };
    this.messages.push(userMessage);
    this.userInput = '';
    this.isLoading = true;

    // Отправляем всю историю чата (включая системный промпт, который добавляется на сервере)
    // Cloudflare Function ожидает массив всех сообщений для контекста
    this.chatService.sendMessage(this.messages).subscribe({
      next: (response) => {
        this.messages.push(response);
        this.isLoading = false;
      },
      error: (errorMsg) => { // errorMsg из handleError уже ChatMessage
        this.messages.push(errorMsg);
        this.isLoading = false;
      }
    });
  }
}
