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
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ListboxModule } from 'primeng/listbox';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ElementRef, HostListener, ViewChild, AfterViewInit } from '@angular/core';

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
    CardModule, DividerModule, ChipModule, AccordionModule, MenuModule, TooltipModule,
    ListboxModule, ConfirmPopupModule
  ],
  templateUrl: './effect-editor.component.html',
  styleUrls: ['./effect-editor.component.scss']
})
export class EffectEditorComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() item: ItemWithEffects | SpellWithEffects | null = null;
  @Input() isSpell: boolean = false;
  @Output() itemChanged = new EventEmitter<ItemWithEffects | SpellWithEffects>();
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  private effectDefinitionsService = inject(EffectDefinitionsService);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);
  private confirmationService = inject(ConfirmationService);

  // Component state
  @ViewChild('deleteButton') deleteButton?: ElementRef<HTMLElement>;
  effects: Effect[] = [];
  selectedEffects: Effect[] = [];
  editingEffect: Effect | null = null;
  showAddEffectDialog = false;
  selectedEffectType: EffectType | null = null;
  effectForm: FormGroup = this.fb.group({});
  highlightedCardId: string | null = null;
  
  // Picker (searchable list) state
  showEffectPicker = false;
  effectPickerOptions: Array<{ type: EffectType; label: string; description: string }> = [];
  pickerFilterText = '';
  pickerScrollTop = 0;
  @ViewChild('pickerContainer') pickerContainer?: ElementRef<HTMLElement>;
  @ViewChild('effectListbox') effectListbox?: any;
  
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

  // Drag state
  private dragEffectId: string | null = null;

  ngOnInit(): void {
    this.setupAddEffectMenu();
    // Build flat list of effect options for the picker (no categories)
    const types = this.effectDefinitionsService.getAvailableEffectTypes();
    this.effectPickerOptions = types.map(t => {
      const def = this.effectDefinitionsService.getEffectDefinition(t);
      return { type: t, label: def.name, description: def.description };
    });

    // Normalize level: any negative input maps to -1
    const levelControl = this.itemForm.get('level');
    if (levelControl) {
      levelControl.valueChanges.subscribe((v: any) => {
        if (typeof v === 'number' && v < 0) {
          levelControl.setValue(-1, { emitEvent: false });
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && this.item) {
      this.loadItem();
    }
  }

  ngAfterViewInit(): void {
    // Nothing for now; restoration of picker UI happens when opening it
  }

  private loadItem(): void {
    if (!this.item) return;

    
    // Normalize and sort effects if provided
    const effectsInput = Array.isArray((this.item as any)?.effects) ? (this.item as any).effects : [];
    this.effects = [...effectsInput].sort((a, b) => (a?.order || 0) - (b?.order || 0));
    
    // Initialize editable template string for rendering/preview purposes
    this.editableTemplate = (this.item as any)?.template || '';
    
    this.itemForm.patchValue({
      name: this.item.name,
      description: this.item.description,
      template: this.item.template,
      type: this.item.type,
      quantity: 'quantity' in this.item ? (this.item as any).quantity : 1,
      level: this.isSpell ? (((this.item as any).level ?? 0) < 0 ? -1 : (this.item as any).level ?? 0) : 0,
      isPassive: this.isSpell ? (this.item as any).isPassive ?? false : false,
      castType: this.isSpell ? (this.item as any).castType ?? 'utility' : 'utility'
    });

    this.updatePreview();
  }

  private setupAddEffectMenu(): void {
    const allEffects = this.effectDefinitionsService.getAvailableEffectTypes();

    this.addEffectMenuItems = allEffects.map(type => ({
      label: this.effectDefinitionsService.getEffectDefinition(type).name,
      command: () => this.startAddingEffect(type)
    }));
  }

  // --- Picker flow ---
  openEffectPicker(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showEffectPicker = true;
    // Restore filter text and scroll position after the picker renders
    setTimeout(() => this.restorePickerUIState(), 0);
  }

  closeEffectPicker(): void {
    // Persist current filter and scroll before closing
    const container = this.pickerContainer?.nativeElement;
    if (container) {
      const listWrapper = container.querySelector('.p-listbox-list-wrapper') as HTMLElement | null;
      if (listWrapper) this.pickerScrollTop = listWrapper.scrollTop;
      const inputEl = container.querySelector('input.p-inputtext') as HTMLInputElement | null;
      if (inputEl) this.pickerFilterText = inputEl.value;
    }
    this.showEffectPicker = false;
  }

  private restorePickerUIState(): void {
    const container = this.pickerContainer?.nativeElement;
    if (!container) return;
    const inputEl = container.querySelector('input.p-inputtext') as HTMLInputElement | null;
    if (inputEl && this.pickerFilterText) {
      inputEl.value = this.pickerFilterText;
      const evt = new Event('input', { bubbles: true });
      inputEl.dispatchEvent(evt);
    }
    const listWrapper = container.querySelector('.p-listbox-list-wrapper') as HTMLElement | null;
    if (listWrapper && this.pickerScrollTop > 0) {
      listWrapper.scrollTop = this.pickerScrollTop;
    }
  }

  onPickerInput(event: Event): void {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'INPUT') {
      this.pickerFilterText = (target as HTMLInputElement).value;
    }
  }

  onPickEffect(option: { type: EffectType }): void {
    if (!option) return;
    // Save current UI state before opening dialog
    const container = this.pickerContainer?.nativeElement;
    const listWrapper = container?.querySelector('.p-listbox-list-wrapper') as HTMLElement | null;
    if (listWrapper) this.pickerScrollTop = listWrapper.scrollTop;
    const inputEl = container?.querySelector('input.p-inputtext') as HTMLInputElement | null;
    if (inputEl) this.pickerFilterText = inputEl.value;
    // Start editing selected effect
    this.startAddingEffect(option.type);
  }

  // Close picker on outside click / Esc
  @HostListener('document:click', ['$event'])
  handleDocumentClick(ev: MouseEvent): void {
    if (!this.showEffectPicker) return;
    const container = this.pickerContainer?.nativeElement;
    if (container && !container.contains(ev.target as Node)) {
      this.closeEffectPicker();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.showEffectPicker) this.closeEffectPicker();
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
    
    const base: Effect = {
      id: this.generateEffectId(),
      name: definition.name,
      type: type,
      description: definition.description,
      properties: {},
      isSystemEffect: definition.isSystemEffect,
      order: maxOrder + 1
    };

    // Provide sensible defaults for CHARGES effect
    if (type === 'CHARGES') {
      base.properties = {
        label: 'Charges',
        sharedAcrossStack: true,
        resetCondition: 'long_rest',
        mode: 'fixed',
        max: 1,
        uiMode: 'auto'
      };
    }

    return base;
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
      formControls['perSlotDice'] = [slotScaling.perSlotDice ?? ''];
      formControls['separateRoll'] = [!!slotScaling.separateRoll];

      // Level scaling managed via a serialized JSON string for simplicity
      const levelScaling = (effect.properties && (effect.properties as any).levelScaling);
      const steps = Array.isArray(levelScaling) ? levelScaling : [];
      formControls['levelScalingSteps'] = [JSON.stringify(steps)];
    }

    this.effectForm = this.fb.group(formControls);

    // Additional validation: if DAMAGE has menuToggleEnabled true, require non-empty menuToggleLabel
    if (effect.type === 'DAMAGE') {
      this.effectForm.valueChanges.subscribe(val => {
        const enabled = !!val['menuToggleEnabled'];
        const labelCtrl = this.effectForm.get('menuToggleLabel');
        if (labelCtrl) {
          if (enabled) {
            labelCtrl.setValidators([Validators.required]);
          } else {
            labelCtrl.clearValidators();
          }
          labelCtrl.updateValueAndValidity({ emitEvent: false });
        }
      });
      // Initialize the validator state based on initial value
      const initEnabled = !!this.effectForm.get('menuToggleEnabled')?.value;
      const initLabelCtrl = this.effectForm.get('menuToggleLabel');
      if (initLabelCtrl) {
        if (initEnabled) {
          initLabelCtrl.setValidators([Validators.required]);
        } else {
          initLabelCtrl.clearValidators();
        }
        initLabelCtrl.updateValueAndValidity({ emitEvent: false });
      }
    }
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
      const perSlotDice = formValue['perSlotDice'];
      const separateRoll = !!formValue['separateRoll'];
      const stepsStr = formValue['levelScalingSteps'];
      const stepsParsed = (() => {
        try { return JSON.parse(stepsStr || '[]'); } catch { return []; }
      })();

      if ((perSlotDice && typeof perSlotDice === 'string') || separateRoll) {
        (this.editingEffect.properties as any).slotScaling = { perSlotDice: perSlotDice ? String(perSlotDice) : '', separateRoll };
      } else {
        delete (this.editingEffect.properties as any).slotScaling;
      }

      if (Array.isArray(stepsParsed) && stepsParsed.length) {
        (this.editingEffect.properties as any).levelScaling = stepsParsed;
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
    // Return to effects list after saving
    this.showEffectPicker = false;
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
    // Also remove its placeholder from the editable template to avoid leftover [id] tags
    this.editableTemplate = this.removeEffectPlaceholder(this.editableTemplate, effect.id);
    this.updatePreview();
    this.emitItemChanged();
  }

  closeEffectDialog(): void {
    this.showAddEffectDialog = false;
    this.editingEffect = null;
    this.selectedEffectType = null;
    // If dialog is cancelled/closed, return to list view
    if (this.showEffectPicker) {
      this.showEffectPicker = false;
    }
  }

  onEffectReorder(): void {
    // Update order numbers after reordering; do not rewrite the user template here
    this.effects.forEach((effect, index) => {
      effect.order = index + 1;
    });

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

    
    // First, replace the item name placeholder
    let processedTemplate = template.replace(/\{\{name\}\}/g, itemName);

    // Collect placeholders for debugging
    const placeholders = Array.from(processedTemplate.matchAll(/\{\{([^}]+)\}\}/g)).map(m => m[1].trim());
    
    // Then, replace effect placeholders with chips
    const allowedChipTypes = new Set<EffectType>(['D20_ROLL','PROFICIENCY','ATTACK_STAT','DAMAGE','SAVE_THROW']);
    const newPreviewHtml = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const trimmedId = (effectId as string).trim();
      const effect = this.effects.find(e => e.id === trimmedId);
      if (!effect) {
        
        return `<span class=\"missing-effect\">[${trimmedId}]</span>`;
      }
      
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      if (definition.isSystemEffect) {
        
        return '';
      }

      const output = definition.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      if (!output) {
        
        return '';
      }
      
      // Make dice notation blue
      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class=\"dice-text\">$1</span>');
      if (allowedChipTypes.has(effect.type)) {
        return `<span class=\"effect-chip\" data-effect-id=\"${effect.id}\" draggable=\"true\" contenteditable=\"false\">${styledOutput}</span>`;
      }
      // Non-whitelisted effects render inline text only (no chip)
      return `<span data-effect-id=\"${effect.id}\" contenteditable=\"false\">${styledOutput}</span>`;
    });

    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(newPreviewHtml);
    
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

  onPreviewDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement | null;
    const chip = target?.closest('.effect-chip') as HTMLElement | null;
    if (!chip) return;
    const effectId = chip.getAttribute('data-effect-id');
    if (!effectId) return;
    this.dragEffectId = effectId;
    event.dataTransfer?.setData('text/plain', effectId);
    event.dataTransfer?.setDragImage(chip, chip.offsetWidth / 2, chip.offsetHeight / 2);
  }

  onPreviewDragOver(event: DragEvent): void {
    if (!this.dragEffectId) return;
    event.preventDefault();
  }

  onPreviewDrop(event: DragEvent): void {
    if (!this.dragEffectId) return;
    event.preventDefault();

    const dropPosition = this.computeDropInsertionIndex(event);
    if (dropPosition == null) {
      this.dragEffectId = null;
      return;
    }

    // Move placeholder in the template
    this.editableTemplate = this.movePlaceholderInTemplate(this.editableTemplate, this.dragEffectId, dropPosition);
    this.dragEffectId = null;
    this.updatePreview();
    this.emitItemChanged();
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
        } else {
          // Preserve inline text from other spans
          template += el.textContent || '';
        }
      }
    });
    return template;
  }

  private emitItemChanged(): void {
    if (!this.item) return;

    const formValue = this.itemForm.value;
    // Clamp any negative level to -1
    const normalizedLevel = typeof formValue.level === 'number' && formValue.level < 0 ? -1 : formValue.level;
    const updatedItem = {
      ...this.item,
      id_suggestion: this.item.id_suggestion,
      name: formValue.name,
      description: formValue.description,
      template: this.editableTemplate,
      type: formValue.type,
      effects: this.effects,
      ...(this.isSpell ? {
        level: normalizedLevel,
        isPassive: formValue.isPassive,
        castType: formValue.castType
      } : { quantity: formValue.quantity })
    };

    
    this.itemChanged.emit(updatedItem);
  }

  onSave(): void {
    if (this.itemForm.invalid) return;
    
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

  // Reassign placeholders logic kept for future but not used on reorder anymore
  private remapPlaceholdersToNewOrder(): void {
    const template = this.editableTemplate || this.generateDefaultTemplate();
    if (!template) return;
    // (No-op in step 1; placeholder remapping will not be invoked on reorder.)
  }

  // ---- Drag-and-drop helpers ----
  private computeDropInsertionIndex(event: DragEvent): number | null {
    const container = event.currentTarget as HTMLElement | null;
    if (!container) return null;

    // Build a linear model of nodes (text or chips)
    const parts: Array<{ kind: 'text'; node: Node } | { kind: 'chip'; el: HTMLElement; effectId: string }> = [];
    container.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        parts.push({ kind: 'text', node: n });
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement;
        const id = el.classList.contains('effect-chip') ? el.getAttribute('data-effect-id') : null;
        if (id) parts.push({ kind: 'chip', el, effectId: id });
        else parts.push({ kind: 'text', node: n });
      }
    });

    // Determine index by comparing mouse x against chip midpoints; fallback to end
    const mouseX = event.clientX;
    let insertionIndex = parts.length; // default at end

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.kind === 'chip') {
        const rect = p.el.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        if (mouseX < mid) { insertionIndex = i; break; }
        insertionIndex = i + 1;
      }
    }

    return insertionIndex;
  }

  private movePlaceholderInTemplate(template: string, effectId: string, insertionIndex: number): string {
    // Tokenize template into alternating text and placeholders
    const tokens: Array<{ type: 'text'; value: string } | { type: 'ph'; id: string }> = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = regex.exec(template)) !== null) {
      if (m.index > last) tokens.push({ type: 'text', value: template.slice(last, m.index) });
      tokens.push({ type: 'ph', id: m[1].trim() });
      last = regex.lastIndex;
    }
    if (last < template.length) tokens.push({ type: 'text', value: template.slice(last) });

    // Remove all instances of the placeholder (keep first occurrence index for relative moves if needed)
    const remaining = tokens.filter(t => !(t.type === 'ph' && t.id === effectId));

    // Build positions array of slots between tokens (0..n)
    // insertionIndex corresponds to position among token items, snapping to between tokens
    const clampedIndex = Math.max(0, Math.min(insertionIndex, remaining.length));

    // Insert placeholder token at the clamped index
    remaining.splice(clampedIndex, 0, { type: 'ph', id: effectId });

    // Rebuild template
    return remaining.map(t => (t.type === 'text' ? t.value : `{{${t.id}}}`)).join('');
  }

  confirmRemoveEffect(event: MouseEvent, effect: Effect): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      key: 'effect-delete',
      message: 'Remove this effect?',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.removeEffect(effect)
    });
  }

  onConfirmDeleteClick(event: MouseEvent): void {
    this.openDeleteConfirmation(event.target as EventTarget);
  }

  private openDeleteConfirmation(target?: EventTarget): void {
    const anchor: EventTarget | undefined = target || (this.deleteButton ? (this.deleteButton.nativeElement as unknown as EventTarget) : undefined);
    this.confirmationService.confirm({
      target: anchor,
      key: 'editor-delete',
      message: this.isSpell ? 'Delete this spell?' : 'Delete this item?',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.delete.emit()
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDownDeleteShortcut(event: KeyboardEvent): void {
    if (event.key !== 'Delete') return;
    const targetEl = event.target as HTMLElement | null;
    if (!targetEl) return;
    const tag = targetEl.tagName?.toLowerCase();
    const isTyping = targetEl.isContentEditable || tag === 'input' || tag === 'textarea';
    if (isTyping) return;
    this.openDeleteConfirmation();
  }

  // --- Helpers for placeholder cleanup ---
  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private removeEffectPlaceholder(template: string, effectId: string): string {
    if (!template) return template;
    const idPattern = this.escapeRegExp(effectId);
    const placeholderRegex = new RegExp(`\\{\\{\\s*${idPattern}\\s*\\}}`, 'g');
    let result = template.replace(placeholderRegex, '');
    // Normalize whitespace around punctuation and collapse doubles
    result = result
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
    return result;
  }
} 