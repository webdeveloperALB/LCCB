export interface ExchangeRates {
  fiat: { [key: string]: number };
  crypto: { [key: string]: number };
  lastUpdated: number;
}

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private rates: ExchangeRates = {
    fiat: { USD: 1 },
    crypto: {},
    lastUpdated: 0,
  };
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: ((rates: ExchangeRates) => void)[] = [];

  static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  async initialize() {
    await this.updateRates();
    this.startAutoUpdate();
  }

  private async updateRates() {
    try {
      console.log("Fetching exchange rates from public APIs...");

      // Initialize rates object
      const rates: ExchangeRates = {
        fiat: { USD: 1 },
        crypto: {},
        lastUpdated: Date.now(),
      };

      // Fetch fiat exchange rates from exchangerate-api.com (free, no API key required)
      try {
        console.log("Fetching fiat exchange rates...");
        const fiatResponse = await fetch(
          "https://api.exchangerate-api.com/v4/latest/USD",
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (fiatResponse.ok) {
          const fiatData = await fiatResponse.json();

          if (fiatData.rates) {
            rates.fiat = {
              USD: 1,
              EUR: fiatData.rates.EUR,
              CAD: fiatData.rates.CAD,
              GBP: fiatData.rates.GBP,
              JPY: fiatData.rates.JPY,
              AUD: fiatData.rates.AUD,
              CHF: fiatData.rates.CHF,
            };

            console.log("Fiat rates fetched successfully");
          }
        } else {
          throw new Error(`Fiat API error: ${fiatResponse.status}`);
        }
      } catch (fiatError: any) {
        console.warn(
          "Failed to fetch fiat rates, using fallback:",
          fiatError.message
        );
        // Keep default USD: 1 as fallback
        rates.fiat = {
          USD: 1,
          EUR: 0.85,
          CAD: 1.35,
          GBP: 0.75,
          JPY: 110,
          AUD: 1.45,
          CHF: 0.92,
        };
      }

      // Fetch crypto prices from CoinGecko (free, no API key required)
      try {
        console.log("Fetching crypto prices...");
        const cryptoResponse = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,cardano,polkadot,chainlink&vs_currencies=usd",
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (cryptoResponse.ok) {
          const cryptoData = await cryptoResponse.json();

          rates.crypto = {
            BTC: cryptoData.bitcoin?.usd || 45000,
            ETH: cryptoData.ethereum?.usd || 2500,
            USDT: cryptoData.tether?.usd || 1,
            ADA: cryptoData.cardano?.usd || 0.5,
            DOT: cryptoData.polkadot?.usd || 7,
            LINK: cryptoData.chainlink?.usd || 15,
          };
          console.log("Crypto rates fetched successfully");
        } else {
          throw new Error(`Crypto API error: ${cryptoResponse.status}`);
        }
      } catch (cryptoError: any) {
        console.warn(
          "Failed to fetch crypto rates, using fallback:",
          cryptoError.message
        );
        // Use fallback crypto rates if API fails
        rates.crypto = {
          BTC: 45000,
          ETH: 2500,
          USDT: 1,
          ADA: 0.5,
          DOT: 7,
          LINK: 15,
        };
      }

      this.rates = rates;
      this.listeners.forEach((listener) => listener(this.rates));
      console.log(
        "Exchange rates updated successfully at",
        new Date().toLocaleTimeString()
      );
    } catch (error: any) {
      console.error("Failed to fetch exchange rates:", error.message || error);

      // Use complete fallback rates if everything fails
      this.rates = {
        fiat: {
          USD: 1,
          EUR: 0.85,
          CAD: 1.35,
          GBP: 0.75,
          JPY: 110,
          AUD: 1.45,
          CHF: 0.92,
        },
        crypto: {
          BTC: 45000,
          ETH: 2500,
          USDT: 1,
          ADA: 0.5,
          DOT: 7,
          LINK: 15,
        },
        lastUpdated: Date.now(),
      };

      this.listeners.forEach((listener) => listener(this.rates));
      console.log("Using complete fallback exchange rates");
    }
  }

  private startAutoUpdate() {
    // Update every 5 minutes
    this.updateInterval = setInterval(() => {
      this.updateRates();
    }, 300000);
  }

  subscribe(listener: (rates: ExchangeRates) => void) {
    this.listeners.push(listener);
    if (this.rates.lastUpdated > 0) {
      listener(this.rates);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getRates(): ExchangeRates {
    return this.rates;
  }

  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): number {
    if (fromCurrency === toCurrency) return amount;

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    let usdValue = amount;

    if (from !== "USD") {
      if (this.rates.fiat[from]) {
        usdValue = amount / this.rates.fiat[from];
      } else if (this.rates.crypto[from]) {
        usdValue = amount * this.rates.crypto[from];
      }
    }

    if (to === "USD") {
      return usdValue;
    } else if (this.rates.fiat[to]) {
      return usdValue * this.rates.fiat[to];
    } else if (this.rates.crypto[to]) {
      return usdValue / this.rates.crypto[to];
    }

    return amount; // fallback
  }

  getExchangeRate(fromCurrency: string, toCurrency: string): number {
    return this.convertCurrency(1, fromCurrency, toCurrency);
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.listeners = [];
  }
}
