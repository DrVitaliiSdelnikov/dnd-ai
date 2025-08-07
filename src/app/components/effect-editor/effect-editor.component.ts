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
    quantity: [1]
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

    this.itemForm.patchValue({
      name: this.item.name,
      description: this.item.description,
      template: this.item.template,
      type: this.item.type,
      quantity: 'quantity' in this.item ? this.item.quantity : 1
    });

    this.effects = [...this.item.effects].sort((a, b) => a.order - b.order);
    this.editableTemplate = this.item.template || this.generateDefaultTemplate();
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

    this.effectForm = this.fb.group(formControls);
  }

  saveEffect(): void {
    if (this.effectForm.invalid || !this.editingEffect) return;

    const formValue = this.effectForm.value;
    const definition = this.effectDefinitionsService.getEffectDefinition(this.editingEffect.type);
    
    // Update effect properties
    this.editingEffect.name = formValue.name;
    definition.fields.forEach(field => {
      this.editingEffect!.properties[field.key] = formValue[field.key];
    });

    // Add or update effect in list
    const existingIndex = this.effects.findIndex(e => e.id === this.editingEffect!.id);
    if (existingIndex >= 0) {
      this.effects[existingIndex] = this.editingEffect;
    } else {
      this.effects.push(this.editingEffect);
    }

    this.updatePreview();
    this.closeEffectDialog();
    this.emitItemChanged();
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
      effect.order = index;
    });
    
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
    
    // Replace effect placeholders with chips
    const newPreviewHtml = template.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const effect = this.effects.find(e => e.id === effectId.trim());
      if (!effect) return `<span class="missing-effect">[${effectId}]</span>`;
      
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      if (definition.isSystemEffect) return ''; // System effects don't appear in preview
      
      const output = definition.outputTemplate(effect.properties);
      if (!output) return '';
      
      // Make dice notation blue
      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class="dice-text">$1</span>');
      return `<span class="effect-chip" data-effect-id="${effect.id}" contenteditable="false">${styledOutput}</span>`;
    });

    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(newPreviewHtml);
  }

  private generateDefaultTemplate(): string {
    if (this.isSpell) {
      return `{{name}} ${this.effects.filter(e => !e.isSystemEffect).map(e => `{{${e.id}}}`).join(' and ')}.`;
    } else {
      return `{{name}} deals {{damage}} damage.`;
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
      name: formValue.name,
      description: formValue.description,
      template: this.editableTemplate,
      type: formValue.type,
      effects: this.effects,
      ...(this.isSpell ? {} : { quantity: formValue.quantity })
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
} 