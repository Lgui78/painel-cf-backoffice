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

const statusOptionsDP = [
  "100% concluído", "Folha enviada/variável", "Folha enviada aguardando conferência do franqueado", 
  "Aguardando/variáveis", "Certificado com 2 etapas", "Liberado pra envio", 
  "Sem certificado", "Certificado vencido", "Parametrizar", "Sem procuração", "Aguardando T.I"
];

const statusOptionsFiscalContabil = ["Pendente", "Em Andamento", "Concluído", "Em Conferência"];
const tributacaoOptions = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "Isento/Imune"];
const sistemaOptions = ["Alterdata", "Domínio", "Nuvem", "Questor", "SCI", "Outros"];

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
            temVariavel: false, arquivada: false
         }));
         await supabase.from('backoffice_empresas').insert(toInsert);
         fetchData();
         alert("Planilha Importada com Sucesso!");
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => { e.preventDefault(); if (loginEmail === 'gui.contato8@gmail.com' || loginEmail === 'admin') { const mockUser: UserProfile = { id: 'master', email: loginEmail, nome: 'Gestor Master', role: 'admin', approved: true }; setCurrentUser(mockUser); setIsLoggedIn(true); localStorage.setItem('cf_user', JSON.stringify(mockUser)); return; } alert("Acesso Master."); };

  const filtered = empresas.filter(e => {
    const matchSearch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        e.cnpj.includes(searchTerm) || 
                        e.franquia.toLowerCase().includes(searchTerm.toLowerCase());
    const matchResp = filterResponsavel === 'Todos' || e.responsavel === filterResponsavel;
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
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  };

  if (!isLoggedIn) {
     return (
       <div className="min-h-screen bg-[#040812] flex items-center justify-center p-6">
         <div className="bg-[#0A101D] border border-white/10 rounded-[4rem] w-full max-w-lg p-20 shadow-2xl">
           <div className="flex justify-center mb-12"><div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-110 duration-500"><Lock size={40} className="text-white"/></div></div>
           <h1 className="text-6xl font-black text-center mb-4 text-white italic tracking-tighter uppercase whitespace-nowrap">CF BACKOFFICE</h1>
           <p className="text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] mb-16 italic">Patrocinado pela Inteligência Onety</p>
           <form onSubmit={handleLogin} className="space-y-8">
             <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-8 bg-white/5 border border-white/10 rounded-3xl text-white outline-none focus:border-indigo-500/50 text-base font-bold placeholder-slate-700" placeholder="E-mail Administrativo" />
             <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-8 bg-white/5 border border-white/10 rounded-3xl text-white outline-none focus:border-indigo-500/50 text-base font-bold placeholder-slate-700" placeholder="Sua Senha Master" />
             <button type="submit" className="w-full bg-indigo-600 py-8 rounded-[2rem] font-black text-white uppercase tracking-[0.3em] text-xs shadow-2xl active:scale-95 transition-all">ENTRAR NO SISTEMA</button>
           </form>
         </div>
       </div>
     );
  }

  const baseSector = visaoAtiva.split('_')[0];
  const isOnbView = visaoAtiva.includes('_Onb');

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200 font-sans overflow-hidden">
      <aside className={`flex h-screen fixed z-50 transition-all duration-500 ${isSidebarOpen ? 'w-[300px]' : 'w-[90px]'} bg-[#0A101D] border-r border-white/5 shadow-2xl backdrop-blur-3xl`}>
        <div className="w-[90px] flex flex-col items-center py-10 gap-8 h-full shrink-0 border-r border-white/5">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center cursor-pointer shadow-indigo-500/50 shadow-lg"><Menu size={24} className="text-white"/></div>
           <nav className="flex flex-col gap-6">
             {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo', 'Usuarios'].map(v => (
               <button key={v} onClick={() => setVisaoAtiva(v as Visao)} title={v} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${visaoAtiva.startsWith(v) ? 'bg-indigo-500/20 text-white border border-indigo-500/30 shadow-xl shadow-indigo-500/10' : 'text-slate-600 hover:bg-white/5'}`}>
                 {v === 'Geral' ? <Globe size={24}/> : v === 'DP' ? <Users size={24}/> : v === 'Fiscal' ? <FileText size={24}/> : v === 'Arquivo' ? <Archive size={24}/> : v === 'Usuarios' ? <ShieldCheck size={24}/> : <LayoutDashboard size={24}/>}
               </button>
             ))}
           </nav>
           <button onClick={() => { localStorage.removeItem('cf_user'); setIsLoggedIn(false); }} className="mt-auto mb-10 text-rose-500/30 hover:text-rose-500"><LogOut size={24}/></button>
        </div>
        {isSidebarOpen && (
           <div className="flex-1 p-10 flex flex-col animate-in slide-in-from-left duration-500">
              <h3 className="text-[11px] font-black uppercase text-slate-600 tracking-[0.4em] mb-12 italic border-b border-white/5 pb-4">Navegação Mestre</h3>
              <div className="space-y-8">
                 {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo', 'Usuarios'].map(m => (
                    <div key={m} className="space-y-4">
                       <button onClick={() => setVisaoAtiva(m as Visao)} className={`w-full text-left p-2 rounded-xl text-xs font-black transition-all ${visaoAtiva.startsWith(m) ? 'text-indigo-400 translate-x-2' : 'text-slate-500'}`}>{m.toUpperCase()}</button>
                       {(m === 'DP' || m === 'Fiscal' || m === 'Contábil') && visaoAtiva.startsWith(m) && (
                          <div className="pl-6 flex flex-col gap-4 border-l border-white/5">
                             <button onClick={() => setVisaoAtiva(m as Visao)} className={`text-left text-[10px] font-black ${visaoAtiva === m ? 'text-white' : 'text-slate-600'}`}>➔ FLUXO MENSAL</button>
                             <button onClick={() => setVisaoAtiva(`${m}_Onb` as Visao)} className={`text-left text-[10px] font-black ${visaoAtiva === `${m}_Onb` ? 'text-white' : 'text-slate-600'}`}>➔ TRILHA ONBOARDING</button>
                          </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        )}
      </aside>

      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'ml-[300px]' : 'ml-[90px]'} p-12 h-screen flex flex-col`}>
        <header className="flex justify-between items-end mb-16 shrink-0">
          <div><h2 className="text-7xl font-black text-white italic tracking-tighter uppercase leading-none">{visaoAtiva.replace('_Onb', '').replace('Arquivo', 'OFF-BOARDING')}</h2><p className="text-xs text-indigo-500 font-bold uppercase tracking-[0.7em] mt-5 italic underline underline-offset-8 decoration-4">{isOnbView ? '➔ Fase Integração' : '➔ Operação Mensal Ativa'}</p></div>
          <label className="bg-indigo-600 text-white px-10 py-6 rounded-[2rem] text-xs font-black uppercase flex items-center gap-4 shadow-indigo-500/30 shadow-2xl transition-transform active:scale-95 cursor-pointer animate-pulse"><Upload size={20}/> IMPORTAR COMPLETA PLANILHA<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
        </header>

        {visaoAtiva === 'Usuarios' ? (
           <div className="flex-1 bg-[#0A101D]/50 rounded-[4rem] border border-white/5 p-16 overflow-auto backdrop-blur-xl">
              <h3 className="text-3xl font-black text-white uppercase italic mb-12 border-b border-white/5 pb-6">Gestão de Patrocinados</h3>
              <div className="grid grid-cols-2 gap-10">
                 {allProfiles.map(p => (
                    <div key={p.id} className="p-10 bg-white/5 border border-white/10 rounded-[3rem] flex items-center justify-between group hover:bg-white/[0.08] transition-all"><div className="space-y-2"><h4 className="text-white font-black text-lg group-hover:text-indigo-400 transition-colors uppercase">{p.nome}</h4><p className="text-slate-600 text-xs font-bold tracking-widest">{p.email}</p></div><div className="bg-emerald-500/20 text-emerald-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase border border-emerald-500/30 shadow-lg">Analista Ativo</div></div>
                 ))}
              </div>
           </div>
        ) : (
           <>
              <div className="flex gap-6 mb-12 shrink-0">
                <div className="relative flex-1 group shadow-2xl rounded-[2.5rem]"><Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-all" size={24}/><input type="text" placeholder="Filtrar por Empresa, CNPJ ou Franquia..." className="w-full pl-20 pr-10 py-8 bg-[#0A101D] border border-white/5 rounded-[2.5rem] text-sm text-white font-black outline-none focus:border-indigo-500/50 transition-all placeholder-slate-800" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
                <select className="bg-[#0A101D] border border-white/5 text-slate-500 rounded-[2rem] px-10 py-8 text-xs font-black outline-none min-w-[280px] shadow-2xl" value={filterFranquia} onChange={e=>setFilterFranquia(e.target.value)}>
                    <option value="Todas">GRUPO / FRANQUIA</option>
                    {Array.from(new Set(empresas.map(e => e.franquia))).sort().map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
                <select className="bg-[#0A101D] border border-white/5 text-slate-500 rounded-[2rem] px-10 py-8 text-xs font-black outline-none min-w-[280px] shadow-2xl" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                    <option value="Todos">ANALISTA RESPONSÁVEL</option>
                    {Array.from(new Set(empresas.map(e => e.responsavel))).sort().map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="bg-[#0A101D]/50 rounded-[4rem] border border-white/5 flex flex-col flex-1 overflow-hidden shadow-2xl relative backdrop-blur-2xl">
                <div className="flex-1 overflow-auto scrollbar-hide">
                  <div className="min-w-[1500px]">
                    <table className="w-full text-left border-separate border-spacing-0">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-[#0D1424]/90 backdrop-blur-3xl text-slate-600 text-[11px] font-black uppercase tracking-[0.4em]">
                          <th className="px-12 py-10 border-b border-white/5">STATUS OPERAÇÃO</th>
                          <th className="px-10 py-10 border-b border-white/5">NOME EMPRESA</th>
                          <th className="px-10 py-10 border-b border-white/5">CNPJ</th>
                          <th className="px-10 py-10 border-b border-white/5">GRUPO</th>
                          <th className="px-10 py-10 border-b border-white/5">ANALISTA</th>
                          <th className="px-10 py-10 border-b border-white/5">TRIBUTAÇÃO</th>
                          <th className="px-10 py-10 border-b border-white/5">SISTEMA</th>
                          {baseSector === 'DP' && <th className="px-10 py-10 border-b border-white/5">CONTROLE FOLHA</th>}
                          <th className="px-12 py-10 border-b border-white/5 text-right">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filtered.map(emp => (
                          <tr key={emp.id} className="hover:bg-indigo-500/[0.04] transition-all group">
                            <td className="px-12 py-8 whitespace-nowrap">
                               <select 
                                 value={isOnbView ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia} 
                                 onChange={(e) => updateEmpresaDirectly(emp.id, isOnbView ? (baseSector==='DP'?{faseOnbDP:e.target.value}:baseSector==='Fiscal'?{faseOnbFiscal:e.target.value}:{faseOnbContabil:e.target.value}) : {statusCompetencia: e.target.value})}
                                 className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase border-none shadow-2xl cursor-pointer ${getStatusColor(isOnbView? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}`}
                               >
                                  {(baseSector==='DP'?statusOptionsDP:statusOptionsFiscalContabil).map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}
                               </select>
                            </td>
                            <td className="px-10 py-8"><span className="text-base font-black text-white tracking-widest uppercase group-hover:text-indigo-400 transition-colors">{emp.nome}</span></td>
                            <td className="px-10 py-8 font-mono text-xs text-slate-500 whitespace-nowrap">{emp.cnpj}</td>
                            <td className="px-10 py-8"><span className="text-[11px] font-black text-slate-400 bg-white/5 px-6 py-3 rounded-2xl border border-white/5 uppercase shadow-inner">{emp.franquia}</span></td>
                            <td className="px-10 py-8"><span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest underline underline-offset-4 decoration-indigo-500/30">{emp.responsavel}</span></td>
                            <td className="px-10 py-8 text-[11px] font-black text-slate-600 uppercase">{emp.tributacao}</td>
                            <td className="px-10 py-8 text-[11px] font-black text-slate-600 uppercase italic">{emp.sistemaBase}</td>
                            {baseSector === 'DP' && (
                               <td className="px-10 py-8 whitespace-nowrap">
                                  <div className="flex gap-4">
                                     <div className={`w-14 h-10 rounded-2xl flex items-center justify-center font-black text-[10px] shadow-sm ${emp.qtdFuncionarios !== '0' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-800'}`}>{emp.qtdFuncionarios} F</div>
                                     <div className={`w-14 h-10 rounded-2xl flex items-center justify-center font-black text-[10px] shadow-sm ${emp.temVariavel ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-slate-800'}`}>VAR</div>
                                  </div>
                               </td>
                            )}
                            <td className="px-12 py-8 text-right whitespace-nowrap">
                               <button onClick={() => { setSelectedEmpresa(emp); setIsEditModalOpen(true); }} className="p-5 bg-white/5 rounded-3xl text-slate-500 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 shadow-2xl"><Pencil size={24}/></button>
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
            <div className="bg-[#0A101D] border border-white/10 rounded-[6rem] w-full max-w-6xl p-24 shadow-2xl relative max-h-[95vh] overflow-auto scrollbar-hide">
               <button onClick={() => setIsEditModalOpen(false)} className="absolute top-16 right-16 text-slate-600 hover:text-white transition-transform hover:rotate-90 duration-500"><X size={48}/></button>
               <h3 className="text-5xl font-black text-white italic mb-20 text-center uppercase tracking-tighter decoration-indigo-600 underline decoration-8 underline-offset-[12px]">Painel Master de Ajuste</h3>
               
               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4"><label className="text-xs font-black text-slate-500 ml-8 uppercase tracking-widest">Nome da Empresa</label><input className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-xl text-white uppercase font-black focus:border-indigo-500 transition-all" value={selectedEmpresa.nome} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {nome: e.target.value})}/></div>
                  <div className="space-y-4"><label className="text-xs font-black text-slate-500 ml-8 uppercase tracking-widest">Analista Responsável</label><input className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-xl text-white uppercase font-black focus:border-indigo-500 transition-all" value={selectedEmpresa.responsavel} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {responsavel: e.target.value})}/></div>
                  
                  <div className="space-y-4">
                     <label className="text-xs font-black text-slate-500 ml-8 uppercase tracking-widest">Regime Tributário</label>
                     <select className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-lg text-white font-black outline-none focus:border-indigo-500" value={selectedEmpresa.tributacao} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {tributacao: e.target.value})}>
                        {tributacaoOptions.map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}
                     </select>
                  </div>
                  
                  <div className="space-y-4">
                     <label className="text-xs font-black text-slate-500 ml-8 uppercase tracking-widest">Sistema Administrativo</label>
                     <select className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-lg text-white font-black outline-none focus:border-indigo-500" value={selectedEmpresa.sistemaBase} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {sistemaBase: e.target.value})}>
                        {sistemaOptions.map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-3"><label className="text-xs font-black text-slate-600 ml-4 uppercase">Qtd Folha</label><input className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-sm text-white font-black border-dashed" value={selectedEmpresa.qtdFuncionarios} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {qtdFuncionarios: e.target.value})}/></div>
                     <div className="space-y-3"><label className="text-xs font-black text-slate-600 ml-4 uppercase">Qtd Pro-Labore</label><input className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-sm text-white font-black border-dashed" value={selectedEmpresa.qtdProlabore} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {qtdProlabore: e.target.value})}/></div>
                  </div>
               </div>

               <div className="mt-20 flex gap-10 flex-wrap justify-center border-t border-white/5 pt-20">
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoDP: !selectedEmpresa.bkoDP })} className={`px-12 py-8 rounded-[3rem] text-[11px] font-black uppercase transition-all shadow-2xl ${selectedEmpresa.bkoDP ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-800 border border-white/5'}`}>PATROCÍNIO DP</button>
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoFiscal: !selectedEmpresa.bkoFiscal })} className={`px-12 py-8 rounded-[3rem] text-[11px] font-black uppercase transition-all shadow-2xl ${selectedEmpresa.bkoFiscal ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-800 border border-white/5'}`}>PATROCÍNIO FISCAL</button>
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoContabil: !selectedEmpresa.bkoContabil })} className={`px-12 py-8 rounded-[3rem] text-[11px] font-black uppercase transition-all shadow-2xl ${selectedEmpresa.bkoContabil ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-800 border border-white/5'}`}>PATROCÍNIO CONTÁBIL</button>
               </div>

               <div className="flex gap-10 mt-20">
                  <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-12 bg-indigo-600 rounded-[3rem] text-white font-black uppercase text-xl shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-6"><CheckCircle2 size={32}/> SALVAR ALTERAÇÕES MESTRE</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
