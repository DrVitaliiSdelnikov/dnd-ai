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

export interface RollExtraToggle {
  id: string;
  label: string;
  checked: boolean;
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
  @Output() toggleChanged = new EventEmitter<{ id: string; checked: boolean }>();
  private destroyRef = inject(DestroyRef);
  rollForm: FormGroup;
  @Input() includeNormal: boolean = true;
  // New: effect-provided toggles
  @Input() toggles: RollExtraToggle[] = [];
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

  onToggleClick(t: RollExtraToggle): void {
    const newState = !t.checked;
    t.checked = newState;
    this.toggleChanged.emit({ id: t.id, checked: newState });
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
