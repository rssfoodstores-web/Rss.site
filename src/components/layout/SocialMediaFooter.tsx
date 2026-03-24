"use client"

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Github, Globe } from 'lucide-react'
import Link from 'next/link'

// Helper to map platform names to Icons
const getIcon = (platform: string) => {
    const p = platform.toLowerCase()
    if (p.includes('facebook')) return <Facebook className="h-5 w-5" />
    if (p.includes('twitter') || p.includes('x.com')) return <Twitter className="h-5 w-5" />
    if (p.includes('instagram')) return <Instagram className="h-5 w-5" />
    if (p.includes('linkedin')) return <Linkedin className="h-5 w-5" />
    if (p.includes('youtube')) return <Youtube className="h-5 w-5" />
    if (p.includes('github')) return <Github className="h-5 w-5" />
    return <Globe className="h-5 w-5" />
}

interface SocialLink {
    id: number
    platform: string
    url: string
    is_active: boolean
}

export function SocialMediaFooter() {
    const [links, setLinks] = useState<SocialLink[]>([])
    const supabase = createClient()

    useEffect(() => {
        // 1. Initial Fetch
        const fetchLinks = async () => {
            const { data } = await supabase
                .from('social_media_links')
                .select('*')
                .eq('is_active', true)
                .order('id', { ascending: true }) // Order by ID or maybe add a specific order column later if needed

            if (data) setLinks(data)
        }
        fetchLinks()

        // 2. Real-time Subscription
        const channel = supabase
            .channel('public_social_media')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'social_media_links' },
                () => fetchLinks()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    if (links.length === 0) return null

    return (
        <>
            {links.map((link) => (
                <Link
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-[#F58220] transition-colors shadow-sm"
                    aria-label={link.platform}
                >
                    {getIcon(link.platform)}
                </Link>
            ))}
        </>
    )
}
