import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { AdventureSummary } from '../../../shared/interfaces/sammery';
import { PlayerCardStateService } from '../../../services/player-card-state.service';
import { InputTextarea } from 'primeng/inputtextarea';

@Component({
  selector: 'app-summary-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ButtonModule,
    InputTextarea, TabViewModule
  ],
  templateUrl: './summary-editor.component.html',
  styleUrls: ['./summary-editor.component.scss']
})
export class SummaryEditorComponent implements OnInit {
  summaryForm: FormGroup;
  initialData: AdventureSummary;

  private fb = inject(FormBuilder);
  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private playerCardStateService = inject(PlayerCardStateService);

  ngOnInit(): void {
    this.initialData = this.config.data.summary;
    this.buildForm();
  }

  private buildForm(): void {
    this.summaryForm = this.fb.group({
      adventureHistory: [this.initialData?.adventureHistory || '', Validators.required],
      keyRelationships: [this.initialData?.keyRelationships || '', Validators.required],
      importantDecisions: [this.initialData?.importantDecisions || '', Validators.required]
    });
  }

  save(): void {
    if (this.summaryForm.invalid) {
      return;
    }
    const updatedSummary = this.summaryForm.getRawValue();
    this.playerCardStateService.updateCampaignSummary(updatedSummary);
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }
}
