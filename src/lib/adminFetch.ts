/**
 * Helper for making authenticated admin API calls.
 * Automatically includes the x-admin-address header.
 */
export function adminFetch(url: string, options: RequestInit = {}, adminAddress: string): Promise<Response> {
    const headers = new Headers(options.headers || {});
    headers.set('x-admin-address', adminAddress);
    
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...options,
        headers,
    });
}
