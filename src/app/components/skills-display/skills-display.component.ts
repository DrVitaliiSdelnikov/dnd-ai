import { Component, computed, EventEmitter, Output, input, WritableSignal, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RollEvent } from '../../shared/interfaces/dice-roll';
import {
  RollOptionsPanelComponent,
  RollState, RollStateEnum
} from '../../shared/components/roll-options-panel/roll-options-panel.component';
import { ConfirmPopup, ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MessageService } from 'primeng/api';


interface Skill {
  key: string;
  name: string;
  ability: string;
  modifier: number;
  proficient: boolean;
}

@Component({
  selector: 'app-skills-display',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, ConfirmPopup, ConfirmPopupModule, RollOptionsPanelComponent],
  templateUrl: './skills-display.component.html',
  styleUrls: ['./skills-display.component.scss'],
  providers: [
    ConfirmationService,
    MessageService
  ]
})
export class SkillsDisplayComponent {
  skillsData = input<{ [key: string]: { proficient: boolean } } | null>(null);
  private selectedMode: WritableSignal<string> = signal(RollStateEnum.NORMAL);
  abilityModifiers = input<{ [key: string]: number }>({});
  proficiencyBonus = input<number>(0);
  selectedItem: WritableSignal<Skill> = signal(null);
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private messageService: MessageService = inject(MessageService);
  @Output() skillCheck = new EventEmitter<RollEvent>();
  private readonly skillAbilityMap: { [key: string]: string } = {
    acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
    deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
    investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
    performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
    stealth: 'dex', survival: 'wis'
  };
  readonly skills = computed<Skill[]>(() => {
    const skills = this.skillsData();
    const modifiers = this.abilityModifiers();
    const profBonus = this.proficiencyBonus();

    if (!skills || !modifiers) return [];

    return Object.keys(this.skillAbilityMap).map(key => {
      const abilityKey = this.skillAbilityMap[key];
      const abilityMod = modifiers[abilityKey] ?? 0;
      const isProficient = skills[key]?.proficient ?? false;

      const totalBonus = abilityMod + (isProficient ? profBonus : 0);

      return {
        key: key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        ability: abilityKey.toUpperCase(),
        modifier: totalBonus,
        proficient: isProficient
      };
    });
  });


  rollSkillCheck(skill: Skill, rollState: RollState = 'NORMAL'): void {
    let d20Roll: number;
    if (rollState === 'ADVANTAGE') {
      d20Roll = Math.max(this.rollD20(), this.rollD20());
    } else if (rollState === 'DISADVANTAGE') {
      d20Roll = Math.min(this.rollD20(), this.rollD20());
    } else {
      d20Roll = this.rollD20();
    }

    const finalResult = d20Roll + skill.modifier;
    const modifierString = skill.modifier >= 0 ? `+ ${skill.modifier}` : `- ${Math.abs(skill.modifier)}`;
    const resultDescription = `${skill.name} Check: ${finalResult} (Roll: ${d20Roll} ${modifierString})`;

    this.skillCheck.emit({
      type: `SKILL_CHECK_${skill.key.toUpperCase()}`,
      description: resultDescription
    });
    this.confirmationService.close();
  }

  callModeDialog(item: Skill, $event: MouseEvent): void {
    $event.preventDefault();
    this.selectedItem.set(item);
    this.confirmationService.confirm({
      target: $event.target as EventTarget,
      acceptVisible: false,
      rejectVisible: false,
      closable: true
    });
  }

  setRollMode($event: RollState): void {
    this.selectedMode.set($event);
  }

  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  };
}
