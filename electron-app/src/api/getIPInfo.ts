export async function getIPInfo(ip: string): Promise<any> {
    const apiUrl = `https://ipinfo.io/${ip}`;
    try {
        const response = await fetch(apiUrl, {
            headers: {
            'User-Agent': 'curl/7.68.0'
            }
        });
        if (!response.ok) {
            throw new Error(`Error fetching IP info: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch IP info:', error);
        throw error;
    }
}