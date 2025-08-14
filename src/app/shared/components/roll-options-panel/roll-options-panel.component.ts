import { Component, OnInit, Output, EventEmitter, inject, DestroyRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ButtonModule } from 'primeng/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter } from 'rxjs';
import { tap } from 'rxjs/operators';

export type RollState = 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE';
export enum RollStateEnum {
  NORMAL = 'NORMAL',
  ADVANTAGE = 'ADVANTAGE',
  DISADVANTAGE = 'DISADVANTAGE',
}

@Component({
  selector: 'app-roll-options-panel',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, RadioButtonModule, ButtonModule ],
  templateUrl: './roll-options-panel.component.html',
  styleUrls: ['./roll-options-panel.component.scss']
})
export class RollOptionsPanelComponent implements OnInit {
  @Output() rollEmit = new EventEmitter<RollState>();
  private destroyRef = inject(DestroyRef);
  rollForm: FormGroup;
  @Input() includeNormal: boolean = true;
  rollOptions = [
    { value: RollStateEnum.ADVANTAGE, text: 'Advantage' },
    { value: RollStateEnum.NORMAL, text: 'Normal' },
    { value: RollStateEnum.DISADVANTAGE, text: 'Disadvantage' }
  ];

  ngOnInit(): void {
    // Build options based on includeNormal input
    const options = [
      { value: RollStateEnum.ADVANTAGE, text: 'Advantage' }
    ];
    if (this.includeNormal) {
      options.push({ value: RollStateEnum.NORMAL, text: 'Normal' });
    }
    options.push({ value: RollStateEnum.DISADVANTAGE, text: 'Disadvantage' });
    this.rollOptions = options;

    this.rollForm = new FormGroup({
      rollState: new FormControl(RollStateEnum.NORMAL)
    });
    this.watchValueChange();
  }

  private watchValueChange(): void {
    this.rollForm.valueChanges
      .pipe(
        filter(item => !!item),
        distinctUntilChanged(),
        tap(({rollState}) => {
          this.rollEmit.emit(rollState)
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe()
  }
}
