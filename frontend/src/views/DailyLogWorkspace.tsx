import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { Tank, Nozzle, CreditAccount, CreditTransaction } from '../services/api';
import { SmartDropdown } from '../components/SmartDropdown';

interface DailyLogWorkspaceProps {
  pumpId: number;
  onBack: () => void;
}

interface LocalNozzleLog {
  nozzle_id: number;
  nozzle_name: string;
  machine_name: string;
  product_name: string;
  original_opening: number;
  closing_reading: string;
  product_price: string;
  is_reset: boolean;
  has_price_change: boolean;
  old_price: string;
  old_price_closing: string;
}

interface LocalTankLog {
  tank_id: number;
  tank_name: string;
  product_name: string;
  opening_dip: number;
  testing_liters: string;
  fuel_received: string;
  actual_dip_volume: string;
  calculated_variance: number;
}

const PAYMENT_METHODS = [
  'Paytm 1',
  'Paytm 2',
  'Paytm 3',
  'ICICI',
  'XTRA Power',
  'XTRA Reward',
  'Miscellaneous'
];

export const DailyLogWorkspace: React.FC<DailyLogWorkspaceProps> = ({ pumpId, onBack }) => {
  // Session & Config state
  const [session, setSession] = useState<any>(null);
  const [nozzlesList, setNozzlesList] = useState<Nozzle[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [creditCharges, setCreditCharges] = useState<CreditTransaction[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditTransaction[]>([]);
  const [yesterdayPaytm1, setYesterdayPaytm1] = useState(0);
  const [yesterdayPaytm2, setYesterdayPaytm2] = useState(0);
  const [pumpAccounts, setPumpAccounts] = useState<any[]>([]);
  const [cashDeposits, setCashDeposits] = useState<{ [accountId: number]: string }>({});

  // Loading / Error states
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active section toggles (Step 1 is Nozzle Readings)
  const [openSection, setOpenSection] = useState<number>(1);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (openSection) {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      const timer = setTimeout(() => {
        const element = document.getElementById(`log-section-${openSection}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [openSection]);

  // Form states per section
  // 1. Nozzle readings (Simple 1 entry per nozzle format)
  const [nozzleLogs, setNozzleLogs] = useState<LocalNozzleLog[]>([]);
  const [nozzleError, setNozzleError] = useState('');
  const [nozzleSuccess, setNozzleSuccess] = useState('');
  const [nozzleSaving, setNozzleSaving] = useState(false);

  // 2. Tank readings
  const [tankLogs, setTankLogs] = useState<LocalTankLog[]>([]);
  const [tankError, setTankError] = useState('');
  const [tankSuccess, setTankSuccess] = useState('');
  const [tankSaving, setTankSaving] = useState(false);

  // 3. Credit charges
  const [chargeAccountId, setChargeAccountId] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNotes, setChargeNotes] = useState('');
  const [chargeSaving, setChargeSaving] = useState(false);
  const [chargeError, setChargeError] = useState('');
  // Inline account creation fields
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('0');

  // 4. Credit payments
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ACCOUNT_TRANSFER'>('CASH');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // 5. Other Items income (renamed from Misc)
  const [miscCash, setMiscCash] = useState('0');
  const [miscNotes, setMiscNotes] = useState('');
  const [miscSaving, setMiscSaving] = useState(false);
  const [miscError, setMiscError] = useState('');
  const [miscSuccess, setMiscSuccess] = useState('');

  // Prior Period Adjustments
  const [priorPeriodAdjustment, setPriorPeriodAdjustment] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  // 6. Close session collections
  const [fuelCollections, setFuelCollections] = useState<{ payment_method: string; amount: string }[]>(
    PAYMENT_METHODS.map(m => ({ payment_method: m, amount: '' }))
  );
  const [closeSaving, setCloseSaving] = useState(false);
  const [closeError, setCloseError] = useState('');

  // Helper to compute today's date in IST timezone
  const getISTDateString = () => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (5.5 * 3600000));

    const yyyy = istTime.getFullYear();
    const mm = String(istTime.getMonth() + 1).padStart(2, '0');
    const dd = String(istTime.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Load Session and Pump configuration
  useEffect(() => {
    loadData();
  }, [pumpId]);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const dateStr = getISTDateString();

      // 1. Fetch pump config layout (tanks, machines, nozzles, accounts)
      const config = await apiService.getPumpConfig(pumpId);

      const extractNumber = (str: string): number => {
        const match = str.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };

      const sortedNozzles = [...config.nozzles.filter((nz: Nozzle) => nz.is_active !== false)].sort((a, b) => {
        const machA = config.machines?.find((m: any) => m.id === a.machine_id);
        const machB = config.machines?.find((m: any) => m.id === b.machine_id);
        const machANum = extractNumber(machA ? machA.name : '');
        const machBNum = extractNumber(machB ? machB.name : '');
        if (machANum !== machBNum) {
          return machANum - machBNum;
        }
        const nozzleANum = extractNumber(a.name);
        const nozzleBNum = extractNumber(b.name);
        return nozzleANum - nozzleBNum;
      });

      const activeNozzles = sortedNozzles;
      setNozzlesList(activeNozzles);
      setCreditAccounts(config.credit_accounts);
      setPumpAccounts(config.pump_accounts || []);
      setYesterdayPaytm1(config.yesterday_paytm1 || 0);
      setYesterdayPaytm2(config.yesterday_paytm2 || 0);

      // 2. Fetch or create today's session in IST date
      const activeSession = await apiService.getOrCreateSession(pumpId, dateStr);
      setSession(activeSession);

      if (activeSession.account_transactions) {
        const depositsMap: { [accountId: number]: string } = {};
        activeSession.account_transactions.forEach((tx: any) => {
          if (tx.description === "Cash deposited from station cash balance") {
            depositsMap[tx.account_id] = String(tx.amount);
          }
        });
        setCashDeposits(depositsMap);
      } else {
        setCashDeposits({});
      }

      // 3. Fetch prefill readings to get correct opening bounds
      const prefill = await apiService.prefillShiftLog(pumpId);

      // Prefill Section 1: Nozzle Readings
      const activeNozzleLogs = activeSession.nozzle_logs || [];
      const initNozzleLogs: LocalNozzleLog[] = activeNozzles.map((nz: Nozzle) => {
        // Find ALL matching logs for this nozzle (could be 2 entries on price change day)
        const matchingLogs = activeNozzleLogs
          .filter((l: any) => l.nozzle_id === nz.id)
          .sort((a: any, b: any) => a.entry_index - b.entry_index);
        const matchingLog = matchingLogs.length > 0 ? matchingLogs[matchingLogs.length - 1] : null;
        const oldPriceLog = matchingLogs.length > 1 ? matchingLogs[0] : null;

        const prefillNz = prefill.nozzles.find((n: any) => n.nozzle_id === nz.id);
        const baseOpening = prefillNz ? parseFloat(prefillNz.opening_reading as any) : 0;

        const machine = config.machines?.find((m: any) => m.id === nz.machine_id);
        const machineName = machine ? machine.name : 'Dispenser';

        const hasPriceChange = prefillNz?.has_price_change || false;
        const oldPrice = prefillNz?.old_price ? String(prefillNz.old_price) : '';

        return {
          nozzle_id: nz.id,
          nozzle_name: nz.name,
          machine_name: machineName,
          product_name: nz.product_name || 'Fuel',
          original_opening: baseOpening,
          closing_reading: matchingLog ? String(matchingLog.closing_reading) : '',
          // Always read price from the main product configuration
          product_price: String(prefillNz?.product_price || nz.product_price || 0),
          is_reset: matchingLog ? matchingLog.is_reset : false,
          has_price_change: hasPriceChange,
          old_price: oldPrice,
          old_price_closing: oldPriceLog ? String(oldPriceLog.closing_reading) : ''
        };
      });
      setNozzleLogs(initNozzleLogs);

      // Prefill Section 2: Tank Dip Readings
      const activeTankLogs = activeSession.tank_logs || [];
      const initTankLogs: LocalTankLog[] = config.tanks.map((tk: Tank) => {
        const matchingLog = activeTankLogs.find((l: any) => l.tank_id === tk.id);
        const prefillTk = prefill.tanks.find((t: any) => t.tank_id === tk.id);
        const baseOpening = prefillTk ? parseFloat(prefillTk.opening_dip_volume as any) : parseFloat(tk.actual_dip_volume as any || 0);

        return {
          tank_id: tk.id,
          tank_name: tk.name,
          product_name: tk.product_name || 'Fuel',
          opening_dip: baseOpening,
          testing_liters: matchingLog ? String(matchingLog.testing_liters) : '0',
          fuel_received: matchingLog ? String(matchingLog.fuel_received) : '0',
          actual_dip_volume: matchingLog ? String(matchingLog.actual_dip_volume) : '',
          calculated_variance: matchingLog ? parseFloat(matchingLog.calculated_variance as any) : 0
        };
      });
      setTankLogs(initTankLogs);

      // Prefill Section 3 & 4: Transactions
      const txns = activeSession.credit_transactions || [];
      setCreditCharges(txns.filter((t: any) => t.type === 'CHARGE'));
      setCreditPayments(txns.filter((t: any) => t.type === 'PAYMENT'));

      // Prefill Section 5: Other Items
      setMiscCash(String(activeSession.misc_cash || '0'));
      setMiscNotes(activeSession.misc_notes || '');
      setPriorPeriodAdjustment(activeSession.prior_period_adjustment ? String(activeSession.prior_period_adjustment) : '');
      setAdjustmentNotes(activeSession.adjustment_notes || '');

      // Prefill Section 6: Fuel Close collections
      const sessionPayments = activeSession.collections || [];
      const initCollections = PAYMENT_METHODS.map(method => {
        const matchingPay = sessionPayments.find((p: any) => p.payment_method === method);
        return {
          payment_method: method,
          amount: matchingPay ? String(matchingPay.amount) : ''
        };
      });
      setFuelCollections(initCollections);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize daily operation workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to calculate total nozzle dispensed liters per nozzle row
  const getNozzleDispensedOld = (log: LocalNozzleLog): number => {
    if (!log.has_price_change) return 0;
    const oldClosing = parseFloat(log.old_price_closing);
    if (isNaN(oldClosing)) return 0;
    if (log.is_reset) return oldClosing;
    if (oldClosing < log.original_opening) return 0;
    return oldClosing - log.original_opening;
  };

  const getNozzleDispensedNew = (log: LocalNozzleLog): number => {
    if (!log.has_price_change) return 0;
    const oldClosing = parseFloat(log.old_price_closing);
    const newClosing = parseFloat(log.closing_reading);
    if (isNaN(oldClosing) || isNaN(newClosing)) return 0;
    if (newClosing < oldClosing) return 0;
    return newClosing - oldClosing;
  };

  const getNozzleDispensed = (log: LocalNozzleLog): number => {
    if (log.has_price_change) {
      return getNozzleDispensedOld(log) + getNozzleDispensedNew(log);
    }
    const closing = parseFloat(log.closing_reading);
    if (isNaN(closing)) return 0;

    if (log.is_reset) {
      return closing;
    }
    if (closing < log.original_opening) {
      return 0;
    }
    return closing - log.original_opening;
  };

  // Live expected revenue preview
  // Live expected revenue preview
  const getLiveExpectedRevenue = (): number => {
    let totalExpected = 0;

    const uniqueTankIds = Array.from(new Set(nozzlesList.map(n => n.tank_id)));

    for (const tankId of uniqueTankIds) {
      if (!tankId) continue;
      let tankRevenue = 0;

      const tankNozzles = nozzlesList.filter(n => n.tank_id === tankId);
      const tankNozzleIds = new Set(tankNozzles.map(n => n.id));

      for (const nLog of nozzleLogs) {
        if (!tankNozzleIds.has(nLog.nozzle_id)) continue;

        if (nLog.has_price_change) {
          const oldPrice = parseFloat(nLog.old_price);
          const newPrice = parseFloat(nLog.product_price);
          if (!isNaN(oldPrice)) {
            tankRevenue += getNozzleDispensedOld(nLog) * oldPrice;
          }
          if (!isNaN(newPrice)) {
            tankRevenue += getNozzleDispensedNew(nLog) * newPrice;
          }
        } else {
          const closing = parseFloat(nLog.closing_reading);
          const price = parseFloat(nLog.product_price);
          if (!isNaN(closing) && !isNaN(price)) {
            let dispensed = 0;
            if (nLog.is_reset) {
              dispensed = closing;
            } else if (closing >= nLog.original_opening) {
              dispensed = closing - nLog.original_opening;
            }
            tankRevenue += dispensed * price;
          }
        }
      }

      const tLog = tankLogs.find(t => t.tank_id === tankId);
      if (tLog) {
        const testing = parseFloat(tLog.testing_liters);
        if (!isNaN(testing) && testing > 0) {
          const productPrice = tankNozzles.length > 0 ? parseFloat(tankNozzles[0].product_price as any || 0) : 0;
          tankRevenue -= testing * productPrice;
        }
      }

      totalExpected += Math.round(tankRevenue);
    }

    return totalExpected;
  };

  // Handlers for Section 1: Nozzle Readings
  const handleNozzleChange = (nozzleIdx: number, field: string, value: any) => {
    setNozzleLogs(prev => {
      const updated = [...prev];
      updated[nozzleIdx] = {
        ...updated[nozzleIdx],
        [field]: value
      };
      return updated;
    });
  };

  const handleSaveNozzleReadings = async () => {
    setNozzleError('');
    setNozzleSuccess('');
    setNozzleSaving(true);
    try {
      const payload = nozzleLogs.map((log) => {
        const price = parseFloat(log.product_price);
        if (isNaN(price) || price < 0) {
          throw new Error(`Invalid price for Nozzle: ${log.nozzle_name}`);
        }

        if (log.has_price_change) {
          // Split reading: old price closing + new price closing
          const oldClosing = parseFloat(log.old_price_closing);
          const newClosing = parseFloat(log.closing_reading);
          const oldPrice = parseFloat(log.old_price);

          if (isNaN(oldClosing) || oldClosing < 0) {
            throw new Error(`Invalid old-price closing reading for Nozzle: ${log.nozzle_name}`);
          }
          if (isNaN(newClosing) || newClosing < 0) {
            throw new Error(`Invalid new-price closing reading for Nozzle: ${log.nozzle_name}`);
          }
          if (oldClosing < log.original_opening && !log.is_reset) {
            throw new Error(`Old-price closing reading cannot be lower than opening (${log.original_opening}) for Nozzle ${log.nozzle_name} unless Reset is toggled.`);
          }
          if (newClosing < oldClosing) {
            throw new Error(`New-price closing reading (${newClosing}) cannot be lower than old-price closing (${oldClosing}) for Nozzle ${log.nozzle_name}.`);
          }
          if (isNaN(oldPrice) || oldPrice < 0) {
            throw new Error(`Invalid old price for Nozzle: ${log.nozzle_name}`);
          }

          return {
            nozzle_id: log.nozzle_id,
            entries: [
              {
                closing_reading: oldClosing,
                product_price: oldPrice,
                is_reset: log.is_reset
              },
              {
                closing_reading: newClosing,
                product_price: price,
                is_reset: false
              }
            ]
          };
        } else {
          // Normal single reading
          const closing = parseFloat(log.closing_reading);
          if (isNaN(closing) || closing < 0) {
            throw new Error(`Invalid closing reading for Nozzle: ${log.nozzle_name}`);
          }
          if (closing < log.original_opening && !log.is_reset) {
            throw new Error(`Closing reading cannot be lower than opening reading (${log.original_opening}) for Nozzle ${log.nozzle_name} unless Reset is toggled.`);
          }
          return {
            nozzle_id: log.nozzle_id,
            entries: [
              {
                closing_reading: closing,
                product_price: price,
                is_reset: log.is_reset
              }
            ]
          };
        }
      });

      await apiService.saveNozzleReadings(session.id, payload);
      setNozzleSuccess('Nozzle readings saved successfully!');

      const updatedSession = await apiService.getOrCreateSession(pumpId);
      setSession(updatedSession);

      setTimeout(() => setOpenSection(2), 600);
    } catch (err: any) {
      setNozzleError(err.message || 'Failed to save nozzle readings.');
    } finally {
      setNozzleSaving(false);
    }
  };

  // Handlers for Section 2: Tank Dip Readings
  const handleTankChange = (tankIdx: number, field: string, value: any) => {
    setTankLogs(prev => {
      const updated = [...prev];
      updated[tankIdx] = { ...updated[tankIdx], [field]: value };

      const opening = updated[tankIdx].opening_dip;
      const received = parseFloat(updated[tankIdx].fuel_received) || 0;
      const actual = parseFloat(updated[tankIdx].actual_dip_volume) || 0;
      const testing = parseFloat(updated[tankIdx].testing_liters) || 0;

      const matchingNozzles = nozzlesList.filter(n => n.tank_id === updated[tankIdx].tank_id);
      let grossDispensed = 0;
      for (const nozzle of matchingNozzles) {
        const nozzleLog = nozzleLogs.find(nl => nl.nozzle_id === nozzle.id);
        if (nozzleLog) {
          grossDispensed += getNozzleDispensed(nozzleLog);
        }
      }

      const bookStock = opening + received - grossDispensed + testing;
      updated[tankIdx].calculated_variance = actual - bookStock;

      return updated;
    });
  };

  const handleSaveTankReadings = async () => {
    setTankError('');
    setTankSuccess('');
    setTankSaving(true);
    try {
      const payload = tankLogs.map((log) => {
        const actual = parseFloat(log.actual_dip_volume);
        if (isNaN(actual) || actual < 0) {
          throw new Error(`Invalid actual dip volume for Tank: ${log.tank_name}`);
        }
        const testing = parseFloat(log.testing_liters) || 0;
        if (testing < 0) {
          throw new Error(`Testing liters cannot be negative for Tank: ${log.tank_name}`);
        }
        const received = parseFloat(log.fuel_received) || 0;
        if (received < 0) {
          throw new Error(`Fuel received cannot be negative for Tank: ${log.tank_name}`);
        }
        return {
          tank_id: log.tank_id,
          testing_liters: testing,
          fuel_received: received,
          actual_dip_volume: actual
        };
      });

      await apiService.saveTankReadings(session.id, payload);
      setTankSuccess('Tank dip readings saved successfully!');

      const updatedSession = await apiService.getOrCreateSession(pumpId);
      setSession(updatedSession);

      setTimeout(() => setOpenSection(3), 600);
    } catch (err: any) {
      setTankError(err.message || 'Failed to save tank readings.');
    } finally {
      setTankSaving(false);
    }
  };

  // Handlers for Section 3: Credit Sales (Charges)
  const handleAddCreditCharge = async () => {
    setChargeError('');
    if (!chargeAccountId) { setChargeError('Please select a credit account.'); return; }
    const amt = parseFloat(chargeAmount);
    if (isNaN(amt) || amt <= 0) { setChargeError('Please enter a positive sale amount.'); return; }

    setChargeSaving(true);
    try {
      const newTx = await apiService.addCreditCharge(session.id, parseInt(chargeAccountId), amt, chargeNotes.trim() || undefined);
      setCreditCharges(prev => [newTx, ...prev]);

      setChargeAmount('');
      setChargeNotes('');
      setChargeAccountId('');

      const config = await apiService.getPumpConfig(pumpId);
      setCreditAccounts(config.credit_accounts);
    } catch (err: any) {
      setChargeError(err.message || 'Failed to record credit sale.');
    } finally {
      setChargeSaving(false);
    }
  };

  const handleDeleteCreditCharge = async (txId: number) => {
    setChargeError('');
    try {
      await apiService.deleteCreditCharge(session.id, txId);
      setCreditCharges(prev => prev.filter(t => t.id !== txId));

      const config = await apiService.getPumpConfig(pumpId);
      setCreditAccounts(config.credit_accounts);
    } catch (err: any) {
      setChargeError(err.message || 'Failed to delete credit sale.');
    }
  };

  const handleCreateNewAccountInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargeError('');
    if (!newAccountName.trim()) { setChargeError('Account name cannot be empty.'); return; }
    const startingBal = parseFloat(newAccountBalance) || 0;

    try {
      const newAcc = await apiService.createCreditAccount({
        pump_id: pumpId,
        account_name: newAccountName.trim(),
        current_outstanding_balance: startingBal
      });
      setCreditAccounts(prev => [...prev, newAcc]);
      setChargeAccountId(String(newAcc.id));

      setNewAccountName('');
      setNewAccountBalance('0');
      setShowNewAccountForm(false);
    } catch (err: any) {
      setChargeError(err.message || 'Failed to create new account.');
    }
  };

  // Handlers for Section 4: Credit Payments
  const handleAddCreditPayment = async () => {
    setPaymentError('');
    if (!paymentAccountId) { setPaymentError('Please select a credit account.'); return; }
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) { setPaymentError('Please enter a positive payment amount.'); return; }

    setPaymentSaving(true);
    try {
      const newTx = await apiService.addCreditPayment(session.id, parseInt(paymentAccountId), amt, paymentMethod, paymentNotes.trim() || undefined);
      setCreditPayments(prev => [newTx, ...prev]);

      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentMethod('CASH');
      setPaymentAccountId('');

      const config = await apiService.getPumpConfig(pumpId);
      setCreditAccounts(config.credit_accounts);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record credit payment.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDeleteCreditPayment = async (txId: number) => {
    setPaymentError('');
    try {
      await apiService.deleteCreditPayment(session.id, txId);
      setCreditPayments(prev => prev.filter(t => t.id !== txId));

      const config = await apiService.getPumpConfig(pumpId);
      setCreditAccounts(config.credit_accounts);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to delete payment transaction.');
    }
  };

  // Handlers for Section 5: Other Items Income
  const handleSaveMiscIncome = async () => {
    setMiscError('');
    setMiscSuccess('');
    const cash = parseFloat(miscCash) || 0;
    if (cash < 0) {
      setMiscError('Other items income cash cannot be negative.');
      return;
    }

    setMiscSaving(true);
    try {
      await apiService.saveMiscIncome(session.id, cash, miscNotes.trim() || undefined);
      setMiscSuccess('Other items income saved successfully!');

      const updatedSession = await apiService.getOrCreateSession(pumpId);
      setSession(updatedSession);

      setTimeout(() => setOpenSection(6), 600);
    } catch (err: any) {
      setMiscError(err.message || 'Failed to save other items income.');
    } finally {
      setMiscSaving(false);
    }
  };

  // Handlers for Section 6: Financial Close
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloseError('');

    // Prepare collections payload
    const collectionsPayload = [];
    for (const col of fuelCollections) {
      const trimmed = (col.amount || '').trim();
      const amt = trimmed === '' ? 0 : parseFloat(trimmed);
      if (isNaN(amt) || amt < 0) {
        setCloseError(`Please enter a valid non-negative amount for ${col.payment_method}.`);
        return;
      }
      collectionsPayload.push({
        payment_method: col.payment_method,
        amount: amt
      });
    }

    // Calculate cash available before deposits
    const fuelDigitalVal = collectionsPayload.filter(c => c.payment_method !== 'Miscellaneous').reduce((acc, curr) => acc + curr.amount, 0);
    const miscExpenditureVal = collectionsPayload.find(c => c.payment_method === 'Miscellaneous')?.amount || 0;
    const fuelCashVal = expectedRevLive - creditSalesSum - fuelDigitalVal;
    const maxCashAvailable = parseFloat(session?.opening_cash_balance as any || 0) + fuelCashVal + creditPaymentsCashSum + (parseFloat(miscCash) || 0) - miscExpenditureVal;

    // Prepare cash deposits payload
    const depositsPayload = [];
    let totalDeposited = 0;
    for (const [accountId, val] of Object.entries(cashDeposits)) {
      const trimmed = (val || '').trim();
      const amt = trimmed === '' ? 0 : parseFloat(trimmed);
      if (isNaN(amt) || amt < 0) {
        setCloseError(`Cash deposit amount cannot be negative.`);
        return;
      }
      if (amt > 0) {
        totalDeposited += amt;
        depositsPayload.push({
          account_id: parseInt(accountId),
          amount: amt
        });
      }
    }

    if (totalDeposited > maxCashAvailable) {
      setCloseError(`Total cash deposited (₹${totalDeposited.toLocaleString('en-IN')}) cannot exceed the total cash balance available before deposits (₹${maxCashAvailable.toLocaleString('en-IN')}).`);
      return;
    }

    setCloseSaving(true);
    try {
      const adjAmount = priorPeriodAdjustment.trim() ? parseFloat(priorPeriodAdjustment) : 0;
      await apiService.closeSession(session.id, collectionsPayload, depositsPayload, adjAmount, adjustmentNotes.trim() || undefined);
      setSuccessMsg('Day logged and locked successfully! Redirecting...');

      setTimeout(() => {
        onBack();
      }, 1550);
    } catch (err: any) {
      setCloseError(err.message || 'Failed to close operation log session.');
    } finally {
      setCloseSaving(false);
    }
  };



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-3xl shadow-sm animate-fadeIn">
        <svg className="animate-spin h-10 w-10 text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Loading Forecourt Log Workspace...</p>
      </div>
    );
  }

  const isClosed = session?.status === 'CLOSED';

  // Derived fuel cash and digital from dynamic collections state (Cash is auto-calculated)
  const fuelDigitalVal = fuelCollections.filter(c => c.payment_method !== 'Miscellaneous').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const creditSalesSum = creditCharges.reduce((acc, curr) => acc + parseFloat(curr.amount as any), 0);
  const creditPaymentsCashSum = creditPayments.filter(p => p.payment_method === 'CASH').reduce((acc, curr) => acc + parseFloat(curr.amount as any), 0);
  const expectedRevLive = getLiveExpectedRevenue();

  const fuelCashVal = expectedRevLive - creditSalesSum - fuelDigitalVal;
  const fuelCash = String(fuelCashVal);
  const miscExpenditureLive = parseFloat(fuelCollections.find(c => c.payment_method === 'Miscellaneous')?.amount || '0') || 0;

  // Summaries
  const totalDepositedLive = Object.values(cashDeposits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const closingCashLive = parseFloat(session?.opening_cash_balance as any || 0) + fuelCashVal + creditPaymentsCashSum + (parseFloat(miscCash) || 0) - miscExpenditureLive - totalDepositedLive + (parseFloat(priorPeriodAdjustment) || 0);

  // Live Paytm credited into account = today's Paytm 3 + yesterday's Paytm 1 & Paytm 2
  const todayPaytm3 = parseFloat(fuelCollections.find(c => c.payment_method === 'Paytm 3')?.amount || '0') || 0;
  const paytmCreditedLive = todayPaytm3 + yesterdayPaytm1 + yesterdayPaytm2;

  const getPriceChangeGainLossLive = (): number => {
    let totalGainLoss = 0;
    const uniqueProducts = Array.from(new Set(nozzleLogs.map(log => log.product_name)));
    for (const prodName of uniqueProducts) {
      const productNozzles = nozzleLogs.filter(n => n.product_name === prodName && n.has_price_change);
      if (productNozzles.length === 0) continue;

      const oldPrice = parseFloat(productNozzles[0].old_price || '0');
      const newPrice = parseFloat(productNozzles[0].product_price || '0');
      if (isNaN(oldPrice) || isNaN(newPrice) || oldPrice === newPrice) continue;

      const productTanks = new Set(productNozzles.map(nl => nozzlesList.find(n => n.id === nl.nozzle_id)?.tank_id));

      for (const tankId of productTanks) {
        if (!tankId) continue;
        const matchingNozzlesForTank = productNozzles.filter(nl => nozzlesList.find(n => n.id === nl.nozzle_id)?.tank_id === tankId);

        let fuelSoldOld = 0;
        for (const nl of matchingNozzlesForTank) {
          fuelSoldOld += getNozzleDispensedOld(nl);
        }

        const tLog = tankLogs.find(tl => tl.tank_id === tankId);
        const openingDip = tLog ? parseFloat(tLog.opening_dip as any || 0) : 0;

        const stockAtChange = openingDip - fuelSoldOld;
        const gainLoss = (newPrice - oldPrice) * stockAtChange;
        totalGainLoss += gainLoss;
      }
    }
    return totalGainLoss;
  };

  const priceChangeGainLossLive = session?.price_change_gain_loss_total != null
    ? parseFloat(session.price_change_gain_loss_total)
    : getPriceChangeGainLossLive();

  return (
    <div className="space-y-6 text-slate-800 animate-fadeIn">



      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-scaleIn">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-start gap-2.5 animate-scaleIn">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* 6 Collapsible log sections - Light Theme */}

      {/* Step 1: Nozzle Readings */}
      <section
        id="log-section-1"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 1 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(1)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed || session?.nozzle_logs?.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              1
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Nozzle Readings</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Dispenser meter logs</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : (session?.nozzle_logs?.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
            {isClosed ? 'Complete ✓' : (session?.nozzle_logs?.length > 0 ? 'Logged ✓' : 'Pending')}
          </span>
        </div>

        {openSection === 1 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-fadeIn">
            {nozzleLogs.map((log, nozzleIdx) => (
              <div key={log.nozzle_id} className="p-4 rounded-2xl bg-slate-55 border border-slate-200/60 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide font-display">{log.nozzle_name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{log.machine_name} • {log.product_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Base Opening</span>
                    <span className="text-xs font-bold text-slate-800">{log.is_reset ? 0 : log.original_opening}</span>
                  </div>
                </div>

                {log.has_price_change ? (
                  <div className="space-y-4">
                    {/* Old Price Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-3 border-t border-slate-200/50">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Closing at Old Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter old price closing meter"
                          disabled={isClosed}
                          value={log.old_price_closing}
                          onChange={(e) => handleNozzleChange(nozzleIdx, 'old_price_closing', e.target.value)}
                          className="w-full rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Old Rate (₹/L)</label>
                        <input
                          type="number"
                          disabled={true}
                          value={log.old_price}
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-500 focus:outline-none transition-all text-xs font-bold font-sans opacity-70"
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[10px] font-bold text-slate-655">
                          <input
                            type="checkbox"
                            disabled={isClosed}
                            checked={log.is_reset}
                            onChange={(e) => handleNozzleChange(nozzleIdx, 'is_reset', e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 bg-white focus:ring-0"
                          />
                          <span>Reset</span>
                        </label>
                      </div>
                    </div>
                    
                    {/* New Price Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-3 border-t border-slate-100">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                          Closing at New Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter final closing meter"
                          disabled={isClosed}
                          value={log.closing_reading}
                          onChange={(e) => handleNozzleChange(nozzleIdx, 'closing_reading', e.target.value)}
                          className="w-full rounded-xl bg-emerald-50/30 border border-emerald-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Rate (₹/L)</label>
                        <input
                          type="number"
                          disabled={true}
                          value={log.product_price}
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-800 font-bold focus:outline-none transition-all text-xs font-sans"
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <span className="text-[10px] font-bold text-slate-400">Opening: {log.old_price_closing || 0}</span>
                      </div>
                    </div>

                    <div className="flex justify-end items-center pt-2 border-t border-slate-200/40 gap-4">
                      <div className="text-right border-r border-slate-200 pr-4">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Old Price L</span>
                        <span className="text-xs font-bold text-amber-600">{getNozzleDispensedOld(log).toFixed(2)} L</span>
                      </div>
                      <div className="text-right border-r border-slate-200 pr-4">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">New Price L</span>
                        <span className="text-xs font-bold text-emerald-600">{getNozzleDispensedNew(log).toFixed(2)} L</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Total Sold</span>
                        <span className="text-xs font-extrabold text-slate-800">{getNozzleDispensed(log).toFixed(2)} L</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-3 border-t border-slate-200/50">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Closing Reading
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter closing meter"
                          disabled={isClosed}
                          value={log.closing_reading}
                          onChange={(e) => handleNozzleChange(nozzleIdx, 'closing_reading', e.target.value)}
                          className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rate (₹/L)</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={true}
                          value={log.product_price}
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-500 focus:outline-none transition-all text-xs font-bold font-sans"
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[10px] font-bold text-slate-655">
                          <input
                            type="checkbox"
                            disabled={isClosed}
                            checked={log.is_reset}
                            onChange={(e) => handleNozzleChange(nozzleIdx, 'is_reset', e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 bg-white focus:ring-0"
                          />
                          <span>Reset</span>
                        </label>
                      </div>
                    </div>
    
                    <div className="flex justify-end items-center pt-2 border-t border-slate-200/40">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Liters Sold</span>
                        <span className="text-xs font-extrabold text-emerald-600">{getNozzleDispensed(log).toFixed(2)} L</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {nozzleError && <p className="text-xs text-rose-600 font-semibold">{nozzleError}</p>}
            {nozzleSuccess && <p className="text-xs text-emerald-600 font-semibold">{nozzleSuccess}</p>}

            {!isClosed && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={handleSaveNozzleReadings}
                  disabled={nozzleSaving}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                >
                  {nozzleSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  <span>{nozzleSaving ? 'Saving readings...' : 'Save Nozzle Readings'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 2: Tank Dip Readings */}
      <section
        id="log-section-2"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 2 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(2)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed || session?.tank_logs?.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              2
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Tank Dip Readings</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Physical stocks, test liters and variances</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : (session?.tank_logs?.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
            {isClosed ? 'Complete ✓' : (session?.tank_logs?.length > 0 ? 'Logged ✓' : 'Pending')}
          </span>
        </div>

        {openSection === 2 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-fadeIn">
            {tankLogs.map((log, tankIdx) => (
              <div key={log.tank_id} className="p-4 rounded-2xl bg-slate-55 border border-slate-200/60 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide font-display">{log.tank_name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{log.product_name} • Opening Dip Volume: {log.opening_dip.toFixed(2)} L</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fuel Received (L)</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="any"
                      disabled={isClosed}
                      value={log.fuel_received}
                      onChange={(e) => handleTankChange(tankIdx, 'fuel_received', e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Testing Liters (L)</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="any"
                      disabled={isClosed}
                      value={log.testing_liters}
                      onChange={(e) => handleTankChange(tankIdx, 'testing_liters', e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Actual Closing Dip (L)</label>
                    <input
                      type="number"
                      placeholder="Enter dip volume"
                      min="0"
                      step="any"
                      disabled={isClosed}
                      value={log.actual_dip_volume}
                      onChange={(e) => handleTankChange(tankIdx, 'actual_dip_volume', e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Variance</span>
                  <span className={`text-xs font-extrabold ${log.calculated_variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {log.calculated_variance >= 0 ? '+' : ''}{log.calculated_variance.toFixed(2)} L
                  </span>
                </div>
              </div>
            ))}

            {tankError && <p className="text-xs text-rose-600 font-semibold">{tankError}</p>}
            {tankSuccess && <p className="text-xs text-emerald-600 font-semibold">{tankSuccess}</p>}

            {!isClosed && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={handleSaveTankReadings}
                  disabled={tankSaving}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                >
                  {tankSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  <span>{tankSaving ? 'Saving Dips...' : 'Save Tank Dips'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 3: Credit Sales (Charges) */}
      <section
        id="log-section-3"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 3 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(3)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed || creditCharges.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              3
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Credit Sales (Charges)</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Client credit slips</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : (creditCharges.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
            {isClosed ? 'Complete ✓' : (creditCharges.length > 0 ? `${creditCharges.length} Slips` : 'Empty')}
          </span>
        </div>

        {openSection === 3 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-fadeIn">
            {creditCharges.length > 0 && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
                {creditCharges.map((tx) => {
                  const account = creditAccounts.find(a => a.id === tx.account_id);
                  return (
                    <div key={tx.id} className="p-3.5 bg-slate-50/30 flex justify-between items-center gap-4 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{account?.account_name || `Account ID: ${tx.account_id}`}</p>
                        {tx.notes && <p className="text-[10px] text-slate-500 mt-0.5 italic">{tx.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3.5">
                        <span className="font-extrabold text-amber-600">₹{parseFloat(tx.amount as any).toFixed(2)}</span>
                        {!isClosed && (
                          <button
                            onClick={() => handleDeleteCreditCharge(tx.id)}
                            className="text-rose-600 hover:text-rose-700 transition-colors p-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isClosed && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Add Credit Sale Slip</span>
                  <button
                    type="button"
                    onClick={() => setShowNewAccountForm(!showNewAccountForm)}
                    className="text-[9px] font-extrabold uppercase text-emerald-600 hover:text-emerald-700 transition-all cursor-pointer"
                  >
                    {showNewAccountForm ? '✕ Cancel' : '+ Create New Account Inline'}
                  </button>
                </div>

                {showNewAccountForm ? (
                  <form onSubmit={handleCreateNewAccountInline} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-3 bg-white border border-slate-200 rounded-xl">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">New Account Name</label>
                      <input
                        type="text"
                        required
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">Starting Balance (₹)</label>
                      <input
                        type="number"
                        value={newAccountBalance}
                        onChange={(e) => setNewAccountBalance(e.target.value)}
                        className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Create Account
                    </button>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Account</label>
                      <SmartDropdown
                        value={chargeAccountId}
                        onChange={setChargeAccountId}
                        options={creditAccounts.map(a => ({
                          value: String(a.id),
                          label: `${a.account_name} (Bal: ₹${parseFloat(a.current_outstanding_balance as any).toFixed(0)})`
                        }))}
                        placeholder="Choose client..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Slip Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        value={chargeAmount}
                        onChange={(e) => setChargeAmount(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Memo / Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. MH-12-7800"
                        value={chargeNotes}
                        onChange={(e) => setChargeNotes(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                )}

                {chargeError && <p className="text-xs text-rose-600 font-semibold">{chargeError}</p>}

                {!showNewAccountForm && (
                  <div className="flex justify-end pt-2 border-t border-slate-200/80">
                    <button
                      onClick={handleAddCreditCharge}
                      disabled={chargeSaving}
                      className="py-2 px-4 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      {chargeSaving && (
                        <svg className="animate-spin h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      <span>{chargeSaving ? 'Adding...' : 'Add Charge Slip'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isClosed && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setOpenSection(4)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
                >
                  Continue to Payments →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 4: Credit Payments Received */}
      <section
        id="log-section-4"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 4 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(4)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed || creditPayments.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              4
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Credit Payments Received</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Collections from credit accounts today</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : (creditPayments.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
            {isClosed ? 'Complete ✓' : (creditPayments.length > 0 ? `${creditPayments.length} Payments` : 'Empty')}
          </span>
        </div>

        {openSection === 4 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-fadeIn">
            {creditPayments.length > 0 && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
                {creditPayments.map((tx) => {
                  const account = creditAccounts.find(a => a.id === tx.account_id);
                  return (
                    <div key={tx.id} className="p-3.5 bg-slate-50/30 flex justify-between items-center gap-4 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">
                          {account?.account_name || `Account ID: ${tx.account_id}`}{' '}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ml-1.5 uppercase ${tx.payment_method === 'CASH' ? 'text-slate-500 bg-slate-200/60 border-slate-300' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                            {tx.payment_method === 'CASH' ? '💵 Cash' : '🏛️ Account'}
                          </span>
                        </p>
                        {tx.notes && <p className="text-[10px] text-slate-500 mt-0.5 italic">{tx.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3.5">
                        <span className="font-extrabold text-emerald-600">₹{parseFloat(tx.amount as any).toFixed(2)}</span>
                        {!isClosed && (
                          <button
                            onClick={() => handleDeleteCreditPayment(tx.id)}
                            className="text-rose-600 hover:text-rose-700 transition-colors p-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isClosed && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block border-b border-slate-200 pb-2">Record Client Payment Received</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Client</label>
                    <SmartDropdown
                      value={paymentAccountId}
                      onChange={setPaymentAccountId}
                      options={creditAccounts.map(a => ({
                        value: String(a.id),
                        label: `${a.account_name} (Bal: ₹${parseFloat(a.current_outstanding_balance as any).toFixed(0)})`
                      }))}
                      placeholder="Choose client..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount Received (₹)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                    <SmartDropdown
                      value={paymentMethod}
                      onChange={(val) => setPaymentMethod(val as any)}
                      options={[
                        { value: 'CASH', label: '💵 Cash' },
                        { value: 'ACCOUNT_TRANSFER', label: '🏛️ Account Transfer' }
                      ]}
                      placeholder="Select payment method..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes / Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. ref 902345"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>



                {paymentError && <p className="text-xs text-rose-600 font-semibold">{paymentError}</p>}

                <div className="flex justify-end pt-2 border-t border-slate-200/85">
                  <button
                    onClick={handleAddCreditPayment}
                    disabled={paymentSaving}
                    className="py-2 px-4 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    {paymentSaving && (
                      <svg className="animate-spin h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span>{paymentSaving ? 'Recording...' : 'Record Payment'}</span>
                  </button>
                </div>
              </div>
            )}

            {!isClosed && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setOpenSection(5)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs cursor-pointer"
                >
                  Continue to Other Items →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 5: Other Items Income */}
      <section
        id="log-section-5"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 5 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(5)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed || (parseFloat(miscCash) || miscNotes) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              5
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Other Items Income</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Lubricants, oil, or filter sales</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : (parseFloat(miscCash) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
            {isClosed ? 'Complete ✓' : (parseFloat(miscCash) ? `₹${parseFloat(miscCash).toFixed(0)}` : 'Empty')}
          </span>
        </div>

        {openSection === 5 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-fadeIn">
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">Other Items Income - Cash (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                disabled={isClosed}
                value={miscCash}
                onChange={(e) => setMiscCash(e.target.value)}
                className="w-full max-w-md rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-505 uppercase tracking-wider mb-1.5">Item Description / Notes</label>
              <textarea
                placeholder="e.g. Engine Oil 2L sold x 1"
                disabled={isClosed}
                value={miscNotes}
                onChange={(e) => setMiscNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs resize-none"
              />
            </div>

            {miscError && <p className="text-xs text-rose-600 font-semibold">{miscError}</p>}
            {miscSuccess && <p className="text-xs text-emerald-600 font-semibold">{miscSuccess}</p>}

            {!isClosed && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={handleSaveMiscIncome}
                  disabled={miscSaving}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                >
                  {miscSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  <span>{miscSaving ? 'Saving...' : 'Save Other Items'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 6: Financial Close */}
      <section
        id="log-section-6"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 6 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(6)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              6
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Financial Reconciliation</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Revenues vs. actual collections</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {isClosed ? 'Locked 🔒' : 'Open ⚡'}
          </span>
        </div>

        {openSection === 6 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-6 animate-fadeIn">
            <form onSubmit={handleCloseSession} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {fuelCollections.map((col, idx) => (
                  <div key={col.payment_method}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{col.payment_method} (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      disabled={isClosed}
                      value={col.amount}
                      onChange={(e) => {
                        const newCollections = [...fuelCollections];
                        newCollections[idx].amount = e.target.value;
                        setFuelCollections(newCollections);
                      }}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                ))}
              </div>

              {/* Cash Deposits to Accounts */}
              {pumpAccounts.filter(acc => acc.name !== "IOCL Account").length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">Cash Deposits to Accounts</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Record cash deposited into linked custom accounts from the station's cash balance</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {pumpAccounts
                      .filter(acc => acc.name !== "IOCL Account")
                      .map((acc) => (
                        <div key={acc.id}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{acc.name} Deposit (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            disabled={isClosed}
                            value={cashDeposits[acc.id] || ''}
                            onChange={(e) => {
                              setCashDeposits(prev => ({
                                ...prev,
                                [acc.id]: e.target.value
                              }));
                            }}
                            className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {/* Prior Day Corrections */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">Prior Day Corrections / Adjustments</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Account for cash shortages/overages discovered from previous days (+ / -)</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Adjustment Amount (₹)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. -500 or 1000"
                      disabled={isClosed}
                      value={priorPeriodAdjustment}
                      onChange={(e) => setPriorPeriodAdjustment(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason / Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Found yesterday's missing 500 note"
                      disabled={isClosed}
                      value={adjustmentNotes}
                      onChange={(e) => setAdjustmentNotes(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none text-xs font-medium"
                    />
                  </div>
                </div>
              </div>


              {/* Calculation preview panel - Light theme styling */}
              <div className="p-5 rounded-2xl bg-slate-55 border border-slate-200 space-y-4 text-xs">
                <h4 className="font-bold text-slate-900 text-[10px] tracking-wider uppercase border-b border-slate-200 pb-2 font-display">Day Reconciliation Preview</h4>

                {/* Top block: sales */}
                <div className="space-y-2.5 font-semibold text-slate-700">
                  <div className="flex justify-between">
                    <span>Fuel Revenue (Total Sales):</span>
                    <span className="text-slate-900 font-bold">₹{expectedRevLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 pb-2.5">
                    <span className="text-[10px] pl-3 italic text-slate-500">↳ Gross fuel nozzle sales:</span>
                    <span className="text-slate-600 pl-3 italic font-bold">
                      ₹{(expectedRevLive + tankLogs.reduce((acc, curr) => acc + (parseFloat(curr.testing_liters) || 0) * (nozzlesList.find(n => n.tank_id === curr.tank_id)?.product_price || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span>Non-Cash Deductions / Expenditures:</span>
                  </div>
                  <div className="space-y-1.5 pl-3 border-l border-slate-200/80 my-2">
                    {fuelCollections.filter(col => col.payment_method !== 'Miscellaneous').map((col) => {
                      const amountVal = parseFloat(col.amount) || 0;
                      if (amountVal === 0) return null;
                      return (
                        <div key={col.payment_method} className="flex justify-between text-[10px] text-rose-600 font-semibold">
                          <span>↳ {col.payment_method}:</span>
                          <span>-₹{amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}
                    {creditSalesSum > 0 && (
                      <div className="flex justify-between text-[10px] text-rose-600 font-semibold">
                        <span>↳ Credit Charges Slips:</span>
                        <span>-₹{creditSalesSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {fuelCollections.filter(col => col.payment_method !== 'Miscellaneous').every(c => (parseFloat(c.amount) || 0) === 0) && creditSalesSum === 0 && (
                      <div className="text-[10px] text-slate-400 italic">No non-cash deductions today</div>
                    )}
                  </div>

                  <div className="flex justify-between text-xs font-bold pt-2.5 border-t border-slate-200/80">
                    <span className="text-slate-900">Fuel Cash Collected Today:</span>
                    <span className="text-emerald-600 font-extrabold">₹{fuelCashVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Cashbook block */}
                <h4 className="font-bold text-slate-900 text-[10px] tracking-wider uppercase border-b border-slate-200 pt-2 pb-2 font-display">Cash Book Inflow</h4>
                <div className="space-y-2.5 font-semibold text-slate-700">
                  <div className="flex justify-between text-[11px]">
                    <span>Opening Cash Book Balance:</span>
                    <span className="text-slate-900 font-bold">₹{(session?.opening_cash_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>+ Daily Fuel Cash Collection:</span>
                    <span className="text-slate-900 font-semibold">₹{(parseFloat(fuelCash) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>+ Credit Payments (Cash Collected):</span>
                    <span className="text-slate-900 font-semibold">₹{creditPaymentsCashSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>+ Other Items Cash Collected:</span>
                    <span className="text-slate-900 font-semibold">₹{(parseFloat(miscCash) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {(parseFloat(priorPeriodAdjustment) || 0) !== 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span>+/- Prior Day Adjustments:</span>
                      <span className={`font-semibold ${(parseFloat(priorPeriodAdjustment) || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {(parseFloat(priorPeriodAdjustment) || 0) > 0 ? '+' : ''}₹{(parseFloat(priorPeriodAdjustment) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {miscExpenditureLive > 0 && (
                    <div className="flex justify-between text-[11px] text-rose-600 font-semibold">
                      <span>- Miscellaneous Payouts:</span>
                      <span>-₹{miscExpenditureLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {pumpAccounts
                    .filter(acc => acc.name !== "IOCL Account")
                    .map((acc) => {
                      const val = parseFloat(cashDeposits[acc.id] || '0') || 0;
                      if (val <= 0) return null;
                      return (
                        <div key={acc.id} className="flex justify-between text-[11px] text-rose-600 font-semibold">
                          <span>- Cash Deposited to {acc.name}:</span>
                          <span>-₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}

                  <div className="border-b border-slate-200/80 my-1 pb-0.5" />

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-slate-200/80 font-bold shadow-2xs">
                    <span className="text-slate-705">Closing Cash Balance:</span>
                    <span className="text-emerald-600 font-extrabold">₹{closingCashLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {priceChangeGainLossLive !== 0 && (
                    <div className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-slate-200/80 font-bold mt-2 shadow-2xs">
                      <span className="text-slate-705">Price Change Inventory {priceChangeGainLossLive > 0 ? 'Gain' : 'Loss'}:</span>
                      <span className={`font-extrabold ${priceChangeGainLossLive > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {priceChangeGainLossLive > 0 ? '+' : '-'}₹{Math.abs(priceChangeGainLossLive).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Paytm credited into account */}
                {paytmCreditedLive > 0 && (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-slate-200/80 font-bold mt-2 shadow-2xs text-[11px]">
                    <div>
                      <span className="text-slate-600">Paytm Credited Into Account Today:</span>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                        Paytm 3 today (₹{todayPaytm3.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) + Paytm 1 yesterday (₹{yesterdayPaytm1.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) + Paytm 2 yesterday (₹{yesterdayPaytm2.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                      </div>
                    </div>
                    <span className="text-emerald-600 font-extrabold">₹{paytmCreditedLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {closeError && <p className="text-xs text-rose-600 font-semibold">{closeError}</p>}

              {!isClosed && (
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={closeSaving}
                    className="py-2.5 px-6 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer border border-emerald-600 hover:border-emerald-700 shadow-md transition-all flex items-center gap-1.5"
                  >
                    {closeSaving ? (
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    )}
                    <span>{closeSaving ? 'Locking Day...' : 'Lock and Close Day\'s Ledger'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </section>
    </div>
  );
};
