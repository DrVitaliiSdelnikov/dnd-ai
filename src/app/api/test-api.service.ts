import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class TestApiService {

  constructor(
    private readonly http: HttpClient
  ) {
  }

  testCall(): void {
    this.http.get(environment.apiUrl + '/api/hello')
      .subscribe(console.log);
  }
}
