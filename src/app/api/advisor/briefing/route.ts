import { NextResponse } from 'next/server';
import { generateWeeklyBriefing } from '../../../actions/advisor';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        // 1. Check if it's a manual request from logged user
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value; },
                    set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
                    remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }); },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        // 2. If user is logged in, generate only for them (Manual Test)
        if (user) {
            const result = await generateWeeklyBriefing(user.id);
            if (result.success) {
                return NextResponse.json({ message: 'Briefing generated successfully (Manual)' });
            } else {
                return NextResponse.json({ error: 'Failed to generate briefing', details: result.error }, { status: 500 });
            }
        }

        // 3. If no user logged in, check if it's a Cron Job (or just allow public trigger for now with Admin)
        // In production, you should check for `request.headers.get('Authorization')` or `CRON_SECRET`

        // Initialize Admin Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch all users from profiles table
        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('id');

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
        }

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ message: 'No users found to generate briefing' });
        }

        // Generate for all users
        const results = await Promise.all(profiles.map(async (profile: any) => {
            return await generateWeeklyBriefing(profile.id);
        }));

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        return NextResponse.json({
            message: `Briefing generation complete. Success: ${successCount}, Failed: ${failCount}`,
            details: results
        });

    } catch (error) {
        console.error('Error in briefing route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
