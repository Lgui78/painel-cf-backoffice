import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, LogOut, Globe, LayoutDashboard, Search, Upload,
  Pencil, Menu, FileText, Archive, ShieldAlert, CheckCircle2, MessageSquare, X
} from 'lucide-react';

// Tipos
type Visao = 'Geral' | 'DP' | 'DP_Onb' | 'Fiscal' | 'Fiscal_Onb' | 'Contábil' | 'Contábil_Onb' | 'Arquivo';

interface Funcionario {
  id: string;
  nome: string;
  nome_normalizado: string;
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
  qtdProlabore?: string;
  qtdFuncionarios?: string;
  temVariavel?: boolean;
  arquivada: boolean;
  obs_dp?: string;
  obs_fiscal?: string;
  obs_contabil?: string;
}

const statusOptionsDP = [
  "100% concluído", "Folha enviada/variável", "Folha enviada aguardando conferência do franqueado", 
  "Aguardando/variáveis", "Certificado com 2 etapas", "Liberado pra envio", 
  "Sem certificado", "Certificado vencido", "Parametrizar", "Sem procuração", "Aguardando T.I"
];

const statusOptionsFiscalContabil = ["Pendente", "Em Andamento", "Concluído", "Em Conferência"];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [visaoAtiva, setVisaoAtiva] = useState<Visao>('Geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterFranquia, setFilterFranquia] = useState('Todas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const fetchData = async () => {
    const { data: emp } = await supabase.from('backoffice_empresas').select('*').order('created_at', { ascending: false });
    if (emp) setEmpresas(emp as Empresa[]);
    const { data: func } = await supabase.from('funcionarios').select('*');
    if (func) setFuncionarios(func as Funcionario[]);
  };

  useEffect(() => {
    if(localStorage.getItem('cf_auth') === 'true') setIsLoggedIn(true);
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [isLoggedIn]);

  const updateEmpresaDirectly = async (id: string, updates: Partial<Empresa>) => {
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (selectedEmpresa?.id === id) setSelectedEmpresa(prev => prev ? { ...prev, ...updates } : null);
    await supabase.from('backoffice_empresas').update(updates).eq('id', id);
  };

  const uniqueFranquias = Array.from(new Set(empresas.map(e => e.franquia))).sort();

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
    if (val.includes('Aguardando') || val.includes('Pendente') || val.includes('Sem')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: 'greedy', encoding: 'ISO-8859-1',
      complete: async (results) => {
         const rawData = results.data as any[];
         const { data: inserted } = await supabase.from('backoffice_empresas').insert(rawData.map(r => ({
            nome: r['EMPRESA'] || r['RAZAO SOCIAL'] || 'Empresa Nova',
            cnpj: r['CNPJ'] || '',
            franquia: r['FRANQUIA'] || 'Própria',
            tributacao: r['TRIBUTACAO'] || 'Simples Nacional',
            sistemaBase: r['SISTEMA'] || 'Nuvem',
            responsavel: r['RESPONSAVEL'] || 'Indefinido',
            bkoDP: true, bkoFiscal: true, bkoContabil: true,
            statusCompetencia: 'Pendente', faseOnbDP: 'Pendente', faseOnbFiscal: 'Pendente', faseOnbContabil: 'Pendente'
         }))).select();
         if(inserted) fetchData();
      }
    });
  };

  if (!isLoggedIn) {
     return (
       <div className="min-h-screen bg-[#040812] flex items-center justify-center p-4">
         <div className="bg-[#0A101D] border border-white/10 rounded-[2rem] p-10 w-full max-w-sm shadow-2xl">
           <h1 className="text-2xl font-black text-center mb-8 text-white italic tracking-tighter uppercase">CF BACKOFFICE</h1>
           <form onSubmit={(e) => { e.preventDefault(); if(loginEmail === 'admin' && loginPassword === 'teste1234'){ localStorage.setItem('cf_auth', 'true'); setIsLoggedIn(true); } }} className="space-y-4">
             <input type="text" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Usuário" />
             <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Senha" />
             <button type="submit" className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-white uppercase tracking-widest text-[10px]">Acessar Sistema</button>
           </form>
         </div>
       </div>
     );
  }

  const baseSector = visaoAtiva.split('_')[0];
  const isOnbView = visaoAtiva.includes('_Onb');

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200 overflow-hidden font-sans">
      {/* Sidebar de Ícones */}
      <aside className={`flex h-screen fixed z-50 transition-all duration-500 ${isSidebarOpen ? 'w-[280px]' : 'w-[80px]'} bg-[#0A101D] border-r border-white/5 shadow-2xl backdrop-blur-3xl`}>
        <div className="w-[80px] flex flex-col items-center py-8 gap-8 h-full shrink-0 border-r border-white/5">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center cursor-pointer shadow-indigo-500/40 shadow-lg hover:scale-110 transition-transform"><Menu size={20} className="text-white"/></div>
           <nav className="flex flex-col gap-4">
             {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo'].map(v => (
               <button key={v} onClick={() => setVisaoAtiva(v as Visao)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${visaoAtiva.startsWith(v) ? 'bg-white/10 text-white border border-white/10 shadow-xl' : 'text-slate-600 hover:bg-white/5'}`}>
                 {v === 'Geral' ? <Globe size={20}/> : v === 'DP' ? <Users size={20}/> : v === 'Fiscal' ? <FileText size={20}/> : v === 'Arquivo' ? <Archive size={20}/> : <LayoutDashboard size={20}/>}
               </button>
             ))}
           </nav>
           <button onClick={() => { localStorage.removeItem('cf_auth'); setIsLoggedIn(false); }} className="mt-auto mb-8 text-rose-500/40 hover:text-rose-500 transition-colors"><LogOut size={20}/></button>
        </div>
        
        {isSidebarOpen && (
           <div className="flex-1 p-8 flex flex-col animate-in fade-in slide-in-from-left-4 duration-500">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] mb-8">Navegação</h3>
              <div className="space-y-4">
                 {['Geral', 'DP', 'Fiscal', 'Contábil', 'Arquivo'].map(m => (
                    <div key={m} className="space-y-2">
                       <button onClick={() => setVisaoAtiva(m as Visao)} className={`w-full text-left p-3 rounded-xl text-xs font-black transition-all ${visaoAtiva.startsWith(m) ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}>{m.toUpperCase()}</button>
                       {m !== 'Geral' && m !== 'Arquivo' && visaoAtiva.startsWith(m) && (
                          <div className="pl-4 flex flex-col gap-1 border-l border-white/5 ml-2">
                             <button onClick={() => setVisaoAtiva(m as Visao)} className={`text-left p-2 text-[10px] font-bold ${visaoAtiva === m ? 'text-white' : 'text-slate-600'}`}>MENSAL</button>
                             <button onClick={() => setVisaoAtiva(`${m}_Onb` as Visao)} className={`text-left p-2 text-[10px] font-bold ${visaoAtiva === `${m}_Onb` ? 'text-white' : 'text-slate-600'}`}>ONBOARDING</button>
                          </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        )}
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'ml-[280px]' : 'ml-[80px]'} p-10 h-screen flex flex-col relative`}>
        <header className="flex justify-between items-end mb-10 shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{visaoAtiva.replace('_Onb', ' / ONB').replace('Arquivo', 'OFF-BOARDING')}</h2>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">Controle de Fluxo Operacional • Onety</p>
          </div>
          <div className="flex gap-4">
             <label className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-[1.2rem] text-[10px] font-black uppercase cursor-pointer flex items-center gap-3 hover:bg-white/10 transition-all shadow-lg active:scale-95"><Upload size={16} className="text-indigo-400"/> IMPORTAR PLANILHA<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
          </div>
        </header>

        {/* Filters Top Bar */}
        <div className="flex gap-4 mb-6 shrink-0">
           <div className="relative flex-1 group"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16}/><input type="text" placeholder="Razão Social, CNPJ ou Franquia..." className="w-full pl-14 pr-6 py-4 bg-[#0A101D] border border-white/5 rounded-2xl text-[11px] text-white outline-none focus:border-indigo-500/30 transition-all font-bold placeholder-slate-700" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
           <select className="bg-[#0A101D] border border-white/5 text-slate-400 rounded-2xl px-6 py-4 text-[10px] font-black outline-none focus:border-indigo-500/30 min-w-[200px]" value={filterFranquia} onChange={e=>setFilterFranquia(e.target.value)}>
              <option value="Todas">FILTRAR FRANQUIA</option>
              {uniqueFranquias.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
           </select>
           <select className="bg-[#0A101D] border border-white/5 text-slate-400 rounded-2xl px-6 py-4 text-[10px] font-black outline-none focus:border-indigo-500/30 min-w-[200px]" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
              <option value="Todos">FILTRAR ANALISTA</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.toUpperCase()}</option>)}
           </select>
        </div>

        {/* Tabela com Scroll */}
        <div className="bg-[#0A101D]/50 rounded-[2.5rem] border border-white/5 flex flex-col flex-1 overflow-hidden backdrop-blur-md shadow-inner">
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#0D1424] text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-10 py-6 border-b border-white/5 backdrop-blur-xl">SITUAÇÃO</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">RAZÃO SOCIAL</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">CNPJ</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">FRANQUIA</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">ANALISTA RESPONSÁVEL</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">TRIBUTAÇÃO</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">SISTEMA</th>
                  <th className="px-8 py-6 border-b border-white/5 backdrop-blur-xl">STATUS</th>
                  <th className="px-10 py-6 border-b border-white/5 text-right backdrop-blur-xl">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(emp => (
                  <tr key={emp.id} className={`hover:bg-white/[0.03] transition-all group ${emp.inadimplente ? 'border-l-4 border-rose-500' : ''}`}>
                    <td className="px-10 py-5">
                       <select 
                         value={isOnbView ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia} 
                         onChange={(e) => updateEmpresaDirectly(emp.id, isOnbView ? (baseSector==='DP'?{faseOnbDP:e.target.value}:baseSector==='Fiscal'?{faseOnbFiscal:e.target.value}:{faseOnbContabil:e.target.value}) : {statusCompetencia: e.target.value})}
                         className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase outline-none cursor-pointer border-none shadow-sm ${getStatusColor(isOnbView? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}`}
                       >
                          {(baseSector==='DP'?statusOptionsDP:statusOptionsFiscalContabil).map(o => <option key={o} value={o} className="bg-[#0A101D]">{o}</option>)}
                       </select>
                    </td>
                    <td onClick={() => { setSelectedEmpresa(emp); setIsCommentsOpen(true); }} className="px-8 py-5 cursor-pointer">
                       <div className="flex flex-col">
                          <span className="text-[11px] font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{emp.nome}</span>
                          {emp.inadimplente && <span className="text-[8px] text-rose-500 font-black uppercase mt-1 flex items-center gap-1"><ShieldAlert size={10}/> Empresa com Pendência Financeira</span>}
                       </div>
                    </td>
                    <td className="px-8 py-5 font-mono text-[10px] text-slate-500">{emp.cnpj || '---'}</td>
                    <td className="px-8 py-5"><span className="text-[10px] font-black text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{emp.franquia.toUpperCase()}</span></td>
                    <td className="px-8 py-5"><span className="text-[10px] font-black text-indigo-400 hover:underline cursor-pointer">{emp.responsavel.toUpperCase()}</span></td>
                    <td className="px-8 py-5 text-[10px] text-slate-500 font-bold uppercase">{emp.tributacao}</td>
                    <td className="px-8 py-5 text-[10px] text-slate-400 font-bold uppercase italic">{emp.sistemaBase}</td>
                    <td className="px-8 py-5">
                       <div className="flex gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${emp.bkoDP ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-800'}`} title="DP"><Users size={12}/></div>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${emp.bkoFiscal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-800'}`} title="Fiscal"><FileText size={12}/></div>
                       </div>
                    </td>
                    <td className="px-10 py-5 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setSelectedEmpresa(emp); setIsEditModalOpen(true); }} className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"><Pencil size={14}/></button>
                          <button onClick={() => updateEmpresaDirectly(emp.id, { arquivada: !emp.arquivada })} className={`p-3 rounded-xl transition-all ${emp.arquivada ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400'}`} title={emp.arquivada ? 'Ativar' : 'Arquivar'}><Archive size={14}/></button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Painel lateral de Comentários / Notion Style */}
      {isCommentsOpen && selectedEmpresa && (
         <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCommentsOpen(false)}></div>
            <div className="relative w-full max-w-xl bg-[#0D1424] h-full shadow-2xl border-l border-white/10 p-10 flex flex-col animate-in slide-in-from-right duration-500">
               <button onClick={() => setIsCommentsOpen(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24}/></button>
               <h2 className="text-2xl font-black text-white italic mb-2 uppercase tracking-tighter">{selectedEmpresa.nome}</h2>
               <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-10">Mural de Anotações • Notion Sync</p>
               
               <div className="flex gap-4 p-1 bg-black/20 rounded-2xl mb-8">
                  {['DP', 'Fiscal', 'Contábil'].map(tab => (
                     <button key={tab} className="flex-1 py-3 text-[10px] font-black uppercase rounded-xl hover:bg-white/5 transition-all text-slate-500">ANOTAÇÕES {tab}</button>
                  ))}
               </div>

               <div className="flex-1 bg-white/5 rounded-3xl p-8 overflow-auto border border-white/5">
                  <div className="space-y-4">
                     <p className="text-xs text-slate-400 leading-relaxed italic">"Nenhuma anotação estratégica encontrada para este setor. Use este espaço para documentar processos, problemas e particularidades da franquia."</p>
                  </div>
               </div>
               
               <div className="mt-8 flex gap-4">
                  <input type="text" placeholder="Escreva algo importante..." className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none focus:border-indigo-500/30 font-bold"/>
                  <button className="bg-indigo-600 px-8 rounded-2xl text-[10px] font-black text-white uppercase">Salvar</button>
               </div>
            </div>
         </div>
      )}

      {/* Modal de Edição */}
      {isEditModalOpen && selectedEmpresa && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl bg-black/80">
            <div className="bg-[#131B2F] border border-white/10 rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl overflow-auto max-h-[90vh]">
               <h3 className="text-2xl font-black text-white italic mb-10 text-center uppercase tracking-tighter">Editar Empresa</h3>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 ml-2 uppercase">Razão Social</label><input className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white uppercase font-bold" value={selectedEmpresa.nome} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {nome: e.target.value})}/></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 ml-2 uppercase">CNPJ</label><input className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white font-bold" value={selectedEmpresa.cnpj} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {cnpj: e.target.value})}/></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 ml-2 uppercase">Franquia</label><input className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white uppercase font-bold" value={selectedEmpresa.franquia} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {franquia: e.target.value})}/></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 ml-2 uppercase">Sistema Base</label><input className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white uppercase font-bold" value={selectedEmpresa.sistemaBase} onChange={e=>updateEmpresaDirectly(selectedEmpresa.id, {sistemaBase: e.target.value})}/></div>
               </div>
               <div className="flex gap-4 mt-8 flex-wrap">
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { inadimplente: !selectedEmpresa.inadimplente })} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 ${selectedEmpresa.inadimplente ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-500'}`}><ShieldAlert size={14}/> {selectedEmpresa.inadimplente ? 'BLOQUEIO FINANCEIRO ATIVO' : 'SINALIZAR PENDÊNCIA'}</button>
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoDP: !selectedEmpresa.bkoDP })} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase ${selectedEmpresa.bkoDP ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-500'}`}>DP</button>
                  <button onClick={() => updateEmpresaDirectly(selectedEmpresa.id, { bkoFiscal: !selectedEmpresa.bkoFiscal })} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase ${selectedEmpresa.bkoFiscal ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-500'}`}>FISCAL</button>
               </div>
               <div className="flex gap-4 mt-12">
                  <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 bg-indigo-600 rounded-3xl text-white font-black uppercase text-xs shadow-xl shadow-indigo-500/20">Finalizar Edição</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
