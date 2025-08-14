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
import { SkillEditorComponent } from './skill-editor/skill-editor.component';
import { DialogService } from 'primeng/dynamicdialog';
import { PlayerCardStateService } from '../../services/player-card-state.service';

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
    MessageService,
    DialogService
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
  private dialogService = inject(DialogService);
  private playerCardStateService = inject(PlayerCardStateService);
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

  openEditSkillModal(event: MouseEvent, skill: Skill): void {
    event.stopPropagation();

    const ref = this.dialogService.open(SkillEditorComponent, {
      header: `Edit Skill: ${skill.name}`,
      width: '350px',
      data: {
        skill: {
          key: skill.key,
          name: skill.name,
          proficient: skill.proficient
        }
      }
    });

    ref.onClose.subscribe((wasSaved: boolean) => {
      // no-op
    });
  }

  rollSkillCheck(skill: Skill, rollState: RollState = 'NORMAL'): void {
    const halflingLuckyStacks = this.getPassiveHalflingLuckyStacks();

    let usedAnnotation = '';
    let d20Roll: number;

    if (rollState === 'ADVANTAGE' || rollState === 'DISADVANTAGE') {
      // Roll two dice and apply Halfling Lucky to each die independently before choosing
      const first = this.rollD20();
      const second = this.rollD20();
      const adjFirst = this.applyHalflingLuckyToDie(first, halflingLuckyStacks);
      const adjSecond = this.applyHalflingLuckyToDie(second, halflingLuckyStacks);

      const rollsDisplay: string[] = [];
      rollsDisplay.push(this.formatLuckyDieDisplay(first, adjFirst));
      rollsDisplay.push(this.formatLuckyDieDisplay(second, adjSecond));

      const used = rollState === 'ADVANTAGE'
        ? Math.max(adjFirst.value, adjSecond.value)
        : Math.min(adjFirst.value, adjSecond.value);

      const totalTriggers = (adjFirst.triggers || 0) + (adjSecond.triggers || 0);
      usedAnnotation = totalTriggers > 0 ? ` (Halfling Lucky x${totalTriggers})` : '';

      d20Roll = used;

      const prefix = rollState === 'ADVANTAGE' ? 'Rolls' : 'Rolls';
      // We embed the rolls detail into the final message below
      const rollsString = `${prefix}: [${rollsDisplay.join(', ')}] -> Used ${d20Roll}${usedAnnotation}`;

      const finalResult = d20Roll + skill.modifier;
      const modifierString = skill.modifier >= 0 ? `+ ${skill.modifier}` : `- ${Math.abs(skill.modifier)}`;
      const resultDescription = `${skill.name} Check: ${finalResult} (${rollsString} ${modifierString})`;

      this.skillCheck.emit({
        type: `SKILL_CHECK_${skill.key.toUpperCase()}`,
        description: resultDescription
      });
      this.confirmationService.close();
      return;
    }

    // NORMAL mode: single die
    const initial = this.rollD20();
    const adjusted = this.applyHalflingLuckyToDie(initial, halflingLuckyStacks);
    d20Roll = adjusted.value;
    usedAnnotation = adjusted.triggers > 0 ? ` (Halfling Lucky x${adjusted.triggers})` : '';

    const finalResult = d20Roll + skill.modifier;
    const modifierString = skill.modifier >= 0 ? `+ ${skill.modifier}` : `- ${Math.abs(skill.modifier)}`;
    const resultDescription = `${skill.name} Check: ${finalResult} (Roll: ${this.formatLuckyDieDisplay(initial, adjusted)}${usedAnnotation} ${modifierString})`;

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

  private getPassiveHalflingLuckyStacks(): number {
    const card = this.playerCardStateService.playerCard$();
    const spells = Array.isArray(card?.spells) ? card!.spells : [];
    let stacks = 0;
    for (const s of spells) {
      if (s?.isPassive && Array.isArray(s.effects)) {
        stacks += s.effects.filter(e => e?.type === 'HALFLING_LUCKY').length;
      }
    }
    return stacks;
  }

  private applyHalflingLuckyToDie(initial: number, stacks: number): { value: number, triggers: number } {
    if (stacks <= 0) return { value: initial, triggers: 0 };
    let current = initial;
    let triggers = 0;
    let remaining = stacks;
    while (remaining > 0 && current === 1) {
      current = this.rollD20();
      triggers += 1;
      remaining -= 1;
      // Must use the new result even if 1; loop will continue if remaining > 0 and still 1
    }
    return { value: current, triggers };
  }

  private formatLuckyDieDisplay(original: number, adjusted: { value: number, triggers: number }): string {
    if (!adjusted || adjusted.triggers <= 0) {
      return String(original);
    }
    // Show a simple original→new form; if multiple triggers, only show final
    if (original === adjusted.value) {
      return String(original);
    }
    return `${original}\u2192${adjusted.value}`; // arrow →
  }
}
