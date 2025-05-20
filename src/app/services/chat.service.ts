// src/app/services/chat.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ChatMessage {
  role: string;
  content: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private http = inject(HttpClient);
  // Путь к вашей Cloudflare Function.
  // Если вы запускаете локально с `wrangler dev` и `ng serve`,
  // вам может понадобиться прокси в Angular (proxy.conf.json)
  // или полный URL к dev-серверу функции (например, http://localhost:8788/api/chat)
  // Для продакшена это будет просто '/api/chat' если Pages Functions
  private apiUrl = '/api/chat'; // ИЛИ http://localhost:YOUR_CF_DEV_PORT/api/chat при локальной разработке

  sendMessage(messages: ChatMessage[]): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(this.apiUrl, { messages }).pipe(
      map(response => {
        if (!response.role) {
          return { ...response, role: 'assistant' };
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Клиентская ошибка
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Серверная ошибка
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.error?.error || error.message}`;
    }
    console.error(errorMessage);
    // Возвращаем сообщение об ошибке как ChatMessage, чтобы отобразить в UI
    return throwError(() => ({ role: 'assistant', content: `Sorry, an error occurred: ${errorMessage}` } as ChatMessage));
  }
}
