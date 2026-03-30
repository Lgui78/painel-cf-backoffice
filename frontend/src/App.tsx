import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, LogOut, Globe, Search, Upload,
  Pencil, Menu, FileText, Archive, X, ShieldCheck, CheckCircle2,
  Trash2, ArrowRightCircle, Rocket
} from 'lucide-react';

import './App.css';

// Tipos
type Visao = 'Geral' | 'DP' | 'Fiscal' | 'Contábil' | 'Arquivo' | 'Usuarios';

const customScrollStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.2);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(99,102,241,0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(99,102,241,0.8);
  }
`;

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'analista';
  approved: boolean;
  responsavel_id?: string;
  modulos?: string; // ex: "DP,Fiscal,Contabil,Geral"
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
  atividade?: string;
  competencia?: string;
  piConcluido?: boolean;
  onety?: boolean;
  procuracao?: boolean;
  emprestimoConsignado?: boolean;
  convencaoColetiva?: boolean;
  arquivada: boolean;
  isOnboarding: boolean;
  module_origin?: string;
  is_global?: boolean;
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
  const [visaoAtiva, setVisaoAtiva] = useState<Visao>(
    () => (localStorage.getItem('cf_visao') as Visao) || 'Geral'
  );
  const [isOnboardingTab, setIsOnboardingTab] = useState(
    () => localStorage.getItem('cf_onboarding_tab') === 'true'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterFranquia, setFilterFranquia] = useState('Todas');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGlobalUpload, setIsGlobalUpload] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginNome, setLoginNome] = useState('');
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'pending'>('login');

  // Persiste módulo e aba no localStorage
  useEffect(() => { localStorage.setItem('cf_visao', visaoAtiva); }, [visaoAtiva]);
  useEffect(() => { localStorage.setItem('cf_onboarding_tab', String(isOnboardingTab)); }, [isOnboardingTab]);

  const fetchData = async () => {
    let query = supabase.from('backoffice_empresas').select('*');
    
    // RBAC
    if (currentUser?.role !== 'admin' && currentUser?.responsavel_id) {
       query = query.eq('responsavel_id', currentUser.responsavel_id);
    }

    // ISOLAMENTO DE MÓDULO (Nível Supabase)
    if (visaoAtiva !== 'Geral' && visaoAtiva !== 'Usuarios' && visaoAtiva !== 'Arquivo') {
       query = query.or(`is_global.eq.true,module_origin.eq.${visaoAtiva}`);
    }

    const { data: emp, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
       console.error("Erro ao puxar dados isolados:", error);
    } else if (emp) {
       setEmpresas(emp as Empresa[]);
    }

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
  }, [isLoggedIn, currentUser, visaoAtiva]);

  const toggleUserApproval = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ approved: !current }).eq('id', id);
    setAllProfiles(prev => prev.map(p => p.id === id ? { ...p, approved: !current } : p));
  };

  const updateProfile = async (id: string, updates: Partial<UserProfile>) => {
    setAllProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    await supabase.from('profiles').update(updates).eq('id', id);
  };

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
      header: true, 
      skipEmptyLines: 'greedy', 
      complete: async (results) => {
         const rawData = results.data as any[];
         
         const toInsert = rawData.map(r => {
            const normalizedRow: any = {};
            Object.keys(r).forEach(k => {
               if (k) {
                  const cleanKey = k.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
                  normalizedRow[cleanKey] = r[k];
               }
            });

             return {
               nome: normalizedRow['EMPRESA'] || normalizedRow['RAZAO SOCIAL'] || normalizedRow['RAZÃO SOCIAL'] || normalizedRow['CLIENTE'] || normalizedRow['NOME'] || normalizedRow['NOME FANTASIA'] || 'Empresa Nova (Sem Nome)',
               cnpj: normalizedRow['CNPJ'] || '',
               franquia: normalizedRow['FRANQUIA'] || normalizedRow['GRUPO'] || 'Indefinida',
               responsavel: normalizedRow['RESPONSAVEL'] || normalizedRow['RESPONSÁVEL'] || normalizedRow['ANALISTA'] || normalizedRow['ATENDENTE'] || 'Sem Analista',
               tributacao: normalizedRow['TRIBUTACAO'] || normalizedRow['TRIBUTAÇÃO'] || 'Simples Nacional',
               sistemaBase: normalizedRow['SISTEMA'] || 'Domínio Base 1',
               qtdFuncionarios: normalizedRow['QTD FOLHA'] || normalizedRow['FOLHA'] || normalizedRow['FUNCIONÁRIOS'] || normalizedRow['FUNCIONARIOS'] || '',
               qtdProlabore: normalizedRow['PRO-L'] || normalizedRow['PROLABORE'] || normalizedRow['PRÓ-LABORE'] || '',
               atividade: normalizedRow['ATIVIDADE'] || '',
               competencia: normalizedRow['COMPETENCIA'] || normalizedRow['COMPETÊNCIA'] || '',
               module_origin: isGlobalUpload ? 'Geral' : visaoAtiva,
               is_global: isGlobalUpload,
               bkoDP: visaoAtiva === 'DP' || isGlobalUpload,
               bkoFiscal: visaoAtiva === 'Fiscal' || isGlobalUpload,
               bkoContabil: visaoAtiva === 'Contábil' || isGlobalUpload,
               inadimplente: false,
               arquivada: false,
               isOnboarding: false,
               statusCompetencia: 'Liberado pra envio',
               faseOnbDP: 'Fase 1: Coleta',
               faseOnbFiscal: 'Fase 1: Coleta',
               faseOnbContabil: 'Fase 1: Coleta',
               temVariavel: normalizedRow['VARIAVEL'] === 'SIM' || normalizedRow['VARIÁVEL'] === 'SIM' || normalizedRow['VAR'] === 'SIM',
               temAdiantamento: normalizedRow['ADIANTAMENTO'] === 'SIM' || normalizedRow['ADIA'] === 'SIM',
               piConcluido: normalizedRow['PI CONCLUIDO'] === 'SIM' || normalizedRow['PI CONCLUÍDO'] === 'SIM',
               onety: normalizedRow['ONETY'] === 'SIM',
               procuracao: normalizedRow['PROCURACAO'] === 'SIM' || normalizedRow['PROCURAÇÃO'] === 'SIM',
               emprestimoConsignado: normalizedRow['EMPRESTIMO CONSIGNADO'] === 'SIM' || normalizedRow['EMPRÉSTIMO CONSIGNADO'] === 'SIM',
               convencaoColetiva: normalizedRow['CONVENCAO COLETIVA'] === 'SIM' || normalizedRow['CONVENÇÃO COLETIVA'] === 'SIM',
            };
         });

         const { data: inserted, error: insertError } = await supabase
            .from('backoffice_empresas')
            .insert(toInsert)
            .select();

         if (insertError) {
            console.error("ERRO_SUPABASE_DETALHADO:", insertError);
            alert(`Mestre, erro na importação: ${insertError.message}`);
         } else {
            console.log("SUCESSO_IMPORT:", inserted);
            fetchData();
            alert(`Mestre, importação completa! ${inserted?.length || 0} empresas subiram para a base.`);
         }
         
         // Limpar o input de arquivo depois de importar
         e.target.value = '';
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const emailFormatado = loginEmail.trim().toLowerCase();

    // Master Backdoor de Segurança (Sempre entra)
    if (emailFormatado === 'gui.contato8@gmail.com' || emailFormatado === 'admin') { 
      const mockUser: UserProfile = { id: 'master', email: emailFormatado, nome: 'Gestor Master', role: 'admin', approved: true }; 
      setCurrentUser(mockUser); 
      setIsLoggedIn(true); 
      localStorage.setItem('cf_user', JSON.stringify(mockUser)); 
      return; 
    } 

    if (!emailFormatado) {
       alert("Digite seu e-mail para entrar.");
       return;
    }

    try {
       const { data: profile, error } = await supabase.from('profiles').select('*').eq('email', emailFormatado).single();

       if (error || !profile) {
          alert("E-mail não encontrado. Clique em 'Solicitar Acesso' para se cadastrar.");
          return;
       }

       if (!profile.approved) {
          setLoginMode('pending');
          return;
       }

       // Aprovado - Pode entrar!
       setCurrentUser(profile as UserProfile);
       setIsLoggedIn(true);
       localStorage.setItem('cf_user', JSON.stringify(profile));
    } catch (err) {
       alert("Erro de conexão com o banco de usuários.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailFormatado = loginEmail.trim().toLowerCase();
    const nomeFormatado = loginNome.trim();
    if (!emailFormatado || !nomeFormatado) {
      alert("Preencha nome e e-mail para solicitar acesso.");
      return;
    }
    try {
      // Verifica se já existe
      const { data: existing } = await supabase.from('profiles').select('id,approved').eq('email', emailFormatado).single();
      if (existing) {
        if (existing.approved) {
          alert("Este e-mail já tem acesso aprovado. Clique em Entrar.");
          setLoginMode('login');
        } else {
          setLoginMode('pending');
        }
        return;
      }
      const { error } = await supabase.from('profiles').insert([{ email: emailFormatado, nome: nomeFormatado, role: 'analista', approved: false }]);
      if (error) {
        alert(`Erro ao solicitar acesso: ${error.message}`);
      } else {
        setLoginMode('pending');
      }
    } catch (err) {
      alert("Erro de conexão.");
    }
  };

  const filtered = empresas.filter(e => {
    try {
      const nome = String(e?.nome || '');
      const cnpj = String(e?.cnpj || '');
      const franquia = String(e?.franquia || '');
      const responsavel = String(e?.responsavel || '');

      const matchSearch = nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          cnpj.includes(searchTerm) || 
                          franquia.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchResp = filterResponsavel === 'Todos' || responsavel === filterResponsavel;
      const matchFran = filterFranquia === 'Todas' || franquia === filterFranquia;
      
      // Converte explicitamente caso venha string 'true' do banco
      const isArquivada = e?.arquivada === true || String(e?.arquivada) === 'true';
      if (visaoAtiva === 'Arquivo') return isArquivada && matchSearch && matchResp && matchFran;
      if (isArquivada) return false;

      // isOnboardingTab apenas controla as colunas exibidas, não filtra empresas

      let isSectorMatch = true;
      if (visaoAtiva === 'DP') isSectorMatch = e?.bkoDP !== false && String(e?.bkoDP) !== 'false';
      else if (visaoAtiva === 'Fiscal') isSectorMatch = e?.bkoFiscal !== false && String(e?.bkoFiscal) !== 'false';
      else if (visaoAtiva === 'Contábil') isSectorMatch = e?.bkoContabil !== false && String(e?.bkoContabil) !== 'false';
      else if (visaoAtiva === 'Geral') isSectorMatch = true;

      return matchSearch && matchResp && matchFran && isSectorMatch;
    } catch (err) {
      console.error("Erro ao processar item do filtro:", err, e);
      return false;
    }
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
    if (!val) return 'bg-slate-500/10 text-slate-400';
    if (val === '100% concluído' || val === 'Concluído' || val.includes('100%')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20';
    if (val.includes('Pendente') || val.includes('Aguardando') || val.includes('Sem')) return 'bg-rose-500/10 text-rose-400 border-rose-400/20';
    return 'bg-indigo-500/10 text-indigo-300 border-indigo-400/20';
  };

  const accent = getAccentColor(visaoAtiva);
  const baseSector = visaoAtiva;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#040812] flex items-center justify-center p-6 text-slate-200" style={{background: 'radial-gradient(ellipse at 30% 50%, #0d1829 0%, #040812 60%)'}}>
        <div className="w-full max-w-md">

          {/* LOGO */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl mb-6">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center"><ShieldCheck size={16} className="text-white"/></div>
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Backoffice Mestre</span>
            </div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">
              {loginMode === 'pending' ? 'Aguardando...' : loginMode === 'register' ? 'Solicitar Acesso' : 'Bem-vindo de volta'}
            </h1>
            <p className="text-slate-600 text-xs mt-2 font-black uppercase tracking-widest">
              {loginMode === 'pending' ? 'Sua solicitação foi enviada' : loginMode === 'register' ? 'Preencha os dados para solicitar entrada' : 'Acesso restrito — equipe interna'}
            </p>
          </div>

          <div className="bg-[#0A101D] border border-white/5 p-8 rounded-[2rem] shadow-2xl">

            {/* MODO: PENDENTE */}
            {loginMode === 'pending' && (
              <div className="text-center space-y-6 py-4">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto animate-pulse">
                  <span className="text-2xl">⏳</span>
                </div>
                <div>
                  <p className="text-white font-black text-sm mb-2">Solicitação Enviada!</p>
                  <p className="text-slate-500 text-xs">O administrador vai revisar seu pedido e liberar seu acesso em breve.</p>
                  <p className="text-slate-700 text-[10px] mt-2 font-black uppercase tracking-widest">{loginEmail}</p>
                </div>
                <button onClick={() => { setLoginMode('login'); setLoginEmail(''); setLoginNome(''); }} className="text-[10px] font-black text-slate-600 hover:text-white transition-colors uppercase tracking-widest">
                  Tentar com outro e-mail
                </button>
              </div>
            )}

            {/* MODO: LOGIN */}
            {loginMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-1 block">E-mail</label>
                  <input type="email" placeholder="seu@email.com" className="w-full bg-white/5 border border-white/10 px-5 py-3 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder-slate-700" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoFocus/>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-500 transition-all text-sm uppercase tracking-widest">ENTRAR</button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"/></div>
                  <div className="relative flex justify-center"><span className="bg-[#0A101D] px-4 text-[9px] text-slate-700 uppercase tracking-widest font-black">ou</span></div>
                </div>
                <button type="button" onClick={() => setLoginMode('register')} className="w-full py-3 bg-white/5 border border-white/10 text-slate-400 font-black rounded-xl hover:bg-white/10 hover:text-white transition-all text-[10px] uppercase tracking-widest">
                  Solicitar Acesso →
                </button>
              </form>
            )}

            {/* MODO: REGISTRO */}
            {loginMode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-1 block">Seu Nome Completo</label>
                  <input type="text" placeholder="Ex: Maria Silva" className="w-full bg-white/5 border border-white/10 px-5 py-3 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder-slate-700" value={loginNome} onChange={e => setLoginNome(e.target.value)} autoFocus/>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-1 block">E-mail Profissional</label>
                  <input type="email" placeholder="seu@email.com" className="w-full bg-white/5 border border-white/10 px-5 py-3 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder-slate-700" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}/>
                </div>
                <button type="submit" className="w-full py-3 bg-orange-600 text-white font-black rounded-xl shadow-xl hover:bg-orange-500 transition-all text-sm uppercase tracking-widest">SOLICITAR ACESSO</button>
                <button type="button" onClick={() => setLoginMode('login')} className="w-full text-center text-[9px] font-black text-slate-700 hover:text-slate-400 transition-colors uppercase tracking-widest">
                  ← Voltar para o Login
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-[9px] text-slate-800 mt-6 font-black uppercase tracking-widest">Onety © 2025 — Acesso restrito</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040812] flex text-slate-200 font-sans overflow-hidden">
      <style>{customScrollStyles}</style>
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

      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'ml-[300px]' : 'ml-[90px]'} p-4 h-screen overflow-hidden flex flex-col`}>
        <header className="flex justify-between items-center mb-2 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">{visaoAtiva.replace('Arquivo', 'OFF-BOARDING')}</h2>
            <div className="flex gap-2">
                <button onClick={() => setIsOnboardingTab(false)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${!isOnboardingTab ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-600'}`}>Carteira Mensal</button>
                <button onClick={() => setIsOnboardingTab(true)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all ${isOnboardingTab ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-slate-600'}`}>Trilha Onboarding 🔥</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex gap-4 items-center bg-[#0A101D] px-3 py-2 rounded-xl border border-white/5">
                 <label className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 cursor-pointer hover:text-white transition-colors">
                    <input type="radio" checked={isGlobalUpload} onChange={() => setIsGlobalUpload(true)} className="accent-indigo-500 w-3 h-3"/>
                    GLOBAL
                 </label>
                 <label className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 cursor-pointer hover:text-white transition-colors">
                    <input type="radio" checked={!isGlobalUpload} onChange={() => setIsGlobalUpload(false)} className="accent-indigo-500 w-3 h-3"/>
                    APENAS AQUI
                 </label>
             </div>
             <label className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-indigo-500/20 shadow-lg transition-all active:scale-95 cursor-pointer hover:bg-indigo-500"><Upload size={13}/> IMPORTAR CSV<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload}/></label>
          </div>
        </header>

        {visaoAtiva === 'Usuarios' ? (
           <div className="flex-1 min-h-0 overflow-y-auto bg-[#0A101D]/50 rounded-[2rem] p-6 border border-white/5 custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-black text-white italic uppercase tracking-widest">Gestão de Analistas</h3>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{allProfiles.length} usuários no sistema</span>
              </div>
              <div className="space-y-3">
                 {allProfiles.map(p => {
                   const mods = (p.modulos || 'DP,Fiscal,Contabil,Geral').split(',');
                   const toggleMod = (mod: string) => {
                     const newMods = mods.includes(mod) ? mods.filter(m => m !== mod) : [...mods, mod];
                     updateProfile(p.id, { modulos: newMods.join(',') });
                   };
                   return (
                     <div key={p.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                       {/* STATUS BOLINHA */}
                       <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.approved ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse'}`}></div>

                       {/* EMAIL */}
                       <span className="text-[9px] font-black text-slate-600 uppercase min-w-[180px]">{p.email}</span>

                       {/* NOME EDITAVEL */}
                       <input
                         className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black text-white outline-none focus:border-indigo-500/50 transition-all min-w-[150px]"
                         value={p.nome || ''}
                         placeholder="Nome do analista..."
                         onChange={e => setAllProfiles(prev => prev.map(u => u.id === p.id ? {...u, nome: e.target.value} : u))}
                         onBlur={e => updateProfile(p.id, { nome: e.target.value })}
                       />

                       {/* ROLE */}
                       <select
                         className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border-none cursor-pointer outline-none ${p.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}
                         value={p.role}
                         onChange={e => updateProfile(p.id, { role: e.target.value as 'admin' | 'analista' })}
                       >
                         <option value="analista" className="bg-[#0A101D]">ANALISTA</option>
                         <option value="admin" className="bg-[#0A101D]">ADMIN</option>
                       </select>

                       {/* MODULOS */}
                       <div className="flex gap-1.5 flex-1">
                         {['Geral','DP','Fiscal','Contábil'].map(mod => (
                           <button
                             key={mod}
                             onClick={() => toggleMod(mod)}
                             className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all border ${
                               mods.includes(mod)
                                 ? mod==='DP' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                 : mod==='Fiscal' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                 : mod==='Contábil' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                 : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                 : 'bg-white/[0.03] text-slate-700 border-white/5'
                             }`}
                           >{mod}</button>
                         ))}
                       </div>

                       {/* APROVAR/REVOGAR */}
                       <button
                         onClick={() => toggleUserApproval(p.id, p.approved)}
                         className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase border transition-all shrink-0 cursor-pointer ${
                           p.approved
                             ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-400/30'
                             : 'bg-orange-500/10 text-orange-400 border-orange-400/20 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-400/30 animate-pulse'
                         }`}
                       >{p.approved ? 'ATIVO ✓' : 'APROVAR'}</button>
                     </div>
                   );
                 })}
              </div>
           </div>
         ) : (
            <>
               <div className="flex gap-2 mb-2 shrink-0">
                 <div className="relative flex-1 group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-indigo-400 transition-colors" size={14}/><input type="text" placeholder="Pesquisar Empresa, Grupo ou CNPJ..." className="w-full pl-10 pr-4 py-2 bg-[#0A101D] border border-white/5 rounded-xl text-[10px] text-white font-black outline-none focus:border-indigo-500/30 transition-all placeholder-slate-800" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
                 <select className="bg-[#0A101D] border border-white/5 text-slate-600 rounded-xl px-4 py-2 text-[9px] font-black outline-none min-w-[160px]" value={filterFranquia} onChange={e=>setFilterFranquia(e.target.value)}>
                     <option value="Todas">FILTRAR GRUPO</option>
                     {Array.from(new Set(empresas.map(e => e.franquia))).sort().map(f => <option key={f} value={f}>{f?.toUpperCase()}</option>)}
                 </select>
                 <select className="bg-[#0A101D] border border-white/5 text-slate-600 rounded-xl px-4 py-2 text-[9px] font-black outline-none min-w-[160px]" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                     <option value="Todos">FILTRAR ANALISTA</option>
                     {Array.from(new Set(empresas.map(e => e.responsavel))).sort().map(r => <option key={r} value={r}>{r?.toUpperCase()}</option>)}
                 </select>
              </div>

              <div className="bg-[#0A101D]/50 rounded-[2rem] border border-white/5 flex flex-col flex-1 min-h-0 shadow-2xl w-full">
                <div className="flex-1 min-h-0 overflow-x-scroll overflow-y-scroll pb-2 px-2 custom-scrollbar">
                  <div className="min-w-[1800px]">
                    <table className="w-full text-left border-separate border-spacing-0">
                      <thead>
                        <tr className="text-slate-600 text-[9px] font-black uppercase tracking-[0.3em]">
                          <th className="px-3 py-3 border-b border-white/5 sticky left-0 bg-[#161B2A] z-40 text-center"><Pencil size={12}/></th>
                          <th className="px-4 py-3 border-b border-white/5 sticky left-[48px] bg-[#161B2A] z-30 font-bold min-w-[160px]">STATUS</th>
                          <th className="px-4 py-3 border-b border-white/5 min-w-[200px]">EMPRESA</th>
                          <th className="px-4 py-3 border-b border-white/5 whitespace-nowrap">CNPJ</th>
                          <th className="px-4 py-3 border-b border-white/5">GRUPO</th>
                          <th className="px-4 py-3 border-b border-white/5">ANALISTA</th>
                          {baseSector === 'Geral' ? (
                            <>
                              <th className="px-3 py-3 border-b border-white/5 text-center">SETOR DP</th>
                              <th className="px-3 py-3 border-b border-white/5 text-center">SETOR FISCAL</th>
                              <th className="px-3 py-3 border-b border-white/5 text-center">SETOR CONTÁBIL</th>
                            </>
                          ) : baseSector === 'DP' ? (
                            <>
                              {isOnboardingTab ? (
                                <>
                                  <th className="px-3 py-3 border-b border-white/5 text-center">TRIB.</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center">ATIVIDADE</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center font-bold text-indigo-400">FUNC.</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center font-bold text-purple-400">PRO-L</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center">SISTEMA</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center">VAR</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center">ADIA</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center text-orange-400">COMPET.</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center" title="PI CONCLUIDO">PI</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center" title="ONETY">1T</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center" title="PROCURACAO">PROC.</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center" title="EMPRESTIMO CONSIGNADO">CONS.</th>
                                  <th className="px-3 py-3 border-b border-white/5 text-center text-[8px]" title="CONVENCAO COLETIVA">C.COL</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-4 py-3 border-b border-white/5 text-center font-bold text-indigo-400">QTD FOLHA</th>
                                  <th className="px-4 py-3 border-b border-white/5 text-center font-bold text-purple-400">PRO-L</th>
                                  <th className="px-4 py-3 border-b border-white/5 text-center">VAR</th>
                                  <th className="px-4 py-3 border-b border-white/5 text-center">ADIA</th>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-3 border-b border-white/5">TRIBUTAÇÃO</th>
                              <th className="px-4 py-3 border-b border-white/5">SISTEMA</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filtered.map(emp => (
                          <tr key={emp.id} className="hover:bg-white/[0.04] transition-all group cursor-pointer">
                            <td className="px-2 py-2 whitespace-nowrap sticky left-0 bg-[#0A101D]/80 backdrop-blur-md z-20 text-center">
                               <button onClick={() => { setSelectedEmpresa(emp); setIsEditModalOpen(true); }} className="p-1.5 bg-white/5 rounded-lg text-slate-600 group-hover:text-white group-hover:bg-white/10 transition-all"><Pencil size={12}/></button>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap sticky left-[48px] bg-[#0A101D]/80 backdrop-blur-md z-10">
                               {baseSector === 'Geral' ? (
                                  <div className="flex gap-2 justify-start items-center">
                                     <div title="DP" className={`w-2 h-2 rounded-full ${emp.bkoDP ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`}></div>
                                     <div title="Fiscal" className={`w-2 h-2 rounded-full ${emp.bkoFiscal ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-slate-800'}`}></div>
                                     <div title="Contábil" className={`w-2 h-2 rounded-full ${emp.bkoContabil ? 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.6)]' : 'bg-slate-800'}`}></div>
                                  </div>
                               ) : (
                                  <select 
                                    value={isOnboardingTab ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia} 
                                    onChange={(e) => updateEmpresaDirectly(emp.id, isOnboardingTab ? (baseSector==='DP'?{faseOnbDP:e.target.value}:baseSector==='Fiscal'?{faseOnbFiscal:e.target.value}:{faseOnbContabil:e.target.value}) : {statusCompetencia: e.target.value})}
                                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border-none cursor-pointer max-w-[155px] ${getStatusColor(isOnboardingTab? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia)}`}
                                  >
                                     {(isOnboardingTab ? statusOnboarding : (baseSector==='DP'?statusOptionsDP : statusOptionsFiscalContabil)).map(o => <option key={o} value={o} className="bg-[#0A101D]">{o.toUpperCase()}</option>)}
                                  </select>
                               )}
                            </td>
                            <td className="px-4 py-2"><span className="text-[10px] font-black text-white uppercase group-hover:text-indigo-400 transition-colors whitespace-nowrap">{emp.nome}</span></td>
                            <td className="px-4 py-2 font-mono text-[9px] text-slate-500 whitespace-nowrap">{emp.cnpj}</td>
                            <td className="px-4 py-2"><span className="text-[8px] font-black text-slate-400 bg-white/5 px-3 py-1 rounded-lg border border-white/5 uppercase whitespace-nowrap">{emp.franquia}</span></td>
                            <td className="px-4 py-2"><span className={`text-[9px] font-black text-${accent === 'rose' ? 'rose' : accent}-400 uppercase whitespace-nowrap`}>{emp.responsavel}</span></td>
                             
                             {baseSector === 'Geral' ? (
                               <>
                                 <td className="px-3 py-2 text-center text-[9px] font-black text-slate-600 uppercase italic">{emp.bkoDP ? 'Ativo' : '-'}</td>
                                 <td className="px-3 py-2 text-center text-[9px] font-black text-slate-600 uppercase italic">{emp.bkoFiscal ? 'Ativo' : '-'}</td>
                                 <td className="px-3 py-2 text-center text-[9px] font-black text-slate-600 uppercase italic">{emp.bkoContabil ? 'Ativo' : '-'}</td>
                               </>
                            ) : baseSector === 'DP' ? (
                               <>
                                  {isOnboardingTab ? (
                                    <>
                                      <td className="px-3 py-2 text-center text-[9px] font-black text-slate-500 uppercase">{emp.tributacao?.substring(0,3)}</td>
                                      <td className="px-3 py-2 text-center text-[9px] font-black text-slate-300 uppercase whitespace-nowrap">{emp.atividade || '-'}</td>
                                      <td className="px-3 py-2 text-center"><div className="mx-auto w-9 h-5 rounded-lg flex items-center justify-center font-black text-[9px] bg-indigo-500/10 text-indigo-300">{emp.qtdFuncionarios || '-'}</div></td>
                                      <td className="px-3 py-2 text-center"><div className="mx-auto w-9 h-5 rounded-lg flex items-center justify-center font-black text-[9px] bg-purple-500/10 text-purple-300">{emp.qtdProlabore || '-'}</div></td>
                                      <td className="px-3 py-2 text-center text-[8px] font-black text-slate-600 italic uppercase whitespace-nowrap">{emp.sistemaBase}</td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-7 h-4 rounded flex items-center justify-center font-black text-[7px] ${emp.temVariavel ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-slate-800'}`}>VAR</div></td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-7 h-4 rounded flex items-center justify-center font-black text-[7px] ${emp.temAdiantamento ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-slate-800'}`}>ADIA</div></td>
                                      <td className="px-3 py-2 text-center text-[9px] font-black text-orange-400/70 whitespace-nowrap">{emp.competencia || '-'}</td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center ${emp.piConcluido ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white/5'}`}>{emp.piConcluido && <CheckCircle2 size={9} className="text-white"/>}</div></td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center ${emp.onety ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-white/5'}`}>{emp.onety && <Rocket size={9} className="text-white"/>}</div></td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center ${emp.procuracao ? 'bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white/5'}`}>{emp.procuracao && <FileText size={9} className="text-white"/>}</div></td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center ${emp.emprestimoConsignado ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white/5'}`}>{emp.emprestimoConsignado && <ShieldCheck size={9} className="text-white"/>}</div></td>
                                      <td className="px-2 py-2 text-center"><div className={`mx-auto w-5 h-5 rounded-full flex items-center justify-center ${emp.convencaoColetiva ? 'bg-rose-500 shadow-lg shadow-rose-500/20' : 'bg-white/5'}`}>{emp.convencaoColetiva && <Users size={9} className="text-white"/>}</div></td>
                                    </>
                                  ) : (
                                    <>
                                       <td className="px-4 py-2 text-center"><div className="mx-auto w-10 h-5 rounded-lg flex items-center justify-center font-black text-[9px] bg-indigo-500/10 text-indigo-300">{emp.qtdFuncionarios || '-'}</div></td>
                                       <td className="px-4 py-2 text-center"><div className="mx-auto w-10 h-5 rounded-lg flex items-center justify-center font-black text-[9px] bg-purple-500/10 text-purple-300">{emp.qtdProlabore || '-'}</div></td>
                                       <td className="px-4 py-2 text-center"><div className={`mx-auto w-9 h-5 rounded-lg flex items-center justify-center font-black text-[9px] ${emp.temVariavel ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-slate-800'}`}>VAR</div></td>
                                       <td className="px-4 py-2 text-center"><div className={`mx-auto w-9 h-5 rounded-lg flex items-center justify-center font-black text-[9px] ${emp.temAdiantamento ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-slate-800'}`}>ADIA</div></td>
                                    </>
                                  )}
                               </>
                            ) : (
                               <>
                                  <td className="px-4 py-2 text-[9px] font-black text-white/50 uppercase whitespace-nowrap">{emp.tributacao}</td>
                                  <td className="px-4 py-2 text-[9px] font-black text-white/30 uppercase italic whitespace-nowrap">{emp.sistemaBase}</td>
                               </>
                            )}
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
               <h3 className="text-4xl font-black text-white italic mb-12 text-center uppercase tracking-tighter decoration-indigo-600 underline decoration-4 underline-offset-8">Ajuste Master Patrocinado</h3>
               
               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4"><label className="text-xs font-black text-slate-600 ml-8 uppercase tracking-widest">Razão Social</label><input className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-xl text-white uppercase font-black focus:border-indigo-500 transition-all outline-none" value={selectedEmpresa.nome} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {nome: e.target.value})}/></div>
                  <div className="space-y-4"><label className="text-xs font-black text-slate-600 ml-8 uppercase tracking-widest">Analista Responsável</label><input className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-xl text-white uppercase font-black focus:border-indigo-500 transition-all outline-none" value={selectedEmpresa.responsavel} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {responsavel: e.target.value})}/></div>
                  
                  <div className="col-span-2 grid grid-cols-3 gap-8 bg-black/30 p-12 rounded-[4rem] border border-white/5 mt-8 text-slate-200">
                     <div className="space-y-6">
                        <h4 className="text-indigo-400 text-xs font-black uppercase tracking-widest border-b border-indigo-400/20 pb-4">Setor DP</h4>
                        <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Atividade</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.atividade} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {atividade: e.target.value})}/></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Qtd Folha</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.qtdFuncionarios} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {qtdFuncionarios: e.target.value})}/></div>
                           <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Qtd Pro-L</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.qtdProlabore} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {qtdProlabore: e.target.value})}/></div>
                        </div>
                        <div className="space-y-3"><label className="text-[10px] text-slate-500 uppercase ml-2">Competência</label><input className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white font-black" value={selectedEmpresa.competencia} onChange={e=>updateEmpresaDirectly(selectedEmpresa!.id, {competencia: e.target.value})}/></div>
                        <div className="grid grid-cols-2 gap-3 pt-4">
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { temVariavel: !selectedEmpresa!.temVariavel })} className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.temVariavel ? 'bg-orange-600 text-white' : 'bg-white/5 text-slate-700'}`}>VARIÁVEL</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { temAdiantamento: !selectedEmpresa!.temAdiantamento })} className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.temAdiantamento ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-700'}`}>ADIANTAMENTO</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { piConcluido: !selectedEmpresa!.piConcluido })} className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.piConcluido ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-700'}`}>PI CONCLUÍDO</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { onety: !selectedEmpresa!.onety })} className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.onety ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-700'}`}>ONETY</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { procuracao: !selectedEmpresa!.procuracao })} className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.procuracao ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-700'}`}>PROCURAÇÃO</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { emprestimoConsignado: !selectedEmpresa!.emprestimoConsignado })} className={`py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.emprestimoConsignado ? 'bg-amber-600 text-white' : 'bg-white/5 text-slate-700'}`}>CONSIGNADO</button>
                           <button onClick={() => updateEmpresaDirectly(selectedEmpresa!.id, { convencaoColetiva: !selectedEmpresa!.convencaoColetiva })} className={`col-span-2 py-4 rounded-xl text-[8px] font-black uppercase transition-all ${selectedEmpresa.convencaoColetiva ? 'bg-rose-600 text-white' : 'bg-white/5 text-slate-700'}`}>CONVENÇÃO COLETIVA</button>
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
