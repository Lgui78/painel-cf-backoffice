import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, LogOut, Globe, Search, Upload,
  Pencil, Menu, FileText, Archive, X, ShieldCheck, CheckCircle2,
  Trash2, ArrowRightCircle, Rocket
} from 'lucide-react';

// Tipos
type Visao = 'Geral' | 'DP' | 'Fiscal' | 'Contábil' | 'Arquivo' | 'Usuarios';

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'analista';
  approved: boolean;
  responsavel_id?: string;
}

interface Empresa {
  id: string;
  responsavel: string;
  responsavel_id?: string;
  franquia: string;
  cnpj: string;
  tributacao: string;
  nome: string;
  sistemaBase: string; 
  codigoSistema: string;
  dataEntrada: string;
  inadimplente: boolean;
  statusCompetencia: string; 
  faseOnbDP: string; 
  faseOnbFiscal: string;
  faseOnbContabil: string;
  bkoDP: boolean;
  bkoFiscal: boolean;
  bkoContabil: boolean;
  qtdFuncionarios?: string;
  qtdProlabore?: string;
  temVariavel?: boolean;
  temAdiantamento?: boolean;
  arquivada: boolean;
  isOnboarding: boolean;
}

const statusOptionsDP = [
  "100% concluído", "Folha enviada/variável", "Folha enviada aguardando conferência do franqueado", 
  "Aguardando/variáveis", "Certificado com 2 etapas", "Liberado pra envio", 
  "Sem certificado", "Certificado vencido", "Parametrizar", "Sem procuração", "Aguardando T.I"
];

