import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OrderListModule } from 'primeng/orderlist';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ChipModule } from 'primeng/chip';
import { AccordionModule } from 'primeng/accordion';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { MenuItem } from 'primeng/api';

import { Effect, EffectType, ItemWithEffects, SpellWithEffects } from '../../shared/interfaces/effects.interface';
import { EffectDefinitionsService } from '../../services/effect-definitions.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-effect-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    OrderListModule, ButtonModule, InputTextModule, InputNumberModule,
    DropdownModule, CheckboxModule, TextareaModule, DialogModule,
    CardModule, DividerModule, ChipModule, AccordionModule, MenuModule, TooltipModule
  ],
  templateUrl: './effect-editor.component.html',
  styleUrls: ['./effect-editor.component.scss']
})
export class EffectEditorComponent implements OnInit, OnChanges {
  @Input() item: ItemWithEffects | SpellWithEffects | null = null;
  @Input() isSpell: boolean = false;
  @Output() itemChanged = new EventEmitter<ItemWithEffects | SpellWithEffects>();
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private effectDefinitionsService = inject(EffectDefinitionsService);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  // Component state
  effects: Effect[] = [];
  filterText: string = '';
  editingEffect: Effect | null = null;
  showAddEffectDialog = false;
  selectedEffectType: EffectType | null = null;
  effectForm: FormGroup = this.fb.group({});
  highlightedCardId: string | null = null;
  
