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
}

const normalizeText = (text: string) => 
  text.trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

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

         // 1. Refresh funcionários
         const { data: currentFuncs } = await supabase.from('funcionarios').select('*');
         const funcList = (currentFuncs || []) as Funcionario[];
         
         // 2. Mapear responsáveis do CSV
         const rowsToProcess = rawData.map(row => {
            const keys = Object.keys(row);
            const respKey = keys.find(k => normalizeText(k).includes('RESPONSAVEL') || normalizeText(k).includes('COLABORADOR') || normalizeText(k).includes('ANALISTA')) || keys[0];
            return { ...row, _detectedResp: row[respKey] || 'Indefinido' };
         });

         const uniqueRespsFromCSV = Array.from(new Set(rowsToProcess.map(r => r._detectedResp)));
         
         // 3. Garantir que todos funcionários existem
         for (const respName of uniqueRespsFromCSV) {
            const normalized = normalizeText(respName);
            if (!funcList.find(f => f.nome_normalizado === normalized)) {
               const { data: newF } = await supabase.from('funcionarios').insert({
                  nome: respName,
                  nome_normalizado: normalized
               }).select().single();
               if (newF) funcList.push(newF as Funcionario);
            }
         }

         setFuncionarios([...funcList]);

         // 4. Preparar empresas
         const toInsert = rowsToProcess.map(row => {
            const normalized = normalizeText(row._detectedResp);
            const func = funcList.find(f => f.nome_normalizado === normalized);
            
            return {
               nome: row['EMPRESA'] || row['RAZAO SOCIAL'] || row['NOME'] || `Import ${(Math.random()*1000).toFixed(0)}`,
               cnpj: row['CNPJ'] || '',
               franquia: row['FRANQUIA'] || 'PRÓPRIA',
               tributacao: row['TRIBUTACAO'] || 'Simples Nacional',
               responsavel: row._detectedResp,
               responsavel_id: func?.id,
               sistemaBase: row['SISTEMA'] || 'Alterdata',
               statusCompetencia: 'Pendente',
               faseOnbDP: 'Falta Parametrizar',
               faseOnbFiscal: 'Falta Parametrizar',
               faseOnbContabil: 'Falta Parametrizar',
               bkoDP: true, bkoFiscal: true, bkoContabil: true
            };
         });

         const { data, error } = await supabase.from('backoffice_empresas').insert(toInsert).select();
         if(!error && data) {
            setEmpresas([...data, ...empresas]);
            alert(`${data.length} empresas importadas com sucesso!`);
         } else {
            alert("Erro na importação. Verifique o console.");
         }
      }
    });
    e.target.value = '';
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail === 'admin' && loginPassword === 'teste1234') {
       localStorage.setItem('cf_auth', 'true');
       setIsLoggedIn(true);
    } else {
       setLoginError('Acesso Negado.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cf_auth');
    setIsLoggedIn(false);
  };

  const filtered = empresas.filter(e => {
    const mSearch = e.nome.toLowerCase().includes(searchTerm.toLowerCase()) || e.responsavel.toLowerCase().includes(searchTerm.toLowerCase());
    const mResp = filterResponsavel === 'Todos' || e.responsavel_id === filterResponsavel || e.responsavel === filterResponsavel;
    return mSearch && mResp;
  });

  if (!isLoggedIn) {
    return (
       <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
         <div className="bg-[#131B2F] border border-white/10 rounded-3xl p-10 w-full max-w-sm shadow-2xl">
           <h1 className="text-2xl font-black text-center mb-1 text-white uppercase italic">CF BACKOFFICE</h1>
           <p className="text-center text-slate-500 text-[10px] font-bold uppercase mb-8">Gestão de Carteiras v3.0</p>
           <form onSubmit={handleLogin} className="space-y-4">
             <input type="text" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Usuário" />
             <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Senha" />
             <button type="submit" className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-white hover:bg-indigo-500 transition-all">ENTRAR</button>
             {loginError && <p className="text-rose-400 text-[10px] text-center font-bold mt-2">{loginError}</p>}
           </form>
         </div>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200">
      <aside className={`flex h-screen fixed z-40 transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-[70px]'} bg-[#0A101D] border-r border-white/5`}>
        <div className="w-[70px] flex flex-col items-center py-6 gap-6 h-full shrink-0">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center cursor-pointer"><Menu size={18}/></div>
           {['Geral', 'DP', 'Fiscal', 'Contábil'].map(v => (
             <button key={v} onClick={() => setVisaoAtiva(v as Visao)} className={`w-12 h-12 rounded-xl flex items-center justify-center ${visaoAtiva.startsWith(v) ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
               {v === 'Geral' ? <Globe size={20}/> : v === 'DP' ? <Users size={20}/> : v === 'Fiscal' ? <FileText size={20}/> : <LayoutDashboard size={20}/>}
             </button>
           ))}
           <button onClick={handleLogout} className="mt-auto mb-6 text-rose-500"><LogOut size={20}/></button>
        </div>
        {isSidebarOpen && (
           <div className="flex-1 p-6">
              <h2 className="text-xs font-black uppercase text-slate-500 mb-6 tracking-widest">Dashboards</h2>
              <div className="space-y-2">
                 {['Geral', 'DP', 'Fiscal', 'Contábil'].map(m => (
                    <button key={m} onClick={() => setVisaoAtiva(m as Visao)} className={`w-full text-left p-3 rounded-xl text-sm font-bold ${visaoAtiva === m ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400'}`}>{m}</button>
                 ))}
              </div>
           </div>
        )}
      </aside>

      <main className={`flex-1 transition-all ${isSidebarOpen ? 'ml-[280px]' : 'ml-[70px]'} p-8`}>
        <header className="flex justify-between items-center mb-8">
          <div><h2 className="text-2xl font-black text-white uppercase">{visaoAtiva}</h2><p className="text-xs text-slate-500 font-bold uppercase">Gestão Relacional de Carteira</p></div>
          <div className="flex gap-3">
             <label className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-600/20"><Upload size={14}/> IMPORTAR PLANILHA<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
             <button className="bg-white/5 border border-white/10 text-slate-400 px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2"><Download size={14}/> EXPORTAR</button>
          </div>
        </header>

        <div className="bg-[#0A101D] rounded-3xl border border-white/5 flex flex-col shadow-2xl">
          <div className="p-6 border-b border-white/5 flex gap-4">
             <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16}/><input type="text" placeholder="Pesquisar empresa ou analista..." className="w-full pl-11 pr-5 py-3 bg-[#131B2F] border border-white/5 rounded-2xl text-sm text-white outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
             <select className="bg-[#131B2F] border border-white/5 text-slate-400 rounded-2xl px-6 py-3 text-xs font-bold outline-none" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                <option value="Todos">TODOS OS ANALISTAS</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.toUpperCase()}</option>)}
             </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 bg-[#0D1424]">
                  <th className="px-8 py-5">STATUS</th>
                  <th className="px-6 py-5">EMPRESA / CNPJ</th>
                  <th className="px-6 py-5">ANALISTA RESPONSÁVEL</th>
                  <th className="px-6 py-5 text-center">BKO</th>
                  <th className="px-8 py-5 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-4">
                       <select 
                         value={emp.statusCompetencia} 
                         onChange={(e) => updateEmpresaDirectly(emp.id, { statusCompetencia: e.target.value })}
                         className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase outline-none"
                       >
                          <option value="Pendente">Pendente</option>
                          <option value="Entregue">Entregue</option>
                       </select>
                    </td>
                    <td className="px-6 py-4"><div className="flex flex-col"><span className="text-sm font-bold text-slate-200">{emp.nome}</span><span className="text-[10px] text-slate-600 font-mono">{emp.cnpj}</span></div></td>
                    <td className="px-6 py-4"><span className="text-[11px] font-black text-slate-400 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">{emp.responsavel.toUpperCase()}</span></td>
                    <td className="px-6 py-4"><div className="flex gap-1 justify-center opacity-40 hover:opacity-100 transition-opacity"><div className="w-8 h-5 bg-white/5 rounded border border-white/5 text-[8px] flex items-center justify-center font-bold">DP</div><div className="w-8 h-5 bg-white/5 rounded border border-white/5 text-[8px] flex items-center justify-center font-bold">FIS</div></div></td>
                    <td className="px-8 py-4 text-right"><button className="p-2 text-slate-600 hover:text-indigo-400 transition-colors"><Pencil size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <div className="bg-[#0A101D] border border-white/10 rounded-3xl w-full max-w-sm p-10">
              <h3 className="text-white font-black mb-8 flex items-center gap-3"><PlaneTakeoff className="text-indigo-500"/> NOVA OPERAÇÃO</h3>
              <div className="space-y-4">
                 <input className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white" placeholder="NOME DA EMPRESA" value={novaEmpresaForm.razaoSocial} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, razaoSocial:e.target.value})} />
                 <input className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white" placeholder="CNPJ" value={novaEmpresaForm.cnpj} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, cnpj:e.target.value})} />
                 <button onClick={() => setIsModalOpen(false)} className="w-full py-4 bg-indigo-600 rounded-2xl text-white font-black uppercase text-xs">CADASTRAR</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
