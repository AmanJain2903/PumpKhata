import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { FuelPump, Product } from '../services/api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { SmartDropdown } from '../components/SmartDropdown';
import { ManageProducts } from './ManageProducts';
import { ManageCreditAccounts } from './ManageCreditAccounts';

interface DashboardProps {
  onSelectPump: (pumpId: number) => void;
  onLogout: () => void;
}

// Temporary types for client-side wizard state
interface TempProduct {
  tempId: string;
  name: string;
  price: number;
  margin: number;
}

interface TankInput {
  tempId: string;
  name: string;
  maxCapacity: string;
  actualDipVolume: string; // Seeding base stock volume
  productId: string; // references database id or tempId (e.g. "temp-1")
}

interface NozzleInput {
  tempId: string;
  name: string;
  tankTempId: string; // references tankInput.tempId
  openingReading: string;
}

interface MachineInput {
  tempId: string;
  name: string;
  nozzles: NozzleInput[];
}

interface SubmitProgressState {
  step: number;
  text: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectPump, onLogout }) => {
  const [subView, setSubView] = useState<'home' | 'manage-products' | 'manage-credit-accounts'>('home');
  const [pumps, setPumps] = useState<FuelPump[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Registration Modal & Wizard states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<SubmitProgressState | null>(null);

  // Step 1: Pump basics
  const [newPumpName, setNewPumpName] = useState('');
  const [newPumpLocation, setNewPumpLocation] = useState('');

  // Step 2: Tanks list
  const [tanksList, setTanksList] = useState<TankInput[]>([
    { tempId: 't-1', name: 'Tank 1', maxCapacity: '20000', actualDipVolume: '10000', productId: '' }
  ]);

  // Inline product sub-form states
  const [inlineProductTankId, setInlineProductTankId] = useState<string | null>(null);
  const [inlineProductName, setInlineProductName] = useState('');
  const [inlineProductPrice, setInlineProductPrice] = useState('');
  const [inlineProductMargin, setInlineProductMargin] = useState('');
  const [inlineProductError, setInlineProductError] = useState('');

  // Client-side registered products created inline
  const [tempNewProducts, setTempNewProducts] = useState<TempProduct[]>([]);

  // Step 3: Machines list
  const [machinesList, setMachinesList] = useState<MachineInput[]>([
    {
      tempId: 'm-1',
      name: 'Dispenser 1',
      nozzles: [
        { tempId: 'n-1', name: 'Nozzle 1', tankTempId: '', openingReading: '0' }
      ]
    }
  ]);

  // Refs for scrolling containers
  const tanksContainerRef = useRef<HTMLDivElement>(null);
  const machinesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top on component mount or subView change
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
  }, [subView]);

  // Scroll to top when loading state finishes and dashboard content renders
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

  // Lock body scroll when registration modal is open
  useBodyScrollLock(isAddModalOpen);


  // Fetch pumps and products on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Scroll to bottom when a new tank is added
  useEffect(() => {
    if (tanksContainerRef.current) {
      tanksContainerRef.current.scrollTop = tanksContainerRef.current.scrollHeight;
    }
  }, [tanksList.length]);

  // Scroll inline product form into view smoothly
  useEffect(() => {
    if (inlineProductTankId) {
      setTimeout(() => {
        const el = document.getElementById(`inline-prod-form-${inlineProductTankId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 80);
    }
  }, [inlineProductTankId]);

  // Scroll to bottom when machines or nozzles count changes
  const totalNozzlesCount = machinesList.reduce((acc, m) => acc + m.nozzles.length, 0);
  useEffect(() => {
    if (machinesContainerRef.current) {
      machinesContainerRef.current.scrollTop = machinesContainerRef.current.scrollHeight;
    }
  }, [machinesList.length, totalNozzlesCount]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [pumpData, productData] = await Promise.all([
        apiService.getPumps(),
        apiService.getProducts()
      ]);
      setPumps(pumpData);
      setProducts(productData);
    } catch (e) {
      console.error('Error fetching dashboard data', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset wizard inputs
  const resetWizard = () => {
    setWizardStep(1);
    setNewPumpName('');
    setNewPumpLocation('');
    setTanksList([{ tempId: 't-1', name: 'Tank 1', maxCapacity: '20000', actualDipVolume: '10000', productId: '' }]);
    setMachinesList([
      {
        tempId: 'm-1',
        name: 'Dispenser 1',
        nozzles: [{ tempId: 'n-1', name: 'Nozzle 1', tankTempId: '', openingReading: '0' }]
      }
    ]);
    setTempNewProducts([]);
    setInlineProductTankId(null);
    setInlineProductName('');
    setInlineProductPrice('');
    setInlineProductMargin('');
    setInlineProductError('');
    setFormError('');
    setSubmitProgress(null);
  };

  // Dynamic products list combining DB products and inline temp ones
  const allAvailableProducts = [
    ...products,
    ...tempNewProducts.map(p => ({
      id: p.tempId as any, // Cast tempId string as number for visual dropdown
      name: p.name,
      current_price: p.price,
      current_margin: p.margin
    }))
  ];

  const getProductLabel = (productId: string) => {
    if (!productId) return 'Unselected';
    if (productId.startsWith('temp-')) {
      const temp = tempNewProducts.find(p => p.tempId === productId);
      return temp ? `${temp.name} (Temp)` : 'Inline Product';
    }
    const dbProduct = products.find(p => p.id.toString() === productId);
    return dbProduct ? dbProduct.name : 'Unknown Product';
  };

  // Inline product registration
  const handleRegisterInlineProduct = (tankTempId: string) => {
    if (!inlineProductName.trim()) {
      setInlineProductError('Product name is required');
      return;
    }
    const price = parseFloat(inlineProductPrice);
    const margin = parseFloat(inlineProductMargin);
    if (isNaN(price) || price <= 0) {
      setInlineProductError('Price must be positive');
      return;
    }
    if (isNaN(margin) || margin < 0) {
      setInlineProductError('Margin cannot be negative');
      return;
    }

    const newTempId = `temp-${Date.now()}`;
    const newTempProd: TempProduct = {
      tempId: newTempId,
      name: inlineProductName.trim(),
      price,
      margin
    };

    setTempNewProducts(prev => [...prev, newTempProd]);

    // Assign to select tank
    setTanksList(prev =>
      prev.map(t => (t.tempId === tankTempId ? { ...t, productId: newTempId } : t))
    );

    // Reset sub-form
    setInlineProductName('');
    setInlineProductPrice('');
    setInlineProductMargin('');
    setInlineProductError('');
    setInlineProductTankId(null);
    setFormError(''); // Clear general wizard warnings
  };

  // Tanks actions
  const handleAddTank = () => {
    setFormError('');
    const nextIndex = tanksList.length + 1;
    setTanksList(prev => [
      ...prev,
      { tempId: `t-${Date.now()}`, name: `Tank ${nextIndex}`, maxCapacity: '20000', actualDipVolume: '10000', productId: '' }
    ]);
  };

  const handleRemoveTank = (tempId: string) => {
    setFormError('');
    if (tanksList.length <= 1) return;
    setTanksList(prev => prev.filter(t => t.tempId !== tempId));
  };

  const updateTankField = (tempId: string, field: keyof TankInput, value: string) => {
    setFormError(''); // Clear error dynamically as user updates
    setTanksList(prev => prev.map(t => (t.tempId === tempId ? { ...t, [field]: value } : t)));
  };

  // Machines / Nozzles actions
  const handleAddMachine = () => {
    setFormError('');
    const nextIndex = machinesList.length + 1;
    setMachinesList(prev => [
      ...prev,
      {
        tempId: `m-${Date.now()}`,
        name: `Dispenser ${nextIndex}`,
        nozzles: [{ tempId: `n-${Date.now()}`, name: 'Nozzle 1', tankTempId: '', openingReading: '0' }]
      }
    ]);
  };

  const handleRemoveMachine = (tempId: string) => {
    setFormError('');
    if (machinesList.length <= 1) return;
    setMachinesList(prev => prev.filter(m => m.tempId !== tempId));
  };

  const updateMachineName = (tempId: string, name: string) => {
    setFormError(''); // Clear error dynamically
    setMachinesList(prev => prev.map(m => (m.tempId === tempId ? { ...m, name } : m)));
  };

  const handleAddNozzle = (machTempId: string) => {
    setFormError('');
    setMachinesList(prev =>
      prev.map(m => {
        if (m.tempId !== machTempId) return m;
        const nextIndex = m.nozzles.length + 1;
        return {
          ...m,
          nozzles: [
            ...m.nozzles,
            { tempId: `n-${Date.now()}`, name: `Nozzle ${nextIndex}`, tankTempId: '', openingReading: '0' }
          ]
        };
      })
    );
  };

  const handleRemoveNozzle = (machTempId: string, nozzleTempId: string) => {
    setFormError('');
    setMachinesList(prev =>
      prev.map(m => {
        if (m.tempId !== machTempId) return m;
        if (m.nozzles.length <= 1) return m;
        return {
          ...m,
          nozzles: m.nozzles.filter(n => n.tempId !== nozzleTempId)
        };
      })
    );
  };

  const updateNozzleField = (
    machTempId: string,
    nozzleTempId: string,
    field: keyof NozzleInput,
    value: string
  ) => {
    setFormError(''); // Clear validation error as soon as user configures connections
    setMachinesList(prev =>
      prev.map(m => {
        if (m.tempId !== machTempId) return m;
        return {
          ...m,
          nozzles: m.nozzles.map(n => (n.tempId === nozzleTempId ? { ...n, [field]: value } : n))
        };
      })
    );
  };

  // Validation routines
  const validateStep1 = () => {
    if (!newPumpName.trim()) {
      setFormError('Station name is required');
      return false;
    }
    if (!newPumpLocation.trim()) {
      setFormError('Station location/address is required');
      return false;
    }
    setFormError('');
    return true;
  };

  const validateStep2 = () => {
    if (tanksList.length === 0) {
      setFormError('At least one underground tank must be configured.');
      return false;
    }
    for (const t of tanksList) {
      if (!t.name.trim()) {
        setFormError('Tank name is required for all tanks.');
        return false;
      }
      const capacity = parseFloat(t.maxCapacity);
      const currentVolume = parseFloat(t.actualDipVolume);
      if (isNaN(capacity) || capacity <= 0) {
        setFormError(`Invalid capacity configured for ${t.name}. Must be positive number.`);
        return false;
      }
      if (isNaN(currentVolume) || currentVolume < 0) {
        setFormError(`Invalid current volume configured for ${t.name}. Must be non-negative.`);
        return false;
      }
      if (currentVolume > capacity) {
        setFormError(`Current fuel volume for ${t.name} cannot exceed its maximum capacity (${capacity} Litres).`);
        return false;
      }
      if (!t.productId) {
        setFormError(`Please select a product for ${t.name}.`);
        return false;
      }
    }
    setFormError('');
    return true;
  };

  const validateStep3 = () => {
    if (machinesList.length === 0) {
      setFormError('At least one dispenser unit is required.');
      return false;
    }
    for (const m of machinesList) {
      if (!m.name.trim()) {
        setFormError('Dispenser name is required.');
        return false;
      }
      if (m.nozzles.length === 0) {
        setFormError(`Dispenser ${m.name} must have at least one nozzle.`);
        return false;
      }
      for (const n of m.nozzles) {
        if (!n.name.trim()) {
          setFormError(`Nozzle name is required in dispenser ${m.name}.`);
          return false;
        }
        if (!n.tankTempId) {
          setFormError(`Nozzle ${n.name} in ${m.name} must be connected to a tank.`);
          return false;
        }
        const reading = parseFloat(n.openingReading);
        if (isNaN(reading) || reading < 0) {
          setFormError(`Invalid starting reading for nozzle ${n.name} in ${m.name}.`);
          return false;
        }
      }
    }
    setFormError('');
    return true;
  };

  // Wizard navigation
  const handleNextStep = () => {
    if (wizardStep === 1) {
      if (validateStep1()) setWizardStep(2);
    } else if (wizardStep === 2) {
      if (validateStep2()) setWizardStep(3);
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1);
      setFormError('');
    }
  };

  // Master Transactional Submit
  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setIsSubmitting(true);
    setFormError('');

    try {
      // 1. Create Pump
      setSubmitProgress({ step: 1, text: 'Registering Station Profile...' });
      const createdPump = await apiService.createPump(newPumpName, newPumpLocation);
      const newPumpId = createdPump.id;

      // 2. Create products registered inline
      setSubmitProgress({ step: 2, text: 'Provisioning New Product Types...' });
      const tempProdIdToDbId: Record<string, number> = {};
      for (const tempProd of tempNewProducts) {
        const createdProd = await apiService.createProduct(
          tempProd.name,
          tempProd.price,
          tempProd.margin,
          [newPumpId]
        );
        tempProdIdToDbId[tempProd.tempId] = createdProd.id;
      }

      // 3. Create Tanks
      setSubmitProgress({ step: 3, text: 'Mapping Underground Storage Tanks...' });
      const tankTempIdToDbId: Record<string, number> = {};
      for (const tankInput of tanksList) {
        let resolvedProductId = 0;
        if (tankInput.productId.startsWith('temp-')) {
          resolvedProductId = tempProdIdToDbId[tankInput.productId];
        } else {
          resolvedProductId = parseInt(tankInput.productId, 10);
        }

        const capacity = parseFloat(tankInput.maxCapacity);
        const dipVolume = parseFloat(tankInput.actualDipVolume) || 0;
        const createdTank = await apiService.createTank(
          newPumpId,
          resolvedProductId,
          tankInput.name,
          capacity,
          dipVolume
        );
        tankTempIdToDbId[tankInput.tempId] = createdTank.id;
      }

      // 4. Create Dispenser Machines and Nozzles
      setSubmitProgress({ step: 4, text: 'Mapping Dispenser units & Nozzles...' });
      for (const machInput of machinesList) {
        const createdMachine = await apiService.createMachine(
          newPumpId,
          machInput.name,
          machInput.nozzles.length
        );

        for (const nozzleInput of machInput.nozzles) {
          const resolvedTankId = tankTempIdToDbId[nozzleInput.tankTempId];
          const createdNozzle = await apiService.createNozzle(
            createdMachine.id,
            resolvedTankId,
            nozzleInput.name
          );

          // 5. Initialize base nozzle reading
          setSubmitProgress({
            step: 5,
            text: `Seeding Base Meter Reading for ${createdMachine.name} — ${nozzleInput.name}...`
          });
          const readingValue = parseFloat(nozzleInput.openingReading) || 0;
          await apiService.initializeNozzleReading(createdNozzle.id, readingValue);
        }
      }

      setSubmitProgress({ step: 6, text: 'Configuration registered successfully!' });

      // Clean up & refresh
      setTimeout(() => {
        setIsAddModalOpen(false);
        resetWizard();
        fetchDashboardData();
      }, 1200);

    } catch (err: any) {
      console.error('Registration failed', err);
      setFormError(err.message || 'Failed to complete configuration workflow. Check API connection.');
      setSubmitProgress(null);
      setIsSubmitting(false);
    }
  };

  const filteredPumps = [...pumps]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(pump =>
      pump.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pump.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans relative overflow-x-hidden">
      {/* Light-theme ambient decorative elements */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[550px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Navigation Bar - High Contrast Light Theme */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div
              onClick={() => setSubView('home')}
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
      </nav>      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 w-full">

        {subView === 'home' && (
          <>
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">
                  Dashboard
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Select or configure a fuel station to record operations, manage credit ledgers, and export statements.
                </p>
              </div>

              <button
                onClick={() => { resetWizard(); setIsAddModalOpen(true); }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.01] cursor-pointer shrink-0"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add New Station
              </button>
            </div>

            {/* Overview Stats Widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stations Enrolled</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-2 font-display">{pumps.length} Stations</h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  {pumps.filter(p => p.is_active).length} active stations operating
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Types</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-2 font-display">{products.length} Products</h3>
                <p className="text-[10px] text-slate-500 mt-1 truncate font-medium">
                  {products.length > 0
                    ? [...products].sort((a, b) => a.name.localeCompare(b.name)).map(p => p.name).join(', ')
                    : 'No active products registered'}
                </p>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="mb-8 flex items-center">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search station by name or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-sm font-sans shadow-sm"
                />
              </div>
            </div>

            {/* Loading Spinner */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <svg className="animate-spin h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-slate-500 text-sm mt-4 font-semibold">Retrieving dashboard data...</span>
              </div>
            ) : filteredPumps.length === 0 ? (
              /* Empty State */
              <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-3xl shadow-sm">
                <svg className="mx-auto h-12 w-12 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 6a2 2 0 012-2h6a2 2 0 012 2v14H5V6zm3 3h4v3H8V9zm8 2h1.5a1.5 1.5 0 011.5 1.5v3.75c0 .966.534 1.75 1.25 1.75s1.25-.784 1.25-1.75V6M3 20h14" />
                </svg>
                <h3 className="mt-4 text-sm font-bold text-slate-700">No Fuel Pumps Found</h3>
                <p className="mt-1 text-xs text-slate-500">Get started by creating a new pump station location.</p>
                <div className="mt-6">
                  <button
                    onClick={() => { resetWizard(); setIsAddModalOpen(true); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 cursor-pointer shadow-sm"
                  >
                    Create Pump Station
                  </button>
                </div>
              </div>
            ) : (
              /* Pumps Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPumps.map((pump, index) => (
                  <div
                    key={pump.id}
                    onClick={() => onSelectPump(pump.id)}
                    className={`group relative rounded-3xl bg-white border p-6 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between ${pump.is_active === false
                        ? 'border-slate-200 opacity-60 bg-slate-50/50 hover:border-slate-300'
                        : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-55'
                      }`}
                  >
                    {/* Visual accent glow */}
                    {pump.is_active !== false && (
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/2 rounded-full blur-2xl group-hover:bg-emerald-500/5 transition-all duration-300" />
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold ${pump.is_active === false
                            ? 'bg-slate-250 text-slate-600 border border-slate-300'
                            : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                          }`}>
                          Station #{index + 1}
                        </span>
                        {pump.is_active === false ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-650 font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>

                      <h3 className={`text-lg font-bold mt-4 font-display transition-colors ${pump.is_active === false
                          ? 'text-slate-500 group-hover:text-slate-700'
                          : 'text-slate-900 group-hover:text-emerald-600'
                        }`}>
                        {pump.name}
                      </h3>

                      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                        <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{pump.location || 'Location unspecified'}</span>
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold group-hover:text-slate-800 transition-colors">
                        {pump.is_active === false ? 'Inactive - Manage' : 'Manage Station'}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-slate-55 border border-slate-200 group-hover:border-slate-300 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Administration Control Panel */}
            <div className="mt-16 border-t border-slate-200 pt-10">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Administration Console</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* Manage Products Action Card */}
                <div
                  onClick={() => setSubView('manage-products')}
                  className="group p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 shadow-sm hover:shadow transition-all duration-300 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 group-hover:border-slate-300 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 transition-all shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-655 transition-colors">Manage Products</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Register fuel types, current price revisions, and margins</p>
                    </div>
                  </div>
                  <div className="text-slate-400 group-hover:text-emerald-655 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Manage Credit Accounts Action Card */}
                <div
                  onClick={() => setSubView('manage-credit-accounts')}
                  className="group p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 shadow-sm hover:shadow transition-all duration-300 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 group-hover:border-slate-300 flex items-center justify-center text-slate-500 group-hover:text-emerald-650 transition-all shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6zm0 4h18m-14 5h3m4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-655 transition-colors">Manage Credit Accounts</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Track customer credit outstanding and logs</p>
                    </div>
                  </div>
                  <div className="text-slate-400 group-hover:text-emerald-655 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

        {subView === 'manage-products' && (
          <ManageProducts
            onBack={() => setSubView('home')}
            pumps={pumps}
          />
        )}

        {subView === 'manage-credit-accounts' && (
          <ManageCreditAccounts
            onBack={() => setSubView('home')}
            pumps={pumps}
          />
        )}

      </main>

      {/* Add Pump Multi-step Configuration Wizard Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div
            className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 md:p-8 relative my-8 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display">Configure Fuel Station</h3>
                <p className="text-xs text-slate-400 mt-0.5">Complete registration steps to initialize operations</p>
              </div>
              {!isSubmitting && (
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Visual Step Progress Bar */}
            {!isSubmitting && (
              <div className="my-6 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
                  <span className={`text-xs font-bold ${wizardStep === 1 ? 'text-slate-800' : 'text-slate-400'}`}>Station Profile</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 mx-2 max-w-12" />
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
                  <span className={`text-xs font-bold ${wizardStep === 2 ? 'text-slate-800' : 'text-slate-400'}`}>Tanks (Storage)</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 mx-2 max-w-12" />
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</div>
                  <span className={`text-xs font-bold ${wizardStep === 3 ? 'text-slate-800' : 'text-slate-400'}`}>Dispensers & Readings</span>
                </div>
              </div>
            )}

            {/* Main Submit/Progress Overlay */}
            {isSubmitting && submitProgress ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-6">
                <svg className="animate-spin h-12 w-12 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="text-center">
                  <h4 className="text-sm font-bold text-slate-800">{submitProgress.text}</h4>
                  <p className="text-xs text-slate-400 mt-1">Deploying private mesh node configuration ({submitProgress.step}/5)</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleWizardSubmit} className="space-y-6">

                {/* STEP 1: Basic Info */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Fuel Station Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Highway bypass fuel station"
                        value={newPumpName}
                        onChange={(e) => { setNewPumpName(e.target.value); setFormError(''); }}
                        className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-sm font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location / Postal Address</label>
                      <input
                        type="text"
                        placeholder="e.g. Sector-14 Bypass, Delhi road"
                        value={newPumpLocation}
                        onChange={(e) => { setNewPumpLocation(e.target.value); setFormError(''); }}
                        className="mt-2 block w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all text-sm font-sans"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: Storage Tanks Configuration */}
                {wizardStep === 2 && (
                  <div
                    ref={tanksContainerRef}
                    className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scroll-smooth"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Underground Tank Slots</h4>
                      <button
                        type="button"
                        onClick={handleAddTank}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Tank
                      </button>
                    </div>

                    {tanksList.map((tank, index) => (
                      <div key={tank.tempId} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-md font-display">
                            Tank #{index + 1}
                          </span>
                          {tanksList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTank(tank.tempId)}
                              className="text-rose-500 hover:text-rose-700 transition-colors text-xs font-semibold cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tank Label</label>
                            <input
                              type="text"
                              value={tank.name}
                              onChange={(e) => updateTankField(tank.tempId, 'name', e.target.value)}
                              className="mt-1 block w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Capacity (Ltrs)</label>
                            <input
                              type="number"
                              value={tank.maxCapacity}
                              onChange={(e) => updateTankField(tank.tempId, 'maxCapacity', e.target.value)}
                              className="mt-1 block w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Volume (Ltrs)</label>
                            <input
                              type="number"
                              value={tank.actualDipVolume}
                              onChange={(e) => updateTankField(tank.tempId, 'actualDipVolume', e.target.value)}
                              className="mt-1 block w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product Content</label>
                            <div className="mt-1">
                              <SmartDropdown
                                value={tank.productId}
                                onChange={(val) => {
                                  setFormError('');
                                  if (val === 'new') {
                                    setInlineProductError('');
                                    setInlineProductTankId(tank.tempId);
                                  } else {
                                    updateTankField(tank.tempId, 'productId', val);
                                  }
                                }}
                                placeholder="Select Product..."
                                options={[
                                  ...allAvailableProducts.map(p => ({
                                    value: p.id.toString(),
                                    label: `${p.name} (₹${p.current_price})`,
                                  })),
                                  { value: 'new', label: '+ Add New Product', isAction: true },
                                ]}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Inline Product Creator block */}
                        {inlineProductTankId === tank.tempId && (
                          <div
                            id={`inline-prod-form-${tank.tempId}`}
                            className="mt-3 p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs scroll-mt-4"
                          >
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                              <h5 className="text-[11px] font-bold text-slate-700">Provision New Product</h5>
                              <button
                                type="button"
                                onClick={() => { setInlineProductTankId(null); setInlineProductError(''); }}
                                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Product Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Premium Petrol"
                                  value={inlineProductName}
                                  onChange={(e) => { setInlineProductName(e.target.value); setInlineProductError(''); }}
                                  className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Price (₹/Ltr)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 104.50"
                                  value={inlineProductPrice}
                                  onChange={(e) => { setInlineProductPrice(e.target.value); setInlineProductError(''); }}
                                  className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Cost Margin (₹/Ltr)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 3.20"
                                  value={inlineProductMargin}
                                  onChange={(e) => { setInlineProductMargin(e.target.value); setInlineProductError(''); }}
                                  className="mt-1 block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                            {inlineProductError && (
                              <p className="text-[10px] text-rose-600 font-semibold">{inlineProductError}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRegisterInlineProduct(tank.tempId)}
                              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
                            >
                              Confirm and Add Product
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 3: Dispenser Units & Initial Readings */}
                {wizardStep === 3 && (
                  <div
                    ref={machinesContainerRef}
                    className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scroll-smooth"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispenser Units Configuration</h4>
                      <button
                        type="button"
                        onClick={handleAddMachine}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Dispenser
                      </button>
                    </div>

                    {machinesList.map((mach, index) => (
                      <div key={mach.tempId} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-md font-display">
                              Dispenser #{index + 1}
                            </span>
                            <input
                              type="text"
                              value={mach.name}
                              onChange={(e) => updateMachineName(mach.tempId, e.target.value)}
                              className="block bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 focus:outline-none text-xs font-bold text-slate-800 py-0.5 px-1 max-w-[150px]"
                            />
                          </div>
                          {machinesList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMachine(mach.tempId)}
                              className="text-rose-500 hover:text-rose-700 transition-colors text-xs font-semibold cursor-pointer"
                            >
                              Remove Dispenser
                            </button>
                          )}
                        </div>

                        <div className="space-y-3 pt-2">
                          <div className="flex justify-between items-center">
                            <h5 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Nozzles</h5>
                            <button
                              type="button"
                              onClick={() => handleAddNozzle(mach.tempId)}
                              className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                            >
                              + Add Nozzle
                            </button>
                          </div>

                          {mach.nozzles.map((nozzle) => (
                            <div key={nozzle.tempId} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end bg-white p-3 border border-slate-200 rounded-xl animate-fadeIn">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Nozzle Name</label>
                                <input
                                  type="text"
                                  value={nozzle.name}
                                  onChange={(e) => updateNozzleField(mach.tempId, nozzle.tempId, 'name', e.target.value)}
                                  className="mt-1 block w-full rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Connect to Tank</label>
                                <div className="mt-1">
                                  <SmartDropdown
                                    value={nozzle.tankTempId}
                                    onChange={(val) => updateNozzleField(mach.tempId, nozzle.tempId, 'tankTempId', val)}
                                    placeholder="Select Tank..."
                                    options={[
                                      ...tanksList.map(tank => ({
                                        value: tank.tempId,
                                        label: `${tank.name} (${getProductLabel(tank.productId)})`,
                                      })),
                                    ]}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center gap-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Last Meter Reading</label>
                                  <span
                                    className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] text-slate-450 font-bold cursor-help"
                                    title="This sets the initial starting reading for the nozzle. Opening and closing readings for today will start here."
                                  >
                                    ?
                                  </span>
                                </div>
                                <input
                                  type="number"
                                  value={nozzle.openingReading}
                                  onChange={(e) => updateNozzleField(mach.tempId, nozzle.tempId, 'openingReading', e.target.value)}
                                  className="mt-1 block w-full rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                                />
                              </div>

                              <div className="flex justify-end pb-0.5">
                                {mach.nozzles.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveNozzle(mach.tempId, nozzle.tempId)}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-semibold cursor-pointer pb-1.5"
                                  >
                                    Remove Nozzle
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation Errors */}
                {formError && (
                  <p className="text-xs text-rose-600 font-semibold">{formError}</p>
                )}

                {/* Modal actions */}
                <div className="pt-4 border-t border-slate-100 flex justify-between gap-3">
                  <div>
                    {wizardStep > 1 && (
                      <button
                        type="button"
                        onClick={handlePrevStep}
                        className="py-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition-all cursor-pointer"
                      >
                        Back
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="py-3 px-6 rounded-xl bg-white hover:bg-slate-55 text-xs font-semibold text-slate-500 border border-slate-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>

                    {wizardStep < 3 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow transition-all cursor-pointer flex items-center justify-center"
                      >
                        Complete Configuration
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
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
