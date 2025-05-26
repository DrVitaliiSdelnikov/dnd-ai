import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environment/environment.dev';

export interface ChatMessage {
  role: string;
  content: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  sendMessage(messages: ChatMessage[]): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/chat`, { messages }).pipe(
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
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.error?.error || error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => ({ role: 'assistant', content: `Sorry, an error occurred: ${errorMessage}` } as ChatMessage));
  }
}
