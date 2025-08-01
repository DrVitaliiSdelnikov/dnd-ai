import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { cloneDeep } from 'lodash';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { PlayerCardStateService } from '../../../services/player-card-state.service';


interface SkillEditData {
  key: string;
  name: string;
  proficient: boolean;
}

@Component({
  selector: 'app-skill-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, CheckboxModule],
  templateUrl: './skill-editor.component.html',
  styleUrls: ['./skill-editor.component.scss']
})
export class SkillEditorComponent implements OnInit {
  skillForm: FormGroup;
  skillData: SkillEditData;

  public dialogRef = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);
  private playerCardStateService = inject(PlayerCardStateService);

  ngOnInit(): void {
    this.skillData = this.config.data.skill;
    this.buildForm();
  }

  private buildForm(): void {
    this.skillForm = new FormGroup({
      proficient: new FormControl(this.skillData.proficient)
    });
  }

  save(): void {
    const currentCard = this.playerCardStateService.playerCard$();
    if (!currentCard) {
      console.error("Cannot save skill, player card is not available.");
      return;
    }

    const newProficientValue = this.skillForm.get('proficient').value;
    const updatedPlayerCard = cloneDeep(currentCard);

    if (updatedPlayerCard.skills && updatedPlayerCard.skills[this.skillData.key]) {
      updatedPlayerCard.skills[this.skillData.key].proficient = newProficientValue;
    } else {
      if (!updatedPlayerCard.skills) updatedPlayerCard.skills = {};
      updatedPlayerCard.skills[this.skillData.key] = { proficient: newProficientValue };
    }

    this.playerCardStateService.updatePlayerCard(updatedPlayerCard);
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close();
  }
}
