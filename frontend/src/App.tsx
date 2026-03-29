import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, PlaneTakeoff, 
  LogOut, Globe, LayoutDashboard, Search, Upload, Download,
  Pencil, ChevronLeft, Menu, FileText
} from 'lucide-react';

// Tipos
type Visao = 'Geral' | 'DP' | 'DP_Onb' | 'Fiscal' | 'Fiscal_Onb' | 'Contábil' | 'Contábil_Onb';

interface Empresa {
  id: string;
  responsavel: string;
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
  temAdiantamento?: boolean;
  temConsignado?: boolean;
  anotacoesFiscal?: string;
  encaminhadoPara?: string; 
}

const optionsTributacao = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune / Isenta'];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
     if(localStorage.getItem('cf_auth') === 'true') {
        setIsLoggedIn(true);
     }
  }, []);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [visaoAtiva, setVisaoAtiva] = useState<Visao>('Geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novaEmpresaForm, setNovaEmpresaForm] = useState({
     franquia: '', razaoSocial: '', cnpj: '', tributacao: 'Simples Nacional', 
     sistemaBase: 'Alterdata Nuvem', codigoSistema: '', responsavel: 'Não Definido'
  });

  const fetchEmpresas = async () => {
    const { data } = await supabase.from('backoffice_empresas').select('*').order('created_at', { ascending: false });
    if (data) setEmpresas(data as Empresa[]);
  };

  useEffect(() => {
    if (isLoggedIn) fetchEmpresas();
  }, [isLoggedIn]);

  const updateEmpresaDirectly = async (id: string, updates: Partial<Empresa>) => {
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const { error } = await supabase.from('backoffice_empresas').update(updates).eq('id', id);
    if (error) alert("Erro ao salvar no banco.");
  };

  const criarNovaOperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
       franquia: novaEmpresaForm.franquia, nome: novaEmpresaForm.razaoSocial, cnpj: novaEmpresaForm.cnpj,
       tributacao: novaEmpresaForm.tributacao, sistemaBase: novaEmpresaForm.sistemaBase, 
       codigoSistema: novaEmpresaForm.codigoSistema, responsavel: novaEmpresaForm.responsavel,
       atividade: 'Serviço', dataEntrada: new Date().toLocaleDateString('pt-BR'),
       inadimplente: false, statusCompetencia: 'Pendente', faseOnbDP: 'Falta Parametrizar',
       faseOnbFiscal: 'Falta Parametrizar', faseOnbContabil: 'Falta Parametrizar',
       temProcuracao: false, bkoDP: true, bkoFiscal: true, bkoContabil: true,
       qtdProlabore: '0', qtdFuncionarios: '0', temVariavel: false, temAdiantamento: false, temConsignado: false,
       anotacoesFiscal: '', encaminhadoPara: null
    };
    const { data, error } = await supabase.from('backoffice_empresas').insert([payload]).select().single();
    if (!error && data) {
       setEmpresas([data as Empresa, ...empresas]);
       setIsModalOpen(false);
       setNovaEmpresaForm({ franquia:'', razaoSocial:'', cnpj:'', tributacao:'Simples Nacional', sistemaBase:'Alterdata Nuvem', codigoSistema:'', responsavel:'Não Definido' });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (loginEmail === 'admin' && loginPassword === 'teste1234') {
       localStorage.setItem('cf_auth', 'true');
       setIsLoggedIn(true);
       return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    if (error) setLoginError('Senha ou Usuário Incoretos.');
    else { localStorage.setItem('cf_auth', 'true'); setIsLoggedIn(true); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('cf_auth');
    setIsLoggedIn(false);
  };

  const colaboradoresSetor = Array.from(new Set(empresas.map(e => e.responsavel))).map(nome => ({
    nome, qtdEmpresas: empresas.filter(e => e.responsavel === nome).length
  }));

  const isOnbView = visaoAtiva.endsWith('_Onb');
  const baseSector = visaoAtiva.replace('_Onb', '');

  const empresasFiltradas = empresas.filter(e => {
    const isResponsavelMatch = filterResponsavel === 'Todos' || e.responsavel === filterResponsavel;
    const isSearchMatch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.franquia.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.responsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.cnpj.includes(searchTerm);
    let isBKOMatch = true;
    if (baseSector === 'DP') isBKOMatch = e.bkoDP === true;
    else if (baseSector === 'Fiscal') isBKOMatch = e.bkoFiscal === true;
    else if (baseSector === 'Contábil') isBKOMatch = e.bkoContabil === true;
    return isResponsavelMatch && isSearchMatch && isBKOMatch;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalizeText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

    const headerMap: Record<string, string> = {
      'CODIGO': 'codigoSistema', 'COD': 'codigoSistema',
      'EMPRESA': 'nome', 'EMPRESAS': 'nome', 'RAZAO SOCIAL': 'nome',
      'FRANQUIA': 'franquia', 'CNPJ': 'cnpj',
      'TRIBUTA': 'tributacao', 'ATIVIDADE': 'atividade',
      'SISTEMA': 'sistemaBase', 'BASE': 'sistemaBase',
      'DATA': 'dataEntrada', 'VARIAVEL': 'temVariavel',
      'RESPONSAVEL': 'responsavel', 'COLABORADOR': 'responsavel', 'COLAB': 'responsavel', 'ANALISTA': 'responsavel',    
      'STATUS': 'statusCompetencia', 'SITUACAO': 'statusCompetencia', 'FASE': 'statusCompetencia'
    };

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'ISO-8859-1',
      complete: async (results) => {
         const rawData = results.data as any[];
         if(rawData.length === 0) return;

         const rawHeaders = Object.keys(rawData[0]);
         const mappedHeaders: Record<string, string> = {};
         
         rawHeaders.forEach((rh, index) => {
            const normalized = normalizeText(rh);
            if (index === 0) mappedHeaders[rh] = 'responsavel';
            for (const [key, dbCol] of Object.entries(headerMap)) {
               if(normalized.includes(key)) {
                  mappedHeaders[rh] = dbCol;
                  break;
               }
            }
         });

         const toInsert = rawData.map(row => {
            const empresa: any = {
               franquia: 'Sem Franq', nome: '', cnpj: '', tributacao: 'Simples Nacional', 
               sistemaBase: 'Alterdata', codigoSistema: '', responsavel: 'Lançamento Automático',
               atividade: 'Serviço', dataEntrada: new Date().toLocaleDateString('pt-BR'),
               inadimplente: false, statusCompetencia: 'Pendente',
               faseOnbDP: 'Falta Parametrizar', faseOnbFiscal: 'Falta Parametrizar', faseOnbContabil: 'Falta Parametrizar',
               temProcuracao: false, bkoDP: true, bkoFiscal: true, bkoContabil: true,
               qtdProlabore: '0', qtdFuncionarios: '0', temVariavel: false, temAdiantamento: false, temConsignado: false
            };

            Object.entries(row).forEach(([rawKey, rawVal]) => {
               const dbCol = mappedHeaders[rawKey];
               if(dbCol) {
                  const valStr = String(rawVal).trim();
                  if (['temVariavel', 'inadimplente'].includes(dbCol)) {
                     empresa[dbCol] = ['SIM', 'TRUE', 'S', '1'].includes(valStr.toUpperCase());
                  } else {
                     if (valStr) empresa[dbCol] = valStr;
                  }
               }
            });

            if (empresa.statusCompetencia && empresa.statusCompetencia !== 'Pendente') {
               empresa.faseOnbDP = empresa.statusCompetencia;
               empresa.faseOnbFiscal = empresa.statusCompetencia;
               empresa.faseOnbContabil = empresa.statusCompetencia;
            }
            if(!empresa.nome) empresa.nome = `Import #${Math.floor(Math.random()*1000)}`;
            return empresa;
         });

         const { data, error } = await supabase.from('backoffice_empresas').insert(toInsert).select();
         if(error) alert(`Erro Supabase: ${error.message}`);
         else if(data) {
            setEmpresas([...data, ...empresas]);
            alert(`🔥 SUCESSO! ${data.length} empresas integradas.`);
         }
      }
    });
    e.target.value = '';
  };

  const getStatusColor = (fase: string) => {
    switch (fase) {
      case '100% concluído': case 'Entregue': case 'Concluído': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Folha enviada/variável': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Falta Parametrizar': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const InlineBadgeSelect = ({ val, options, onChange, disabled }: { val: string, options: string[], onChange: (v: string) => void, disabled?: boolean }) => (
     <select 
       value={val} onChange={(e) => onChange(e.target.value)} disabled={disabled}
       className={`appearance-none cursor-pointer outline-none text-center px-2 py-1.5 rounded-md text-[9.5px] font-black uppercase shadow-sm border transition-all ${getStatusColor(val)} ${disabled ? 'opacity-50' : 'hover:scale-105'}`}
     >
        {options.map((o, idx) => <option key={idx} value={o} className="bg-[#0A101D] text-slate-300">{o}</option>)}
     </select>
  );

  const BkoBadge = ({ ativo, label }: {ativo: boolean, label: string}) => (
    <div className={`px-2 py-1 min-w-[38px] border text-[9px] font-bold rounded-md transition-all ${ativo ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-transparent border-white/5 text-slate-600'}`}>
      {ativo ? `${label} ✓` : `${label}`}
    </div>
  );

  if (!isLoggedIn) {
    return (
       <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4 overflow-hidden relative">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
         <div className="bg-[#131B2F]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 w-full max-w-sm relative z-10 shadow-2xl">
           <h1 className="text-2xl font-black text-center mb-1 text-white uppercase tracking-tighter">BACKOFFICE</h1>
           <p className="text-center text-slate-500 text-[9px] font-bold uppercase mb-8">CF Contabilidade • Gestão Central</p>
           <form onSubmit={handleLogin} className="space-y-4">
             <input type="text" autoFocus required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Acesso" />
             <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Senha" />
             <button type="submit" className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-white hover:bg-indigo-500 transition-all border border-indigo-500/30">CESSAR PAINEL</button>
             {loginError && <p className="text-rose-400 text-[10px] text-center font-bold mt-2">! {loginError}</p>}
           </form>
         </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200">
      <style>{`.custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }`}</style>
      
      <aside className={`flex h-screen fixed z-40 transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-[70px]'} bg-[#0A101D] border-r border-white/5`}>
        <div className="w-[70px] flex flex-col items-center py-6 gap-6 h-full shrink-0">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
             {isSidebarOpen ? <ChevronLeft size={18}/> : <Menu size={18}/>}
           </div>
           {['Geral', 'DP', 'Fiscal', 'Contábil'].map(v => (
             <button key={v} onClick={() => { setVisaoAtiva(v as Visao); setIsSidebarOpen(true); }} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${baseSector === v ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/5'}`}>
               {v === 'Geral' ? <Globe size={20}/> : v === 'DP' ? <Users size={20}/> : v === 'Fiscal' ? <FileText size={20}/> : <LayoutDashboard size={20}/>}
             </button>
           ))}
        </div>
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
           <div className="p-6 h-[88px] flex items-center border-b border-white/5"><span className="text-white font-black text-xs tracking-widest uppercase">Módulos Administrativos</span></div>
           <div className="flex-1 p-3 space-y-1">
             {['Geral', 'DP', 'Fiscal', 'Contábil'].map(m => (
               <div key={m} className={baseSector === m ? 'bg-white/5 rounded-xl pb-2' : ''}>
                 <button onClick={() => setVisaoAtiva(m as Visao)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-[12px] font-bold ${visaoAtiva === m ? 'bg-indigo-500/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{m}</button>
                 {m !== 'Geral' && baseSector === m && (
                   <div className="pl-6 mt-1 flex flex-col gap-1">
                     <button onClick={() => setVisaoAtiva(m as Visao)} className={`text-left p-2 text-[11px] font-medium ${visaoAtiva === m ? 'text-indigo-400' : 'text-slate-600'}`}>• Mensal</button>
                     <button onClick={() => setVisaoAtiva(`${m}_Onb` as Visao)} className={`text-left p-2 text-[11px] font-medium ${visaoAtiva === `${m}_Onb` ? 'text-indigo-400' : 'text-slate-600'}`}>• Onboarding</button>
                   </div>
                 )}
               </div>
             ))}
           </div>
           <div className="p-4 border-t border-white/5"><button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 text-rose-500 text-[10px] font-black uppercase py-2 hover:bg-rose-500/5 rounded-lg transition-all"><LogOut size={14}/> Sair</button></div>
        </div>
      </aside>

      <main className={`flex-1 transition-all ${isSidebarOpen ? 'ml-[280px]' : 'ml-[70px]'} p-8 h-screen overflow-hidden flex flex-col`}>
        <header className="flex justify-between items-center mb-10 shrink-0">
          <div><h2 className="text-2xl font-black text-white uppercase tracking-tight"> {visaoAtiva.replace('_', ' ')}</h2><p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão Central</p></div>
          <div className="flex gap-3">
             <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20">+ NOVA OPERAÇÃO</button>
             <label className="bg-white/5 border border-white/10 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer flex items-center gap-2 hover:bg-white/10 transition-all"><Upload size={14}/> IMPORTAR CSV<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
             <button onClick={() => alert('Exportação em breve...')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2"><Download size={14}/> EXPORTAR</button>
          </div>
        </header>

        <div className="bg-[#0A101D] rounded-3xl border border-white/5 flex flex-col flex-1 overflow-hidden shadow-2xl relative">
          <div className="p-5 border-b border-white/5 flex justify-between items-center gap-4 bg-[#0D1424]">
             <div className="relative flex-1 max-w-lg"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16}/><input type="text" placeholder="Localizar..." className="w-full pl-11 pr-5 py-3 bg-[#131B2F] border border-white/5 rounded-2xl text-[13px] text-white outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
             <select className="bg-[#131B2F] border border-white/5 text-slate-400 rounded-2xl px-4 py-3 text-xs font-bold" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                <option value="Todos">TODOS OS ANALISTAS</option>
                {colaboradoresSetor.map(c => <option key={c.nome} value={c.nome}>{c.nome.toUpperCase()}</option>)}
             </select>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0D1424] sticky top-0 z-10">
                <tr className="text-[#334155] text-[9.5px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                  <th className="px-8 py-5 text-center w-20">AÇÃO</th>
                  <th className="px-6 py-5">STATUS</th>
                  <th className="px-6 py-5">EMPRESA</th>
                  <th className="px-6 py-5">ANALISTA</th>
                  <th className="px-6 py-5">BASE</th>
                  <th className="px-6 py-5 text-center">BKO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empresasFiltradas.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-4 text-center">
                      <button onClick={() => alert('Edição em breve...')} className="p-2 text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"><Pencil size={15} /></button>
                    </td>
                    <td className="px-6 py-4">
                       <InlineBadgeSelect 
                         val={isOnbView ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia}
                         options={baseSector==='DP'||isOnbView ? ['Falta Parametrizar', '100% concluído', 'Folha enviada/variável', 'Aguardando/variáveis', 'Aguardando T.I'] : ['Pendente', 'Entregue']}
                         onChange={v => {
                           const up: any = {};
                           if(!isOnbView) up.statusCompetencia = v;
                           else { if(baseSector==='DP') up.faseOnbDP=v; else if(baseSector==='Fiscal') up.faseOnbFiscal=v; else up.faseOnbContabil=v; }
                           updateEmpresaDirectly(emp.id, up);
                         }}
                       />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-slate-200">{emp.nome}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{emp.franquia} | {emp.cnpj}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="text-[11px] font-black text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">{emp.responsavel.toUpperCase()}</span></td>
                    <td className="px-6 py-4 text-[11px] text-slate-500 font-medium">{emp.sistemaBase}</td>
                    <td className="px-6 py-4">
                       <div className="flex gap-1 justify-center">
                         <BkoBadge label="DP" ativo={emp.bkoDP} />
                         <BkoBadge label="FIS" ativo={emp.bkoFiscal} />
                         <BkoBadge label="CTB" ativo={emp.bkoContabil} />
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-6">
           <div className="bg-[#0A101D] border border-white/10 rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
              <h3 className="text-white text-xl font-black mb-8 uppercase tracking-widest flex items-center gap-3"><PlaneTakeoff className="text-indigo-500"/> Nova Operação</h3>
              <form onSubmit={criarNovaOperacao} className="space-y-5">
                 <input required className="w-full bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-sm text-white" placeholder="RAZÃO SOCIAL" value={novaEmpresaForm.razaoSocial} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, razaoSocial:e.target.value})} />
                 <div className="grid grid-cols-2 gap-4">
                   <input required className="bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-sm text-white" placeholder="FRANQUIA" value={novaEmpresaForm.franquia} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, franquia:e.target.value})} />
                   <input required className="bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-sm text-white" placeholder="CNPJ" value={novaEmpresaForm.cnpj} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, cnpj:e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <select className="bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-sm text-slate-400" value={novaEmpresaForm.tributacao} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, tributacao:e.target.value})}>{optionsTributacao.map(t=><option key={t}>{t}</option>)}</select>
                    <input className="bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-sm text-white" placeholder="ANALISTA" value={novaEmpresaForm.responsavel} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, responsavel:e.target.value})} />
                 </div>
                 <div className="flex gap-4 pt-6">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold uppercase text-[10px]">Cancelar</button>
                    <button type="submit" className="flex-1 py-4 bg-indigo-600 rounded-2xl text-white font-black uppercase text-[10px]">ATIVAR TRILHA</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
