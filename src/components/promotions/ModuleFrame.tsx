"use client"

import { useEffect, useRef, useState } from 'react'
import type { ModuleDesign } from '@/lib/promotionModule'

function documentSource(design: ModuleDesign, channel: string) {
    const sdk = `(()=>{const channel=${JSON.stringify(channel)};let serial=0;const pending=new Map();function call(method,args){return new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('The request timed out. Try again to recover your saved result.'))},20000);pending.set(id,{resolve,reject,timer});parent.postMessage({rssModule:channel,id,method,args},'*')})}window.addEventListener('message',event=>{if(event.source!==parent||event.data?.rssModule!==channel)return;const item=pending.get(event.data.id);if(!item)return;clearTimeout(item.timer);pending.delete(event.data.id);if(event.data.error)item.reject(new Error(event.data.error));else item.resolve(event.data.result)});window.RSS=Object.freeze({getState:()=>call('getState'),enter:()=>call('enter'),claim:()=>call('claim'),getSummary:()=>call('getSummary'),updateSettings:value=>call('updateSettings',value),fulfill:reference=>call('fulfill',reference),navigate:page=>call('navigate',page)});function resize(){parent.postMessage({rssModule:channel,method:'resize',height:Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)},'*')}addEventListener('load',()=>{new ResizeObserver(resize).observe(document.body);resize()})})();`
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; media-src https:; connect-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'"><style>html,body{margin:0;overflow-wrap:anywhere}*{box-sizing:border-box}img,video{max-width:100%}${design.css.replace(/<\/style/gi,'<\\/style')}</style></head><body>${design.html}<script>${sdk}</script><script>${design.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`
}

export function ModuleFrame({ design, title, onRequest }: {
    design: ModuleDesign; title: string; onRequest: (method: string, args: unknown) => Promise<unknown>
}) {
    const { html, css, js } = design
    const iframe = useRef<HTMLIFrameElement>(null)
    const handler = useRef(onRequest)
    const channel = useRef('')
    const [source, setSource] = useState('')
    const [height, setHeight] = useState(500)
    useEffect(() => { handler.current = onRequest }, [onRequest])
    useEffect(() => {
        let alive = true
        const receive = async (event: MessageEvent) => {
            if (event.source !== iframe.current?.contentWindow || !channel.current || event.data?.rssModule !== channel.current) return
            const data = event.data
            if (data.method === 'resize') {
                if (Number.isFinite(data.height)) setHeight(Math.max(200,Math.min(3000,data.height)))
                return
            }
            if (!Number.isSafeInteger(data.id) || typeof data.method !== 'string') return
            const sender = event.source as Window
            const currentChannel = channel.current
            try {
                const result = await handler.current(data.method,data.args)
                if (alive && currentChannel === channel.current) sender.postMessage({ rssModule: currentChannel,id: data.id,result },'*')
            } catch (error) {
                if (alive && currentChannel === channel.current) sender.postMessage({ rssModule: currentChannel,id: data.id,error: error instanceof Error ? error.message : 'Could not complete this action.' },'*')
            }
        }
        window.addEventListener('message',receive)
        return () => { alive = false; window.removeEventListener('message',receive) }
    }, [])
    useEffect(() => {
        channel.current = crypto.randomUUID()
        const code = documentSource({ html, css, js },channel.current)
        const frame = requestAnimationFrame(() => setSource(code))
        return () => cancelAnimationFrame(frame)
    }, [html,css,js])
    if (!source) return <p className="p-4 text-sm text-muted-foreground">Loading promotion…</p>
    return <iframe ref={iframe} srcDoc={source} title={title} sandbox="allow-scripts" referrerPolicy="no-referrer"
        className="block w-full rounded-xl border bg-white" style={{ height }} />
}
