import { Component, OnInit } from '@angular/core';
import { TestApiService } from '../api/test-api.service';

@Component({
  template: `TEST`,
  selector: 'hello-component',
  standalone: true
})
export class HelloComponent implements OnInit {

  constructor(
    private readonly testApi: TestApiService
  ) {

  }

  ngOnInit() {
    this.testApi.testCall();
  }
}
