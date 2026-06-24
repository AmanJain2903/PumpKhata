import { useState } from 'react'

interface Transaction {
  id: string
  pump: string
  fuelType: 'Petrol' | 'Diesel' | 'CNG'
  amount: number
  liters: number
  status: 'Completed' | 'Pending'
  date: string
}

function App() {
  const [transactions] = useState<Transaction[]>([
    { id: 'TXN-1001', pump: 'Pump A', fuelType: 'Petrol', amount: 4800, liters: 45.2, status: 'Completed', date: 'Just now' },
    { id: 'TXN-1002', pump: 'Pump C', fuelType: 'Diesel', amount: 12500, liters: 140.5, status: 'Completed', date: '5 mins ago' },
    { id: 'TXN-1003', pump: 'Pump B', fuelType: 'Petrol', amount: 2100, liters: 19.8, status: 'Pending', date: '12 mins ago' },
    { id: 'TXN-1004', pump: 'Pump A', fuelType: 'CNG', amount: 850, liters: 12.1, status: 'Completed', date: '45 mins ago' },
  ])

  const [filter, setFilter] = useState<'All' | 'Petrol' | 'Diesel' | 'CNG'>('All')

  const filteredTxns = filter === 'All' ? transactions : transactions.filter(t => t.fuelType === filter)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                PumpKhata
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Vite + React + Tailwind v4
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Success Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-700" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Frontend Boilerplate Ready!
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Your React application has been successfully scaffolded with Vite and Tailwind CSS.
              </p>
            </div>
            <div className="flex gap-3">
              <a 
                href="https://tailwindcss.com" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium transition-colors border border-slate-700/50"
              >
                Tailwind CSS Docs
              </a>
              <a 
                href="https://vite.dev" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-xs font-medium text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
              >
                Vite Guide
              </a>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all duration-300">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Sales Today</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-2">₹18,150</h3>
            <div className="flex items-center gap-1 text-emerald-400 text-xs mt-2 font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>+12.4% vs yesterday</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all duration-300">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fuel Dispensed</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-2">217.6 L</h3>
            <div className="flex items-center gap-1 text-emerald-400 text-xs mt-2 font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>+8.2% vs yesterday</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all duration-300">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Dues</p>
            <h3 className="text-2xl font-bold text-amber-500 mt-2">₹2,100</h3>
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-2 font-medium">
              <span>1 customer invoice pending</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 hover:border-slate-800 transition-all duration-300">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Pumps</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-2">3 / 4</h3>
            <div className="flex items-center gap-1 text-emerald-400 text-xs mt-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block mr-1" />
              <span>Pump A, B & C online</span>
            </div>
          </div>
        </div>

        {/* Sales Chart & Recent Transactions Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Visual Sales Analytics Chart */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/30 border border-slate-900/85 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Fuel Sales Trend</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Hourly transaction volume</p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">Today</span>
              </div>
              
              {/* Graphic Mock Chart */}
              <div className="h-48 flex items-end gap-3 pt-6 border-b border-slate-900 pb-2">
                {[45, 60, 35, 80, 50, 70, 95, 65, 85, 110, 75, 90].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    <div className="w-full relative rounded-t bg-gradient-to-t from-indigo-600 to-emerald-500 transition-all duration-300 group-hover:brightness-125" style={{ height: `${height * 1.2}px` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-mono whitespace-nowrap z-50">
                        ₹{(height * 150).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{i + 8}h</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-400 mt-4">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Petrol
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                  Diesel
                </span>
              </div>
              <span>Updated 1 min ago</span>
            </div>
          </div>

          {/* Quick Actions & Fuel Prices */}
          <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-900/85 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-4">Fuel Rates Today</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">P</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Petrol</p>
                      <p className="text-[10px] text-slate-500">Regular Octane</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-100">₹103.44</p>
                    <p className="text-[9px] text-emerald-500">+₹0.12</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">D</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Diesel</p>
                      <p className="text-[10px] text-slate-500">Ultra-low sulfur</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-100">₹94.27</p>
                    <p className="text-[9px] text-slate-500">Unchanged</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">C</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">CNG</p>
                      <p className="text-[10px] text-slate-500">Compressed Gas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-100">₹87.50</p>
                    <p className="text-[9px] text-rose-500">-₹0.50</p>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full mt-6 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-100 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Record Price Revision
            </button>
          </div>

        </div>

        {/* Ledger & Transactions Table */}
        <div className="mt-8 p-6 rounded-2xl bg-slate-900/30 border border-slate-900/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Recent Transactions Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time log of fuel sales</p>
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-900 w-fit">
              {(['All', 'Petrol', 'Diesel', 'CNG'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${filter === f ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Transaction ID</th>
                  <th className="py-3 px-4 font-semibold">Pump</th>
                  <th className="py-3 px-4 font-semibold">Fuel</th>
                  <th className="py-3 px-4 font-semibold">Liters</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {filteredTxns.map(txn => (
                  <tr key={txn.id} className="hover:bg-slate-900/20 transition-colors group">
                    <td className="py-3.5 px-4 font-mono text-xs text-indigo-400 font-medium">{txn.id}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">{txn.pump}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        txn.fuelType === 'Petrol' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        txn.fuelType === 'Diesel' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {txn.fuelType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">{txn.liters} L</td>
                    <td className="py-3.5 px-4 text-slate-200 font-semibold font-mono">₹{txn.amount.toLocaleString()}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${txn.status === 'Completed' ? 'text-emerald-400' : 'text-amber-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${txn.status === 'Completed' ? 'bg-emerald-400' : 'bg-amber-500 animate-pulse'}`} />
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs text-right">{txn.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/50 mt-16 py-8 text-center text-xs text-slate-650 bg-slate-950/20">
        <p>© 2026 PumpKhata Digital Ledger System. Created as requested.</p>
      </footer>
    </div>
  )
}

export default App
