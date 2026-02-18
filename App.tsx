
import React, { useState, useEffect, useMemo } from 'react';
import { ViewState, ExpenseRecord, AlimentationRecord, MonthlySummary } from './types';
import { getAllRecords, saveRecord, deleteRecord, initDB } from './db';
import { FingerprintIcon, PlusIcon, DownloadIcon, CameraIcon, TrashIcon } from './components/Icons';

// --- Utilitaires Globaux ---
const getTodayDate = () => new Date().toISOString().split('T')[0];
const FIXED_PIN = "1997";
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// --- Composants ---

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const PinLogin: React.FC<{ onSuccess: () => void; isInline?: boolean }> = ({ onSuccess, isInline }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handlePin = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === FIXED_PIN) {
          onSuccess();
        } else {
          setError("Code PIN invalide");
          setTimeout(() => { setPin(""); setError(""); }, 800);
        }
      }
    }
  };

  const handleFingerprint = () => {
    onSuccess();
  };

  return (
    <div className={`${isInline ? '' : 'min-h-screen'} flex flex-col items-center justify-center bg-gray-900 text-white p-6 rounded-2xl`}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight">Vérification de Sécurité</h1>
          <p className="text-gray-400 text-sm">Entrez le PIN (1997) ou utilisez l'empreinte</p>
        </div>

        <div className="flex justify-center gap-4 py-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-3 h-3 rounded-full border-2 border-white transition-all ${pin.length >= i ? 'bg-white' : 'bg-transparent'}`} />
          ))}
        </div>

        {error && <p className="text-red-500 font-bold animate-pulse">{error}</p>}

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => handlePin(n.toString())} className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-xl font-bold transition-colors">
              {n}
            </button>
          ))}
          <button onClick={handleFingerprint} className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center transition-colors">
            <FingerprintIcon className="w-8 h-8" />
          </button>
          <button onClick={() => handlePin("0")} className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-xl font-bold transition-colors">
            0
          </button>
          <button onClick={() => setPin("")} className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[10px] font-black uppercase transition-colors">
            Effacer
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<ViewState | 'YEARLY'>('AUTH');
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [alimentation, setAlimentation] = useState<AlimentationRecord[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authAction, setAuthAction] = useState<(() => void) | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<Partial<ExpenseRecord>>({});
  const [alimentationForm, setAlimentationForm] = useState<Partial<AlimentationRecord>>({});
  const [editingRecord, setEditingRecord] = useState<{ type: 'expenses' | 'alimentation', id: string } | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const ex = await getAllRecords<ExpenseRecord>('expenses');
    const al = await getAllRecords<AlimentationRecord>('alimentation');
    setExpenses(ex);
    setAlimentation(al);
  };

  const requireAuth = (callback: () => void) => {
    setAuthAction(() => callback);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    if (authAction) {
      authAction();
      setAuthAction(null);
    }
  };

  const getMonthlyStats = (month: number, year: number) => {
    const mExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).reduce((sum, e) => sum + e.price, 0);

    const mAlimentation = alimentation.filter(a => {
      const d = new Date(a.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).reduce((sum, a) => sum + a.amount, 0);

    return { expenses: mExpenses, alimentation: mAlimentation };
  };

  const getCarryOver = (month: number, year: number): number => {
    let cumulative = 0;
    for (let m = 0; m < month; m++) {
      const stats = getMonthlyStats(m, year);
      cumulative += (stats.alimentation - stats.expenses);
    }
    return cumulative;
  };

  const currentMonthStats = getMonthlyStats(selectedMonth, selectedYear);
  const carryOver = getCarryOver(selectedMonth, selectedYear);
  const totalAvailable = currentMonthStats.alimentation + carryOver;
  const remaining = totalAvailable - currentMonthStats.expenses;

  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const currentMonthAlimentation = alimentation.filter(a => {
    const d = new Date(a.date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const handleSaveExpense = async () => {
    const record: ExpenseRecord = {
      id: editingRecord?.id || crypto.randomUUID(),
      date: expenseForm.date || getTodayDate(),
      productName: expenseForm.productName || "Produit sans nom",
      price: expenseForm.price || 0,
      photo: expenseForm.photo
    };
    await saveRecord('expenses', record);
    resetForms();
    setView('DASHBOARD');
    loadData();
  };

  const handleSaveAlimentation = async () => {
    const record: AlimentationRecord = {
      id: editingRecord?.id || crypto.randomUUID(),
      date: alimentationForm.date || getTodayDate(),
      amount: alimentationForm.amount || 0
    };
    await saveRecord('alimentation', record);
    resetForms();
    setView('DASHBOARD');
    loadData();
  };

  const resetForms = () => {
    setExpenseForm({});
    setAlimentationForm({});
    setEditingRecord(null);
  };

  const startEdit = (type: 'expenses' | 'alimentation', item: any) => {
    requireAuth(() => {
      setEditingRecord({ type, id: item.id });
      if (type === 'expenses') {
        setExpenseForm(item);
        setView('EXPENSE_FORM');
      } else {
        setAlimentationForm(item);
        setView('ALIMENTATION_FORM');
      }
    });
  };

  const handleDelete = (type: 'expenses' | 'alimentation', id: string) => {
    requireAuth(async () => {
      await deleteRecord(type, id);
      loadData();
    });
  };

  const capturePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      const canvas = document.createElement('canvas');
      setTimeout(() => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setExpenseForm(prev => ({ ...prev, photo: dataUrl }));
        stream.getTracks().forEach(t => t.stop());
      }, 1500);
    } catch (e) {
      alert("Erreur caméra : " + e);
    }
  };

  const exportPDF = () => {
    requireAuth(() => {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(`Rapport Financier : ${MONTHS[selectedMonth]} ${selectedYear}`, 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Alimentation du mois : ${currentMonthStats.alimentation.toFixed(2)} DH`, 14, 30);
      doc.text(`Report : ${carryOver.toFixed(2)} DH`, 14, 35);
      doc.text(`Total Dépenses : ${currentMonthStats.expenses.toFixed(2)} DH`, 14, 40);
      doc.text(`Solde Final : ${remaining.toFixed(2)} DH`, 14, 45);

      const tableData = currentMonthExpenses
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(e => [e.date, e.productName, `${e.price.toFixed(2)} DH`, e.photo ? 'IMAGE_HERE' : 'Aucun']);

      (doc as any).autoTable({
        startY: 55,
        head: [['Date', 'Produit', 'Prix', 'Reçu']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: {
            3: { cellWidth: 30, minCellHeight: 30 }
        },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3 && data.cell.raw === 'IMAGE_HERE') {
                const item = currentMonthExpenses.find(e => e.date === data.row.cells[0].text && e.productName === data.row.cells[1].text);
                if (item && item.photo) {
                    doc.addImage(item.photo, 'JPEG', data.cell.x + 2, data.cell.y + 2, 26, 26);
                }
            }
        }
      });

      doc.save(`Dépenses_Détaillées_${MONTHS[selectedMonth]}.pdf`);
    });
  };

  const exportExcel = () => {
    requireAuth(() => {
      const XLSX = (window as any).XLSX;
      // Excel focalisé sur : Date, Dépense (Produit), Montant, Alimentation
      const rows = [
        ["Date", "Dépense (Produit)", "Montant Dépense (DH)", "Provision Alimentation (DH)"],
        ...currentMonthExpenses.map(e => [e.date, e.productName, e.price, ""]),
        ...currentMonthAlimentation.map(a => [a.date, "RECHARGE ALIMENTATION", "", a.amount]),
        [],
        ["SOLDE DU MOIS", "", "", remaining.toFixed(2) + " DH"]
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dépenses et Provisions");
      XLSX.writeFile(wb, `Finance_${MONTHS[selectedMonth]}_${selectedYear}.xlsx`);
    });
  };

  if (view === 'AUTH') return <PinLogin onSuccess={() => setView('YEARLY')} />;

  return (
    <div className="min-h-screen pb-32 bg-gray-50 font-sans">
      <Modal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title="Vérification PIN">
        <PinLogin onSuccess={handleAuthSuccess} isInline />
      </Modal>

      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Image du Reçu">
        {previewImage && <img src={previewImage} className="w-full h-auto rounded-2xl shadow-lg" alt="Facture" />}
      </Modal>

      <header className="bg-indigo-700 text-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-40">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black text-xl">E</div>
            <div>
              <h1 className="text-xl font-black">GestionExpense</h1>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Version Hors Ligne</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setView('YEARLY')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${view === 'YEARLY' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}>Annuel</button>
             <button onClick={() => setView('DASHBOARD')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${view === 'DASHBOARD' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}>Détails</button>
          </div>
        </div>

        {view === 'DASHBOARD' && (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-white/60 text-[10px] uppercase font-black tracking-wider mb-1">Total Disponible</p>
                <p className="text-2xl font-black">{totalAvailable.toFixed(2)} <span className="text-sm">DH</span></p>
                <p className="text-[10px] text-white/40 mt-1">Report : {carryOver.toFixed(2)} DH</p>
              </div>
              <div className="bg-white/10 p-4 rounded-3xl border border-white/5">
                <p className="text-white/60 text-[10px] uppercase font-black tracking-wider mb-1">Total Dépenses</p>
                <p className="text-2xl font-black">{currentMonthStats.expenses.toFixed(2)} <span className="text-sm">DH</span></p>
              </div>
            </div>
            <div className={`p-5 rounded-3xl flex justify-between items-center shadow-lg transition-all ${remaining < 0 ? 'bg-red-500 shadow-red-200' : 'bg-green-500 shadow-green-200'}`}>
              <div>
                <p className="text-white/70 text-[10px] uppercase font-black tracking-widest">Solde Actuel</p>
                <p className="text-3xl font-black">{remaining.toFixed(2)} <span className="text-xl">DH</span></p>
              </div>
              <div className="bg-white/20 p-2 rounded-2xl font-black">
                {remaining >= 0 ? 'EN RÈGLE' : 'DÉPASSEMENT'}
              </div>
            </div>
          </div>
        )}

        {view === 'YEARLY' && (
          <div className="text-center py-2 animate-in fade-in duration-500">
             <h2 className="text-3xl font-black">Année {selectedYear}</h2>
             <p className="text-white/60 text-sm mt-1">Surveillance du budget annuel</p>
          </div>
        )}
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        <div className="flex gap-3 mb-6 items-center bg-white p-3 rounded-3xl shadow-sm border border-gray-100">
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="p-2.5 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {view === 'DASHBOARD' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {MONTHS.map((m, idx) => (
                <button key={m} onClick={() => setSelectedMonth(idx)} className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedMonth === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                  {m.substring(0, 4)}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === 'YEARLY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-500">
            {MONTHS.map((m, idx) => {
              const stats = getMonthlyStats(idx, selectedYear);
              const mCarry = getCarryOver(idx, selectedYear);
              const mRem = (stats.alimentation + mCarry) - stats.expenses;
              const isFuture = (selectedYear === new Date().getFullYear() && idx > new Date().getMonth()) || selectedYear > new Date().getFullYear();
              return (
                <button key={m} onClick={() => { setSelectedMonth(idx); setView('DASHBOARD'); }} disabled={isFuture} className={`bg-white p-5 rounded-[2rem] border shadow-sm text-left transition-all hover:scale-[1.02] flex justify-between items-center ${isFuture ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div>
                    <h3 className="text-lg font-black text-gray-800">{m}</h3>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Alim: {stats.alimentation} | Dép: {stats.expenses}
                    </div>
                  </div>
                  <p className={`text-xl font-black ${mRem < 0 ? 'text-red-500' : 'text-green-600'}`}>{mRem.toFixed(0)} DH</p>
                </button>
              );
            })}
          </div>
        )}

        {view === 'DASHBOARD' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <section>
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                  Transactions du Mois
                </h2>
                <div className="flex gap-2">
                  <button onClick={exportPDF} title="PDF Détaillé + Reçus" className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                    <DownloadIcon className="w-5 h-5" />
                  </button>
                  <button onClick={exportExcel} title="Excel (Données)" className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
              
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {[...currentMonthExpenses, ...currentMonthAlimentation]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item) => {
                      const isExp = 'productName' in item;
                      const expense = item as ExpenseRecord;
                      const alim = item as AlimentationRecord;
                      return (
                        <div key={item.id} className="p-5 flex items-center justify-between group hover:bg-gray-50">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${isExp ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                              {isExp ? '🛒' : '🍞'}
                            </div>
                            <div onClick={() => startEdit(isExp ? 'expenses' : 'alimentation', item)} className="cursor-pointer">
                              <p className="font-black text-gray-900 leading-tight">{isExp ? expense.productName : 'Provision Alim'}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{item.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className={`text-lg font-black ${isExp ? 'text-red-600' : 'text-green-600'}`}>
                                {isExp ? '-' : '+'}{isExp ? expense.price.toFixed(2) : alim.amount.toFixed(2)} <span className="text-xs">DH</span>
                              </p>
                              {isExp && expense.photo && (
                                <button onClick={() => setPreviewImage(expense.photo!)} className="text-[10px] text-indigo-600 font-black uppercase hover:underline">Voir Reçu</button>
                              )}
                            </div>
                            <button onClick={() => handleDelete(isExp ? 'expenses' : 'alimentation', item.id)} className="p-2 text-gray-300 hover:text-red-500">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {currentMonthExpenses.length === 0 && currentMonthAlimentation.length === 0 && (
                    <div className="p-16 text-center text-gray-300 font-black">MOIS VIDE</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'EXPENSE_FORM' && (
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-8 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-black text-gray-800">{editingRecord ? 'Modifier' : 'Nouvelle'} Dépense</h2>
            <div className="space-y-6">
              <input type="date" value={expenseForm.date || getTodayDate()} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-bold" />
              <input type="text" placeholder="Désignation du produit" value={expenseForm.productName || ""} onChange={e => setExpenseForm({...expenseForm, productName: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-bold" />
              <div className="relative">
                <input type="number" placeholder="0.00" value={expenseForm.price || ""} onChange={e => setExpenseForm({...expenseForm, price: parseFloat(e.target.value)})} className="w-full p-5 pr-16 bg-gray-50 rounded-3xl text-4xl font-black outline-none" />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-gray-300">DH</span>
              </div>
              <button onClick={capturePhoto} className="w-full p-6 border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 hover:border-red-500">
                {expenseForm.photo ? <img src={expenseForm.photo} className="w-24 h-24 rounded-xl object-cover" /> : <CameraIcon />}
                <span className="font-bold text-sm">Prendre Reçu en Photo</span>
              </button>
              <div className="flex gap-4">
                <button onClick={() => { resetForms(); setView('DASHBOARD'); }} className="flex-1 p-5 bg-gray-100 rounded-3xl font-black uppercase tracking-widest text-sm">Annuler</button>
                <button onClick={handleSaveExpense} className="flex-1 p-5 bg-red-600 text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-200">Enregistrer</button>
              </div>
            </div>
          </div>
        )}

        {view === 'ALIMENTATION_FORM' && (
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-8 animate-in slide-in-from-bottom-8">
            <h2 className="text-3xl font-black text-gray-800">{editingRecord ? 'Modifier' : 'Nouvelle'} Provision</h2>
            <div className="space-y-6">
              <input type="date" value={alimentationForm.date || getTodayDate()} onChange={e => setAlimentationForm({...alimentationForm, date: e.target.value})} className="w-full p-5 bg-gray-50 rounded-3xl font-bold" />
              <div className="relative">
                <input type="number" placeholder="0.00" value={alimentationForm.amount || ""} onChange={e => setAlimentationForm({...alimentationForm, amount: parseFloat(e.target.value)})} className="w-full p-5 pr-16 bg-gray-50 rounded-3xl text-4xl font-black outline-none" />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-gray-300">DH</span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { resetForms(); setView('DASHBOARD'); }} className="flex-1 p-5 bg-gray-100 rounded-3xl font-black uppercase tracking-widest text-sm">Annuler</button>
                <button onClick={handleSaveAlimentation} className="flex-1 p-5 bg-green-600 text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl shadow-green-200">Enregistrer</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {(view === 'DASHBOARD' || view === 'YEARLY') && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center items-center gap-4 z-50">
          <div className="flex gap-3 p-3 bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white ring-1 ring-black/5 scale-110">
            <button onClick={() => { resetForms(); setView('EXPENSE_FORM'); }} className="flex items-center gap-2 bg-red-600 text-white pl-4 pr-6 py-4 rounded-full shadow-lg active:scale-95 transition-all">
              <PlusIcon className="w-4 h-4" /> <span className="text-xs font-black uppercase">Dépense</span>
            </button>
            <button onClick={() => { resetForms(); setView('ALIMENTATION_FORM'); }} className="flex items-center gap-2 bg-green-600 text-white pl-4 pr-6 py-4 rounded-full shadow-lg active:scale-95 transition-all">
              <PlusIcon className="w-4 h-4" /> <span className="text-xs font-black uppercase">Alim</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
