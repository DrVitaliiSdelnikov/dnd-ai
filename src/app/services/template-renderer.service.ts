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
    
    console.log('��️ TemplateRenderer:renderItemTemplate item:', item.name, {
      template: item.template,
      effectIds: Array.isArray(effects) ? effects.map(e => e.id) : effects
    });

    // First, replace the item name placeholder
    let processedTemplate = template.replace(/\{\{name\}\}/g, item.name);

    // Then, replace effect placeholders with chips
    const renderedHtml = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      
      const effect = effects.find(e => e.id === effectId.trim());
      if (!effect) {
        console.warn('⚠️ TemplateRenderer: missing effect for placeholder:', effectId, 'in item', item.name);
        return `<span class="missing-effect">[${effectId}]</span>`;
      }
      
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      
      if (definition?.isSystemEffect) {
        return '';
      }

      const output = definition?.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      
      if (!output) {
        console.warn('⚠️ TemplateRenderer: no output for effect:', effectId, effect);
        return '';
      }
      
      // Make dice notation blue
      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class="dice-text">$1</span>');
      const chipHtml = `<span class="effect-chip" data-effect-id="${effect.id}">${styledOutput}</span>`;
      
      return chipHtml;
    });

    return this.sanitizer.bypassSecurityTrustHtml(renderedHtml);
  }

  /**
   * Renders an item template with computed values for chat (no chips, actual rolled values)
   */
  renderTemplateForChat(item: InventoryItem, rollResults: {[effectId: string]: string}): string {
    console.log('💬 renderTemplateForChat called with item:', item.name, 'rollResults:', rollResults);
    
    if (!item.template || !item.properties?.effects) {
      console.log('❌ Missing template or effects for chat, returning item name:', item.name);
      return item.name;
    }

    const template = item.template;
    const effects = item.properties.effects as Effect[];
    
    console.log('📋 Chat template:', template);
    console.log('🎯 Chat effects:', effects);
    
    // First, replace the item name placeholder
    let processedTemplate = template.replace(/\{\{name\}\}/g, item.name);
    console.log('🔄 Chat after name replacement:', processedTemplate);

    // Then, replace effect placeholders with computed values
    const renderedText = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      console.log('🔍 Processing chat placeholder:', match, 'effectId:', effectId);
      
      const effect = effects.find(e => e.id === effectId.trim());
      if (!effect) {
        console.log('❌ Effect not found for chat id:', effectId);
        return `[${effectId}]`;
      }
      
      // Use provided roll result if available
      if (rollResults[effectId]) {
        console.log('🎲 Using roll result for', effectId, ':', rollResults[effectId]);
        return rollResults[effectId];
      }

      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type);
      if (definition?.isSystemEffect) {
        console.log('🔒 System effect in chat, returning empty string');
        return '';
      }

      // For non-rolled effects, use the output template
      const output = definition?.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      console.log('📝 Chat output template result:', output);
      return output || '';
    });

    console.log('💬 Final chat text:', renderedText);
    return renderedText;
  }
} 