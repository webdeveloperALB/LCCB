"use client";

class PriceService {
  private cryptoCache: any = null;
  private exchangeCache: any = null;
  private lastCryptoFetch = 0;
  private lastExchangeFetch = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  async getCryptoPrices() {
    const now = Date.now();

    if (this.cryptoCache && now - this.lastCryptoFetch < this.CACHE_DURATION) {
      return this.cryptoCache;
    }

    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      );

      if (!response.ok) {
        throw new Error(`Crypto fetch failed: ${response.status}`);
      }

      const data = await response.json();
      this.cryptoCache = data;
      this.lastCryptoFetch = now;

      return data;
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      return (
        this.cryptoCache || {
          bitcoin: { usd: 43250, usd_24h_change: 0 },
          ethereum: { usd: 2650, usd_24h_change: 0 },
        }
      );
    }
  }

  async getExchangeRates() {
    const now = Date.now();

    if (
      this.exchangeCache &&
      now - this.lastExchangeFetch < this.CACHE_DURATION
    ) {
      return this.exchangeCache;
    }

    try {
      const response = await fetch(
        "https://api.exchangerate.host/latest?base=USD"
      );

      if (!response.ok) {
        throw new Error(`Fiat rate fetch failed: ${response.status}`);
      }

      const data = await response.json();
      this.exchangeCache = data.rates;
      this.lastExchangeFetch = now;

      return data.rates;
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      return (
        this.exchangeCache || {
          EUR: 0.92,
          CAD: 1.35,
          GBP: 0.78,
        }
      );
    }
  }
}

export const priceService = new PriceService();
