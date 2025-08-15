import { Injectable } from '@angular/core';

export type Unlimited = 'unlimited';

export interface ChargesComputationInput {
	level: number;
	abilityModifiers: { [key: string]: number };
	proficiencyBonus: number;
}

@Injectable({ providedIn: 'root' })
export class ChargesService {
	computeMax(props: any, input: ChargesComputationInput): number | Unlimited {
		if (!props) return 0;
		const mode = String(props.mode || 'fixed');
		switch (mode) {
			case 'fixed': {
				const max = Number(props.max || 0);
				return Math.max(0, Math.floor(max));
			}
			case 'linear': {
				const baseAtLevel1 = this.toInt(props.baseAtLevel1, 0);
				const perLevel = this.toInt(props.perLevel, 0);
				const levelsGained = Math.max(0, Math.floor((input.level || 1) - 1));
				let result = baseAtLevel1 + perLevel * levelsGained;
				result = Math.max(0, result);
				const cap = this.toIntNullable(props.cap);
				if (cap != null) result = Math.min(result, cap);
				return result;
			}
			case 'multiplier': {
				const mult = this.toInt(props.multiplier, 0);
				let result = mult * Math.max(0, Math.floor(input.level || 1));
				const cap = this.toIntNullable(props.cap);
				if (cap != null) result = Math.min(result, cap);
				return Math.max(0, result);
			}
			case 'table': {
				const steps = this.parseSteps(props.steps);
				if (!steps.length) return 0;
				let current: number | Unlimited = 0;
				for (const s of steps) {
					if (!Number.isFinite(s.level)) continue;
					if ((input.level || 1) >= s.level) {
						current = (s.max === 'unlimited') ? 'unlimited' : Math.max(0, this.toInt(s.max, 0));
					}
				}
				return current;
			}
			case 'ability_mod': {
				const ability = String(props.ability || '').toLowerCase();
				const mod = Number.isFinite(input.abilityModifiers?.[ability]) ? input.abilityModifiers[ability] : 0;
				const min = this.toInt(props.min, 1);
				const cap = this.toIntNullable(props.cap);
				let result = Math.max(min, mod);
				if (cap != null) result = Math.min(result, cap);
				return Math.max(0, result);
			}
			case 'proficiency': {
				const mul = Number.isFinite(props.profMultiplier) ? Number(props.profMultiplier) : 1;
				const bonus = this.toInt(props.profBonus, 0);
				return Math.max(0, Math.floor(mul * (input.proficiencyBonus || 0) + bonus));
			}
			default:
				return 0;
		}
	}

	private toInt(value: any, fallback: number): number {
		const n = Number(value);
		return Number.isFinite(n) ? Math.floor(n) : fallback;
	}

	private toIntNullable(value: any): number | null {
		const n = Number(value);
		return Number.isFinite(n) ? Math.floor(n) : null;
	}

	private parseSteps(input: any): Array<{ level: number; max: number | Unlimited }> {
		if (Array.isArray(input)) return input as any;
		if (typeof input === 'string') {
			try {
				const parsed = JSON.parse(input);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return [];
	}
} 