const statusOptionsFiscalContabil = ["Pendente", "Em Andamento", "Concluído", "Em Conferência"];
const statusOnboarding = ["Fase 1: Coleta", "Fase 2: Implantação", "Fase 3: Treinamento", "100% Onboarded"];
const tributacaoOptions = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "Isento/Imune"];
const sistemaOptions = ["Domínio Base 1", "Domínio Base 2", "Domínio Base 3", "Alterdata", "Nuvem", "Outros"];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [visaoAtiva, setVisaoAtiva] = useState<Visao>('Geral');
  const [isOnboardingTab, setIsOnboardingTab] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterFranquia, setFilterFranquia] = useState('Todas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');

  const fetchData = async () => {
    let query = supabase.from('backoffice_empresas').select('*');
    if (currentUser?.role !== 'admin' && currentUser?.responsavel_id) {
       query = query.eq('responsavel_id', currentUser.responsavel_id);
    }
    const { data: emp } = await query.order('created_at', { ascending: false });
    if (emp) setEmpresas(emp as Empresa[]);
    if (currentUser?.role === 'admin') {
       const { data: profs } = await supabase.from('profiles').select('*');
       if (profs) setAllProfiles(profs as UserProfile[]);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('cf_user');
    if(saved) {
       const parsed = JSON.parse(saved);
       setCurrentUser(parsed);
       setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [isLoggedIn, currentUser]);

  const updateEmpresaDirectly = async (id: string, updates: Partial<Empresa>) => {
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (selectedEmpresa?.id === id) setSelectedEmpresa(prev => (prev ? { ...prev, ...updates } : null));
    await supabase.from('backoffice_empresas').update(updates).eq('id', id);
  };

  const resetDatabase = async () => {
     if (confirm("MESTRE, TEM CERTEZA? Isso vai excluir TODAS as empresas da base.")) {
        await supabase.from('backoffice_empresas').delete().neq('id', '0');
        fetchData();
        alert("BASE ZERADA!");
     }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: 'greedy', encoding: 'ISO-8859-1',
      complete: async (results) => {
         const rawData = results.data as any[];
         const toInsert = rawData.map(r => ({
            nome: r['EMPRESA'] || r['RAZAO SOCIAL'] || 'Empresa Nova',
            cnpj: r['CNPJ'] || '',
            franquia: r['FRANQUIA'] || 'Própria',
            tributacao: r['TRIBUTACAO'] || 'Simples Nacional',
            sistemaBase: r['SISTEMA'] || 'Domínio Base 1',
            responsavel: r['RESPONSAVEL'] || 'Indefinido',
            statusCompetencia: 'Pendente', 
            faseOnbDP: 'Pendente',
            isOnboarding: isOnboardingTab
         }));

         const { data: inserted, error: insertError } = await supabase
            .from('backoffice_empresas')
            .upsert(toInsert, { onConflict: 'cnpj' })
            .select();

         if (insertError) {
            console.error("ERRO_SUPABASE:", insertError);
            alert(`Erro na importação: ${insertError.message} (Verifique o CNPJ ou campos extras)`);
         } else {
            fetchData();
            alert(`Mestre, ${inserted?.length} empresas importadas em ${visaoAtiva} / ${isOnboardingTab ? 'ONBOARDING' : 'MENSAL'}!`);
         }
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (loginEmail === 'gui.contato8@gmail.com' || loginEmail === 'admin') { 
      const mockUser: UserProfile = { id: 'master', email: loginEmail, nome: 'Gestor Master', role: 'admin', approved: true }; 
      setCurrentUser(mockUser); 
      setIsLoggedIn(true); 
      localStorage.setItem('cf_user', JSON.stringify(mockUser)); 
      return; 
    } 
    alert("Acesso Master."); 
  };

  const filtered = empresas.filter(e => {
    const matchSearch = (e.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (e.cnpj || '').includes(searchTerm) || 
                        (e.franquia || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchResp = filterResponsavel === 'Todos' || e.responsavel === filterResponsavel;
    const matchFran = filterFranquia === 'Todas' || e.franquia === filterFranquia;
    if (visaoAtiva === 'Arquivo') return e.arquivada && matchSearch && matchResp && matchFran;
    if (e.arquivada) return false;
    if (isOnboardingTab !== e.isOnboarding) return false;
    let isSectorMatch = true;
    if (visaoAtiva === 'DP') isSectorMatch = e.bkoDP;
    else if (visaoAtiva === 'Fiscal') isSectorMatch = e.bkoFiscal;
    else if (visaoAtiva === 'Contábil') isSectorMatch = e.bkoContabil;
    return matchSearch && matchResp && matchFran && isSectorMatch;
  });

  const getAccentColor = (v: Visao) => {
    if (v === 'DP') return 'indigo';
    if (v === 'Fiscal') return 'emerald';
    if (v === 'Contábil') return 'purple';
    if (v === 'Arquivo') return 'rose';
    if (v === 'Usuarios') return 'slate';
    return 'indigo';
  };

  const getStatusColor = (val: string) => {
    if (val === '100% concluído' || val === 'Concluído' || val.includes('100%')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20';
    if (val.includes('Pendente') || val.includes('Aguardando') || val.includes('Sem')) return 'bg-rose-500/10 text-rose-400 border-rose-400/20';
    return 'bg-indigo-500/10 text-indigo-300 border-indigo-400/20';
  };

  const accent = getAccentColor(visaoAtiva);
  const baseSector = visaoAtiva;

  if (!isLoggedIn) {
     return (
        <div className="min-h-screen bg-[#040812] flex items-center justify-center p-6 text-slate-200">
           <div className="w-full max-w-md bg-[#0A101D] border border-white/5 p-12 rounded-[3rem] shadow-2xl">
              <h1 className="text-4xl font-black text-white italic mb-10 text-center uppercase tracking-tighter">Backoffice <span className="text-indigo-500">Mestre</span></h1>
              <form onSubmit={handleLogin} className="space-y-6">
                 <input type="text" placeholder="E-mail Master" className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white outline-none focus:border-indigo-500" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
                 <button className="w-full py-6 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-500 transition-all">ENTRAR NO SISTEMA</button>
              </form>
           </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200 font-sans overflow-hidden">
      <aside className={`flex h-screen fixed z-50 transition-all duration-500 ${isSidebarOpen ? 'w-[300px]' : 'w-[90px]'} bg-[#0A101D] border-r border-white/5 shadow-2xl backdrop-blur-3xl`}>
        <div className="w-[90px] flex flex-col items-center py-10 gap-10 h-full shrink-0 border-r border-white/5">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center cursor-pointer shadow-indigo-500/50 shadow-lg group"><Menu size={24} className="text-white group-hover:rotate-90 transition-transform"/></div>
           <nav className="flex flex-col gap-6">
             {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo', 'Usuarios'].map(v => (
               <button key={v} onClick={() => setVisaoAtiva(v as Visao)} title={v} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${visaoAtiva === v ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-600 hover:bg-white/5'}`}>
                 {v === 'Geral' ? <Globe size={24}/> : v === 'DP' ? <Users size={24}/> : v === 'Fiscal' ? <FileText size={24}/> : v === 'Arquivo' ? <Archive size={24}/> : <ShieldCheck size={24}/>}
               </button>
             ))}
           </nav>
           <button onClick={() => { localStorage.removeItem('cf_user'); setIsLoggedIn(false); }} className="mt-auto mb-12 text-rose-500/30 hover:text-rose-500"><LogOut size={24}/></button>
        </div>
        {isSidebarOpen && (
           <div className="flex-1 p-10 flex flex-col animate-in slide-in-from-left duration-500">
              <h3 className="text-[11px] font-black uppercase text-slate-600 tracking-[0.4em] mb-12 italic border-b border-white/5 pb-4">Backoffice Mestre</h3>
              <div className="space-y-6">
                 {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo', 'Usuarios'].map(m => (
                    <button key={m} onClick={() => setVisaoAtiva(m as Visao)} className={`w-full text-left p-2 rounded-xl text-xs font-black transition-all ${visaoAtiva === m ? 'text-indigo-400 translate-x-2' : 'text-slate-500 hover:text-slate-300'}`}>{m.toUpperCase()}</button>
                 ))}
                 {currentUser?.role === 'admin' && (
                    <button onClick={resetDatabase} className="mt-10 w-full text-left p-2 rounded-xl text-xs font-black text-rose-500/50 hover:text-rose-500 flex items-center gap-3"><Trash2 size={16}/> RESETAR BASE GLOBAL</button>
                 )}
              </div>
           </div>
        )}
      </aside>

      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'ml-[300px]' : 'ml-[90px]'} p-12 h-screen flex flex-col`}>
        <header className="flex justify-between items-start mb-12 shrink-0">
          <div className="space-y-2">
            <h2 className="text-7xl font-black text-white italic tracking-tighter uppercase leading-none">{visaoAtiva.replace('Arquivo', 'OFF-BOARDING')}</h2>
            <div className="flex gap-4 mt-6">
                <button onClick={() => setIsOnboardingTab(false)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${!isOnboardingTab ? 'bg-indigo-600 text-white shadow-2xl' : 'bg-white/5 text-slate-600'}`}>Carteira Mensal</button>
                <button onClick={() => setIsOnboardingTab(true)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${isOnboardingTab ? 'bg-orange-600 text-white shadow-2xl shadow-orange-500/20' : 'bg-white/5 text-slate-600'}`}>Trilha Onboarding 🔥</button>
            </div>
          </div>
          <div className="flex gap-6">
             <label className="bg-indigo-600 text-white px-8 py-4 rounded-3xl text-xs font-black uppercase flex items-center gap-4 shadow-indigo-500/20 shadow-2xl transition-all active:scale-95 cursor-pointer hover:bg-indigo-500"><Upload size={20}/> IMPORTAR ESTEIRA COMPLETA<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
          </div>
        </header>

        {visaoAtiva === 'Usuarios' ? (
           <div className="flex-1 bg-[#0A101D]/50 rounded-[4rem] p-16 border border-white/5 overflow-auto focus:outline-none">
              <h3 className="text-3xl font-black text-white italic mb-12">Gestão de Patrocínio Onety</h3>
              <div className="grid grid-cols-2 gap-10">
                 {allProfiles.map(p => (
                    <div key={p.id} className="p-8 bg-white/5 border border-white/10 rounded-[3rem] flex items-center justify-between">
                       <div className="space-y-1">
                          <h4 className="text-white font-black text-lg">{p.nome.toUpperCase()}</h4>
                          <p className="text-slate-600 text-[10px] font-black tracking-widest uppercase">{p.email}</p>
                       </div>
                       <div className="bg-emerald-500/10 text-emerald-400 px-6 py-2 rounded-xl text-[9px] font-black uppercase border border-emerald-400/20 shadow-lg">Analista Ativo</div>
                    </div>
                 ))}
              </div>
           </div>
        ) : (
           <>
              <div className="flex gap-6 mb-10 shrink-0">
                <div className="relative flex-1 group"><Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-indigo-400 transition-colors" size={24}/><input type="text" placeholder="Pesquisar Empresa, Grupo ou CNPJ..." className="w-full pl-22 pr-10 py-8 bg-[#0A101D] border border-white/5 rounded-[2.5rem] text-sm text-white font-black outline-none focus:border-indigo-500/30 transition-all placeholder-slate-800" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
                <select className="bg-[#0A101D] border border-white/5 text-slate-600 rounded-[2rem] px-10 py-8 text-xs font-black outline-none min-w-[280px]" value={filterFranquia} onChange={e=>setFilterFranquia(e.target.value)}>
                    <option value="Todas">FILTRAR GRUPO</option>
                    {Array.from(new Set(empresas.map(e => e.franquia))).sort().map(f => <option key={f} value={f}>{f?.toUpperCase()}</option>)}
                </select>
                <select className="bg-[#0A101D] border border-white/5 text-slate-600 rounded-[2rem] px-10 py-8 text-xs font-black outline-none min-w-[280px]" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                    <option value="Todos">FILTRAR ANALISTA</option>
                    {Array.from(new Set(empresas.map(e => e.responsavel))).sort().map(r => <option key={r} value={r}>{r?.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="bg-[#0A101D]/50 rounded-[4rem] border border-white/5 flex flex-col flex-1 overflow-hidden shadow-2xl relative">
                <div className="flex-1 overflow-auto scrollbar-hide px-8">
                  <div className="min-w-[1800px]">
                    <table className="w-full text-left border-separate border-spacing-0">
                      <thead>
                        <tr className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">
                          <th className="px-12 py-10 border-b border-white/5 sticky left-0 bg-[#161B2A] z-30">STATUS</th>
                          <th className="px-10 py-10 border-b border-white/5">EMPRESA</th>
                          <th className="px-10 py-10 border-b border-white/5">CNPJ</th>
                          <th className="px-10 py-10 border-b border-white/5">GRUPO</th>
                          <th className="px-10 py-10 border-b border-white/5">ANALISTA</th>
                          {baseSector === 'Geral' ? (
                            <>
                              <th className="px-6 py-10 border-b border-white/5 text-center">SETOR DP</th>
                              <th className="px-6 py-10 border-b border-white/5 text-center">SETOR FISCAL</th>
                              <th className="px-6 py-10 border-b border-white/5 text-center">SETOR CONTÁBIL</th>
                            </>
                          ) : baseSector === 'DP' ? (
                            <>
                              <th className="px-10 py-10 border-b border-white/5 text-center font-bold text-indigo-400">QTD FOLHA</th>
                              <th className="px-10 py-10 border-b border-white/5 text-center font-bold text-purple-400">PRO-L</th>
                              <th className="px-10 py-10 border-b border-white/5 text-center">VAR</th>
                              <th className="px-10 py-10 border-b border-white/5 text-center">ADIA</th>
                            </>
                          ) : (
                            <>
                              <th className="px-10 py-10 border-b border-white/5">TRIBUTAÇÃO</th>
                              <th className="px-10 py-10 border-b border-white/5">SISTEMA</th>
                            </>
                          )}
                          <th className="px-12 py-10 border-b border-white/5 text-right sticky right-0 bg-[#161B2A] z-30">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filtered.map(emp => (
                          <tr key={emp.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-12 py-8 whitespace-nowrap sticky left-0 bg-[#0A101D]/80 backdrop-blur-md z-10">
                               {baseSector === 'Geral' ? (
                                  <div className="flex gap-3 justify-start items-center h-full">
                                     <div title={`DP`} className={`w-3 h-3 rounded-full ${emp.bkoDP ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-800'}`}></div>
                                     <div title={`Fiscal`} className={`w-3 h-3 rounded-full ${emp.bkoFiscal ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}></div>
                                     <div title={`Contábil`} className={`w-3 h-3 rounded-full ${emp.bkoContabil ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-800'}`}></div>
                                  </div>
                               ) : (
                                  <select 
                                    value={isOnboardingTab ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia} 
                                    onChange={(e) => updateEmpresaDirectly(emp.id, isOnboardingTab ? (baseSector==='DP'?{faseOnbDP:e.target.value}:baseSector==='Fiscal'?{faseOnbFiscal:e.target.value}:{faseOnbContabil:e.target.value}) : {statusCompetencia: e.target.value})}
                                    className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase border-none shadow-2xl cursor-pointer ${getStatusColor(isOnboardingTab? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}`}
                                  >
                                     {(isOnboardingTab ? statusOnboarding : (baseSector==='DP'?statusOptionsDP : statusOptionsFiscalContabil)).map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}
                                  </select>
                               )}
                            </td>
                            <td className="px-10 py-8"><span className="text-[13px] font-black text-white tracking-widest uppercase group-hover:text-indigo-400 transition-colors">{emp.nome}</span></td>
                            <td className="px-10 py-8 font-mono text-xs text-slate-500 whitespace-nowrap">{emp.cnpj}</td>
                            <td className="px-10 py-8"><span className="text-[10px] font-black text-slate-400 bg-white/5 px-6 py-3 rounded-2xl border border-white/5 uppercase shadow-inner">{emp.franquia}</span></td>
                            <td className="px-10 py-8"><span className={`text-[11px] font-black text-${accent === 'rose' ? 'rose' : accent}-400 uppercase tracking-widest`}>{emp.responsavel}</span></td>
                            
                            {baseSector === 'Geral' ? (
                               <>
                                 <td className="px-6 py-8 text-center text-[10px] font-black text-slate-600 uppercase italic">{emp.bkoDP ? 'Ativo' : '-'}</td>
                                 <td className="px-6 py-8 text-center text-[10px] font-black text-slate-600 uppercase italic">{emp.bkoFiscal ? 'Ativo' : '-'}</td>
                                 <td className="px-6 py-8 text-center text-[10px] font-black text-slate-600 uppercase italic">{emp.bkoContabil ? 'Ativo' : '-'}</td>
                               </>
                            ) : baseSector === 'DP' ? (
                               <>
                                  <td className="px-10 py-8 text-center"><div className="mx-auto w-16 h-10 rounded-2xl flex items-center justify-center font-black text-[12px] bg-indigo-500/10 text-indigo-300 shadow-inner">{emp.qtdFuncionarios}</div></td>
                                  <td className="px-10 py-8 text-center"><div className="mx-auto w-16 h-10 rounded-2xl flex items-center justify-center font-black text-[12px] bg-purple-500/10 text-purple-300 shadow-inner">{emp.qtdProlabore}</div></td>
                                  <td className="px-10 py-8 text-center"><div className={`mx-auto w-14 h-10 rounded-2xl flex items-center justify-center font-black text-[10px] ${emp.temVariavel ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-slate-800'}`}>VAR</div></td>
                                  <td className="px-10 py-8 text-center"><div className={`mx-auto w-14 h-10 rounded-2xl flex items-center justify-center font-black text-[10px] ${emp.temAdiantamento ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-slate-800'}`}>ADIA</div></td>
                               </>
                            ) : (
                               <>
                                  <td className="px-10 py-8 text-[11px] font-black text-white/50 uppercase">{emp.tributacao}</td>
                                  <td className="px-10 py-8 text-[11px] font-black text-white/30 uppercase italic">{emp.sistemaBase}</td>
                                </>
                            )}
                            <td className="px-12 py-8 text-right whitespace-nowrap sticky right-0 bg-[#0A101D]/80 backdrop-blur-md z-10">
                               <button onClick={() => { setSelectedEmpresa(emp); setIsEditModalOpen(true); }} className="p-5 bg-white/5 rounded-3xl text-slate-600 group-hover:text-white group-hover:bg-white/10 transition-all shadow-2xl"><Pencil size={24}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
           </>
        )}
      </main>

      {isEditModalOpen && selectedEmpresa && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-12 backdrop-blur-3xl bg-black/80">
            <div className="bg-[#0A101D] border border-white/10 rounded-[6rem] w-full max-w-6xl p-24 shadow-2xl relative max-h-[95vh] overflow-auto scrollbar-hide animate-in zoom-in-95 duration-300">
               <button onClick={() => setIsEditModalOpen(false)} className="absolute top-16 right-16 text-slate-600 hover:text-white transition-all"><X size={48}/></button>
               <h3 className="text-5xl font-black text-white italic mb-16 text-center uppercase tracking-tighter decoration-indigo-600 underline decoration-8 underline-offset-8">Ajuste Master Patrocinado</h3>
               
               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4"><label className="text-xs font-black text-slate-600 ml-8 uppercase tracking-widest">Razão Social</label><input className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-xl text-white uppercase font-black focus:border-indigo-500 transition-all outline-none" value={selectedEmpresa.nome} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {nome: e.target.value})}/></div>
                  <div className="space-y-4"><label className="text-xs font-black text-slate-600 ml-8 uppercase tracking-widest">Analista Responsável</label><input className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-xl text-white uppercase font-black focus:border-indigo-500 transition-all outline-none" value={selectedEmpresa.responsavel} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {responsavel: e.target.value})}/></div>
                  
                  <div className="col-span-2 grid grid-cols-3 gap-8 bg-black/30 p-12 rounded-[4rem] border border-white/5 mt-8 text-slate-200">
                     <div className="space-y-6">
                        <h4 className="text-indigo-400 text-xs font-black uppercase tracking-widest border-b border-indigo-400/20 pb-4">Setor DP</h4>
                        <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Qtd Folha</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.qtdFuncionarios} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {qtdFuncionarios: e.target.value})}/></div>
                        <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Qtd Pro-L</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.qtdProlabore} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {qtdProlabore: e.target.value})}/></div>
                        <div className="flex flex-col gap-3 pt-4">
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { temVariavel: !selectedEmpresa!.temVariavel })} className={`py-4 rounded-xl text-[9px] font-black uppercase transition-all ${selectedEmpresa.temVariavel ? 'bg-orange-600 text-white' : 'bg-white/5 text-slate-700'}`}>VARIÁVEL (VAR)</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { temAdiantamento: !selectedEmpresa!.temAdiantamento })} className={`py-4 rounded-xl text-[9px] font-black uppercase transition-all ${selectedEmpresa.temAdiantamento ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-700'}`}>ADIANTAMENTO (ADIA)</button>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest border-b border-emerald-400/20 pb-4">Setor Fiscal</h4>
                        <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Tributação</label><select className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.tributacao} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {tributacao: e.target.value})}>{tributacaoOptions.map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}</select></div>
                        <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Sistema</label><select className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.sistemaBase} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {sistemaBase: e.target.value})}>{sistemaOptions.map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}</select></div>
                     </div>

                     <div className="space-y-6">
                        <h4 className="text-purple-400 text-xs font-black uppercase tracking-widest border-b border-purple-400/20 pb-4">Acessos & Status</h4>
                        <div className="flex flex-col gap-4 pt-4">
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { bkoDP: !selectedEmpresa!.bkoDP })} className={`py-6 rounded-2xl text-[10px] font-black uppercase transition-all ${selectedEmpresa.bkoDP ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-800'}`}>Ativo no DP</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { bkoFiscal: !selectedEmpresa!.bkoFiscal })} className={`py-6 rounded-2xl text-[10px] font-black uppercase transition-all ${selectedEmpresa.bkoFiscal ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-slate-800'}`}>Ativo no Fiscal</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { bkoContabil: !selectedEmpresa!.bkoContabil })} className={`py-6 rounded-2xl text-[10px] font-black uppercase transition-all ${selectedEmpresa.bkoContabil ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-slate-800'}`}>Ativo no Contábil</button>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="mt-16 flex gap-8 justify-center border-t border-white/5 pt-16">
                  {selectedEmpresa.isOnboarding ? (
                     <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { isOnboarding: false })} className="px-16 py-8 bg-emerald-600 text-white rounded-full text-sm font-black uppercase shadow-2xl flex items-center gap-6 hover:scale-110 active:scale-95 transition-all"><Rocket size={32}/> GRADUAR PARA CARTEIRA OFICIAL</button>
                  ) : (
                     <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { isOnboarding: true })} className="px-16 py-8 bg-orange-600 text-white rounded-full text-sm font-black uppercase shadow-2xl flex items-center gap-6 hover:scale-110 active:scale-95 transition-all"><ArrowRightCircle size={12}/> VOLTAR PARA ONBOARDING</button>
                  )}
               </div>

               <div className="flex gap-10 mt-16">
                  <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-12 bg-white/10 rounded-full text-white font-black uppercase text-xl shadow-2xl flex items-center justify-center gap-6 transition-all hover:bg-white/20 border border-white/10"><CheckCircle2 size={32}/> CONCLUIR EDIÇÃO</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
