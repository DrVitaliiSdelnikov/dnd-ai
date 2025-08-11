import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EffectDefinitionsService } from './effect-definitions.service';
import { InventoryItem } from '../shared/interfaces/inventory.interface';
import { Spell } from '../shared/interfaces/spell.interface';
import { Effect } from '../shared/interfaces/effects.interface';

const allowedChipTypes = new Set<string>(['D20_ROLL','PROFICIENCY','ATTACK_STAT','DAMAGE','SAVE_THROW']);

@Injectable({
  providedIn: 'root'
})
export class TemplateRendererService {
  private sanitizer = inject(DomSanitizer);
  private effectDefinitionsService = inject(EffectDefinitionsService);

  renderItemTemplate(item: InventoryItem): SafeHtml {
    if (!item?.template || !item?.properties?.effects) {
      return this.sanitizer.bypassSecurityTrustHtml(item?.name || '');
    }

    const template = item.template;
    const effects = item.properties.effects as Effect[];

    let processedTemplate = template.replace(/\{\{name\}\}/g, item.name);

    const renderedHtml = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const effect = effects.find(e => e.id === String(effectId).trim());
      if (!effect) {
        console.warn('TemplateRenderer:item missing effect for', effectId, 'in', item.name);
        return `<span class="missing-effect">[${effectId}]</span>`;
      }

      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type as any);
      if (definition?.isSystemEffect) return '';

      const output = definition?.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      if (!output) return '';

      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class="dice-text">$1<\/span>');
      if (allowedChipTypes.has(effect.type)) {
        return `<span class="effect-chip" data-effect-id="${effect.id}">${styledOutput}</span>`;
      }
      return `<span data-effect-id="${effect.id}">${styledOutput}</span>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(renderedHtml);
  }

  renderSpellTemplate(spell: Spell): SafeHtml {
    if (!spell?.template || !Array.isArray(spell?.effects)) {
      return this.sanitizer.bypassSecurityTrustHtml(spell?.name || '');
    }

    const template = spell.template;
    const effects = spell.effects as Effect[];

    let processedTemplate = template.replace(/\{\{name\}\}/g, spell.name);

    const renderedHtml = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const effect = effects.find(e => e.id === String(effectId).trim());
      if (!effect) {
        console.warn('TemplateRenderer:spell missing effect for', effectId, 'in', spell.name);
        return `<span class="missing-effect">[${effectId}]</span>`;
      }

      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type as any);
      if (definition?.isSystemEffect) return '';

      const output = definition?.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      if (!output) return '';

      const styledOutput = output.replace(/(\d+d\d+(?:[+\-]\d+)?)/g, '<span class="dice-text">$1<\/span>');
      if (allowedChipTypes.has(effect.type)) {
        return `<span class="effect-chip" data-effect-id="${effect.id}">${styledOutput}</span>`;
      }
      return `<span data-effect-id="${effect.id}">${styledOutput}</span>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(renderedHtml);
  }

  // Plain text rendering (no chips) for chat output
  renderSpellText(spell: Spell): string {
    if (!spell?.template || !Array.isArray(spell?.effects)) {
      return spell?.name || '';
    }
    const template = spell.template;
    const effects = spell.effects as Effect[];

    const processedTemplate = template.replace(/\{\{name\}\}/g, spell.name);
    const text = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const effect = effects.find(e => e.id === String(effectId).trim());
      if (!effect) return '';
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type as any);
      if (definition?.isSystemEffect) return '';
      const output = definition?.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      return output || '';
    });
    // Strip any residual HTML tags from outputTemplate
    return text.replace(/<[^>]*>/g, '');
  }

  // Back-compat for inventory chat rendering: replace placeholders with provided roll results
  renderTemplateForChat(item: InventoryItem, rollResults: { [effectId: string]: string }): string {
    if (!item?.template || !Array.isArray(item?.properties?.effects)) {
      return item?.name || '';
    }
    const template = item.template;
    const effects = item.properties.effects as Effect[];

    const processedTemplate = template.replace(/\{\{name\}\}/g, item.name);
    const text = processedTemplate.replace(/\{\{([^}]+)\}\}/g, (match, effectId) => {
      const trimmed = String(effectId).trim();
      const effect = effects.find(e => e.id === trimmed);
      if (!effect) return '';
      const definition = this.effectDefinitionsService.getEffectDefinition(effect.type as any);
      if (definition?.isSystemEffect) return '';
      if (rollResults && typeof rollResults[trimmed] === 'string') {
        return rollResults[trimmed];
      }
      const output = definition?.outputTemplate ? definition.outputTemplate(effect.properties) : '';
      return output || '';
    });
    return text.replace(/<[^>]*>/g, '');
  }
} 