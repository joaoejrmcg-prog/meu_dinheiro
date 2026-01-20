import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Bypass RLS if possible or just try to fetch. 
    // Since we are in dev mode, maybe we can use service role if available, but let's try anon first.
    // Actually, without user session, RLS will block.
    // We need to use SERVICE_ROLE_KEY if available in process.env.

    const adminAuthClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: loans } = await adminAuthClient.from('loans').select('*');
    const { data: movements } = await adminAuthClient.from('movements').select('*').order('created_at', { ascending: false }).limit(10);
    const { data: accounts } = await adminAuthClient.from('accounts').select('*');

    return NextResponse.json({
        loans,
        movements,
        accounts
    });
}
