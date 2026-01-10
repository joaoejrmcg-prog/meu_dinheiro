import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processReferralRewardAdmin } from './referral-service';

// Mock Supabase Client
const mockSupabase = {
    from: vi.fn(),
};

describe('Referral Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should grant reward if user has referrer and no previous reward', async () => {
        const userId = 'user_123';
        const referrerId = 'referrer_456';

        const fromMock = vi.fn((table) => {
            const queryBuilder: any = {};

            // Default chainable methods
            queryBuilder.select = vi.fn().mockReturnThis();
            queryBuilder.eq = vi.fn().mockReturnThis();
            queryBuilder.single = vi.fn();
            queryBuilder.update = vi.fn().mockReturnThis();
            queryBuilder.insert = vi.fn().mockReturnThis();

            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { referred_by: referrerId }, error: null });
            }
            if (table === 'referral_rewards') {
                // For select (check existing), return null (not found)
                queryBuilder.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
                // For insert, return success
                queryBuilder.insert.mockResolvedValue({ error: null });
            }
            if (table === 'subscriptions') {
                // For select (get current period), return date
                queryBuilder.single.mockResolvedValue({ data: { current_period_end: new Date().toISOString() }, error: null });

                // For update, we need to support .eq() after .update()
                // We make update return the builder itself, which has .eq()
                // And .eq() needs to be awaitable (return a promise-like result)
                // So we mock .eq to return a promise that resolves to { error: null }
                // BUT, .eq is also used in select chains.
                // So .eq needs to be context aware or just return a "thenable" builder.

                // Let's make the builder itself thenable.
                queryBuilder.then = (resolve: any) => resolve({ error: null });
            }

            return queryBuilder;
        });

        mockSupabase.from = fromMock;

        const result = await processReferralRewardAdmin(mockSupabase as any, userId);

        expect(result.success).toBe(true);
        expect(result.granted).toBe(true);
        expect(fromMock).toHaveBeenCalledWith('referral_rewards');
    });

    it('should NOT grant reward if user has no referrer', async () => {
        const userId = 'user_no_ref';

        const fromMock = vi.fn((table) => {
            const queryBuilder: any = {};
            queryBuilder.select = vi.fn().mockReturnThis();
            queryBuilder.eq = vi.fn().mockReturnThis();
            queryBuilder.single = vi.fn();

            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { referred_by: null }, error: null });
            }
            return queryBuilder;
        });
        mockSupabase.from = fromMock;

        const result = await processReferralRewardAdmin(mockSupabase as any, userId);

        expect(result.success).toBe(true);
        expect(result.granted).toBe(false);
        expect(result.reason).toBe('no_referrer');
    });

    it('should NOT grant reward if reward already exists', async () => {
        const userId = 'user_existing';
        const referrerId = 'referrer_existing';

        const fromMock = vi.fn((table) => {
            const queryBuilder: any = {};
            queryBuilder.select = vi.fn().mockReturnThis();
            queryBuilder.eq = vi.fn().mockReturnThis();
            queryBuilder.single = vi.fn();

            if (table === 'profiles') {
                queryBuilder.single.mockResolvedValue({ data: { referred_by: referrerId }, error: null });
            }
            if (table === 'referral_rewards') {
                // Return existing reward
                queryBuilder.single.mockResolvedValue({ data: { id: 'reward_123' }, error: null });
            }
            return queryBuilder;
        });
        mockSupabase.from = fromMock;

        const result = await processReferralRewardAdmin(mockSupabase as any, userId);

        expect(result.success).toBe(true);
        expect(result.granted).toBe(false);
        expect(result.reason).toBe('already_granted');
    });
});
