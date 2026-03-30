import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, LogOut, Globe, LayoutDashboard, Search, Upload,
  Pencil, Menu, FileText, Archive, X, ShieldCheck, Lock, CheckCircle2
} from 'lucide-react';

// Tipos
type Visao = 'Geral' | 'DP' | 'DP_Onb' | 'Fiscal' | 'Fiscal_Onb' | 'Contábil' | 'Contábil_Onb' | 'Arquivo' | 'Usuarios';

interface Funcionario {
  id: string;
  nome: string;
}

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
  atividade: string;
  inadimplente: boolean;
  statusCompetencia: string; 
  faseOnbDP: string; 
  faseOnbFiscal: string;
  faseOnbContabil: string;
  temProcuracao: boolean;
  bkoDP: boolean;
  bkoFiscal: boolean;
  bkoContabil: boolean;
  qtdFuncionarios?: string;
  qtdProlabore?: string;
  temVariavel?: boolean;
  temAdiantamento?: boolean;
  temConsignado?: boolean;
  arquivada: boolean;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [visaoAtiva, setVisaoAtiva] = useState<Visao>('Geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterFranquia, setFilterFranquia] = useState('Todas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const fetchData = async () => {
    let query = supabase.from('backoffice_empresas').select('*');
    if (currentUser?.role !== 'admin' && currentUser?.responsavel_id) {
       query = query.eq('responsavel_id', currentUser.responsavel_id);
    }
    const { data: emp } = await query.order('created_at', { ascending: false });
    if (emp) setEmpresas(emp as Empresa[]);
    const { data: func } = await supabase.from('funcionarios').select('*');
    if (func) setFuncionarios(func as Funcionario[]);
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
    if (selectedEmpresa?.id === id) setSelectedEmpresa(prev => ({...prev!, ...updates}));
    await supabase.from('backoffice_empresas').update(updates).eq('id', id);
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
    alert("Login Master Exclusivo.");
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
            sistemaBase: r['SISTEMA'] || 'Nuvem',
            responsavel: r['RESPONSAVEL'] || 'Indefinido',
            bkoDP: true, bkoFiscal: true, bkoContabil: true,
            statusCompetencia: 'Pendente', faseOnbDP: 'Pendente', faseOnbFiscal: 'Pendente', faseOnbContabil: 'Pendente',
            qtdFuncionarios: r['FUNCIONARIOS'] || '0',
            qtdProlabore: r['PROLABORE'] || '0',
            temVariavel: false, 
            arquivada: false
         }));
         const { data: inserted } = await supabase.from('backoffice_empresas').insert(toInsert).select();
         if(inserted) fetchData();
      }
    });
  };

  const filtered = empresas.filter(e => {
    const matchSearch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        e.cnpj.includes(searchTerm) || 
                        e.franquia.toLowerCase().includes(searchTerm.toLowerCase());
    const matchResp = filterResponsavel === 'Todos' || e.responsavel_id === filterResponsavel;
    const matchFran = filterFranquia === 'Todas' || e.franquia === filterFranquia;
    if (visaoAtiva === 'Arquivo') return e.arquivada && matchSearch && matchResp && matchFran;
    if (e.arquivada) return false;
    let isSectorMatch = true;
    if (visaoAtiva.startsWith('DP')) isSectorMatch = e.bkoDP;
    else if (visaoAtiva.startsWith('Fiscal')) isSectorMatch = e.bkoFiscal;
    else if (visaoAtiva.startsWith('Contábil')) isSectorMatch = e.bkoContabil;
    return matchSearch && matchResp && matchFran && isSectorMatch;
  });

  const getStatusColor = (val: string) => {
    if (val === '100% concluído' || val === 'Concluído') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (val.includes('Pendente') || val.includes('Sem')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
  };

  if (!isLoggedIn) {
     return (
       <div className="min-h-screen bg-[#040812] flex items-center justify-center p-6">
         <div className="bg-[#0A101D] border border-white/10 rounded-[3rem] w-full max-w-lg p-16 shadow-2xl">
           <div className="flex justify-center mb-10"><div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl"><Lock size={32} className="text-white"/></div></div>
           <h1 className="text-5xl font-black text-center mb-12 text-white italic tracking-tighter uppercase whitespace-nowrap">CF BACKOFFICE</h1>
           <form onSubmit={handleLogin} className="space-y-6">
             <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500/50 text-sm font-bold placeholder-slate-700" placeholder="E-mail Corporativo" />
             <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500/50 text-sm font-bold placeholder-slate-700" placeholder="Sua Senha" />
             <button type="submit" className="w-full bg-indigo-600 py-6 rounded-3xl font-black text-white uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all">ENTRAR NO PAINEL</button>
           </form>
         </div>
       </div>
     );
  }

  const baseSector = visaoAtiva.split('_')[0];
  const isOnbView = visaoAtiva.includes('_Onb');

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200 font-sans overflow-hidden">
      <aside className={`flex h-screen fixed z-50 transition-all duration-500 ${isSidebarOpen ? 'w-[300px]' : 'w-[90px]'} bg-[#0A101D] border-r border-white/5 shadow-2xl`}>
        <div className="w-[90px] flex flex-col items-center py-10 gap-8 h-full shrink-0 border-r border-white/5">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center cursor-pointer shadow-indigo-500/50 shadow-lg"><Menu size={20} className="text-white"/></div>
           <nav className="flex flex-col gap-6">
             {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo', 'Usuarios'].map(v => (
               <button key={v} onClick={() => setVisaoAtiva(v as Visao)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${visaoAtiva.startsWith(v) ? 'bg-indigo-500/20 text-white border border-indigo-500/30' : 'text-slate-600 hover:bg-white/5'}`}>
                 {v === 'Geral' ? <Globe size={20}/> : v === 'DP' ? <Users size={20}/> : v === 'Fiscal' ? <FileText size={20}/> : v === 'Arquivo' ? <Archive size={20}/> : v === 'Usuarios' ? <ShieldCheck size={20}/> : <LayoutDashboard size={20}/>}
               </button>
             ))}
           </nav>
           <button onClick={() => { localStorage.removeItem('cf_user'); setIsLoggedIn(false); }} className="mt-auto mb-10 text-rose-500/30 hover:text-rose-500 transition-all"><LogOut size={20}/></button>
        </div>
        {isSidebarOpen && (
           <div className="flex-1 p-8 flex flex-col animate-in fade-in duration-500">
              <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em] mb-10 italic">Gerenciamento</h3>
              <div className="space-y-6">
                 {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo', 'Usuarios'].map(m => (
                    <div key={m} className="space-y-3">
                       <button onClick={() => setVisaoAtiva(m as Visao)} className={`w-full text-left p-2 rounded-xl text-[11px] font-black transition-all ${visaoAtiva.startsWith(m) ? 'text-indigo-400 font-black' : 'text-slate-500'}`}>{m.toUpperCase()}</button>
                       {(m === 'DP' || m === 'Fiscal' || m === 'Contábil') && visaoAtiva.startsWith(m) && (
                          <div className="pl-4 flex flex-col gap-2 border-l border-white/5">
                             <button onClick={() => setVisaoAtiva(m as Visao)} className={`text-left text-[10px] font-black ${visaoAtiva === m ? 'text-white underline decoration-indigo-500 decoration-2 underline-offset-4' : 'text-slate-600'}`}>MENSAL</button>
                             <button onClick={() => setVisaoAtiva(`${m}_Onb` as Visao)} className={`text-left text-[10px] font-black ${visaoAtiva === `${m}_Onb` ? 'text-white underline decoration-indigo-500 decoration-2 underline-offset-4' : 'text-slate-600'}`}>ONBOARDING</button>
                          </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        )}
      </aside>

      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'ml-[300px]' : 'ml-[90px]'} p-10 h-screen flex flex-col`}>
        <header className="flex justify-between items-end mb-12 shrink-0">
          <div>
            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{visaoAtiva.replace('_Onb', '').replace('Arquivo', 'OFF-BOARDING')}</h2>
            <p className="text-[11px] text-indigo-400 font-black uppercase tracking-[0.6em] mt-3">{isOnbView ? '➔ TRILHA DE ONBOARDING' : '➔ FLUXO MENSAL'}</p>
          </div>
          <label className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-3 shadow-indigo-500/20 shadow-2xl transition-transform active:scale-95 cursor-pointer"><Upload size={16}/> IMPORTAR PLANILHA<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
        </header>

        {visaoAtiva === 'Usuarios' ? (
           <div className="flex-1 bg-[#0A101D]/50 rounded-[3rem] border border-white/5 p-10 overflow-auto">
              <h3 className="text-xl font-black text-white uppercase italic mb-8">Gestão de Time Patrocinado</h3>
              <div className="grid grid-cols-3 gap-6">
                 {allProfiles.map(p => (
                    <div key={p.id} className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4">
                       <h4 className="text-white font-black text-sm">{p.nome.toUpperCase()}</h4>
                       <p className="text-slate-500 text-[10px] font-bold">{p.email}</p>
                       <button className="bg-emerald-600 p-4 rounded-xl text-[10px] font-black text-white uppercase">Aprovado</button>
                    </div>
                 ))}
              </div>
           </div>
        ) : (
           <>
              <div className="flex gap-4 mb-8 shrink-0">
                <div className="relative flex-1 group"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-all font-black" size={18}/><input type="text" placeholder="Pesquisar Empresa, CNPJ ou Franquia..." className="w-full pl-16 pr-8 py-5 bg-[#0A101D] border border-white/5 rounded-3xl text-[12px] text-white outline-none focus:border-indigo-500/40 font-black placeholder-slate-700 shadow-inner" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
                <select className="bg-[#0A101D] border border-white/5 text-slate-500 rounded-2xl px-8 py-5 text-[11px] font-black outline-none min-w-[240px]" value={filterFranquia} onChange={e=>setFilterFranquia(e.target.value)}>
                    <option value="Todas">FILTRAR FRANQUIA</option>
                    {Array.from(new Set(empresas.map(e => e.franquia))).sort().map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
                <select className="bg-[#0A101D] border border-white/5 text-slate-500 rounded-2xl px-8 py-5 text-[11px] font-black outline-none min-w-[240px]" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                    <option value="Todos">FILTRAR ANALISTA</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="bg-[#0A101D]/50 rounded-[3rem] border border-white/5 flex flex-col flex-1 overflow-hidden shadow-2xl relative">
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-[#0D1424]/90 backdrop-blur-xl text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
                        <th className="px-12 py-8 border-b border-white/5">SITUAÇÃO</th>
                        <th className="px-10 py-8 border-b border-white/5">EMPRESA</th>
                        <th className="px-10 py-8 border-b border-white/5">CNPJ</th>
                        <th className="px-10 py-8 border-b border-white/5">FRANQUIA</th>
                        <th className="px-10 py-8 border-b border-white/5">ANALISTA</th>
                        {baseSector === 'DP' && <th className="px-10 py-8 border-b border-white/5">FOLHA / VAR</th>}
                        <th className="px-10 py-8 border-b border-white/5 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map(emp => (
                        <tr key={emp.id} className="hover:bg-indigo-500/[0.03] transition-all group">
                          <td className="px-12 py-6">
                             <span className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-sm border border-white/5 ${getStatusColor(isOnbView? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}`}>
                                {(isOnbView? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}
                             </span>
                          </td>
                          <td className="px-10 py-6"><span className="text-[12px] font-black text-white tracking-widest uppercase group-hover:text-indigo-400 transition-colors">{emp.nome}</span></td>
                          <td className="px-10 py-6 font-mono text-[11px] text-slate-500">{emp.cnpj}</td>
                          <td className="px-10 py-6"><span className="text-[10px] font-black text-slate-400 bg-white/5 px-4 py-2 rounded-xl border border-white/5 uppercase">{emp.franquia}</span></td>
                          <td className="px-10 py-6"><span className="text-[10px] font-black text-indigo-400 uppercase">{emp.responsavel}</span></td>
                          {baseSector === 'DP' && (
                             <td className="px-10 py-6">
                                <div className="flex gap-2">
                                   <div className={`w-10 h-8 rounded-xl flex items-center justify-center font-black text-[10px] ${emp.qtdFuncionarios !== '0' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-800'}`}>{emp.qtdFuncionarios}F</div>
                                   {emp.temVariavel && <div className="w-10 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-[10px]">VAR</div>}
                                </div>
                             </td>
                          )}
                          <td className="px-10 py-6 text-right">
                             <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => { setSelectedEmpresa(emp); setIsEditModalOpen(true); }} className="p-4 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all shadow-xl"><Pencil size={16}/></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
           </>
        )}
      </main>

      {isEditModalOpen && selectedEmpresa && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-12 backdrop-blur-3xl bg-black/80">
            <div className="bg-[#0A101D] border border-white/10 rounded-[5rem] w-full max-w-6xl p-24 shadow-2xl relative max-h-[90vh] overflow-auto">
               <button onClick={() => setIsEditModalOpen(false)} className="absolute top-12 right-12 text-slate-600 hover:text-white transition-all"><X size={32}/></button>
               <h3 className="text-4xl font-black text-white italic mb-16 text-center uppercase tracking-tighter decoration-indigo-500 underline decoration-8 underline-offset-8">Painel de Ajuste Detalhado</h3>
               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-3"><label className="text-[11px] font-black text-slate-600 ml-4 uppercase">Razão Social</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-lg text-white uppercase font-black" value={selectedEmpresa.nome} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {nome: e.target.value})}/></div>
                  <div className="space-y-3"><label className="text-[11px] font-black text-slate-600 ml-4 uppercase">CNPJ</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-lg text-white font-black" value={selectedEmpresa.cnpj} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {cnpj: e.target.value})}/></div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-3"><label className="text-[11px] font-black text-slate-600 ml-4 uppercase">Qtd Folha</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.qtdFuncionarios} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {qtdFuncionarios: e.target.value})}/></div>
                     <div className="space-y-3"><label className="text-[11px] font-black text-slate-600 ml-4 uppercase">Qtd Pro-L</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.qtdProlabore} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {qtdProlabore: e.target.value})}/></div>
                  </div>
               </div>
               <div className="flex gap-8 mt-16 flex-wrap justify-center bg-black/20 p-10 rounded-[3rem]">
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoDP: !selectedEmpresa.bkoDP })} className={`px-10 py-6 rounded-3xl text-[11px] font-black uppercase transition-all flex items-center gap-3 ${selectedEmpresa.bkoDP ? 'bg-indigo-600 text-white shadow-2xl' : 'bg-white/5 text-slate-700'}`}>SETOR DP {selectedEmpresa.bkoDP ? '✓' : '✖'}</button>
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoFiscal: !selectedEmpresa.bkoFiscal })} className={`px-10 py-6 rounded-3xl text-[11px] font-black uppercase transition-all flex items-center gap-3 ${selectedEmpresa.bkoFiscal ? 'bg-emerald-600 text-white shadow-2xl' : 'bg-white/5 text-slate-700'}`}>SETOR FISCAL {selectedEmpresa.bkoFiscal ? '✓' : '✖'}</button>
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoContabil: !selectedEmpresa.bkoContabil })} className={`px-10 py-6 rounded-3xl text-[11px] font-black uppercase transition-all flex items-center gap-3 ${selectedEmpresa.bkoContabil ? 'bg-purple-600 text-white shadow-2xl' : 'bg-white/5 text-slate-700'}`}>SETOR CONTÁBIL {selectedEmpresa.bkoContabil ? '✓' : '✖'}</button>
               </div>
               <button onClick={() => setIsEditModalOpen(false)} className="w-full mt-16 py-10 bg-indigo-600 rounded-[2.5rem] text-white font-black uppercase text-base shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-6"><CheckCircle2 size={24}/> CONCLUIR AJUSTES</button>
            </div>
         </div>
      )}
    </div>
  );
}
