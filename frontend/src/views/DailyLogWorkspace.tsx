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

export const DailyLogWorkspace: React.FC<DailyLogWorkspaceProps> = ({ pumpId, onBack }) => {
  // Session & Config state
  const [session, setSession] = useState<any>(null);
  const [nozzlesList, setNozzlesList] = useState<Nozzle[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [creditCharges, setCreditCharges] = useState<CreditTransaction[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditTransaction[]>([]);

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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ACCOUNT_TRANSFER'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // 5. Misc income
  const [miscCash, setMiscCash] = useState('0');
  const [miscDigital, setMiscDigital] = useState('0');
  const [miscNotes, setMiscNotes] = useState('');
  const [miscSaving, setMiscSaving] = useState(false);
  const [miscError, setMiscError] = useState('');
  const [miscSuccess, setMiscSuccess] = useState('');

  // 6. Close session
  const [fuelCash, setFuelCash] = useState('');
  const [fuelDigital, setFuelDigital] = useState('');
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

      const activeNozzles = config.nozzles.filter((nz: Nozzle) => nz.is_active !== false);
      setNozzlesList(activeNozzles);
      setCreditAccounts(config.credit_accounts);

      // 2. Fetch or create today's session in IST date
      const activeSession = await apiService.getOrCreateSession(pumpId, dateStr);
      setSession(activeSession);

      // 3. Fetch prefill readings to get correct opening bounds
      const prefill = await apiService.prefillShiftLog(pumpId);

      // Prefill Section 1: Nozzle Readings
      const activeNozzleLogs = activeSession.nozzle_logs || [];
      const initNozzleLogs: LocalNozzleLog[] = activeNozzles.map((nz: Nozzle) => {
        const matchingLog = activeNozzleLogs.find((l: any) => l.nozzle_id === nz.id);
        const prefillNz = prefill.nozzles.find((n: any) => n.nozzle_id === nz.id);
        const baseOpening = prefillNz ? parseFloat(prefillNz.opening_reading as any) : 0;

        const machine = config.machines?.find((m: any) => m.id === nz.machine_id);
        const machineName = machine ? machine.name : 'Dispenser';

        return {
          nozzle_id: nz.id,
          nozzle_name: nz.name,
          machine_name: machineName,
          product_name: nz.product_name || 'Fuel',
          original_opening: baseOpening,
          closing_reading: matchingLog ? String(matchingLog.closing_reading) : '',
          // Always read price from the main product configuration
          product_price: String(prefillNz?.product_price || nz.product_price || 0),
          is_reset: matchingLog ? matchingLog.is_reset : false
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

      // Prefill Section 5: Misc
      setMiscCash(String(activeSession.misc_cash || '0'));
      setMiscDigital(String(activeSession.misc_digital || '0'));
      setMiscNotes(activeSession.misc_notes || '');

      // Prefill Section 6: Fuel Close
      setFuelCash(activeSession.fuel_cash_collected !== null ? String(activeSession.fuel_cash_collected) : '');
      setFuelDigital(activeSession.fuel_digital_collected !== null ? String(activeSession.fuel_digital_collected) : '');

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize daily operation workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to calculate total nozzle dispensed liters per nozzle row
  const getNozzleDispensed = (log: LocalNozzleLog): number => {
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
  const getLiveExpectedRevenue = (): number => {
    let expected = 0;
    // Nozzle sales contribution
    for (const nLog of nozzleLogs) {
      const closing = parseFloat(nLog.closing_reading);
      const price = parseFloat(nLog.product_price);
      if (isNaN(closing) || isNaN(price)) continue;

      let dispensed = 0;
      if (nLog.is_reset) {
        dispensed = closing;
      } else if (closing >= nLog.original_opening) {
        dispensed = closing - nLog.original_opening;
      }
      expected += dispensed * price;
    }

    // Deduct testing liters
    for (const tLog of tankLogs) {
      const testing = parseFloat(tLog.testing_liters);
      if (isNaN(testing) || testing <= 0) continue;

      const matchingNozzle = nozzlesList.find(n => n.tank_id === tLog.tank_id);
      const productPrice = matchingNozzle ? parseFloat(matchingNozzle.product_price as any || 0) : 0;
      expected -= testing * productPrice;
    }

    return expected;
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
        const closing = parseFloat(log.closing_reading);
        const price = parseFloat(log.product_price);
        if (isNaN(closing) || closing < 0) {
          throw new Error(`Invalid closing reading for Nozzle: ${log.nozzle_name}`);
        }
        if (closing < log.original_opening && !log.is_reset) {
          throw new Error(`Closing reading cannot be lower than opening reading (${log.original_opening}) for Nozzle ${log.nozzle_name} unless Reset is toggled.`);
        }
        if (isNaN(price) || price < 0) {
          throw new Error(`Invalid price for Nozzle: ${log.nozzle_name}`);
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

      const matchingNozzle = nozzlesList.find(n => n.tank_id === updated[tankIdx].tank_id);
      const nozzleLog = matchingNozzle ? nozzleLogs.find(nl => nl.nozzle_id === matchingNozzle.id) : null;
      const grossDispensed = nozzleLog ? getNozzleDispensed(nozzleLog) : 0;

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
        return {
          tank_id: log.tank_id,
          testing_liters: parseFloat(log.testing_liters) || 0,
          fuel_received: parseFloat(log.fuel_received) || 0,
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

  // Handlers for Section 5: Misc Income
  const handleSaveMiscIncome = async () => {
    setMiscError('');
    setMiscSuccess('');
    const cash = parseFloat(miscCash) || 0;
    const digital = parseFloat(miscDigital) || 0;

    setMiscSaving(true);
    try {
      await apiService.saveMiscIncome(session.id, cash, digital, miscNotes.trim() || undefined);
      setMiscSuccess('Miscellaneous income saved successfully!');

      const updatedSession = await apiService.getOrCreateSession(pumpId);
      setSession(updatedSession);

      setTimeout(() => setOpenSection(6), 600);
    } catch (err: any) {
      setMiscError(err.message || 'Failed to save misc income.');
    } finally {
      setMiscSaving(false);
    }
  };

  // Handlers for Section 6: Financial Close
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloseError('');
    const cash = parseFloat(fuelCash);
    const digital = parseFloat(fuelDigital);

    if (isNaN(cash) || cash < 0) { setCloseError('Please enter a valid cash collected amount.'); return; }
    if (isNaN(digital) || digital < 0) { setCloseError('Please enter a valid digital collected amount.'); return; }

    setCloseSaving(true);
    try {
      await apiService.closeSession(session.id, cash, digital);
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

  // Summaries
  const creditSalesSum = creditCharges.reduce((acc, curr) => acc + parseFloat(curr.amount as any), 0);
  const creditPaymentsCashSum = creditPayments.filter(p => p.payment_method === 'CASH').reduce((acc, curr) => acc + parseFloat(curr.amount as any), 0);
  const creditPaymentsDigitalSum = creditPayments.filter(p => p.payment_method === 'ACCOUNT_TRANSFER').reduce((acc, curr) => acc + parseFloat(curr.amount as any), 0);

  const expectedRevLive = getLiveExpectedRevenue();
  const reportedRevLive = (parseFloat(fuelCash) || 0) + (parseFloat(fuelDigital) || 0) + creditSalesSum;
  const shortageOverageLive = reportedRevLive - expectedRevLive;
  const closingCashLive = parseFloat(session?.opening_cash_balance as any || 0) + (parseFloat(fuelCash) || 0) + creditPaymentsCashSum + (parseFloat(miscCash) || 0);

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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-3 border-t border-slate-200/50">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Closing Reading
                    </label>
                    <input
                      type="number"
                      step="0.01"
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
                          <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded-md bg-slate-200/60 border border-slate-300 ml-1.5 uppercase">
                            {tx.payment_method === 'CASH' ? '💵 Cash' : '🏦 Bank'}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes / Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. UPI ref 902345"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Collection Method</label>
                  <div className="grid grid-cols-2 gap-3 max-w-sm">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${paymentMethod === 'CASH' ? 'border-emerald-600 bg-emerald-55 text-emerald-700 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50 text-slate-600 bg-white'}`}
                    >
                      💵 Cash collected
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('ACCOUNT_TRANSFER')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${paymentMethod === 'ACCOUNT_TRANSFER' ? 'border-emerald-600 bg-emerald-55 text-emerald-700 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50 text-slate-600 bg-white'}`}
                    >
                      🏦 UPI / Bank Transfer
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 font-medium">
                    {paymentMethod === 'CASH'
                      ? 'ℹ Note: Cash payments automatically add to today\'s cashbook balance.'
                      : 'ℹ Note: Bank Transfers record ledger changes but do not add to closing cash.'}
                  </p>
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
                  Continue to Misc →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 5: Miscellaneous Income */}
      <section
        id="log-section-5"
        className={`scroll-mt-24 border bg-white rounded-3xl overflow-hidden transition-all shadow-xs ${openSection === 5 ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' : 'border-slate-200/80'}`}
      >
        <div
          onClick={() => setOpenSection(5)}
          className="p-5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold font-display ${isClosed || (parseFloat(miscCash) || parseFloat(miscDigital) || miscNotes) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              5
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-display">Miscellaneous Income</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Lubricants, oil, or filter sales</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : ((parseFloat(miscCash) || parseFloat(miscDigital)) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
            {isClosed ? 'Complete ✓' : ((parseFloat(miscCash) || parseFloat(miscDigital)) ? `₹${(parseFloat(miscCash) + parseFloat(miscDigital)).toFixed(0)}` : 'Empty')}
          </span>
        </div>

        {openSection === 5 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">Misc Cash Income (₹)</label>
                <input
                  type="number"
                  disabled={isClosed}
                  value={miscCash}
                  onChange={(e) => setMiscCash(e.target.value)}
                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-555 uppercase tracking-wider mb-1.5">Misc Digital UPI Income (₹)</label>
                <input
                  type="number"
                  disabled={isClosed}
                  value={miscDigital}
                  onChange={(e) => setMiscDigital(e.target.value)}
                  className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-350 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                />
              </div>
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
                  <span>{miscSaving ? 'Saving...' : 'Save Misc Income'}</span>
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
              <p className="text-[10px] text-slate-500 mt-0.5">Expected revenues vs. actual collections</p>
            </div>
          </div>
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isClosed ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {isClosed ? 'Locked 🔒' : 'Open ⚡'}
          </span>
        </div>

        {openSection === 6 && (
          <div className="p-5 border-t border-slate-100 bg-white space-y-6 animate-fadeIn">
            <form onSubmit={handleCloseSession} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fuel Cash Collected (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    disabled={isClosed}
                    value={fuelCash}
                    onChange={(e) => setFuelCash(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fuel Digital UPI Collected (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    disabled={isClosed}
                    value={fuelDigital}
                    onChange={(e) => setFuelDigital(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                  />
                </div>
              </div>

              {/* Calculation preview panel - Light theme styling */}
              <div className="p-5 rounded-2xl bg-slate-55 border border-slate-200 space-y-4 text-xs">
                <h4 className="font-bold text-slate-900 text-[10px] tracking-wider uppercase border-b border-slate-200 pb-2 font-display">Day Reconciliation Preview</h4>

                {/* Top block: sales */}
                <div className="space-y-2.5 font-semibold text-slate-700">
                  <div className="flex justify-between">
                    <span>Expected Fuel Revenue:</span>
                    <span className="text-slate-900 font-bold">₹{expectedRevLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 pb-2.5">
                    <span className="text-[10px] pl-3 italic text-slate-500">↳ Gross fuel nozzle sales:</span>
                    <span className="text-slate-600 pl-3 italic font-bold">
                      ₹{(expectedRevLive + tankLogs.reduce((acc, curr) => acc + (parseFloat(curr.testing_liters) || 0) * (nozzlesList.find(n => n.tank_id === curr.tank_id)?.product_price || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span>Actual Fuel Cash + UPI Reported:</span>
                    <span className="text-slate-900 font-bold">₹{((parseFloat(fuelCash) || 0) + (parseFloat(fuelDigital) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 pb-2.5 text-[11px]">
                    <span>Credit Charges Slips Today:</span>
                    <span className="text-slate-900 font-bold">₹{creditSalesSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span className="text-slate-900">Total Accounted:</span>
                    <span className="text-slate-950 font-extrabold">₹{reportedRevLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-slate-200/80 font-bold mt-2 shadow-2xs">
                    <span className="text-slate-600">Reconciliation Shortage/Overage:</span>
                    <span className={`${shortageOverageLive >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ₹{shortageOverageLive >= 0 ? '+' : ''}{shortageOverageLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Cashbook block */}
                <h4 className="font-bold text-slate-900 text-[10px] tracking-wider uppercase border-b border-slate-200 pt-2 pb-2 font-display">Estimated Cash Book Inflow</h4>
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
                  <div className="flex justify-between text-[11px] border-b border-slate-200/80 pb-2.5">
                    <span>+ Misc Cash Collected:</span>
                    <span className="text-slate-900 font-semibold">₹{(parseFloat(miscCash) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-white border border-slate-200/80 font-bold mt-2 shadow-2xs">
                    <span className="text-slate-705">Final Estimated Closing Cash Balance:</span>
                    <span className="text-emerald-600 font-extrabold">₹{closingCashLive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Non-cash collection totals */}
                <div className="text-[10px] text-slate-500 pt-2 flex flex-wrap gap-4 font-semibold border-t border-slate-200/60">
                  <span>UPI/Digital Fuel: ₹{(parseFloat(fuelDigital) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span>UPI/Digital Credit Payments: ₹{creditPaymentsDigitalSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span>UPI/Digital Misc: ₹{(parseFloat(miscDigital) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
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
