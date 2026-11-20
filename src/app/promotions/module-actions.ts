"use server"

import { createClient } from '@/lib/supabase/server'
import type { ModuleState } from '@/lib/promotionModule'

export async function eventTicketAction(campaignId: string, issue: boolean) {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(campaignId) || typeof issue !== 'boolean') throw new Error('Choose a valid promotion.')
    const supabase=await createClient()
    const {data,error}=await supabase.rpc('promotion_event_ticket_state',{p_campaign:campaignId,p_issue:issue})
    if(error)throw new Error(error.code==='42501'?'Sign in with your email or Google account.':error.message)
    return data
}

export async function customerModuleAction(campaignId: string, method: string): Promise<ModuleState> {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(campaignId)) throw new Error('This promotion is unavailable.')
    const methods = { getState: 'promotion_module_state', enter: 'enter_promotion_module', claim: 'claim_promotion_prize' } as const
    if (!Object.hasOwn(methods,method)) throw new Error('This action is unavailable.')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(methods[method as keyof typeof methods],{ p_campaign: campaignId })
    if (error) throw new Error(error.code === '42501' ? 'Sign in to participate.' : error.message)
    return data as ModuleState
}