  // Form for item/spell basic properties
  itemForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    template: [''],
    type: [''],
    quantity: [1],
    // Spell-only fields
    level: [0],
    isPassive: [false],
    castType: ['utility']
  });

  // Menu options for adding effects
  addEffectMenuItems: MenuItem[] = [];
  
  // Preview
  previewHtml: SafeHtml = '';
  editableTemplate: string = '';

  ngOnInit(): void {
    this.setupAddEffectMenu();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && this.item) {
      this.loadItem();
    }
  }

  private loadItem(): void {
    if (!this.item) return;

    console.log('🎯 EffectEditor: loadItem called with:', this.item);
    console.log('🔍 EffectEditor: item.effects:', this.item.effects);

    this.itemForm.patchValue({
      name: this.item.name,
      description: this.item.description,
      template: this.item.template,
      type: this.item.type,
      quantity: 'quantity' in this.item ? (this.item as any).quantity : 1,
      level: this.isSpell ? (this.item as any).level ?? 0 : 0,
      isPassive: this.isSpell ? (this.item as any).isPassive ?? false : false,
      castType: this.isSpell ? (this.item as any).castType ?? 'utility' : 'utility'
    });

    this.effects = [...this.item.effects].sort((a, b) => a.order - b.order);
    console.log('✅ EffectEditor: effects loaded and sorted:', this.effects);
    
    this.editableTemplate = this.item.template || this.generateDefaultTemplate();
    console.log('📝 EffectEditor: editableTemplate set to:', this.editableTemplate);
    
    this.updatePreview();
  }

  private setupAddEffectMenu(): void {
    const allEffects = this.effectDefinitionsService.getAvailableEffectTypes();

    this.addEffectMenuItems = allEffects.map(type => ({
      label: this.effectDefinitionsService.getEffectDefinition(type).name,
      command: () => this.startAddingEffect(type)
    }));
  }

  startAddingEffect(type: EffectType): void {
    this.selectedEffectType = type;
    this.editingEffect = this.createNewEffect(type);
    this.buildEffectForm(this.editingEffect);
    this.showAddEffectDialog = true;
  }

  editEffect(effect: Effect): void {
    this.editingEffect = { ...effect };
    this.selectedEffectType = effect.type;
    this.buildEffectForm(this.editingEffect);
    this.showAddEffectDialog = true;
  }

  private createNewEffect(type: EffectType): Effect {
    const definition = this.effectDefinitionsService.getEffectDefinition(type);
    const maxOrder = Math.max(...this.effects.map(e => e.order), 0);
    
    return {
      id: this.generateEffectId(),
      name: definition.name,
      type: type,
      description: definition.description,
      properties: {},
      isSystemEffect: definition.isSystemEffect,
      order: maxOrder + 1
    };
  }

  private buildEffectForm(effect: Effect): void {
    const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
    const formControls: any = {
      name: [effect.name, Validators.required]
    };

    definition.fields.forEach(field => {
      const value = effect.properties[field.key] || '';
      const validators = field.required ? [Validators.required] : [];
      formControls[field.key] = [value, validators];
    });

    // Scaling controls for DAMAGE/HEALING
    if (effect.type === 'DAMAGE' || effect.type === 'HEALING') {
      const slotScaling = (effect.properties && (effect.properties as any).slotScaling) || {};
      formControls['slot_baseSlot'] = [slotScaling.baseSlot ?? null];
      formControls['slot_addDicePerSlot'] = [slotScaling.addDicePerSlot ?? ''];

      // Level scaling steps managed via a serialized JSON string for simplicity
      const levelScaling = (effect.properties && (effect.properties as any).levelScaling) || {};
      const steps = Array.isArray(levelScaling.steps) ? levelScaling.steps : [];
      formControls['levelScalingSteps'] = [JSON.stringify(steps)];
    }

    this.effectForm = this.fb.group(formControls);
  }

  saveEffect(): void {
    if (this.effectForm.invalid || !this.editingEffect) return;

    const formValue = this.effectForm.value;
    const definition = this.effectDefinitionsService.getEffectDefinition(this.editingEffect.type);
    
    // Update effect properties
    this.editingEffect.name = formValue.name;
    definition.fields.forEach(field => {
      let val = formValue[field.key];
      // Enforce lowercase for specific keys
      if (this.editingEffect!.type === 'ATTACK_STAT' && field.key === 'attackStat' && typeof val === 'string') {
        val = val.toLowerCase();
      }
      if (this.editingEffect!.type === 'DAMAGE' && field.key === 'damageType' && typeof val === 'string') {
        val = val.toLowerCase();
      }
      if (this.editingEffect!.type === 'SAVE_THROW' && field.key === 'saveAbility' && typeof val === 'string') {
        val = val.toLowerCase();
      }
      this.editingEffect!.properties[field.key] = val;
    });

    // Persist scaling for DAMAGE/HEALING
    if (this.editingEffect.type === 'DAMAGE' || this.editingEffect.type === 'HEALING') {
      const baseSlot = formValue['slot_baseSlot'];
      const addDicePerSlot = formValue['slot_addDicePerSlot'];
      const stepsStr = formValue['levelScalingSteps'];
      const stepsParsed = (() => {
        try { return JSON.parse(stepsStr || '[]'); } catch { return []; }
      })();

      if (baseSlot || addDicePerSlot) {
        (this.editingEffect.properties as any).slotScaling = {
          ...(baseSlot != null ? { baseSlot: Number(baseSlot) } : {}),
          ...(addDicePerSlot ? { addDicePerSlot: String(addDicePerSlot) } : {})
        };
      } else {
        delete (this.editingEffect.properties as any).slotScaling;
      }

      if (Array.isArray(stepsParsed) && stepsParsed.length) {
        (this.editingEffect.properties as any).levelScaling = { steps: stepsParsed };
      } else {
        delete (this.editingEffect.properties as any).levelScaling;
      }
    }

    // Add or update effect in list
    const existingIndex = this.effects.findIndex(e => e.id === this.editingEffect!.id);
    if (existingIndex >= 0) {
      this.effects[existingIndex] = this.editingEffect;
    } else {
      this.effects.push(this.editingEffect);
      const newEffectDefinition = this.effectDefinitionsService.getEffectDefinition(this.editingEffect.type);
      if (!newEffectDefinition.isSystemEffect) {
        this.addEffectToTemplate(this.editingEffect.id);
      }
    }

    this.updatePreview();
    this.closeEffectDialog();
    this.emitItemChanged();
  }

  addEditingEffectToChat(): void {
    if (!this.editingEffect) return;

    const placeholder = `{{${this.editingEffect.id}}}`;
    if (!this.editableTemplate.includes(placeholder)) {
      this.editableTemplate = (this.editableTemplate || '{{name}}') + ` ${placeholder}`;
      this.updatePreview();
      this.emitItemChanged();
    }
  }

  removeEffect(effect: Effect): void {
    this.effects = this.effects.filter(e => e.id !== effect.id);
    this.updatePreview();
    this.emitItemChanged();
  }

  closeEffectDialog(): void {
    this.showAddEffectDialog = false;
    this.editingEffect = null;
    this.selectedEffectType = null;
  }

  onEffectReorder(): void {
    // Update order numbers after reordering
    this.effects.forEach((effect, index) => {
      effect.order = index + 1;
    });

    console.log('🔁 EffectEditor:onEffectReorder new order:', this.effects.map(e => ({ id: e.id, order: e.order })));
    
    // Synchronize template placeholder positions with new order
    this.remapPlaceholdersToNewOrder();
    console.log('🧭 EffectEditor:onEffectReorder remapped template:', this.editableTemplate);
    
    // Update the main effects array
    this.updatePreview();
    this.emitItemChanged();
  }

  onTemplateChange(): void {
    this.updatePreview();
    this.emitItemChanged();
  }

  private updatePreview(): void {
    const template = this.editableTemplate || this.generateDefaultTemplate();
    const itemName = this.itemForm.get('name')?.value || '';

    console.log('🧩 EffectEditor:updatePreview template before:', template);

    // First, replace the item name placeholder
    let processedTemplate = template.replace(/\{\{name\}\}/g, itemName);

    // Collect placeholders for debugging
    const placeholders = Array.from(processedTemplate.matchAll(/\{\{([^}]+)\}\}/g)).map(m => m[1].trim());
    console.log('🔎 EffectEditor:updatePreview placeholders found:', placeholders);

    // Then, replace effect placeholders with chips
    const allowedChipTypes = new Set<EffectType>(['D20_ROLL','PROFICIENCY','ATTACK_STAT','DAMAGE','SAVE_THROW']);
    const newPreviewHtml = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const trimmedId = (effectId as string).trim();
      const effect = this.effects.find(e => e.id === trimmedId);
      if (!effect) {
        console.warn('⚠️ EffectEditor:updatePreview missing effect for placeholder:', trimmedId);
        return `<span class="missing-effect">[${trimmedId}]</span>`;
      }
      
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      if (definition.isSystemEffect) {
        console.log('ℹ️ EffectEditor:updatePreview system effect skipped:', trimmedId, effect.type);
        return '';
      }

      const output = definition.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      if (!output) {
        console.warn('⚠️ EffectEditor:updatePreview no output for effect:', trimmedId, effect.type, effect.properties);
        return '';
      }
      
      // Make dice notation blue
      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class="dice-text">$1</span>');
      if (allowedChipTypes.has(effect.type)) {
        return `<span class="effect-chip" data-effect-id="${effect.id}" contenteditable="false">${styledOutput}</span>`;
      }
      // Non-whitelisted effects render inline text only (no chip)
      return `<span data-effect-id="${effect.id}" contenteditable="false">${styledOutput}</span>`;
    });

    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(newPreviewHtml);
    console.log('🧷 EffectEditor:updatePreview rendered HTML updated');
  }

  private generateDefaultTemplate(): string {
    if (this.isSpell) {
      return `{{name}} ${this.effects.filter(e => !e.isSystemEffect).map(e => `{{${e.id}}}`).join(' and ')}.`;
    } else {
      // For weapons, create a more comprehensive template
      const nonSystemEffects = this.effects.filter(e => !e.isSystemEffect);
      const attackStatEffect = this.effects.find(e => e.type === 'ATTACK_STAT');
      const proficiencyEffect = this.effects.find(e => e.type === 'PROFICIENCY');
      const damageEffect = this.effects.find(e => e.type === 'DAMAGE');
      const magicBonusEffect = this.effects.find(e => e.type === 'MAGIC_BONUS');
      
      let template = '{{name}}';
      
      if (magicBonusEffect) {
        template += ' {{magic_bonus}}';
      }
      
      if (attackStatEffect) {
        template += ' {{attack_stat}}';
      }
      
      if (proficiencyEffect) {
        template += ' ({{proficiency}})';
      }
      
      if (damageEffect) {
        template += ' deals {{damage}}';
      }
      
      // Add any other non-system effects
      const otherEffects = nonSystemEffects.filter(e => 
        e.type !== 'ATTACK_STAT' && e.type !== 'PROFICIENCY' && e.type !== 'DAMAGE' && e.type !== 'MAGIC_BONUS'
      );
      
      if (otherEffects.length > 0) {
        template += ` and ${otherEffects.map(e => `{{${e.id}}}`).join(' and ')}`;
      }
      
      template += '.';
      return template;
    }
  }

  getEffectDefinition(type: EffectType) {
    return this.effectDefinitionsService.getEffectDefinition(type);
  }

  getFilteredEffects(): Effect[] {
    if (!this.filterText) return this.effects;
    
    const filter = this.filterText.toLowerCase();
    return this.effects.filter(effect => 
      effect.name.toLowerCase().includes(filter) ||
      effect.type.toLowerCase().includes(filter)
    );
  }

  getDropdownOptions(field: any): any[] {
    if (!field.options) return [];
    return field.options.map((opt: string) => ({ label: opt, value: opt }));
  }

  private generateEffectId(): string {
    return `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // --- New methods for interactive preview ---

  onPreviewInput(event: Event): void {
    const element = event.target as HTMLElement;
    this.editableTemplate = this.htmlToTemplate(element);
    // Live update while typing can be expensive, so we only update on blur.
    // If live updates are needed, this is where you'd call emitItemChanged().
  }

  onPreviewBlur(event: FocusEvent): void {
    const element = event.target as HTMLElement;
    this.editableTemplate = this.htmlToTemplate(element);
    this.emitItemChanged();
  }

  onPreviewHover(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const chip = target.closest('.effect-chip');
    if (chip) {
      this.highlightedCardId = chip.getAttribute('data-effect-id');
    }
  }

  onPreviewHoverEnd(event: MouseEvent): void {
    this.highlightedCardId = null;
  }

  onPreviewClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const chip = target.closest('.effect-chip');
    if (chip) {
      event.preventDefault();
      const effectId = chip.getAttribute('data-effect-id');
      const effect = this.effects.find(e => e.id === effectId);
      if (effect) {
        this.editEffect(effect);
      }
    }
  }

  private htmlToTemplate(element: HTMLElement): string {
    let template = '';
    element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        template += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains('effect-chip')) {
          const effectId = el.getAttribute('data-effect-id');
          if (effectId) {
            template += `{{${effectId}}}`;
          }
        }
      }
    });
    return template;
  }

  private emitItemChanged(): void {
    if (!this.item) return;

    const formValue = this.itemForm.value;
    const updatedItem = {
      ...this.item,
      id_suggestion: this.item.id_suggestion,
      name: formValue.name,
      description: formValue.description,
      template: this.editableTemplate,
      type: formValue.type,
      effects: this.effects,
      ...(this.isSpell ? {
        level: formValue.level,
        isPassive: formValue.isPassive,
        castType: formValue.castType
      } : { quantity: formValue.quantity })
    };

    console.log('📤 EffectEditor:emitItemChanged emitting item:', {
      name: updatedItem.name,
      template: updatedItem.template,
      effectIds: this.effects.map(e => e.id),
      effects: this.effects
    });

    this.itemChanged.emit(updatedItem);
  }

  onSave(): void {
    if (this.itemForm.invalid) return;
    console.log('💾 EffectEditor:onSave current item about to emit:', {
      name: this.itemForm.value.name,
      template: this.editableTemplate,
      effects: this.effects
    });
    this.emitItemChanged();
    this.save.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  private addEffectToTemplate(effectId: string): void {
    const newPlaceholder = ` {{${effectId}}}`;
    this.editableTemplate += newPlaceholder;
    this.updatePreview();
    this.emitItemChanged();
  }

  // Reassign placeholders in the current template to match the new order of effects
  // Keeps text and the number of placeholder slots intact; only swaps which effect id
  // occupies each slot based on the current sorted this.effects order.
  private remapPlaceholdersToNewOrder(): void {
    const template = this.editableTemplate || this.generateDefaultTemplate();
    if (!template) return;

    // Parse template into parts of text and placeholders
    const parts: Array<{ type: 'text'; value: string } | { type: 'placeholder'; id: string }> = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(template)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: template.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'placeholder', id: match[1].trim() });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < template.length) {
      parts.push({ type: 'text', value: template.slice(lastIndex) });
    }

    // Collect reorderable placeholder ids that exist in the template
    const placeholderIdsInTemplate = parts
      .filter((p): p is { type: 'placeholder'; id: string } => p.type === 'placeholder')
      .map(p => p.id);

    // We only remap placeholders that correspond to existing, non-system effects (not {{name}} etc.)
    const reorderableIds = placeholderIdsInTemplate.filter(id =>
      id !== 'name' && this.effects.some(e => e.id === id && !e.isSystemEffect)
    );
    if (reorderableIds.length === 0) return;

    // Desired order: effects present in template, sorted by current effect.order
    const desiredOrderQueue = this.effects
      .filter(e => !e.isSystemEffect && reorderableIds.includes(e.id))
      .sort((a, b) => a.order - b.order)
      .map(e => e.id);

    // If mismatch, still proceed safely
    if (desiredOrderQueue.length === 0) return;

    // Remap: walk parts and for each reorderable placeholder, swap its id with next from queue
    const remappedParts: Array<{ type: 'text'; value: string } | { type: 'placeholder'; id: string }> = parts.map(part => {
      if (part.type === 'placeholder' && reorderableIds.includes(part.id)) {
        const nextId = desiredOrderQueue.shift();
        return { type: 'placeholder', id: nextId ?? part.id };
      }
      return part;
    });

    // Rebuild template
    this.editableTemplate = remappedParts
      .map(p => (p.type === 'text' ? p.value : `{{${p.id}}}`))
      .join('');

    console.log('🧱 EffectEditor:remapPlaceholdersToNewOrder result:', this.editableTemplate);
  }
} 