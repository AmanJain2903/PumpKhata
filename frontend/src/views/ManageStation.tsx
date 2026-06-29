import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { FuelPump, Tank, Machine, Nozzle, Product, CreditAccount } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { SmartDropdown } from '../components/SmartDropdown';

interface ManageStationProps {
  pumpId: number;
  onBack: () => void;
  onLogout: () => void;
}

export const ManageStation: React.FC<ManageStationProps> = ({ pumpId, onBack, onLogout }) => {
  const [pump, setPump] = useState<FuelPump | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [customProductColors, setCustomProductColors] = useState<Record<string, any>>({});

  // Interactive customization state hooks
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTanks, setDraftTanks] = useState<any[]>([]);
  const [draftMachines, setDraftMachines] = useState<any[]>([]);
  const [draftNozzles, setDraftNozzles] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Tank Edit Modal states
  const [editingTank, setEditingTank] = useState<any | null>(null);
  const [isTankModalOpen, setIsTankModalOpen] = useState(false);
  const [tankName, setTankName] = useState('');
  const [tankProductId, setTankProductId] = useState<number>(0);
  const [tankMaxCapacity, setTankMaxCapacity] = useState('');
  const [tankDipVolume, setTankDipVolume] = useState('');
  const [tankVariance, setTankVariance] = useState('');

  // Interactive hover states for highlighting connections
  const [hoveredTankId, setHoveredTankId] = useState<number | null>(null);
  const [hoveredNozzleId, setHoveredNozzleId] = useState<number | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  // Delete Pump (Station) states
  const [isDeletePumpModalOpen, setIsDeletePumpModalOpen] = useState(false);
  const [deletePumpStep, setDeletePumpStep] = useState<1 | 2>(1);
  const [isDeletingPump, setIsDeletingPump] = useState(false);
  const [deletePumpError, setDeletePumpError] = useState('');
  const [isCheckingBalances, setIsCheckingBalances] = useState(false);
  const [unclearedAccounts, setUnclearedAccounts] = useState<CreditAccount[]>([]);

  // Renaming Fuel Pump states
  const [isEditingPumpName, setIsEditingPumpName] = useState(false);
  const [pumpNameInput, setPumpNameInput] = useState('');
  const [isSavingPumpName, setIsSavingPumpName] = useState(false);

  // Scroll to top on component mount or pumpId change
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
  }, [pumpId]);

  // Scroll to top when loading state finishes and station content renders
  useEffect(() => {
    if (!isLoading) {
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
    }
  }, [isLoading]);

  // Lock body scroll when any modal (tank edit or delete station) is open
  const anyModalOpen = isTankModalOpen || isDeletePumpModalOpen;
  useBodyScrollLock(anyModalOpen);


  useEffect(() => {
    fetchStationConfig();
  }, [pumpId]);

  const handleToggleStationActive = async () => {
    if (!pump) return;
    setIsTogglingActive(true);
    try {
      const nextActive = !pump.is_active;
      await apiService.updatePump(pump.id, { is_active: nextActive });
      await fetchStationConfig();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to toggle station status');
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleOpenDeletePumpModal = async () => {
    setIsCheckingBalances(true);
    setDeletePumpError('');
    setUnclearedAccounts([]);
    setDeletePumpStep(1);
    setIsDeletingPump(false);
    setIsDeletePumpModalOpen(true);
    try {
      const accounts = await apiService.getCreditAccounts(pumpId);
      const uncleared = accounts.filter(acc => parseFloat(acc.current_outstanding_balance as any) !== 0);
      setUnclearedAccounts(uncleared);
    } catch (err: any) {
      setDeletePumpError(err.message || 'Failed to check B2B credit accounts balance.');
    } finally {
      setIsCheckingBalances(false);
    }
  };

  const handleConfirmDeletePump = async () => {
    if (!pump) return;
    if (deletePumpStep === 1) {
      setDeletePumpStep(2);
      return;
    }

    setIsDeletingPump(true);
    setDeletePumpError('');
    try {
      await apiService.deletePump(pump.id);
      setIsDeletePumpModalOpen(false);
      onBack();
    } catch (err: any) {
      setDeletePumpError(err.message || 'Failed to delete fuel pump station.');
    } finally {
      setIsDeletingPump(false);
    }
  };

  const handleStartRenamePump = () => {
    if (!pump) return;
    setPumpNameInput(pump.name);
    setIsEditingPumpName(false); // set to edit mode
    setIsEditingPumpName(true);
  };

  const handleSaveRenamePump = async () => {
    if (!pump || !pumpNameInput.trim()) return;
    setIsSavingPumpName(true);
    try {
      await apiService.updatePump(pump.id, { name: pumpNameInput.trim() });
      await fetchStationConfig();
      setIsEditingPumpName(false);
    } catch (err: any) {
      alert(err.message || 'Failed to rename fuel pump station.');
    } finally {
      setIsSavingPumpName(false);
    }
  };

  const fetchStationConfig = async () => {
    setIsLoading(true);
    setError('');
    try {
      const config = await apiService.getPumpConfig(pumpId);
      setPump(config.pump);

      // Sort tanks alphabetically
      const sortedTanks = [...config.tanks].sort((a, b) => a.name.localeCompare(b.name));
      setTanks(sortedTanks);

      // Sort machines alphabetically
      const sortedMachines = [...config.machines].sort((a, b) => a.name.localeCompare(b.name));
      setMachines(sortedMachines);

      // Set nozzles list
      const configNozzles = config.nozzles || [];
      setNozzles(configNozzles);

      // Save products list
      setProducts(config.products || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch station forecourt configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-map unique custom product colors dynamically when tanks/drafts change
  useEffect(() => {
    const altPalettes = [
      {
        bg: 'bg-violet-500',
        text: 'text-violet-750',
        border: 'border-violet-500',
        inactiveBorder: 'border-violet-200/80',
        lightBg: 'bg-violet-50',
        fillColor: '#8b5cf6',
        glow: 'shadow-violet-500/30 shadow-lg',
        ringColor: 'ring-violet-500/40'
      },
      {
        bg: 'bg-sky-500',
        text: 'text-sky-750',
        border: 'border-sky-500',
        inactiveBorder: 'border-sky-200/80',
        lightBg: 'bg-sky-50',
        fillColor: '#0ea5e9',
        glow: 'shadow-sky-500/30 shadow-lg',
        ringColor: 'ring-sky-500/40'
      },
      {
        bg: 'bg-teal-500',
        text: 'text-teal-750',
        border: 'border-teal-500',
        inactiveBorder: 'border-teal-200/80',
        lightBg: 'bg-teal-50',
        fillColor: '#14b8a6',
        glow: 'shadow-teal-500/30 shadow-lg',
        ringColor: 'ring-teal-500/40'
      },
      {
        bg: 'bg-orange-500',
        text: 'text-orange-750',
        border: 'border-orange-500',
        inactiveBorder: 'border-orange-200/80',
        lightBg: 'bg-orange-50',
        fillColor: '#f97316',
        glow: 'shadow-orange-500/30 shadow-lg',
        ringColor: 'ring-orange-500/40'
      },
      {
        bg: 'bg-fuchsia-500',
        text: 'text-fuchsia-750',
        border: 'border-fuchsia-500',
        inactiveBorder: 'border-fuchsia-200/80',
        lightBg: 'bg-fuchsia-50',
        fillColor: '#d946ef',
        glow: 'shadow-fuchsia-500/30 shadow-lg',
        ringColor: 'ring-fuchsia-500/40'
      },
      {
        bg: 'bg-pink-500',
        text: 'text-pink-750',
        border: 'border-pink-500',
        inactiveBorder: 'border-pink-200/80',
        lightBg: 'bg-pink-50',
        fillColor: '#ec4899',
        glow: 'shadow-pink-500/30 shadow-lg',
        ringColor: 'ring-pink-500/40'
      }
    ];

    const mapping: Record<string, any> = {};
    let altIndex = 0;

    const sourceTanks = isEditing ? draftTanks : tanks;
    const sourceNozzles = isEditing ? draftNozzles : nozzles;

    const uniqueProds = new Set<string>();
    sourceTanks.forEach((t) => {
      if (t.product_name) uniqueProds.add(t.product_name);
    });
    sourceNozzles.forEach((n) => {
      if (n.product_name) uniqueProds.add(n.product_name);
    });

    uniqueProds.forEach((prodName) => {
      const uName = prodName.toUpperCase();
      const isHsd = uName.includes('DIESEL') || uName.includes('HSD');
      const isXp = uName.includes('XP95') || uName.includes('PREMIUM') || uName.includes('SPEED');
      const isMs = uName.includes('MS') || uName.includes('PETROL');

      if (!isHsd && !isXp && !isMs) {
        mapping[prodName] = altPalettes[altIndex % altPalettes.length];
        altIndex++;
      }
    });

    setCustomProductColors(mapping);
  }, [tanks, draftTanks, nozzles, draftNozzles, isEditing]);

  // Helper to get color code based on fuel/product name
  const getProductColor = (productName: string) => {
    const name = productName.toUpperCase();
    if (name.includes('DIESEL') || name.includes('HSD')) {
      return {
        bg: 'bg-indigo-500',
        text: 'text-indigo-700',
        border: 'border-indigo-500',
        inactiveBorder: 'border-indigo-200/80',
        lightBg: 'bg-indigo-50',
        fillColor: '#6366f1',
        glow: 'shadow-indigo-500/30 shadow-lg',
        ringColor: 'ring-indigo-500/40'
      };
    }
    if (name.includes('XP95') || name.includes('PREMIUM') || name.includes('SPEED')) {
      return {
        bg: 'bg-rose-500',
        text: 'text-rose-750',
        border: 'border-rose-500',
        inactiveBorder: 'border-rose-200/80',
        lightBg: 'bg-rose-50',
        fillColor: '#f43f5e',
        glow: 'shadow-rose-500/30 shadow-lg',
        ringColor: 'ring-rose-500/40'
      };
    }
    if (name.includes('MS') || name.includes('PETROL')) {
      return {
        bg: 'bg-amber-500',
        text: 'text-amber-700',
        border: 'border-amber-500',
        inactiveBorder: 'border-amber-200/80',
        lightBg: 'bg-amber-50',
        fillColor: '#f59e0b',
        glow: 'shadow-amber-500/30 shadow-lg',
        ringColor: 'ring-amber-500/40'
      };
    }

    if (name.includes('XG') || name.includes('GREEN')) {
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-700',
        border: 'border-emerald-500',
        inactiveBorder: 'border-emerald-200/80',
        lightBg: 'bg-emerald-50',
        fillColor: '#10b981',
        glow: 'shadow-emerald-500/30 shadow-lg',
        ringColor: 'ring-emerald-500/40'
      };
    }

    // Look up custom mapped colors first
    if (customProductColors[productName]) {
      return customProductColors[productName];
    }

    // Default fallback
    return {
      bg: 'bg-orange-500',
      text: 'text-orange-750',
      border: 'border-orange-500',
      inactiveBorder: 'border-orange-200/80',
      lightBg: 'bg-orange-50',
      fillColor: '#f97316',
      glow: 'shadow-orange-500/30 shadow-lg',
      ringColor: 'ring-orange-500/40'
    };
  };

  // Determine if a nozzle connects to the currently hovered tank
  const isNozzleHighlighted = (nozzle: Nozzle) => {
    if (nozzle.is_active === false) return false;
    if (hoveredNozzleId === nozzle.id) return true;
    if (hoveredTankId !== null && nozzle.tank_id === hoveredTankId) return true;
    return false;
  };

  // Determine if a tank connects to the currently hovered nozzle
  const isTankHighlighted = (tankId: number | string) => {
    if (hoveredTankId === tankId) return true;
    if (hoveredNozzleId !== null) {
      const activeNozzlesList = isEditing ? draftNozzles : nozzles;
      const activeNozzle = activeNozzlesList.find(n => n.id === hoveredNozzleId || n.temp_id === hoveredNozzleId);
      if (activeNozzle && activeNozzle.is_active !== false && activeNozzle.tank_id === tankId) return true;
    }
    return false;
  };

  // --- Edit Mode Event Handlers ---
  const handleStartEdit = () => {
    setDraftTanks(tanks.map(t => ({ ...t })));
    setDraftMachines(machines.map(m => ({ ...m })));
    setDraftNozzles(nozzles.map(n => ({ ...n })));
    setValidationErrors([]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setValidationErrors([]);
  };

  // --- Tank Editing Operations ---
  const handleOpenAddTankModal = () => {
    setEditingTank(null);
    setTankName('');
    setTankProductId(products[0]?.id || 0);
    setTankMaxCapacity('20000');
    setTankDipVolume('10000');
    setTankVariance('0');
    setIsTankModalOpen(true);
  };

  const handleOpenEditTankModal = (tank: any) => {
    setEditingTank(tank);
    setTankName(tank.name);
    setTankProductId(tank.product_id);
    setTankMaxCapacity((tank.max_capacity || 0).toString());
    setTankDipVolume((tank.actual_dip_volume || 0).toString());
    setTankVariance((tank.variance || 0).toString());
    setIsTankModalOpen(true);
  };

  const handleSaveTankModal = () => {
    const capacity = parseFloat(tankMaxCapacity);
    const dip = parseFloat(tankDipVolume) || 0;
    const variance = parseFloat(tankVariance) || 0;
    const prod = products.find(p => p.id === tankProductId);
    const productName = prod ? prod.name : 'Fuel';

    if (!tankName.trim()) {
      alert('Tank name cannot be empty.');
      return;
    }
    if (isNaN(capacity) || capacity <= 0) {
      alert('Max capacity must be a positive number.');
      return;
    }
    if (isNaN(dip) || dip < 0 || dip > capacity) {
      alert('Current volume must be between 0 and max capacity.');
      return;
    }

    if (editingTank) {
      // Update existing tank
      setDraftTanks(draftTanks.map(t => {
        const isMatch = (t.id && t.id === editingTank.id) || (t.temp_id && t.temp_id === editingTank.temp_id);
        if (isMatch) {
          return {
            ...t,
            name: tankName,
            product_id: tankProductId,
            product_name: productName,
            max_capacity: capacity,
            actual_dip_volume: dip,
            variance: variance
          };
        }
        return t;
      }));
    } else {
      // Add new tank
      const newTank = {
        temp_id: `temp-t-${Date.now()}`,
        name: tankName,
        product_id: tankProductId,
        product_name: productName,
        max_capacity: capacity,
        actual_dip_volume: dip,
        variance: variance
      };
      setDraftTanks([...draftTanks, newTank]);
    }
    setIsTankModalOpen(false);
  };

  const handleDeleteTank = (tank: any) => {
    const key = tank.id || tank.temp_id;
    // Remove tank
    setDraftTanks(draftTanks.filter(t => (t.id || t.temp_id) !== key));
    // Disconnect nozzles linked to this tank
    setDraftNozzles(draftNozzles.map(n => {
      if (n.tank_id === key) {
        return { ...n, tank_id: '' };
      }
      return n;
    }));
  };

  // --- Machine Forecourt Operations ---
  const handleAddMachine = () => {
    const tempId = `temp-m-${Date.now()}`;
    const newMach = {
      temp_id: tempId,
      name: `Dispenser ${draftMachines.length + 1}`,
      number_of_nozzles: 1
    };
    setDraftMachines([...draftMachines, newMach]);

    // Automatically seed 1 default nozzle for the new dispenser linked to first tank
    const firstTank = draftTanks[0];
    const newNozzle = {
      temp_id: `temp-n-${Date.now()}`,
      machine_temp_id: tempId,
      name: 'Nozzle 1',
      tank_id: firstTank ? (firstTank.id || firstTank.temp_id) : '',
      opening_reading: 0,
      product_name: firstTank ? firstTank.product_name : '',
      product_price: firstTank ? getProductPriceById(firstTank.product_id) : 0
    };
    setDraftNozzles([...draftNozzles, newNozzle]);
  };

  const handleRenameMachine = (mach: any, name: string) => {
    setDraftMachines(draftMachines.map(m => {
      const isMatch = (m.id && m.id === mach.id) || (m.temp_id && m.temp_id === mach.temp_id);
      return isMatch ? { ...m, name } : m;
    }));
  };

  const handleDeleteMachine = (mach: any) => {
    const key = mach.id || mach.temp_id;
    setDraftMachines(draftMachines.filter(m => (m.id || m.temp_id) !== key));
    // Delete connected nozzles
    setDraftNozzles(draftNozzles.filter(n => n.machine_id !== key && n.machine_temp_id !== key));
  };

  // --- Nozzle Editing Operations ---
  const handleAddNewNozzle = (mach: any) => {
    const machKey = mach.id || mach.temp_id;
    const machNozzles = draftNozzles.filter(n => n.machine_id === machKey || n.machine_temp_id === machKey);
    const firstTank = draftTanks[0];

    const newNozzle = {
      temp_id: `temp-n-${Date.now()}`,
      machine_id: mach.id || undefined,
      machine_temp_id: mach.temp_id || undefined,
      name: `Nozzle ${machNozzles.length + 1}`,
      tank_id: firstTank ? (firstTank.id || firstTank.temp_id) : '',
      opening_reading: 0,
      product_name: firstTank ? firstTank.product_name : '',
      product_price: firstTank ? getProductPriceById(firstTank.product_id) : 0
    };
    setDraftNozzles([...draftNozzles, newNozzle]);
  };

  const handleRenameNozzle = (nozzleId: string | number, name: string) => {
    setDraftNozzles(draftNozzles.map(n => {
      const isMatch = (n.id && n.id === nozzleId) || (n.temp_id && n.temp_id === nozzleId);
      return isMatch ? { ...n, name } : n;
    }));
  };

  const handleReconnectNozzle = (nozzleId: string | number, newTankId: string | number) => {
    const parsedId = typeof newTankId === 'string' && !newTankId.startsWith('temp-')
      ? parseInt(newTankId, 10)
      : newTankId;

    const tank = draftTanks.find(t => (t.id || t.temp_id) === parsedId);

    setDraftNozzles(draftNozzles.map(n => {
      const isMatch = (n.id && n.id === nozzleId) || (n.temp_id && n.temp_id === nozzleId);
      if (isMatch) {
        return {
          ...n,
          tank_id: parsedId,
          tank_name: tank ? tank.name : '',
          product_name: tank ? tank.product_name : '',
          product_price: tank ? getProductPriceById(tank.product_id) : 0
        };
      }
      return n;
    }));
  };

  const handleNozzleReadingChange = (nozzleId: string | number, val: number) => {
    setDraftNozzles(draftNozzles.map(n => {
      const isMatch = (n.id && n.id === nozzleId) || (n.temp_id && n.temp_id === nozzleId);
      return isMatch ? { ...n, opening_reading: val } : n;
    }));
  };

  const handleDeleteNozzle = (nozzleId: string | number) => {
    setDraftNozzles(draftNozzles.filter(n => (n.id || n.temp_id) !== nozzleId));
  };

  const handleToggleMachineActive = (machKey: string | number, currentActive: boolean) => {
    const nextActive = !currentActive;

    // Update machine
    setDraftMachines(draftMachines.map(m => {
      const isMatch = (m.id && m.id === machKey) || (m.temp_id && m.temp_id === machKey);
      return isMatch ? { ...m, is_active: nextActive } : m;
    }));

    // Cascade active status to nozzles automatically
    setDraftNozzles(draftNozzles.map(n => {
      const belongs = n.machine_id === machKey || n.machine_temp_id === machKey;
      return belongs ? { ...n, is_active: nextActive } : n;
    }));
  };

  const handleToggleNozzleActive = (nozzleKey: string | number, currentActive: boolean) => {
    const nextActive = !currentActive;

    // Update target nozzle status
    const updatedNozzles = draftNozzles.map(n => {
      const isMatch = (n.id && n.id === nozzleKey) || (n.temp_id && n.temp_id === nozzleKey);
      return isMatch ? { ...n, is_active: nextActive } : n;
    });

    setDraftNozzles(updatedNozzles);

    // Find the target nozzle to get parent machine key
    const targetNozzle = draftNozzles.find(n => (n.id && n.id === nozzleKey) || (n.temp_id && n.temp_id === nozzleKey));
    if (targetNozzle) {
      const parentMachKey = targetNozzle.machine_id || targetNozzle.machine_temp_id;
      if (parentMachKey) {
        if (nextActive) {
          // If nozzle becomes active, make parent machine active too
          setDraftMachines(draftMachines.map(m => {
            const isMatch = (m.id && m.id === parentMachKey) || (m.temp_id && m.temp_id === parentMachKey);
            return isMatch ? { ...m, is_active: true } : m;
          }));
        } else {
          // If nozzle becomes inactive, check if all nozzles of the parent machine are now inactive
          const parentMachNozzles = updatedNozzles.filter(n => n.machine_id === parentMachKey || n.machine_temp_id === parentMachKey);
          const allInactive = parentMachNozzles.every(n => !n.is_active);
          if (allInactive) {
            // Make parent machine inactive
            setDraftMachines(draftMachines.map(m => {
              const isMatch = (m.id && m.id === parentMachKey) || (m.temp_id && m.temp_id === parentMachKey);
              return isMatch ? { ...m, is_active: false } : m;
            }));
          }
        }
      }
    }
  };

  const getProductPriceById = (productId: number) => {
    const prod = products.find(p => p.id === productId);
    return prod ? prod.current_price : 0;
  };

  // --- Validation & Atomic Submission ---
  const runValidationChecks = (): string[] => {
    const errors: string[] = [];

    // 1. Tanks Validation
    if (draftTanks.length === 0) {
      errors.push('At least one Underground Tank must be configured.');
    }
    draftTanks.forEach(t => {
      if (!t.name.trim()) {
        errors.push('Tank label cannot be empty.');
      }
      if (t.max_capacity <= 0) {
        errors.push(`Tank "${t.name}" must have a positive capacity.`);
      }
      if (t.actual_dip_volume < 0 || t.actual_dip_volume > t.max_capacity) {
        errors.push(`Tank "${t.name}" current fuel volume must not exceed its max capacity.`);
      }
    });

    // 2. Dispenser Units Validation
    if (draftMachines.length === 0) {
      errors.push('At least one Dispenser Forecourt Machine must be configured.');
    }
    draftMachines.forEach(m => {
      if (!m.name.trim()) {
        errors.push('Dispenser machine label/name cannot be empty.');
      }
      const machNozzles = draftNozzles.filter(n => (m.id && n.machine_id === m.id) || (m.temp_id && n.machine_temp_id === m.temp_id));
      if (machNozzles.length === 0) {
        errors.push(`Dispenser unit "${m.name}" must contain at least one nozzle connection.`);
      }
    });

    // 3. Nozzle Wiring Connectivity Validation
    draftNozzles.forEach(n => {
      if (!n.name.trim()) {
        errors.push('Nozzle label cannot be empty.');
      }
      if (!n.tank_id) {
        const parentName = draftMachines.find(m => m.id === n.machine_id || m.temp_id === n.machine_temp_id)?.name || 'Dispenser';
        errors.push(`Nozzle "${n.name}" inside "${parentName}" must be connected to an underground tank.`);
      }
    });

    return errors;
  };

  const handleSaveConfiguration = async () => {
    const errors = runValidationChecks();
    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSaving(true);
    setValidationErrors([]);
    try {
      const payloadTanks = draftTanks.map(t => ({
        id: t.id || null,
        temp_id: t.temp_id || null,
        name: t.name,
        product_id: t.product_id,
        max_capacity: t.max_capacity,
        actual_dip_volume: t.actual_dip_volume,
        variance: t.variance || 0
      }));

      const payloadMachines = draftMachines.map(m => {
        const machineNozzles = draftNozzles.filter(n => (m.id && n.machine_id === m.id) || (m.temp_id && n.machine_temp_id === m.temp_id));
        return {
          id: m.id || null,
          temp_id: m.temp_id || null,
          name: m.name,
          is_active: m.is_active !== false,
          nozzles: machineNozzles.map(n => ({
            id: n.id || null,
            name: n.name,
            tank_id: n.tank_id, // Union[int, str]
            opening_reading: n.opening_reading || 0,
            is_active: n.is_active !== false
          }))
        };
      });

      await apiService.updatePumpConfig(pumpId, {
        tanks: payloadTanks,
        machines: payloadMachines
      });

      // Reload config & exit edit mode
      await fetchStationConfig();
      setIsEditing(false);
    } catch (err: any) {
      setValidationErrors([err.message || 'Failed to update station forecourt layout configuration.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans relative overflow-x-hidden">
      {/* Light-theme ambient decorative glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[550px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky Top Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div
              onClick={onBack}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-400 to-emerald-400 via-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/10">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 6a2 2 0 012-2h6a2 2 0 012 2v14H5V6zm3 3h4v3H8V9zm8 2h1.5a1.5 1.5 0 011.5 1.5v3.75c0 .966.534 1.75 1.25 1.75s1.25-.784 1.25-1.75V6M3 20h14" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-400 via-emerald-600 bg-clip-text text-transparent font-display">
                PumpKhata
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={onLogout}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-sm cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Workspace Container */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 w-full">
        {/* Navigation Breadcrumb, title, and action edit modes */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
              <button
                onClick={onBack}
                className="hover:text-emerald-600 transition-colors flex items-center gap-1 cursor-pointer"
              >
                Dashboard
              </button>
              <span>/</span>
              <span className="text-slate-800">{pump?.name || 'Loading...'}</span>
            </div>
            {isEditingPumpName ? (
              <div className="flex items-center gap-2 mt-1.5 animate-fadeIn">
                <input
                  type="text"
                  value={pumpNameInput}
                  onChange={(e) => setPumpNameInput(e.target.value)}
                  className="text-2xl font-bold text-slate-900 border border-slate-350 rounded-xl px-3 py-1 focus:outline-emerald-500 max-w-xs focus:ring-1 focus:ring-emerald-500 font-display"
                  disabled={isSavingPumpName}
                  placeholder="Enter station name..."
                  autoFocus
                />
                <button
                  onClick={handleSaveRenamePump}
                  disabled={isSavingPumpName || !pumpNameInput.trim()}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Save Name"
                >
                  {isSavingPumpName ? (
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setIsEditingPumpName(false)}
                  disabled={isSavingPumpName}
                  className="p-2 rounded-xl border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-550 transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-3">
                <span>{pump?.name || 'Manage Station'}</span>
                {pump && (
                  <button
                    onClick={handleStartRenamePump}
                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                    title="Rename Station"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {pump && pump.is_active === false && (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider select-none shrink-0 font-sans">
                    Inactive Station
                  </span>
                )}
              </h1>
            )}
            <p className="text-sm text-slate-500 mt-1">
              {pump?.location || 'Forecourt operations workspace'}
            </p>
          </div>

          {pump && (
            <div className="flex items-center gap-2.5 shrink-0">
              {pump.is_active === false ? (
                <button
                  onClick={handleToggleStationActive}
                  disabled={isTogglingActive}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer border border-emerald-650"
                >
                  Activate Station
                </button>
              ) : (
                <button
                  onClick={handleToggleStationActive}
                  disabled={isTogglingActive}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  Deactivate Station
                </button>
              )}
              <button
                onClick={handleOpenDeletePumpModal}
                disabled={isTogglingActive || isDeletingPump}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                Delete Station
              </button>
            </div>
          )}
        </div>

        {/* Validation Errors alert panel */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-5 bg-rose-50 border border-rose-150 rounded-2xl text-rose-800 animate-fadeIn">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>⚠️ Configuration Validation Failed</span>
            </h4>
            <ul className="list-disc list-inside text-xs space-y-1.5">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="font-semibold">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tab Workspaces */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <svg className="animate-spin h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-slate-500 text-sm mt-4 font-semibold">Retrieving forecourt configuration...</span>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 text-sm text-rose-600 rounded-3xl shadow-sm">
            {error}
          </div>
        ) : (
          <div className="space-y-8 animate-scaleIn">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-6 gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Station Map</h3>
                  <p className="text-xs text-slate-450 mt-0.5">
                    {isEditing
                      ? 'Customizing layout. Save changes to commit to database.'
                      : pump?.is_active === false
                        ? 'This station is currently inactive. Re-activate to resume daily logs and highlighted operations.'
                        : 'Hover over a tank or nozzle to highlight physical connections'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveConfiguration}
                        disabled={isSaving}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-650 hover:to-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        {isSaving && (
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                        Save Layout Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStartEdit}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit Station Map
                    </button>
                  )}
                </div>
              </div>

              {tanks.length === 0 && !isEditing ? (
                <div className="text-center py-16 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-500 font-semibold">No equipment configured for this pump station.</p>
                </div>
              ) : isEditing ? (
                <div className="space-y-8 relative min-h-[480px]">

                  {/* 1. Storage Tanks Section (Top Stack) */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-2">
                      Underground Tanks
                    </span>

                    <div className="grid grid-cols-1 gap-4">
                      {draftTanks.map((tank) => {
                        const productColors = getProductColor(tank.product_name || '');
                        const fillPercent = Math.min(100, Math.max(0, (tank.actual_dip_volume / tank.max_capacity) * 100));
                        const isHighlighted = isTankHighlighted(tank.id || tank.temp_id);
                        const varianceVal = parseFloat(tank.variance as any) || 0;

                        return (
                          <div
                            key={tank.id || tank.temp_id}
                            onMouseEnter={() => setHoveredTankId(tank.id || tank.temp_id)}
                            onMouseLeave={() => setHoveredTankId(null)}
                            className={`group relative p-5 rounded-2xl bg-white border transition-all duration-300 select-none ${isHighlighted
                              ? `${productColors.border} ring-2 ring-inset ${productColors.ringColor} shadow-md`
                              : `${productColors.inactiveBorder} hover:border-slate-350 shadow-sm`
                              }`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                              {/* Left details */}
                              <div className="flex items-center gap-4 min-w-[200px]">
                                <div>
                                  <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">{tank.name}</h4>
                                  <span className={`inline-block text-[9px] font-extrabold mt-1 px-2 py-0.5 rounded border ${productColors.text} ${productColors.lightBg} ${productColors.border}`}>
                                    {tank.product_name}
                                  </span>
                                </div>

                                {varianceVal !== 0 && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${varianceVal > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                    : 'bg-rose-50 text-rose-700 border-rose-250'
                                    }`}>
                                    {varianceVal > 0 ? `+${varianceVal.toFixed(1)} L` : `${varianceVal.toFixed(1)} L`}
                                  </span>
                                )}
                              </div>

                              {/* Center Level Fill cylinder */}
                              <div className="flex-grow max-w-xl space-y-1.5 w-full">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                  <span>Level</span>
                                  <span>{fillPercent.toFixed(1)}% Filled</span>
                                </div>

                                <div className="h-6 w-full rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative shadow-inner">
                                  <div
                                    className={`absolute top-0 bottom-0 left-0 rounded-r-md transition-all duration-700 ${productColors.bg}`}
                                    style={{ width: `${fillPercent}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-slate-700 mix-blend-difference tracking-wider font-sans">
                                    {parseFloat(tank.actual_dip_volume as any).toLocaleString()} / {parseFloat(tank.max_capacity as any).toLocaleString()} Ltrs
                                  </div>
                                </div>
                              </div>

                              {/* Tank configuration buttons */}
                              <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                                <button
                                  onClick={() => handleOpenEditTankModal(tank)}
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-650 transition-colors border border-slate-200 cursor-pointer shadow-sm"
                                  title="Edit Tank Details"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteTank(tank)}
                                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-colors cursor-pointer shadow-sm"
                                  title="Delete Tank"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleOpenAddTankModal}
                      className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-250 hover:border-emerald-500 hover:bg-emerald-50/20 text-slate-500 hover:text-emerald-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Storage Tank
                    </button>
                  </div>

                  {/* Dispenser Units Section (Bottom Stack) */}
                  <div className="space-y-4 pt-8 border-t border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-2">
                      Dispenser Units
                    </span>

                    <div className="grid grid-cols-1 gap-6">
                      {draftMachines.map((mach) => {
                        const machKey = mach.id || mach.temp_id;
                        const machineNozzles = draftNozzles.filter(n => (mach.id && n.machine_id === mach.id) || (mach.temp_id && n.machine_temp_id === mach.temp_id));

                        return (
                          <div
                            key={machKey}
                            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative animate-fadeIn"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <input
                                type="text"
                                value={mach.name}
                                onChange={(e) => handleRenameMachine(mach, e.target.value)}
                                className="text-sm font-extrabold text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-grow bg-slate-50 focus:bg-white focus:outline-emerald-500 w-full"
                              />

                              <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto">
                                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer select-none shrink-0 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors shadow-sm">
                                  <input
                                    type="checkbox"
                                    checked={mach.is_active !== false}
                                    onChange={() => handleToggleMachineActive(machKey, mach.is_active !== false)}
                                    className="accent-emerald-600 cursor-pointer"
                                  />
                                  <span>Active</span>
                                </label>

                                <button
                                  onClick={() => handleDeleteMachine(mach)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-colors cursor-pointer shadow-sm"
                                  title="Delete Dispenser"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                              {machineNozzles.map((nozzle) => {
                                const nozzleKey = nozzle.id || nozzle.temp_id;
                                const colors = getProductColor(nozzle.product_name || '');
                                const isHighlighted = isNozzleHighlighted(nozzle);

                                return (
                                  <div
                                    key={nozzleKey}
                                    onMouseEnter={() => setHoveredNozzleId(nozzleKey)}
                                    onMouseLeave={() => setHoveredNozzleId(null)}
                                    className={`p-4 rounded-xl border transition-all duration-300 select-none ${isHighlighted
                                      ? `${colors.border} ${colors.lightBg} ring-2 ring-inset ${colors.ringColor} shadow-sm`
                                      : 'border-slate-150 bg-slate-50 hover:bg-white hover:border-slate-300'
                                      } ${nozzle.is_active === false ? 'opacity-65 bg-slate-105/50 border-slate-200' : ''}`}
                                  >
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <input
                                          type="text"
                                          value={nozzle.name}
                                          onChange={(e) => handleRenameNozzle(nozzleKey, e.target.value)}
                                          className="text-xs font-bold text-slate-700 border border-slate-200 rounded px-2 py-1 w-full bg-white focus:outline-emerald-500"
                                          placeholder="Nozzle Label"
                                          disabled={nozzle.is_active === false}
                                        />

                                        <input
                                          type="checkbox"
                                          checked={nozzle.is_active !== false}
                                          onChange={() => handleToggleNozzleActive(nozzleKey, nozzle.is_active !== false)}
                                          className="accent-emerald-600 cursor-pointer shrink-0 w-3.5 h-3.5"
                                          title="Toggle Nozzle Active Status"
                                        />

                                        <button
                                          onClick={() => handleDeleteNozzle(nozzleKey)}
                                          className="text-slate-400 hover:text-rose-650 transition-colors cursor-pointer shrink-0"
                                          title="Delete Nozzle"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>

                                      {nozzle.is_active !== false ? (
                                        <>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wide block">Tank Source</label>
                                            <SmartDropdown
                                              value={nozzle.tank_id?.toString() || ''}
                                              onChange={(val) => handleReconnectNozzle(nozzleKey, val)}
                                              placeholder="-- Disconnected --"
                                              options={[
                                                { value: '', label: '-- Disconnected --' },
                                                ...draftTanks.map(t => ({
                                                  value: (t.id || t.temp_id).toString(),
                                                  label: `${t.name} (${t.product_name})`,
                                                }))
                                              ]}
                                              className="!rounded-lg !py-1.5"
                                            />
                                          </div>

                                          <div className="space-y-1">
                                            <label className="text-[9px] font-extrabold text-slate-455 uppercase tracking-wide block">Base Meter Reading</label>
                                            <input
                                              type="number"
                                              value={nozzle.opening_reading || 0}
                                              onChange={(e) => handleNozzleReadingChange(nozzleKey, parseFloat(e.target.value) || 0)}
                                              className="w-full text-xs border border-slate-200 rounded p-1.5 focus:outline-emerald-500"
                                              min="0"
                                              placeholder="Last shift closing reading"
                                            />
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-[10px] text-slate-400 italic text-center py-2.5 font-bold bg-slate-100 rounded-lg border border-slate-200">
                                          Inactive Nozzle
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
                              <button
                                onClick={() => handleAddNewNozzle(mach)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Nozzle
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleAddMachine}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-250 hover:border-emerald-500 hover:bg-emerald-50/20 text-slate-500 hover:text-emerald-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Dispenser Unit
                    </button>
                  </div>

                </div>
              ) : (
                /* 3-column map layout when viewing */
                <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative min-h-[480px] transition-all duration-300 ${pump?.is_active === false ? 'opacity-65 grayscale-[40%] pointer-events-none' : ''
                  }`}>

                  {/* 1. Storage Tanks Section (Left) */}
                  <div className="lg:col-span-4 space-y-6 flex flex-col justify-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-2">
                      Underground Tanks
                    </span>

                    {tanks.map((tank) => {
                      const productColors = getProductColor(tank.product_name || '');
                      const fillPercent = Math.min(100, Math.max(0, (tank.actual_dip_volume / tank.max_capacity) * 100));
                      const isHighlighted = isTankHighlighted(tank.id);
                      const varianceVal = parseFloat(tank.variance as any) || 0;

                      return (
                        <div
                          key={tank.id}
                          onMouseEnter={() => setHoveredTankId(tank.id)}
                          onMouseLeave={() => setHoveredTankId(null)}
                          className={`group relative p-5 rounded-2xl bg-white border transition-all duration-300 select-none ${isHighlighted
                            ? `${productColors.border} ring-2 ring-inset ${productColors.ringColor} shadow-md`
                            : `${productColors.inactiveBorder} hover:border-slate-350 shadow-sm`
                            }`}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">{tank.name}</h4>
                              <span className={`inline-block text-[9px] font-extrabold mt-1 px-2 py-0.5 rounded border ${productColors.text} ${productColors.lightBg} ${productColors.border}`}>
                                {tank.product_name}
                              </span>
                            </div>

                            {varianceVal !== 0 && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${varianceVal > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                : 'bg-rose-50 text-rose-700 border-rose-250'
                                }`}>
                                {varianceVal > 0 ? `+${varianceVal.toFixed(1)} L` : `${varianceVal.toFixed(1)} L`}
                              </span>
                            )}
                          </div>

                          {/* Cylindrical Tank Meter */}
                          <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span>Level</span>
                              <span>{fillPercent.toFixed(1)}% Filled</span>
                            </div>

                            <div className="h-6 w-full rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative shadow-inner">
                              <div
                                className={`absolute top-0 bottom-0 left-0 rounded-r-md transition-all duration-700 ${productColors.bg}`}
                                style={{ width: `${fillPercent}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-slate-700 mix-blend-difference tracking-wider font-sans">
                                {parseFloat(tank.actual_dip_volume as any).toLocaleString()} / {parseFloat(tank.max_capacity as any).toLocaleString()} Ltrs
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 2. Interactive Flow Pipeline Column (Middle) */}
                  <div className="hidden lg:col-span-3 lg:flex flex-col justify-around items-center py-10 relative select-none">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-2 w-full text-center">
                      Supply Lines
                    </span>

                    <div className="flex flex-col gap-6 justify-center items-center w-full flex-grow">
                      {tanks.map((tank) => {
                        const isTankHovered = hoveredTankId === tank.id;
                        const isNozzleConnecting = hoveredNozzleId !== null && nozzles.find(n => n.id === hoveredNozzleId)?.tank_id === tank.id;
                        const isActive = isTankHovered || isNozzleConnecting;
                        const colors = getProductColor(tank.product_name || '');

                        return (
                          <div
                            key={`line-${tank.id}`}
                            className={`w-4/5 h-2.5 rounded-full transition-all duration-500 ${isActive
                              ? `${colors.bg} scale-y-150 shadow-lg ring-1 ring-white/50 animate-pulse`
                              : `${colors.bg} opacity-20 hover:opacity-40`
                              }`}
                            title={`${tank.name} Pipeline (${tank.product_name})`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Forecourt Dispensers & Nozzles (Right) */}
                  <div className="lg:col-span-5 space-y-6 flex flex-col justify-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-2">
                      Dispenser Units
                    </span>

                    {machines.map((mach) => {
                      const machineNozzles = nozzles.filter(n => n.machine_id === mach.id);

                      return (
                        <div
                          key={mach.id}
                          className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 ${mach.is_active === false ? 'opacity-50 grayscale bg-slate-50 border-slate-200 shadow-none' : ''}`}
                        >
                          <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2.5 h-2.5 rounded-full ${mach.is_active === false ? 'bg-slate-300' : 'bg-emerald-500 shadow-sm shadow-emerald-500/25'}`} />
                              {mach.name}
                            </div>
                            {mach.is_active === false && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-550 border border-slate-200 uppercase tracking-wider shrink-0 select-none">
                                Inactive Dispenser
                              </span>
                            )}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {machineNozzles.map((nozzle) => {
                              const colors = getProductColor(nozzle.product_name || '');
                              const isHighlighted = isNozzleHighlighted(nozzle);

                              return (
                                <div
                                  key={nozzle.id}
                                  onMouseEnter={() => setHoveredNozzleId(nozzle.id)}
                                  onMouseLeave={() => setHoveredNozzleId(null)}
                                  className={`p-3.5 rounded-xl border transition-all duration-300 select-none ${isHighlighted
                                    ? `${colors.border} ${colors.lightBg} ring-2 ring-inset ${colors.ringColor} shadow-sm`
                                    : 'border-slate-150 bg-slate-50 hover:bg-white hover:border-slate-300'
                                    } ${nozzle.is_active === false ? 'opacity-50 grayscale bg-slate-100/50 cursor-not-allowed border-slate-200' : ''}`}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-slate-700">{nozzle.name}</span>
                                    {nozzle.is_active === false ? (
                                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-450 border border-slate-200 select-none font-sans">
                                        Inactive
                                      </span>
                                    ) : (
                                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${colors.text} ${colors.lightBg} border ${colors.border}`}>
                                        {nozzle.product_name || 'Fuel'}
                                      </span>
                                    )}
                                  </div>

                                  {nozzle.is_active !== false && (
                                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-455">
                                      <span className="font-extrabold text-slate-800">₹{parseFloat(nozzle.product_price as any || 0).toFixed(2)}/L</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Tank Configuration Modal */}
      {isTankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                {editingTank ? `Edit Tank: ${editingTank.name}` : 'Configure New Tank'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Configure storage metrics and dynamic fuel product</p>
            </div>

            <div className="space-y-4">
              {/* Tank Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Tank Label/Name</label>
                <input
                  type="text"
                  value={tankName}
                  onChange={(e) => setTankName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-emerald-500"
                  placeholder="e.g. Tank 1, Diesel Tank A"
                />
              </div>

              {/* Product Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Fuel Product</label>
                <SmartDropdown
                  value={tankProductId.toString()}
                  onChange={(val) => setTankProductId(parseInt(val, 10))}
                  placeholder="Select Fuel Product..."
                  options={products.map(p => ({
                    value: p.id.toString(),
                    label: `${p.name} (Current: ₹${parseFloat(p.current_price as any).toFixed(2)})`,
                  }))}
                />
              </div>

              {/* Capacity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Max Capacity (Litres)</label>
                <input
                  type="number"
                  value={tankMaxCapacity}
                  onChange={(e) => setTankMaxCapacity(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-emerald-500"
                  placeholder="e.g. 20000"
                  min="1"
                />
              </div>

              {/* Dip volume */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Current Dip Volume (Litres)</label>
                <input
                  type="number"
                  value={tankDipVolume}
                  onChange={(e) => setTankDipVolume(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-emerald-500"
                  placeholder="e.g. 10000"
                  min="0"
                />
              </div>

              {/* Starting variance */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Starting Variance (Litres)</label>
                <input
                  type="number"
                  value={tankVariance}
                  onChange={(e) => setTankVariance(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTankModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTankModal}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Station Confirmation Modal */}
      {isDeletePumpModalOpen && pump && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 relative animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 font-display">
                {deletePumpStep === 1 ? 'Delete Fuel Station' : '⚠️ Critical: Purge Confirmation'}
              </h3>
              <button
                onClick={() => setIsDeletePumpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                disabled={isDeletingPump}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {deletePumpError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-250 text-xs font-semibold text-rose-600">
                  {deletePumpError}
                </div>
              )}

              {isCheckingBalances ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-500 text-[11px] mt-2 font-semibold">Checking credit ledgers...</span>
                </div>
              ) : unclearedAccounts.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl space-y-3">
                    <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                      <span>⚠️ Uncleared Credit Balances Detected</span>
                    </p>
                    <p className="text-xs text-rose-650 leading-normal font-semibold">
                      The following B2B accounts have active balances at this station:
                    </p>
                    <div className="max-h-[140px] overflow-y-auto space-y-2 bg-white/60 p-2.5 rounded-xl border border-rose-100">
                      {unclearedAccounts.map(acc => {
                        const bal = parseFloat(acc.current_outstanding_balance as any);
                        return (
                          <div key={acc.id} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800">{acc.account_name}</span>
                            <span className={`font-extrabold ${bal > 0 ? 'text-amber-600' : 'text-sky-600'}`}>
                              {bal < 0 ? `-₹${Math.abs(bal).toFixed(2)}` : `₹${bal.toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-rose-500 leading-relaxed">
                      You must settle all credit accounts to ₹0.00 before you can delete this station.
                    </p>
                  </div>
                </div>
              ) : deletePumpStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Are you sure you want to delete <strong className="text-slate-800 font-bold">{pump.name}</strong>?
                  </p>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                    <p className="font-bold text-slate-700">💡 Important Note</p>
                    <p className="text-slate-500 leading-normal">
                      Create and export any financial, nozzle reading, or credit statement reports first. After this deletion, all historic records for this station will be permanently deleted and you will not be able to retrieve them.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-3">
                    <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                      <span>⚠️ High-Risk Data Loss Warning</span>
                    </p>
                    <p className="text-xs text-rose-605 leading-normal">
                      This action will permanently erase this station's:
                    </p>
                    <ul className="text-xs text-rose-600 list-disc list-inside space-y-1 pl-1 font-semibold">
                      <li>All Storage Tanks &amp; Dispenser Machines/Nozzles</li>
                      <li>All Credit Accounts &amp; Ledgers</li>
                      <li>All Daily Nozzle Readings &amp; Tank Dip logs</li>
                      <li>All Financial shift logs associated with this station</li>
                    </ul>
                    <p className="text-[11px] text-rose-500 italic font-medium">
                      This action is final. It cannot be undone.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeletePumpModalOpen(false)}
                  disabled={isDeletingPump}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePump}
                  disabled={isDeletingPump || isCheckingBalances || unclearedAccounts.length > 0}
                  className={`py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer ${unclearedAccounts.length > 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : deletePumpStep === 2
                      ? 'bg-rose-600 hover:bg-rose-750'
                      : 'bg-red-500 hover:bg-red-650'
                    }`}
                >
                  {isDeletingPump && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {unclearedAccounts.length > 0 ? 'Cannot Delete' : deletePumpStep === 1 ? 'Proceed' : 'Delete Station Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-slate-100/50 w-full shrink-0">
        <p>© 2026 PumpKhata Digital Ledger System. All rights reserved.</p>
      </footer>
    </div>
  );
};
