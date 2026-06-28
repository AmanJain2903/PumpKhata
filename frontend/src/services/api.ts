const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export interface FuelPump {
  id: number;
  name: string;
  location: string;
  is_active: boolean;
}

export interface Tank {
  id: number;
  pump_id: number;
  product_id: number;
  name: string;
  max_capacity: number;
  actual_dip_volume: number;
  variance: number;
  product_name?: string;
}

export interface Machine {
  id: number;
  pump_id: number;
  name: string;
  number_of_nozzles: number;
  is_active: boolean;
}

export interface Nozzle {
  id: number;
  machine_id: number;
  tank_id: number;
  name: string;
  is_active: boolean;
  tank_name?: string;
  product_name?: string;
  product_price?: number;
}

export interface Product {
  id: number;
  name: string;
  current_price: number;
  current_margin: number;
  pump_ids?: number[];
}

export interface CreditAccount {
  id: number;
  pump_id: number;
  account_name: string;
  current_outstanding_balance: number;
}

export interface CreditTransaction {
  id: number;
  account_id: number;
  log_date: string;
  log_timestamp: string;
  type: 'CHARGE' | 'PAYMENT';
  amount: number;
  notes: string | null;
}

export interface PumpConfigResponse {
  pump: FuelPump;
  tanks: Tank[];
  machines: Machine[];
  nozzles: Nozzle[];
  products: Product[];
  credit_accounts: CreditAccount[];
}

export const apiService = {
  /**
   * List all fuel pumps.
   */
  async getPumps(): Promise<FuelPump[]> {
    const response = await fetch(`${API_BASE_URL}/pumps`);
    if (!response.ok) {
      throw new Error(`Failed to fetch pumps: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Create a new fuel pump.
   */
  async createPump(name: string, location: string): Promise<FuelPump> {
    const response = await fetch(`${API_BASE_URL}/pumps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location, is_active: true }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create pump: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Update properties of an existing pump (e.g. name, location, is_active)
   */
  async updatePump(pumpId: number, data: { name?: string; location?: string; is_active?: boolean }): Promise<FuelPump> {
    const response = await fetch(`${API_BASE_URL}/pumps/${pumpId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update pump: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Delete a fuel pump permanently.
   */
  async deletePump(pumpId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/pumps/${pumpId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete station: ${response.statusText}`);
    }
  },

  /**
   * Fetch nested configurations for a specific pump.
   */
  async getPumpConfig(pumpId: number): Promise<PumpConfigResponse> {
    const response = await fetch(`${API_BASE_URL}/pumps/${pumpId}/config`);
    if (!response.ok) {
      throw new Error(`Failed to fetch pump configuration: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Submit shift log operations.
   */
  async submitShiftLog(pumpId: number, data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/operations/submit/${pumpId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to submit shift log: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Save layout configuration atomically.
   */
  async updatePumpConfig(pumpId: number, data: { tanks: any[]; machines: any[] }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pumps/${pumpId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (Array.isArray(err.detail)) {
        const messages = err.detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join(', ');
        throw new Error(messages);
      }
      throw new Error(err.detail || `Failed to save station configuration: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * List all products.
   */
  async getProducts(): Promise<Product[]> {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Create a new product.
   */
  async createProduct(name: string, price: number, margin: number, pumpIds: number[]): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        current_price: price,
        current_margin: margin,
        pump_ids: pumpIds
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create product: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Create a new tank for a pump.
   */
  async createTank(pumpId: number, productId: number, name: string, maxCapacity: number, actualDipVolume: number): Promise<Tank> {
    const response = await fetch(`${API_BASE_URL}/tanks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pump_id: pumpId,
        product_id: productId,
        name,
        max_capacity: maxCapacity,
        actual_dip_volume: actualDipVolume,
        variance: 0
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create tank: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Create a new machine dispenser unit.
   */
  async createMachine(pumpId: number, name: string, numberOfNozzles: number): Promise<Machine> {
    const response = await fetch(`${API_BASE_URL}/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pump_id: pumpId,
        name,
        number_of_nozzles: numberOfNozzles,
        is_active: true
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create machine: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Create a new nozzle dispenser.
   */
  async createNozzle(machineId: number, tankId: number, name: string): Promise<Nozzle> {
    const response = await fetch(`${API_BASE_URL}/nozzles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: machineId,
        tank_id: tankId,
        name,
        is_active: true
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create nozzle: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Initialize a starting meter reading for a nozzle.
   */
  async initializeNozzleReading(nozzleId: number, openingReading: number, logDate?: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/nozzles/${nozzleId}/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opening_reading: openingReading,
        log_date: logDate || null
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to initialize nozzle: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Update a product's name or pump associations.
   */
  async updateProduct(productId: number, name: string, pumpIds: number[]): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pump_ids: pumpIds }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update product: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Update dynamic selling price & cost margin for a product.
   */
  async updateProductPrice(productId: number, price: number, margin: number): Promise<Product> {
    const response = await fetch(`${API_BASE_URL}/products/${productId}/price`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selling_price: price, cost_margin: margin }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update product price: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Fetch the full pricing history of a product.
   */
  async getProductPriceHistory(productId: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/products/${productId}/price-history`);
    if (!response.ok) {
      throw new Error(`Failed to fetch product price history: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Check if a product is linked to any pump or tank in the database.
   */
  async getProductUsage(productId: number): Promise<{ in_use: boolean; tanks_count: number; pumps_count: number }> {
    const response = await fetch(`${API_BASE_URL}/products/${productId}/usage`);
    if (!response.ok) {
      throw new Error(`Failed to fetch product usage: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Delete a product.
   */
  async deleteProduct(productId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete product: ${response.statusText}`);
    }
  },

  // ==================== Credit Accounts ====================

  /**
   * List all credit accounts, optionally filtered by pump_id.
   */
  async getCreditAccounts(pumpId?: number): Promise<CreditAccount[]> {
    const url = pumpId != null
      ? `${API_BASE_URL}/credit/accounts?pump_id=${pumpId}`
      : `${API_BASE_URL}/credit/accounts`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch credit accounts: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Create a new B2B credit account.
   */
  async createCreditAccount(data: { pump_id: number; account_name: string; current_outstanding_balance: number }): Promise<CreditAccount> {
    const response = await fetch(`${API_BASE_URL}/credit/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create credit account: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Update a credit account (rename).
   */
  async updateCreditAccount(accountId: number, data: { account_name?: string }): Promise<CreditAccount> {
    const response = await fetch(`${API_BASE_URL}/credit/accounts/${accountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update credit account: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Delete a credit account (only if balance is zero).
   */
  async deleteCreditAccount(accountId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/credit/accounts/${accountId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete credit account: ${response.statusText}`);
    }
  },

  /**
   * List transaction history for a credit account.
   */
  async getCreditTransactions(accountId: number): Promise<CreditTransaction[]> {
    const response = await fetch(`${API_BASE_URL}/credit/accounts/${accountId}/transactions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Record a CHARGE or PAYMENT transaction on a credit account.
   */
  async recordCreditTransaction(
    accountId: number,
    data: { account_id: number; log_date: string; log_timestamp: string; type: 'CHARGE' | 'PAYMENT'; amount: number; notes?: string }
  ): Promise<CreditTransaction> {
    const response = await fetch(`${API_BASE_URL}/credit/accounts/${accountId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to record transaction: ${response.statusText}`);
    }
    return await response.json();
  },
};

