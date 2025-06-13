import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {

  saveItemToSessionStorage(key: string, value: any): void {
    sessionStorage.setItem(key, value);
  }

  getItemFromSessionStorage(key: string): string | null {
    return sessionStorage.getItem(key);
  }
}
