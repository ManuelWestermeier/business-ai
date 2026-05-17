export async function onRequest(context) {
    const { request } = context

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    let body
    try {
        body = await request.json()
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
    }

    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || '',
            'Accept': 'text/event-stream', // wichtig
        },
        body: JSON.stringify(body),
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

    // Header vom Upstream übernehmen
    const headers = new Headers(upstream.headers)
    headers.set('Cache-Control', 'no-cache')

    return new Response(upstream.body, {
        status: upstream.status,
        headers,
    })
}