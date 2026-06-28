import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { FuelPump, CreditAccount, CreditTransaction } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { SmartDropdown } from '../components/SmartDropdown';

interface ManageCreditAccountsProps {
  onBack: () => void;
  pumps: FuelPump[];
}

export const ManageCreditAccounts: React.FC<ManageCreditAccountsProps> = ({ onBack, pumps }) => {
  const [accountsList, setAccountsList] = useState<CreditAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generalError, setGeneralError] = useState('');

  // Selected pump filter
  const [selectedFilterPumpId, setSelectedFilterPumpId] = useState<string>('all');

  // Modals & form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form Fields
  const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountPumpId, setAccountPumpId] = useState<string>('');
  const [startingBalance, setStartingBalance] = useState('');

  // Transaction fields
  const [txType, setTxType] = useState<'CHARGE' | 'PAYMENT'>('CHARGE');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction History Timeline state
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    const forceScrollToTop = () => {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      setTimeout(() => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 150);
    };
    forceScrollToTop();
  }, []);

  const anyModalOpen = isAddModalOpen || isEditModalOpen || isTxModalOpen || isHistoryModalOpen || isDeleteModalOpen;
  useBodyScrollLock(anyModalOpen);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    setGeneralError('');
    try {
      const data = await apiService.getCreditAccounts();
      setAccountsList(data);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to retrieve credit accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== Add Account ==========
  const handleOpenAddModal = () => {
    setAccountName('');
    setAccountPumpId(pumps[0]?.id?.toString() || '');
    setStartingBalance('0');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!accountName.trim()) { setFormError('Account name is required.'); return; }
    if (!accountPumpId) { setFormError('Please select a fuel station.'); return; }
    const balance = parseFloat(startingBalance);
    if (isNaN(balance) || balance < 0) { setFormError('Starting balance must be a non-negative number.'); return; }

    setIsSubmitting(true);
    try {
      await apiService.createCreditAccount({
        pump_id: parseInt(accountPumpId, 10),
        account_name: accountName.trim(),
        current_outstanding_balance: balance,
      });
      await fetchAccounts();
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to register credit account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== Edit Account ==========
  const handleOpenEditModal = (acc: CreditAccount) => {
    setSelectedAccount(acc);
    setAccountName(acc.account_name);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedAccount) return;
    if (!accountName.trim()) { setFormError('Account name is required.'); return; }

    setIsSubmitting(true);
    try {
      await apiService.updateCreditAccount(selectedAccount.id, { account_name: accountName.trim() });
      await fetchAccounts();
      setIsEditModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to rename account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== Record Transaction ==========
  const handleOpenTxModal = (acc: CreditAccount) => {
    setSelectedAccount(acc);
    setTxType('CHARGE');
    setTxAmount('');
    setTxNotes('');
    setFormError('');
    setIsTxModalOpen(true);
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedAccount) return;
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0) { setFormError('Amount must be a positive number.'); return; }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const localDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const localTimestamp = now.toISOString();

      await apiService.recordCreditTransaction(selectedAccount.id, {
        account_id: selectedAccount.id,
        log_date: localDate,
        log_timestamp: localTimestamp,
        type: txType,
        amount,
        notes: txNotes.trim() || undefined,
      });
      await fetchAccounts();
      setIsTxModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== View History ==========
  const handleOpenHistoryModal = async (acc: CreditAccount) => {
    setSelectedAccount(acc);
    setIsHistoryLoading(true);
    setIsHistoryModalOpen(true);
    try {
      const data = await apiService.getCreditTransactions(acc.id);
      setTransactions(data);
    } catch {
      setIsHistoryModalOpen(false);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // ========== Delete Account ==========
  const handleOpenDeleteModal = (acc: CreditAccount) => {
    setSelectedAccount(acc);
    setFormError('');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedAccount) return;
    if (parseFloat(selectedAccount.current_outstanding_balance as any) !== 0) {
      setFormError('Cannot delete account with a non-zero outstanding balance.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiService.deleteCreditAccount(selectedAccount.id);
      await fetchAccounts();
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to delete account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== Helpers ==========
  const getPumpName = (pumpId: number) => pumps.find(p => p.id === pumpId)?.name || `Station #${pumpId}`;

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const filteredAccounts = accountsList.filter(acc => {
    if (selectedFilterPumpId === 'all') return true;
    return acc.pump_id.toString() === selectedFilterPumpId;
  });
  const sortedAccounts = [...filteredAccounts].sort((a, b) => a.account_name.localeCompare(b.account_name));

  // ==================== RENDER ====================
  return (
    <div className="animate-fadeIn">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button onClick={onBack} className="hover:text-emerald-600 transition-colors flex items-center gap-1 cursor-pointer">
              Dashboard
            </button>
            <span>/</span>
            <span className="text-slate-700">Credit Accounts</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display mt-2">
            Client Credit Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage credit accounts, track outstanding balances, record charges &amp; payments, and review transaction history.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.01] cursor-pointer"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Account
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Station:</span>
          <div className="min-w-[180px]">
            <SmartDropdown
              value={selectedFilterPumpId}
              onChange={setSelectedFilterPumpId}
              options={[
                { value: 'all', label: 'All Stations' },
                ...pumps.map(p => ({ value: p.id.toString(), label: p.name })),
              ]}
            />
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{sortedAccounts.length}</span> account{sortedAccounts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg className="animate-spin h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-500 text-sm mt-4 font-semibold">Loading client credit data...</span>
        </div>
      ) : generalError ? (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {generalError}
        </div>
      ) : sortedAccounts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-3xl shadow-sm">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-4 text-sm font-bold text-slate-700">No Credit Accounts Found</h3>
          <p className="mt-1 text-xs text-slate-500">Create credit accounts for fleet or corporate clients to begin tracking outstanding balances.</p>
          <div className="mt-6">
            <button onClick={handleOpenAddModal} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer shadow-sm">
              Add First Account
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAccounts.map((acc) => {
            const balance = parseFloat(acc.current_outstanding_balance as any);
            return (
              <div key={acc.id} className="group relative rounded-3xl bg-white border border-slate-200/90 hover:border-slate-350 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                <div>
                  {/* Title & Delete */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Client</span>
                      <h3 className="text-base font-bold text-slate-900 font-display mt-0.5 group-hover:text-emerald-600 transition-colors">
                        {acc.account_name}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleOpenDeleteModal(acc)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                      title="Delete Account"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Outstanding Balance */}
                  <div className="p-4 rounded-2xl mt-4 border border-slate-200/60 flex items-center justify-between bg-slate-50/60">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding</span>
                      <span className={`text-xl font-extrabold mt-1 block font-display ${balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-sky-600' : 'text-emerald-600'}`}>
                        {balance < 0 ? `-₹${Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${balance > 0 ? 'bg-amber-100 text-amber-800' : balance < 0 ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {balance > 0 ? 'Due' : balance < 0 ? 'Overpaid' : 'Cleared'}
                    </span>
                  </div>

                  {/* Station */}
                  <div className="mt-4 pt-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Station Associated</span>
                    <span className="text-xs font-semibold text-slate-700 mt-1 block">{getPumpName(acc.pump_id)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                  <button onClick={() => handleOpenHistoryModal(acc)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer">
                    Ledger Log
                  </button>
                  <button onClick={() => handleOpenEditModal(acc)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer">
                    Rename
                  </button>
                  <button onClick={() => handleOpenTxModal(acc)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold transition-colors cursor-pointer">
                    Record Tx
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 font-display">Create Credit Account</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Account Name / Client</label>
                <input type="text" placeholder="e.g. BlueStar Logistics, City Transport Co." value={accountName} onChange={(e) => setAccountName(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Fuel Station</label>
                <div className="mt-2">
                  <SmartDropdown value={accountPumpId} onChange={setAccountPumpId} options={pumps.map(p => ({ value: p.id.toString(), label: p.name }))} placeholder="Select Station..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Starting Outstanding Balance (₹)</label>
                <input type="number" step="0.01" placeholder="0.00" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs" />
                <span className="text-[10px] text-slate-400 mt-1 block">Set starting balance if transferring credit from an old ledger.</span>
              </div>
              {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold cursor-pointer">
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {isEditModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 font-display">Edit Client Account</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Account Name</label>
                <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs" />
              </div>
              {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold cursor-pointer">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {isTxModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-950 font-display">Record Transaction</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedAccount.account_name}</p>
              </div>
              <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleTxSubmit} className="space-y-4 pt-4">
              {/* Type Radio */}
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Transaction Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${txType === 'CHARGE' ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                    <input type="radio" name="txType" checked={txType === 'CHARGE'} onChange={() => setTxType('CHARGE')} className="sr-only" />
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Charge</span>
                  </label>
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${txType === 'PAYMENT' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                    <input type="radio" name="txType" checked={txType === 'PAYMENT'} onChange={() => setTxType('PAYMENT')} className="sr-only" />
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Payment</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Amount (₹)</label>
                <input type="number" step="0.01" placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">Notes / Memo <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                <textarea placeholder="e.g. Fuel for Truck MH-12-3456, UPI ref 12345" value={txNotes} onChange={(e) => setTxNotes(e.target.value)} rows={3}
                  className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-xs resize-none" />
              </div>
              {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting} className={`py-2.5 px-4 rounded-xl text-white text-xs font-bold cursor-pointer ${txType === 'CHARGE' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {isSubmitting ? 'Recording...' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {isHistoryModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-950 font-display">Client Credit Ledger</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedAccount.account_name} — transaction timeline (IST)</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mt-4 max-h-[350px] overflow-y-auto pr-1">
              {isHistoryLoading ? (
                <div className="flex justify-center py-10">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-6">No credit transactions recorded yet.</p>
              ) : (
                <div className="relative border-l border-slate-200 ml-3.5 my-4">
                  {transactions.map((tx) => {
                    const isCharge = tx.type === 'CHARGE';
                    return (
                      <div key={tx.id} className="mb-6 ml-6 relative">
                        <span className={`absolute -left-[30px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${isCharge ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                            <span>{formatDateTime(tx.log_timestamp)}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wide font-extrabold ${isCharge ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {isCharge ? 'Charge' : 'Payment'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <div>
                              <span className="text-[9px] text-slate-400 block font-bold uppercase">Amount</span>
                              <span className={`font-extrabold ${isCharge ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ₹{parseFloat(tx.amount as any).toFixed(2)}
                              </span>
                            </div>
                            {tx.notes && (
                              <div className="text-right flex-grow max-w-[70%]">
                                <span className="text-[9px] text-slate-400 block font-bold uppercase">Memo</span>
                                <span className="text-[10px] font-medium text-slate-600 break-words">{tx.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 font-display">Delete Credit Account</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" disabled={isSubmitting}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="pt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete the credit account for <strong className="text-slate-900">{selectedAccount.account_name}</strong>? This will erase all historical transaction logs.
              </p>
              {parseFloat(selectedAccount.current_outstanding_balance as any) !== 0 ? (
                <div className={`p-3.5 border rounded-2xl flex gap-3 text-xs font-semibold ${parseFloat(selectedAccount.current_outstanding_balance as any) > 0 ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-sky-50 border-sky-100 text-sky-800'}`}>
                  <svg className={`w-5 h-5 shrink-0 ${parseFloat(selectedAccount.current_outstanding_balance as any) > 0 ? 'text-rose-600' : 'text-sky-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <span className="block font-bold">
                      {parseFloat(selectedAccount.current_outstanding_balance as any) > 0 ? 'Outstanding Balance Detected' : 'Overpaid — You Owe This Client'}
                    </span>
                    <span className={`block mt-0.5 font-normal ${parseFloat(selectedAccount.current_outstanding_balance as any) > 0 ? 'text-rose-700' : 'text-sky-700'}`}>
                      {parseFloat(selectedAccount.current_outstanding_balance as any) > 0
                        ? `Client owes ₹${parseFloat(selectedAccount.current_outstanding_balance as any).toFixed(2)}. Accounts with non-zero balances cannot be deleted.`
                        : `You owe this client ₹${Math.abs(parseFloat(selectedAccount.current_outstanding_balance as any)).toFixed(2)}. Settle the balance to zero before deleting.`
                      }
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800 text-xs font-semibold">
                  <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <span className="block font-bold">Safe to Delete</span>
                    <span className="block mt-0.5 font-normal text-emerald-700">Balance is fully settled. Deletion will permanently erase all records.</span>
                  </div>
                </div>
              )}
              {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer" disabled={isSubmitting}>Cancel</button>
                <button type="button" onClick={handleDeleteSubmit} disabled={isSubmitting || parseFloat(selectedAccount.current_outstanding_balance as any) !== 0}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  {isSubmitting ? 'Deleting...' : 'Confirm Deletion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
