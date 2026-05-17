export async function onRequest(context) {
    const { request, env } = context

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    let body
    try {
        body = await request.json()
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
    }

    const controller = new AbortController()

    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.NVIDIA_API_KEY}`, // in Cloudflare env setzen
        },
        body: JSON.stringify(body),
        signal: controller.signal,
    })

    if (!upstream.ok) {
        let msg = `HTTP ${upstream.status}`
        try {
            const err = await upstream.json()
            msg = err?.error?.message || msg
        } catch { }
        return new Response(JSON.stringify({ error: msg }), {
            status: upstream.status,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Streaming direkt durchreichen
    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}