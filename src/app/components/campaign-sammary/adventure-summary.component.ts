import {
  Component,
  computed,
  EventEmitter, inject,
  input,
  OnInit,
  Output,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { AdventureSummary } from '../../shared/interfaces/sammery';
import { PlayerCardStateService } from '../../services/player-card-state.service';
import { DialogService } from 'primeng/dynamicdialog';
import { SummaryEditorComponent } from './summary-editor/summary-editor.component';

@Component({
  selector: 'app-adventure-summary',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TabsModule,
    ButtonModule
  ],
  providers: [
    DialogService
  ],
  templateUrl: './adventure-summary.component.html',
  styleUrls: ['./adventure-summary.component.scss']
})
export class AdventureSummaryComponent implements OnInit {
  private dialogService = inject(DialogService);
  playerCardStateService: PlayerCardStateService = inject(PlayerCardStateService);
  readonly summaryData: Signal<AdventureSummary | null> = this.playerCardStateService.campaignSummary$;
  @Output() summaryChange = new EventEmitter<AdventureSummary>();
  summaryForm: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.buildForm();

    computed(() => {
      const data = this.summaryData();
      if (data) {
        this.summaryForm.patchValue(data, { emitEvent: false });
      }
    });
  }

  private buildForm(): void {
    this.summaryForm = this.fb.group({
      general: [this.summaryData()?.adventureHistory || 'No summary yet.', Validators.required],
      characters: [this.summaryData()?.keyRelationships || 'No character interactions recorded.', Validators.required],
      notes: [this.summaryData()?.importantDecisions || 'No additional notes.', Validators.required]
    });
    this.summaryForm.disable();
  }

  openEditModal(): void {
    const ref = this.dialogService.open(SummaryEditorComponent, {
      header: 'Edit Adventure Summary',
      width: '70vw',
      maximizable: true,
      data: {
        summary: this.summaryData()
      }
    });

    ref.onClose.subscribe((wasSaved: boolean) => {
      // no-op
    });
  }
}
