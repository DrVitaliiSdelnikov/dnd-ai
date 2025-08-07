import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EffectDefinitionsService } from './effect-definitions.service';
import { InventoryItem } from '../shared/interfaces/inventory.interface';
import { Effect } from '../shared/interfaces/effects.interface';

@Injectable({
  providedIn: 'root'
})
export class TemplateRendererService {
  private sanitizer = inject(DomSanitizer);
  private effectDefinitionsService = inject(EffectDefinitionsService);

  /**
   * Renders an item template with effect chips for display
   */
  renderItemTemplate(item: InventoryItem): SafeHtml {
    if (!item.template || !item.properties?.effects) {
      return this.sanitizer.bypassSecurityTrustHtml(item.name);
    }

    const template = item.template;
    const effects = item.properties.effects as Effect[];
    
    // First, replace the item name placeholder
    let processedTemplate = template.replace(/\{\{name\}\}/g, item.name);

    // Then, replace effect placeholders with chips
    const renderedHtml = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const effect = effects.find(e => e.id === effectId.trim());
      if (!effect) return `<span class="missing-effect">[${effectId}]</span>`;
      
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      if (definition.isSystemEffect) return '';

      const output = definition.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      if (!output) return '';
      
      // Make dice notation blue
      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class="dice-text">$1</span>');
      return `<span class="effect-chip" data-effect-id="${effect.id}">${styledOutput}</span>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(renderedHtml);
  }

  /**
   * Renders an item template with computed values for chat (no chips, actual rolled values)
   */
  renderTemplateForChat(item: InventoryItem, rollResults: {[effectId: string]: string}): string {
    if (!item.template || !item.properties?.effects) {
      return item.name;
    }

    const template = item.template;
    const effects = item.properties.effects as Effect[];
    
    // First, replace the item name placeholder
    let processedTemplate = template.replace(/\{\{name\}\}/g, item.name);

    // Then, replace effect placeholders with computed values
    const renderedText = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const effect = effects.find(e => e.id === effectId.trim());
      if (!effect) return `[${effectId}]`;
      
      // Use provided roll result if available
      if (rollResults[effectId]) {
        return rollResults[effectId];
      }

      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      if (definition.isSystemEffect) return '';

      // For non-rolled effects, use the output template
      const output = definition.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      return output || '';
    });

    return renderedText;
  }
} 