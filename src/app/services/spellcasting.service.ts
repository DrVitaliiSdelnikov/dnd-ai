import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpellcastingService {
  /**
   * Returns the maximum spell slot level available for a Wizard at the given character level (5e-like).
   * 1→1, 2→1, 3→2, 4→2, 5→3, 6→3, 7→4, 8→4, 9→5, 10→5,
   * 11→6, 12→6, 13→7, 14→7, 15→8, 16→8, 17→9, 18→9, 19→9, 20→9
   */
  getMaxSlotLevelForWizardLevel(level: number): number {
    if (!Number.isFinite(level) || level < 1) return 0;
    if (level < 3) return 1;
    if (level < 5) return 2;
    if (level < 7) return 3;
    if (level < 9) return 4;
    if (level < 11) return 5;
    if (level < 13) return 6;
    if (level < 15) return 7;
    if (level < 17) return 8;
    return 9;
  }

  /** Returns array [1..maxSlotLevel] or [] if none available */
  getAvailableSlots(level: number): number[] {
    const max = this.getMaxSlotLevelForWizardLevel(level);
    if (max <= 0) return [];
    return Array.from({ length: max }, (_, i) => i + 1);
    
  }

  /** Proficiency bonus by level (matches existing logic) */
  getProficiencyBonus(level: number): number {
    if (!Number.isFinite(level) || level < 1) return 2;
    return Math.ceil(level / 4) + 1;
  }

  /** Standard DnD ability modifier */
  getAbilityModifier(score: number): number {
    if (!Number.isFinite(score)) return 0;
    return Math.floor((score - 10) / 2);
  }
} 