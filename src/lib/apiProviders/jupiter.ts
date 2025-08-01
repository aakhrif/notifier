import axios from "axios";

export async function fetchJupiterPrices(tokenIds: string[]): Promise<string | undefined> {
    let ids;
    if (Array.isArray(tokenIds)) {
        ids = tokenIds.join(", ");
    } else {
        ids = tokenIds;
    }
    const url = `https://lite-api.jup.ag/price/v3?ids=${ids}`
    try {
        const response = await axios.get(url, {
            headers: { 'Accept': 'application/json' }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching Jupiter prices: ", error);
    }
}
