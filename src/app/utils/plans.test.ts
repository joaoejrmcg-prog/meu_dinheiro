import { describe, it, expect } from 'vitest';
import { getPlanDisplayName, plansData, PLAN_LIGHT, PLAN_PRO, PLAN_VIP, PLAN_TRIAL, PLAN_LIGHT_PRICE, PLAN_PRO_PRICE } from './plans';

describe('Plans Utility', () => {
    it('should return correct display name for known plans', () => {
        expect(getPlanDisplayName(PLAN_LIGHT)).toBe('Plano Light');
        expect(getPlanDisplayName(PLAN_PRO)).toBe('Plano Pro');
        expect(getPlanDisplayName(PLAN_VIP)).toBe('Plano VIP');
        expect(getPlanDisplayName(PLAN_TRIAL)).toBe('Período de Testes');
    });

    it('should capitalize unknown plans', () => {
        expect(getPlanDisplayName('custom')).toBe('Custom');
    });

    it('should have correct pricing data', () => {
        const lightPlan = plansData.find(p => p.id === PLAN_LIGHT);
        expect(lightPlan).toBeDefined();
        expect(lightPlan?.value).toBe(PLAN_LIGHT_PRICE);

        const proPlan = plansData.find(p => p.id === PLAN_PRO);
        expect(proPlan).toBeDefined();
        expect(proPlan?.value).toBe(PLAN_PRO_PRICE);
    });
});
