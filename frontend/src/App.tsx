import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, LogOut, Globe, LayoutDashboard, Search, Upload,
  Pencil, Menu, FileText
} from 'lucide-react';

// Tipos
type Visao = 'Geral' | 'DP' | 'DP_Onb' | 'Fiscal' | 'Fiscal_Onb' | 'Contábil' | 'Contábil_Onb';

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
  temAdiantamento?: boolean;
  temConsignado?: boolean;
  anotacoesFiscal?: string;
}

const normalizeText = (text: string) => 
  text.trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [novaEmpresaForm, setNovaEmpresaForm] = useState({
     franquia: '', razaoSocial: '', cnpj: '', tributacao: 'Simples Nacional', 
     sistemaBase: 'Alterdata Nuvem', codigoSistema: '', responsavel: ''
  });

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
    await supabase.from('backoffice_empresas').update(updates).eq('id', id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'ISO-8859-1',
      complete: async (results) => {
         const rawData = results.data as any[];
         if(rawData.length === 0) return;

         const { data: currentFuncs } = await supabase.from('funcionarios').select('*');
         const funcList = (currentFuncs || []) as Funcionario[];
         
         const toInsert = [];

         for (const row of rawData) {
            const keys = Object.keys(row);
            const respKey = keys.find(k => normalizeText(k).includes('RESPONSAVEL') || normalizeText(k).includes('COLABORADOR') || normalizeText(k).includes('ANALISTA')) || keys[0];
            const respNameFull = (row[respKey] || 'Indefinido').trim();
            const normalized = normalizeText(respNameFull);

            let func = funcList.find(f => f.nome_normalizado === normalized);
            if (!func && normalized && normalized !== 'INDEFINIDO') {
               const { data: newF } = await supabase.from('funcionarios').insert({ nome: respNameFull, nome_normalizado: normalized }).select().single();
               if (newF) { func = newF as Funcionario; funcList.push(func); }
            }

            toInsert.push({
               nome: row['EMPRESA'] || row['RAZAO SOCIAL'] || row['NOME'] || `Imp #${(Math.random()*100).toFixed(0)}`,
               cnpj: row['CNPJ'] || '',
               franquia: row['FRANQUIA'] || 'Própria',
               tributacao: row['TRIBUTACAO'] || row['TIPO'] || 'Simples Nacional',
               sistemaBase: row['SISTEMA'] || 'Alterdata',
               responsavel: respNameFull,
               responsavel_id: func?.id,
               statusCompetencia: 'Pendente',
               faseOnbDP: 'Falta Parametrizar',
               faseOnbFiscal: 'Falta Parametrizar',
               faseOnbContabil: 'Falta Parametrizar',
               bkoDP: true, bkoFiscal: true, bkoContabil: true,
               qtdFuncionarios: row['FUNCIONARIOS'] || '0',
               qtdProlabore: row['PROLABORE'] || '0',
               temVariavel: ['SIM', 'S', 'S/V'].includes(normalizeText(row['VARIAVEL'] || '')),
               anotacoesFiscal: row['ANOTAÇÕES'] || ''
            });
         }

         setFuncionarios([...funcList]);
         const { data: inserted, error } = await supabase.from('backoffice_empresas').insert(toInsert).select();
         if(!error && inserted) {
            setEmpresas([...inserted, ...empresas]);
            alert(`${inserted.length} Empresas Integradas com Sucesso!`);
         }
      }
    });
    e.target.value = '';
  };

  const filtered = empresas.filter(e => {
    const isSearchMatch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.responsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.cnpj.includes(searchTerm);
    const isRespMatch = filterResponsavel === 'Todos' || e.responsavel_id === filterResponsavel;
    
    // Filtragem por setor
    let isSectorMatch = true;
    if (visaoAtiva.startsWith('DP')) isSectorMatch = e.bkoDP;
    else if (visaoAtiva.startsWith('Fiscal')) isSectorMatch = e.bkoFiscal;
    else if (visaoAtiva.startsWith('Contábil')) isSectorMatch = e.bkoContabil;

    return isSearchMatch && isRespMatch && isSectorMatch;
  });

  const getStatusColor = (val: string) => {
    if (val === '100% concluído' || val === 'Concluído') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (val.includes('Aguardando') || val.includes('Pendente')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  if (!isLoggedIn) {
     return (
       <div className="min-h-screen bg-[#040812] flex items-center justify-center p-4">
         <div className="bg-[#0A101D] border border-white/10 rounded-[2rem] p-10 w-full max-w-sm shadow-2xl">
           <h1 className="text-2xl font-black text-center mb-8 text-white italic tracking-tighter">CF BACKOFFICE</h1>
           <form onSubmit={(e) => { e.preventDefault(); if(loginEmail === 'admin' && loginPassword === 'teste1234'){ localStorage.setItem('cf_auth', 'true'); setIsLoggedIn(true); } else setLoginError('Login Inválido.'); }} className="space-y-4">
             <input type="text" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Usuário" />
             <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Senha" />
             <button type="submit" className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-white uppercase tracking-widest text-xs">Acessar Painel</button>
             {loginError && <p className="text-rose-400 text-center font-bold text-[10px] uppercase">! {loginError}</p>}
           </form>
         </div>
       </div>
     );
  }

  const baseSector = visaoAtiva.split('_')[0];
  const isOnbView = visaoAtiva.includes('_Onb');
  const currentStatusOptions = baseSector === 'DP' ? statusOptionsDP : statusOptionsFiscalContabil;

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200 overflow-hidden">
      <aside className={`flex h-screen fixed z-40 transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-[70px]'} bg-[#0A101D] border-r border-white/5`}>
        <div className="w-[70px] flex flex-col items-center py-6 gap-6 h-full shrink-0">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/20"><Menu size={18}/></div>
           {['Geral', 'DP', 'Fiscal', 'Contábil'].map(v => (
             <button key={v} onClick={() => setVisaoAtiva(v as Visao)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${visaoAtiva.startsWith(v) ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white/5'}`}>
               {v === 'Geral' ? <Globe size={20}/> : v === 'DP' ? <Users size={20}/> : v === 'Fiscal' ? <FileText size={20}/> : <LayoutDashboard size={20}/>}
             </button>
           ))}
           <button onClick={() => { localStorage.removeItem('cf_auth'); setIsLoggedIn(false); }} className="mt-auto mb-6 text-rose-500/50 hover:text-rose-500"><LogOut size={20}/></button>
        </div>
        {isSidebarOpen && (
           <div className="flex-1 p-6 flex flex-col">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-6">Linguagem de gestão</h3>
              <div className="space-y-1">
                 {['Geral', 'DP', 'Fiscal', 'Contábil'].map(m => (
                    <div key={m} className={visaoAtiva.startsWith(m) ? 'bg-white/5 rounded-2xl pb-2' : ''}>
                       <button onClick={() => setVisaoAtiva(m as Visao)} className={`w-full text-left p-4 rounded-xl text-xs font-bold ${visaoAtiva.startsWith(m) ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>{m}</button>
                       {m !== 'Geral' && visaoAtiva.startsWith(m) && (
                          <div className="pl-6 flex flex-col gap-1">
                             <button onClick={() => setVisaoAtiva(m as Visao)} className={`text-left p-2 text-[11px] font-medium ${visaoAtiva === m ? 'text-indigo-400' : 'text-slate-600'}`}>• {m} Mensal</button>
                             <button onClick={() => setVisaoAtiva(`${m}_Onb` as Visao)} className={`text-left p-2 text-[11px] font-medium ${visaoAtiva === `${m}_Onb` ? 'text-indigo-400' : 'text-slate-600'}`}>• Onboarding</button>
                          </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        )}
      </aside>

      <main className={`flex-1 transition-all ${isSidebarOpen ? 'ml-[280px]' : 'ml-[70px]'} p-8 h-screen flex flex-col`}>
        <header className="flex justify-between items-center mb-8 shrink-0">
          <div><h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{visaoAtiva.replace('_Onb', ' ONBOARDING')}</h2><p className="text-xs text-slate-500 font-bold uppercase mt-1 tracking-widest">Controle de Fluxo Operacional</p></div>
          <div className="flex gap-3">
             <button onClick={() => setIsModalOpen(true)} className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase">+ NOVA EMPRESA</button>
             <label className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase cursor-pointer flex items-center gap-2 shadow-xl shadow-indigo-500/20"><Upload size={14}/> IMPORTAR PLANILHA<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
          </div>
        </header>

        <div className="bg-[#0A101D] rounded-[2.5rem] border border-white/5 flex flex-col flex-1 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 flex gap-4 bg-[#0D1424]">
             <div className="relative flex-1 max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16}/><input type="text" placeholder="Pesquisar por Empresa, CNPJ ou Analista..." className="w-full pl-11 pr-5 py-3.5 bg-[#131B2F] border border-white/5 rounded-2xl text-xs text-white outline-none focus:border-indigo-500/50 transition-all font-medium" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
             <select className="bg-[#131B2F] border border-white/5 text-slate-400 rounded-2xl px-6 py-3.5 text-xs font-bold outline-none" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                <option value="Todos">TODOS OS ANALISTAS</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.toUpperCase()}</option>)}
             </select>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0D1424] sticky top-0 z-10">
                <tr className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                  <th className="px-8 py-5">SITUAÇÃO</th>
                  <th className="px-6 py-5">NOME EMPRESA</th>
                  <th className="px-6 py-5">CNPJ</th>
                  <th className="px-6 py-5">FRANQUIA</th>
                  <th className="px-6 py-5">ANALISTA RESPONSÁVEL</th>
                  <th className="px-6 py-5">TRIBUTAÇÃO</th>
                  <th className="px-6 py-5">SISTEMA</th>
                  {baseSector === 'DP' && <th className="px-6 py-5">FOLHA / VAR / ADIA</th>}
                  <th className="px-8 py-5 text-right">OPÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-4">
                       <select 
                         value={isOnbView ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia} 
                         onChange={(e) => {
                            const up: any = {};
                            if(isOnbView) { if(baseSector==='DP') up.faseOnbDP=e.target.value; else if(baseSector==='Fiscal') up.faseOnbFiscal=e.target.value; else up.faseOnbContabil=e.target.value; }
                            else up.statusCompetencia = e.target.value;
                            updateEmpresaDirectly(emp.id, up);
                         }}
                         className={`border-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none transition-all cursor-pointer ${getStatusColor(isOnbView? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}`}
                       >
                          {currentStatusOptions.map(opt => <option key={opt} value={opt} className="bg-[#0A101D] text-slate-300">{opt}</option>)}
                       </select>
                    </td>
                    <td className="px-6 py-4"><span className="text-xs font-bold text-slate-200 tracking-tight">{emp.nome}</span></td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{emp.cnpj}</td>
                    <td className="px-6 py-4"><span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg">{emp.franquia.toUpperCase()}</span></td>
                    <td className="px-6 py-4"><span className="text-[10px] font-black text-indigo-400">{emp.responsavel.toUpperCase()}</span></td>
                    <td className="px-6 py-4 text-[10px] text-slate-500 font-medium">{emp.tributacao}</td>
                    <td className="px-6 py-4 text-[10px] text-slate-500 font-medium">{emp.sistemaBase}</td>
                    {baseSector === 'DP' && (
                       <td className="px-6 py-4">
                          <div className="flex gap-2">
                             <div className={`w-8 h-4 rounded text-[8px] font-bold flex items-center justify-center ${emp.qtdFuncionarios !== '0' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/5 text-slate-700'}`}>{emp.qtdFuncionarios}F</div>
                             <div className={`w-8 h-4 rounded text-[8px] font-bold flex items-center justify-center ${emp.temVariavel ? 'bg-orange-500/10 text-orange-400' : 'bg-white/5 text-slate-700'}`}>VAR</div>
                          </div>
                       </td>
                    )}
                    <td className="px-8 py-4 text-right"><button className="p-2 text-slate-600 hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100"><Pencil size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
           <div className="bg-[#0A101D] border border-white/10 rounded-[3rem] w-full max-w-sm p-12 shadow-2xl relative">
              <h3 className="text-white text-xl font-black mb-10 tracking-widest text-center uppercase italic">Nova Empresa</h3>
              <div className="space-y-5">
                 <input className="w-full bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-xs text-white uppercase placeholder-slate-600" placeholder="Razão Social" value={novaEmpresaForm.razaoSocial} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, razaoSocial:e.target.value})} />
                 <input className="w-full bg-[#131B2F] border border-white/5 rounded-2xl p-4 text-xs text-white placeholder-slate-600" placeholder="CNPJ" value={novaEmpresaForm.cnpj} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, cnpj:e.target.value})} />
                 <div className="flex gap-4 pt-6">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold uppercase text-[9px]">Cancelar</button>
                    <button onClick={async () => {
                       const payload = { ...novaEmpresaForm, nome: novaEmpresaForm.razaoSocial, statusCompetencia: 'Pendente', faseOnbDP: 'Falta Parametrizar', faseOnbFiscal: 'Falta Parametrizar', faseOnbContabil: 'Falta Parametrizar', bkoDP: true, bkoFiscal: true, bkoContabil: true, atividade: 'Serviço', responsavel: 'Lançamento Manual' };
                       const { data } = await supabase.from('backoffice_empresas').insert([payload]).select().single();
                       if(data) { setEmpresas([data as Empresa, ...empresas]); setIsModalOpen(false); }
                    }} className="flex-1 py-4 bg-indigo-600 rounded-2xl text-white font-black uppercase text-[10px]">Ativar Trilha</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
