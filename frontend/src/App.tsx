import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  Users, Search, Upload, Globe, FileText, BookOpen, LogOut, X, Pencil, Archive, AlertTriangle, Menu, UserCog, DollarSign, Trash2, RefreshCcw, Plus, ChevronLeft, ChevronRight, ExternalLink
} from 'lucide-react';
import Papa from 'papaparse';
import './App.css';

// Tipos
type Visao = 'Geral' | 'DP' | 'Fiscal' | 'Contábil' | 'Arquivo' | 'Usuarios' | 'COBRANCA';

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'lider' | 'analista';
  approved: boolean;
  setor?: 'DP' | 'FISCAL' | 'CONTABIL' | 'FINANCEIRO';
  modulos?: string; 
}

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  franquia: string;
  responsavel: string;
  competencia: string;
  link_onboarding?: string;
  link_onetty?: string;
  inicio_onboarding?: string;
  tributacao: string;
  atividade: string;
  qtd_func: string;
  pro_l: string;
  sistema: string;
  var_campo: boolean;
  adia_campo: boolean;
  proc: boolean;
  cons: boolean;
  c_col: boolean;
  observacoes: string;
  isArchived: boolean;
  isOnboarding?: boolean;
  statusCompetencia: 'PENDENTE' | 'EM ANDAMENTO' | 'CONCLUÍDO' | 'NÃO SE APLICA';

  // CAMPOS FINANCEIROS BKO
  bkoDP: boolean;
  valorDP: number;
  pagoDP: boolean;
  vencDP: string;
  
  bkoFiscal: boolean;
  valorFiscal: number;
  pagoFiscal: boolean;
  vencFiscal: string;
  
  bkoContabil: boolean;
  valorContabil: number;
  pagoContabil: boolean;
  vencContabil: string;

  valorMensalidade: number;
  dataVencimento: string;
  statusFinanceiro: 'PENDENTE' | 'EM ANDAMENTO' | 'CONCLUÍDO';
}

const analistasDP = ['FERNANDA', 'GABRIEL', 'THAIS', 'POLIANA'];
const analistasFiscal = ['MAYCON', 'GABRIELA', 'JULIA', 'RAFAEL'];
const analistasContabil = ['LUANA', 'VINICIUS', 'ANA', 'CARLOS'];
const analistasFinanceiro = ['ALINE', 'BEATRIZ', 'FINANCEIRO MATRIZ'];

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const GLOBAL_ADMINS = ['gui.contato8@gmail.com', 'admin'];

export default function App() {
  const formatCNPJ = (val: string) => {
    const digits = (val || '').replace(/\D/g, '');
    if (digits.length !== 14) return val;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [visaoAtiva, setVisaoAtiva] = useState<Visao>('Geral');
  const [isOnboardingTab, setIsOnboardingTab] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('Todos');
  const [filterFranquia, setFilterFranquia] = useState('Todas');
  const [viewState, setViewState] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPRDrawerOpen, setIsPRDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginNome, setLoginNome] = useState('');
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'pending'>('login');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const checkOverdue = (emp: Empresa) => {
    const resp = (emp.responsavel || '').toUpperCase().trim();
    if (resp && resp !== 'NÃO ATRIBUÍDO' && resp !== 'NAO ATRIBUIDO') return false;
    if (!emp.inicio_onboarding) return false;

    try {
      const datePart = (emp.inicio_onboarding || '').replace(/-/g, '/');
      const [startM, startY] = datePart.split('/').map(Number);
      if (!startM || !startY) return false;

      const currentM = viewState.month + 1;
      const currentY = viewState.year;

      const diff = (currentY - startY) * 12 + (currentM - startM);
      return diff >= 3; 
    } catch { return false; }
  };


  const getCurrentCompetence = () => {
  const now = new Date();
  return `${MESES[now.getMonth()]} / ${now.getFullYear()}`;
};
  const fetchData = async () => {
    let query = supabase.from('backoffice_empresas').select('*');
    if (currentUser?.role === 'analista') {
       query = query.or(`responsavel.eq."${currentUser?.nome}",responsavel.eq."${currentUser?.email}"`);
    }
    const { data: emp } = await query.order('created_at', { ascending: false });
    if (emp) setEmpresas(emp as Empresa[]);
  };

  const updateProfile = async (id: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (!error) {
      setAllProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      if (currentUser?.id === id) {
         const newProf = { ...currentUser, ...updates };
         setCurrentUser(newProf);
         localStorage.setItem('cf_user', JSON.stringify(newProf));
      }
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('cf_user');
    if (saved) {
      const user = JSON.parse(saved);
      setCurrentUser(user);
      setIsLoggedIn(true);
      fetchData();
      if (user.role === 'admin') {
         supabase.from('profiles').select('*').then(({ data }) => data && setAllProfiles(data));
      }
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [visaoAtiva, isOnboardingTab, viewState]);

  const handleUpdate = async (id: string, updates: Partial<Empresa>) => {
    const target = empresas.find(e => e.id === id);
    if (!target) return;

    if (updates.responsavel && updates.responsavel !== target.responsavel) {
       updates.isOnboarding = updates.responsavel.toUpperCase().includes('NÃO ATRIBUÍDO');
    }
    
    const { error } = await supabase.from('backoffice_empresas').update(updates).eq('id', id);
    if (!error) {
       setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  };

  const archiveEmpresa = async (id: string) => {
    const { error } = await supabase.from('backoffice_empresas').update({ isArchived: true }).eq('id', id);
    if (!error) {
       setEmpresas(prev => prev.map(e => e.id === id ? { ...e, isArchived: true } : e));
    }
  };

  const restoreEmpresa = async (id: string) => {
    const { error } = await supabase.from('backoffice_empresas').update({ isArchived: false }).eq('id', id);
    if (!error) {
       setEmpresas(prev => prev.map(e => e.id === id ? { ...e, isArchived: false } : e));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (!status || selectedIds.length === 0) return;
    const { error } = await supabase.from('backoffice_empresas').update({ statusCompetencia: status }).in('id', selectedIds);
    if (!error) {
      setEmpresas(prev => prev.map(e => selectedIds.includes(e.id) ? {...e, statusCompetencia: status as any} : e));
      setSelectedIds([]);
    }
  };

  const handleBulkAssign = async (novoResponsavel: string) => {
    if (!novoResponsavel || selectedIds.length === 0) return;
    const selectedCNPJs = Array.from(new Set(empresas.filter(e => selectedIds.includes(e.id)).map(e => e.cnpj)));
    const updates = { responsavel: novoResponsavel, isOnboarding: false };
    const { error } = await supabase.from('backoffice_empresas').update(updates).in('cnpj', selectedCNPJs);
    if (!error) {
       setEmpresas(prev => prev.map(e => selectedCNPJs.includes(e.cnpj) ? {...e, ...updates} : e));
       setSelectedIds([]);
    }
  };

  const syncEdit = async (dataOverride?: Empresa) => {
    const dataToSave = dataOverride || editingEmpresa;
    if (!dataToSave) return;
    const { error } = await supabase.from('backoffice_empresas').update(dataToSave).eq('id', dataToSave.id);
    if (!error) { fetchData(); setIsEditModalOpen(false); }
  };

  const cycleStatus = (id: string, current: string) => {
    const main = current.split('|')[0].trim();
    const sequence = ['PENDENTE', 'EM ANDAMENTO', '100% CONCLUIDO'];
    const idx = sequence.indexOf(main);
    const next = sequence[(idx + 1) % sequence.length];
    handleUpdate(id, { statusCompetencia: next as any });
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const cnpj = (formData.get('cnpj') as string) || '';
    const nome = (formData.get('nome') as string) || '';
    const franquia = (formData.get('franquia') as string) || '';
    const responsavel = (formData.get('responsavel') as string) || 'NÃO ATRIBUÍDO';
    const tributacao = formData.get('tributacao') as string;
    const sistema = formData.get('sistema') as string;
    const comp = getCurrentCompetence();
    const pro_l = formData.get('pro_l') as string;
    const qtd_func = formData.get('qtd_func') as string;

    const baseData = { 
      nome: nome.toUpperCase(), cnpj, franquia: franquia.toUpperCase(), responsavel, 
      isOnboarding: isOnboardingTab, 
      bkoDP: visaoAtiva === 'DP' || visaoAtiva === 'Geral',
      bkoFiscal: visaoAtiva === 'Fiscal',
      bkoContabil: visaoAtiva === 'Contábil',
      inicio_onboarding: comp, pro_l: pro_l || '0', qtd_func: qtd_func || '0',
      tributacao: (tributacao || '').toUpperCase(), 
      sistema: (sistema || '').toUpperCase(), 
      competencia: comp,
      statusCompetencia: 'PENDENTE'
    };

    const { error } = await supabase.from('backoffice_empresas').insert([baseData]);
    if (!error) {
       setIsNewModalOpen(false);
       fetchData();
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentYear = viewState.year;

    const processRows = async (rows: any[]) => {
      const toInsert: any[] = [];
      const toB = (v: any) => {
        if (v === undefined || v === null) return false;
        const s = String(v).toUpperCase().trim();
        return s === 'SIM' || s === 'TRUE' || s === '1' || s === 'S';
      };

      rows.forEach(r => {
        const data: any = {};
        Object.keys(r).forEach(k => data[k.trim()] = r[k]);
        if (!data['EMPRESAS'] && !data['EMPRESA'] && !data['NOME']) return;

        const rawCnpj = String(data['CNPJ'] || data['CNPJ '] || data['CNPJ/CPF'] || data.cnpj || '');
        const cleanCnpj = rawCnpj.replace(/\D/g, '');

        const baseData = {
          nome: (data.EMPRESAS || data.EMPRESA || data.NOME || 'UNIDADE').toUpperCase(),
          cnpj: cleanCnpj,
          franquia: (data.FRANQUIA || 'GERAL').toUpperCase(),
          responsavel: (data.COLABORADOR || data.RESPONSAVEL || data.ANALISTA || 'NÃO ATRIBUÍDO').toUpperCase().trim(),
          statusCompetencia: 'Pendente',
          pro_l: String(data['PRÓ-LABORE'] || data['PRÓ LABORE'] || data['PROLABORE'] || data['PRO-LABORE'] || data['PRO LABORE'] || '0'),
          qtd_func: String(data['FUNCIONÁRIOS'] || data['FUNCIONARIOS'] || data['FUNC'] || '0'),
          tributacao: (data['TRIBUTAÇÃO'] || data['TRIBUTACAO'] || data['RENGIME'] || data['REGIME'] || '').toUpperCase(),
          sistema: (data['SISTEMA'] || data['BASE'] || '').toUpperCase(),
          isOnboarding: isOnboardingTab,
          inicio_onboarding: data['COMPETÊNCIA INÍCIO'] || data['COMPETENCIA INICIO'] || data['COMPETÊNCIA'] || data['DATA'] || `${(viewState.month + 1).toString().padStart(2, '0')}/${currentYear}`,
          bkoDP: visaoAtiva === 'DP' || visaoAtiva === 'Geral', 
          bkoFiscal: visaoAtiva === 'Fiscal', 
          bkoContabil: visaoAtiva === 'Contábil',
          proc: toB(data.PROCURAÇÃO),
          cons: toB(data['EMPRÉSTIMO CONSIGNADO']),
          c_col: toB(data['CONVENÇÃO COLETIVA']),
          var_campo: toB(data['VARIÁVEL']),
          adia_campo: toB(data['ADIANTAMENTO']),
          observacoes: data['OBSERVAÇÕES PARA PRÓXIMA ANALISTA'] || data['OBSERVAÇÕES'] || ''
        };

        for (let m = 0; m < 12; m++) {
          toInsert.push({ ...baseData, competencia: `${(m + 1).toString().padStart(2, '0')}/${currentYear}` });
        }
      });

      if (toInsert.length > 0) {
        const uniqueToInsert = Array.from(
          toInsert.reduce((map, obj) => map.set(`${obj.cnpj}-${obj.competencia}`, obj), new Map()).values()
        );

        const { error } = await supabase
          .from('backoffice_empresas')
          .upsert(uniqueToInsert, { onConflict: 'cnpj,competencia' });

        if (error) {
          console.error("ERRO SUPABASE (UPSERT):", error);
          alert("❌ ERRO NO BANCO: " + error.message);
        } else {
          alert("✅ " + (uniqueToInsert.length / 12).toFixed(0) + " Unidades processadas com sucesso!");
          fetchData();
        }
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // @ts-ignore
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
        await processRows(data);
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: 'greedy', delimiter: ';', 
        complete: async (results) => {
          if (results.errors.length > 0) {
            console.error("ERRO NO PARSE:", results.errors);
            alert("Erro ao ler CSV. Use ponto e vírgula (;).");
            return;
          }
          await processRows(results.data);
        }
      });
    }
  };

  const baseFiltered = empresas.filter(e => {
     const resp = (e.responsavel || '').toUpperCase().trim();
     const matchesSearch = !searchTerm || 
                          (e.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.cnpj || '').includes(searchTerm) ||
                          (e.franquia || '').toLowerCase().includes(searchTerm.toLowerCase());
     const matchesFranquia = filterFranquia === 'Todas' || e.franquia === filterFranquia;
     const matchesAnalista = filterResponsavel === 'Todos' || e.responsavel === filterResponsavel;
     
     const isActuallyOnboarding = !resp || resp === 'NÃO ATRIBUÍDO' || resp === 'NAO ATRIBUIDO';
     const matchesOnboarding = isActuallyOnboarding === isOnboardingTab;
     const isVisibleInMain = !e.isArchived;

     // VISÃO FINANCEIRA / COBRANÇA
     if (visaoAtiva === 'COBRANCA') return !e.isArchived && matchesSearch && matchesFranquia;

     // VISÃO ARQUIVO
     if (visaoAtiva === 'Arquivo') return e.isArchived && currentUser?.role === 'admin';

     // VISÃO GERAL / OPERACIONAL
     // Se estiver buscando, esquece a trava de onboarding
     if (searchTerm) return isVisibleInMain && matchesSearch && matchesFranquia;

     return matchesSearch && matchesFranquia && matchesAnalista && matchesOnboarding && isVisibleInMain;
   });

  const stats = {
    total: baseFiltered.length,
    concluida: baseFiltered.filter(e => {
        const s = (e.statusFinanceiro || '').toUpperCase();
        return visaoAtiva === 'COBRANCA' ? (s === 'CONCLUÍDO' || s === 'CONCLUIDO') : e.statusCompetencia.startsWith('100% CONCLUIDO');
    }).length,
    emAndamento: baseFiltered.filter(e => {
        const s = (e.statusFinanceiro || '').toUpperCase();
        return visaoAtiva === 'COBRANCA' ? s === 'EM ANDAMENTO' : e.statusCompetencia.startsWith('EM ANDAMENTO');
    }).length,
    pendente: baseFiltered.filter(e => {
        const s = (e.statusFinanceiro || '').toUpperCase();
        return visaoAtiva === 'COBRANCA' ? (s === 'PENDENTE' || !e.statusFinanceiro) : e.statusCompetencia.startsWith('PENDENTE');
    }).length,
    foraDoPrazo: baseFiltered.filter(e => e.statusCompetencia.startsWith('FORA DO PRAZO') || checkOverdue(e)).length,
    totalFranquias: new Set(baseFiltered.map(e => e.franquia)).size,
    totalReceita: baseFiltered.reduce((acc, e) => {
       const dp = e.bkoDP ? (e.valorDP || 200) : 0;
       const fis = e.bkoFiscal ? (e.valorFiscal || 200) : 0;
       const con = e.bkoContabil ? (e.valorContabil || 200) : 0;
       return acc + (e.valorMensalidade || (dp + fis + con));
    }, 0),
    receitaPaga: baseFiltered.reduce((acc, e) => {
       if (e.statusFinanceiro === 'CONCLUÍDO') return acc + (e.valorMensalidade || ((e.valorDP||200) + (e.valorFiscal||200) + (e.valorContabil||200)));
       const dp = (e.bkoDP && e.pagoDP) ? (e.valorDP || 200) : 0;
       const fis = (e.bkoFiscal && e.pagoFiscal) ? (e.valorFiscal || 200) : 0;
       const con = (e.bkoContabil && e.pagoContabil) ? (e.valorContabil || 200) : 0;
       return acc + dp + fis + con;
    }, 0)
  };

  const filtered = baseFiltered.filter(e => {
     if (!statusFilter) return true;
     if (visaoAtiva === 'COBRANCA') {
        const s = (e.statusFinanceiro || '').toUpperCase();
        if (statusFilter === 'CONCLUIDO' || statusFilter === '100% CONCLUIDO' || statusFilter === 'PAGO OK') return (s === 'CONCLUÍDO' || s === 'CONCLUIDO');
        if (statusFilter === 'EM ANDAMENTO' || statusFilter === 'AGENDADO') return s === 'EM ANDAMENTO';
        if (statusFilter === 'PENDENTE' || statusFilter === 'A COBRAR') return (s === 'PENDENTE' || !e.statusFinanceiro);
        return true;
     }
     if (statusFilter === '100% CONCLUIDO') return e.statusCompetencia.startsWith('100% CONCLUIDO');
     if (statusFilter === 'EM ANDAMENTO') return e.statusCompetencia.startsWith('EM ANDAMENTO');
     if (statusFilter === 'PENDENTE') return e.statusCompetencia.startsWith('PENDENTE');
     if (statusFilter === 'OUTROS') return e.statusCompetencia.startsWith('FORA DO PRAZO') || checkOverdue(e);
     return true;
   }).sort((a, b) => {
    if (visaoAtiva === 'COBRANCA') {
       const order = { 'PENDENTE': 0, 'EM ANDAMENTO': 1, 'CONCLUÍDO': 2 };
       const statusA = a.statusFinanceiro || 'PENDENTE';
       const statusB = b.statusFinanceiro || 'PENDENTE';
       return (order as any)[statusA] - (order as any)[statusB];
    }
    const getRank = (e: Empresa) => {
      if (e.statusCompetencia.startsWith('100% CONCLUIDO')) return 1;
      if (e.statusCompetencia.startsWith('EM ANDAMENTO')) return 2;
      if (e.statusCompetencia.startsWith('PENDENTE')) return 3;
      if (e.statusCompetencia.startsWith('FORA DO PRAZO') || checkOverdue(e)) return 4;
      return 5;
    };
    return getRank(a) - getRank(b);
  });

  const canSeeModule = (mod: string) => {
    if (currentUser?.role === 'admin') return true;
    return (currentUser?.modulos || '').split(',').includes(mod);
  };

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const email = loginEmail.trim().toLowerCase();
    if (GLOBAL_ADMINS.includes(email)) {
       const master: UserProfile = { id: 'master', email, nome: 'Gestor Master', role: 'admin', approved: true };
       setCurrentUser(master); setIsLoggedIn(true); localStorage.setItem('cf_user', JSON.stringify(master));
       return;
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
    if (profile && profile.approved) {
      setCurrentUser(profile); setIsLoggedIn(true); localStorage.setItem('cf_user', JSON.stringify(profile));
      fetchData();
    } else alert("Acesso negado ou pendente.");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    await supabase.from('profiles').insert([{ 
       email: loginEmail.toLowerCase(), 
       nome: loginNome, 
       role: 'analista', 
       approved: false,
       setor: formData.get('setor') as any
    }]);
    setLoginMode('pending');
  };

  const SidebarIcon = ({ icon: Icon, label, isActive, onClick, visible = true }: any) => {
    if (!visible) return null;
    return (
      <button onClick={onClick} title={label} className={`flex items-center rounded-2xl transition-all relative group ${isSidebarExpanded ? 'w-full px-5 py-3.5 gap-4 justify-start' : 'w-12 h-12 justify-center'} ${isActive ? `bg-indigo-600/20 text-indigo-500 shadow-lg` : 'text-indigo-900/60 hover:bg-white/5 hover:text-white'}`}>
        <Icon size={20} />
        {isSidebarExpanded && <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>}
      </button>
    );
  };

  if (!isLoggedIn) {
     return (
       <div className="h-screen w-screen flex items-center justify-center bg-[#05080F]">
         <div className="bg-[#0A101D] p-10 rounded-[2rem] border border-white/10 w-96 space-y-6">
            <h1 className="text-2xl font-black text-white italic text-center uppercase tracking-tighter">BKO <span className="text-indigo-500">MESTRE</span></h1>
            {loginMode === 'pending' ? <p className="text-white/40 text-center text-xs font-black uppercase">Aguardando aprovação...</p> : loginMode === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-4">
                 <input placeholder="NOME COMPLETO" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white text-xs uppercase outline-none" value={loginNome} onChange={e=>setLoginNome(e.target.value)} required/>
                 <input type="email" placeholder="E-MAIL CORPORATIVO" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white text-xs outline-none" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/>
                 <select name="setor" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white text-[10px] font-black uppercase outline-none cursor-pointer" required>
                     <option value="" className="bg-[#0A101D]">SELECIONE SEU SETOR...</option>
                     <option value="DP" className="bg-[#0A101D]">DEPARTAMENTO PESSOAL</option>
                     <option value="FISCAL" className="bg-[#0A101D]">FISCAL</option>
                     <option value="CONTABIL" className="bg-[#0A101D]">CONTÁBIL</option>
                     <option value="FINANCEIRO" className="bg-[#0A101D]">FINANCEIRO</option>
                  </select>
                 <button className="w-full py-4 bg-orange-600 text-white font-black rounded-xl text-xs uppercase shadow-xl">Solicitar Acesso</button>
                 <button type="button" onClick={()=>setLoginMode('login')} className="w-full text-white/20 text-[9px] font-black uppercase mt-4">Já tenho conta</button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                 <input type="email" placeholder="SEU E-MAIL" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white text-xs outline-none focus:border-indigo-500" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/>
                 <button className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase shadow-xl hover:bg-indigo-500 transition-all">Acessar Sistema</button>
                 <button type="button" onClick={()=>setLoginMode('register')} className="w-full text-white/20 text-[9px] font-black uppercase mt-4">Solicitar novo acesso</button>
              </form>
            )}
         </div>
       </div>
     );
  }

  if ((visaoAtiva as string) === 'Usuarios') {
     return (
       <div className="flex h-screen bg-[#05080F] text-slate-200">
          <aside className="w-20 bg-[#0A101D] border-r border-white/5 flex flex-col items-center py-8">
             <button onClick={()=>setVisaoAtiva('Geral')}><Menu size={24}/></button>
          </aside>
          <main className="flex-1 p-10 overflow-auto bg-[#0A101D]">
              <div className="flex items-center justify-between mb-10">
                 <h2 className="text-xl font-black text-white italic uppercase tracking-widest flex items-center gap-4"><UserCog size={28} className="text-indigo-500"/> Controle de Squad</h2>
                 <button onClick={()=>setVisaoAtiva('Geral')} className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all">Voltar ao Dashboard</button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 {allProfiles.sort((a,b) => a.nome.localeCompare(b.nome)).map(p => {
                    const toggleMod = (mod: string) => {
                       let mods = (p.modulos || '').split(',').map(m => m.trim()).filter(m => m);
                       if (mods.includes(mod)) mods = mods.filter(m => m !== mod);
                       else mods.push(mod);
                       updateProfile(p.id, { modulos: mods.join(',') });
                    };

                    return (
                       <div key={p.id} className="bg-white/[0.03] border border-white/5 p-8 rounded-[2rem] flex flex-wrap items-center justify-between gap-8 transition-all hover:bg-white/[0.05] hover:border-indigo-500/20 group">
                          <div className="flex items-center gap-6">
                             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl ${p.approved ? 'bg-indigo-600 text-white' : 'bg-orange-600/20 text-orange-500'}`}>
                                {p.nome.substring(0,1)}
                             </div>
                             <div>
                                <p className="text-lg font-black text-white uppercase italic tracking-tighter">{p.nome}</p>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{p.email}</p>
                             </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-12">
                             <div className="space-y-2">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Cargo Hierárquico</p>
                                <select 
                                   value={p.role} 
                                   onChange={(e) => updateProfile(p.id, { role: e.target.value as any })}
                                   className="bg-[#0F172A] border border-white/10 p-3 rounded-xl text-[10px] font-black text-white uppercase outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                   <option value="analista">Analista</option>
                                   <option value="lider">Líder</option>
                                   <option value="admin">Administrador (TI)</option>
                                </select>
                             </div>

                             <div className="space-y-2">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Módulos Habilitados</p>
                                <div className="flex gap-2">
                                   {['DP', 'FISCAL', 'CONTABIL'].map(m => {
                                      const hasAccess = (p.modulos || '').includes(m);
                                      return (
                                         <button 
                                            key={m}
                                            onClick={() => toggleMod(m)}
                                            className={`px-3 py-2 rounded-lg text-[8px] font-black uppercase transition-all border ${hasAccess ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg' : 'bg-white/5 border-white/5 text-white/20 hover:text-white/40'}`}
                                         >
                                            {m}
                                         </button>
                                      );
                                   })}
                                </div>
                             </div>

                             <div className="space-y-2">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Setor de Atuação</p>
                                <select 
                                   value={p.setor || ''} 
                                   onChange={(e) => updateProfile(p.id, { setor: e.target.value as any })}
                                   className="bg-[#0F172A] border border-white/10 p-3 rounded-xl text-[10px] font-black text-white uppercase outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                   <option value="">NÃO DEFINIDO</option>
                                   <option value="DP">DP</option>
                                   <option value="FISCAL">FISCAL</option>
                                   <option value="CONTABIL">CONTABIL</option>
                                   <option value="FINANCEIRO">FINANCEIRO</option>
                                </select>
                             </div>

                             <div className="space-y-2">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Status de Acesso</p>
                                <button 
                                   onClick={() => updateProfile(p.id, { approved: !p.approved })}
                                   className={`w-full px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-xl ${p.approved ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-orange-600 text-white hover:bg-orange-500 animate-pulse'}`}
                                >
                                   {p.approved ? 'Acesso Ativo' : 'Acesso Pendente'}
                                </button>
                             </div>
                          </div>
                       </div>
                    );
                 })}
              </div>
          </main>
       </div>
     );
  }

  return (
    <div className="flex h-screen bg-[#05080F] text-slate-200 font-['Inter',sans-serif] overflow-hidden">
      <aside className={`bg-[#0A101D] border-r border-white/5 flex flex-col items-center py-6 gap-6 transition-all ${isSidebarExpanded ? 'w-64 px-6' : 'w-20'} shrink-0 z-50`}>
        <div onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="w-12 h-12 flex items-center justify-center text-indigo-500 cursor-pointer hover:bg-white/5 rounded-2xl"><Menu size={24} /></div>
        <SidebarIcon icon={Globe} label="GERAL" isActive={visaoAtiva === 'Geral'} onClick={() => setVisaoAtiva('Geral')} visible={true} />
        <SidebarIcon icon={Users} label="DP" isActive={visaoAtiva === 'DP'} onClick={() => setVisaoAtiva('DP')} visible={canSeeModule('DP')} />
        <SidebarIcon icon={FileText} label="FISCAL" isActive={visaoAtiva === 'Fiscal'} onClick={() => setVisaoAtiva('Fiscal')} visible={canSeeModule('Fiscal')} />
        <SidebarIcon icon={BookOpen} label="CONTÁBIL" isActive={visaoAtiva === 'Contábil'} onClick={() => setVisaoAtiva('Contábil')} visible={canSeeModule('Contabil') || canSeeModule('Contábil')} />
        <div className="w-10 h-[1px] bg-white/5 my-2" />
        <SidebarIcon icon={DollarSign} label="COBRANÇA" isActive={visaoAtiva === 'COBRANCA'} onClick={() => setVisaoAtiva('COBRANCA')} visible={currentUser?.role === 'admin' || currentUser?.role === 'lider'} />
        <SidebarIcon icon={Archive} label="LIXEIRA" isActive={visaoAtiva === 'Arquivo'} onClick={() => setVisaoAtiva('Arquivo')} visible={currentUser?.role === 'admin'} />
        <div className="flex-1" />
        <SidebarIcon icon={UserCog} label="SQUAD" isActive={(visaoAtiva as string) === 'Usuarios'} onClick={() => setVisaoAtiva('Usuarios')} visible={currentUser?.role === 'admin'} />
        <SidebarIcon icon={LogOut} label="SAIR" onClick={() => { localStorage.removeItem('cf_user'); setIsLoggedIn(false); }} />
      </aside>

      <main className="flex-1 flex flex-col bg-[#0A101D] min-w-0">
        <header className="h-[64px] border-b border-white/5 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 shrink-0">
             <h1 className="text-sm font-black text-white italic uppercase tracking-tighter">{visaoAtiva}</h1>
             {visaoAtiva !== 'COBRANCA' && visaoAtiva !== 'Arquivo' && (
               <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5 uppercase select-none">
                  <button onClick={() => setIsOnboardingTab(false)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${!isOnboardingTab ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>CARTEIRA</button>
                  <button onClick={() => setIsOnboardingTab(true)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${isOnboardingTab ? 'bg-orange-600 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>ONBOARDING</button>
               </div>
             )}
             <div className="flex items-center bg-[#0A101D] border border-white/5 p-1 rounded-xl shadow-inner relative">
                <button onClick={() => setViewState(v => {
                   const m = v.month === 0 ? 11 : v.month - 1;
                   const y = v.month === 0 ? v.year - 1 : v.year;
                   return { month: m, year: y };
                })} className="p-2 text-white/40 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-all"><ChevronLeft size={16}/></button>
                <div onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} className="px-6 py-1.5 min-w-[140px] text-center border-x border-white/5 cursor-pointer">
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{MESES[viewState.month]}</p>
                   <p className="text-[8px] font-bold text-white/20">{viewState.year}</p>
                </div>
                <button onClick={() => setViewState(v => {
                   const m = v.month === 11 ? 0 : v.month + 1;
                   const y = v.month === 11 ? v.year + 1 : v.year;
                   return { month: m, year: y };
                })} className="p-2 text-white/40 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-all"><ChevronRight size={16}/></button>
                {isMonthPickerOpen && (
                   <div className="absolute top-full left-0 mt-4 bg-[#0A101D] border border-white/10 p-4 rounded-2xl shadow-2xl z-[100] grid grid-cols-3 gap-2">
                      {MESES.map((m, i) => (
                         <button key={m} onClick={() => { setViewState(v => ({...v, month: i})); setIsMonthPickerOpen(false); }} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${viewState.month === i ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}>{m.substring(0,3)}</button>
                      ))}
                   </div>
                )}
             </div>
             <button onClick={() => setViewState({ month: new Date().getMonth(), year: new Date().getFullYear() })} className="px-3 py-2 text-[8px] font-black text-indigo-500 hover:text-white bg-indigo-500/10 rounded-xl uppercase transition-all tracking-tighter">HOJE</button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
             <div className="flex items-center bg-white/5 rounded-xl border border-white/10 px-3 h-10 gap-2 min-w-[200px]">
                <Search size={14} className="text-white/20" />
                <input placeholder="RAZÃO OU CNPJ..." className="bg-transparent text-[8px] font-black text-white outline-none w-full uppercase placeholder:text-white/10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>

             <select 
                className="h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-indigo-400 uppercase outline-none cursor-pointer"
                value={filterResponsavel}
                onChange={e => setFilterResponsavel(e.target.value)}
             >
                <option value="Todos" className="bg-[#0A101D]">ANALISTAS...</option>
                {[...analistasDP, ...analistasFiscal, ...analistasContabil].sort().map(a => <option key={a} value={a} className="bg-[#0A101D]">{a}</option>)}
             </select>

             <select 
                className="h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-indigo-400 uppercase outline-none cursor-pointer"
                value={filterFranquia}
                onChange={e => setFilterFranquia(e.target.value)}
             >
                <option value="Todas" className="bg-[#0A101D]">FRANQUIAS...</option>
                {Array.from(new Set(empresas.map(e => e.franquia))).sort().map(f => <option key={f} value={f} className="bg-[#0A101D]">{f}</option>)}
             </select>

             <label className="h-10 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2 text-[8px] font-black text-white cursor-pointer hover:bg-white/10 transition-all uppercase shadow-md active:scale-95">
                <Upload size={14} /> IMPORTAR
                <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
             </label>
             <button onClick={() => setIsNewModalOpen(true)} className="h-10 w-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-xl hover:bg-indigo-500 transition-all transform active:scale-95"><Plus size={20} /></button>
          </div>
        </header>

        <section className="px-8 mt-6 grid grid-cols-5 gap-4 shrink-0">
           <div onClick={() => setStatusFilter(null)} className={`p-4 bg-white/[0.03] border border-white/5 rounded-2xl cursor-pointer transition-all ${!statusFilter ? 'ring-2 ring-indigo-500/30' : ''}`}><p className="text-[9px] font-black text-white/20 uppercase tracking-tighter">Total Geral {visaoAtiva === 'COBRANCA' ? 'Financeiro' : 'Operacional'}</p><h3 className="text-2xl font-black text-white tabular-nums">{filtered.length}</h3></div>
           <div onClick={() => setStatusFilter(visaoAtiva === 'COBRANCA' ? 'PAGO OK' : '100% CONCLUIDO')} className={`p-4 bg-white/[0.03] border border-white/5 rounded-2xl cursor-pointer transition-all ${statusFilter === (visaoAtiva === 'COBRANCA' ? 'PAGO OK' : '100% CONCLUIDO') ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : ''}`}><p className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">{visaoAtiva === 'COBRANCA' ? 'PAGO OK' : '100% CONCLUIDO'}</p><h3 className="text-2xl font-black text-emerald-400 tabular-nums">{stats.concluida}</h3></div>
           <div onClick={() => setStatusFilter(visaoAtiva === 'COBRANCA' ? 'AGENDADO' : 'EM ANDAMENTO')} className={`p-4 bg-white/[0.03] border border-white/5 rounded-2xl cursor-pointer transition-all ${statusFilter === (visaoAtiva === 'COBRANCA' ? 'AGENDADO' : 'EM ANDAMENTO') ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : ''}`}><p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">{visaoAtiva === 'COBRANCA' ? 'AGENDADO' : 'EM ANDAMENTO'}</p><h3 className="text-2xl font-black text-indigo-400 tabular-nums">{stats.emAndamento}</h3></div>
           <div onClick={() => setStatusFilter(visaoAtiva === 'COBRANCA' ? 'A COBRAR' : 'PENDENTE')} className={`p-4 bg-white/[0.03] border border-white/5 rounded-2xl cursor-pointer transition-all ${statusFilter === (visaoAtiva === 'COBRANCA' ? 'A COBRAR' : 'PENDENTE') ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : ''}`}><p className="text-[9px] font-black text-red-400 uppercase tracking-tighter">{visaoAtiva === 'COBRANCA' ? 'A COBRAR' : 'PENDENTE'}</p><h3 className="text-2xl font-black text-red-400 tabular-nums">{stats.pendente}</h3></div>
           <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl"><p className="text-[9px] font-black text-red-500 uppercase tracking-tighter">FORA DO PRAZO</p><h3 className="text-2xl font-black text-red-500 tabular-nums">{stats.foraDoPrazo}</h3></div>
        </section>

        {selectedIds.length > 0 && (
           <div className="px-8 mt-4">
              <div className="bg-indigo-600 p-3 rounded-xl flex items-center justify-between shadow-2xl relative z-30">
                 <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-white uppercase ml-2">{selectedIds.length} selecionados</span>
                    <select className="bg-[#0A101D] border border-white/10 rounded-lg px-4 py-2 text-[10px] text-white font-black outline-none" onChange={(e) => handleBulkAssign(e.target.value)}>
                       <option value="">ATRIBUIR ANALISTA...</option>
                       {[...analistasDP, ...analistasFiscal, ...analistasContabil].sort().map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select className="bg-[#0A101D] border border-white/10 rounded-lg px-4 py-2 text-[10px] text-white font-black outline-none" onChange={(e) => handleBulkStatus(e.target.value)}>
                       <option value="">STATUS EM LOTE...</option>
                       <option value="100% CONCLUIDO">100% CONCLUIDO</option>
                       <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                       <option value="PENDENTE">PENDENTE</option>
                    </select>
                    <button onClick={() => setSelectedIds([])} className="text-[9px] font-black text-white/30 hover:text-white uppercase transition-all">Cancelar</button>
                 </div>
              </div>
           </div>
        )}

          <section className="flex-1 overflow-auto custom-scrollbar p-8 pt-0">
           {visaoAtiva === 'COBRANCA' ? (
              <div className="w-full min-w-[1200px]">
                  {/* TOTALIZADOR DE COBRANÇA */}
                  <div className="flex gap-4 mb-4">
                     <div className="flex-1 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-white/20 uppercase">Total de Unidades</p>
                        <h4 className="text-xl font-black text-white">{stats.totalFranquias}</h4>
                     </div>
                     <div className="flex-1 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                        <p className="text-[9px] font-black text-emerald-500/60 uppercase">Receita Paga</p>
                        <h4 className="text-xl font-black text-emerald-500">R$ {stats.receitaPaga.toFixed(2)}</h4>
                     </div>
                     <div className="flex-1 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                        <p className="text-[9px] font-black text-red-500/60 uppercase">Em Aberto</p>
                        <h4 className="text-xl font-black text-red-500">R$ {(stats.totalReceita - stats.receitaPaga).toFixed(2)}</h4>
                     </div>
                  </div>

                  <div className="grid grid-cols-[40px_1.5fr_1fr_100px_100px_120px] gap-4 px-6 py-4 bg-[#0A101D] border-b border-white/5 rounded-t-2xl items-center sticky top-[-1px] z-[40] shadow-xl">
                     <span className="text-[9px] font-black text-white/20 uppercase text-center">Edit</span>
                     <span className="text-[9px] font-black text-white/20 uppercase">Franquia / Responsável</span>
                     <span className="text-[9px] font-black text-white/20 uppercase text-center">Setores e Valores</span>
                     <span className="text-[9px] font-black text-white/20 uppercase text-center">Vencimento</span>
                     <span className="text-[9px] font-black text-white/20 uppercase text-right">Saldo Total</span>
                     <span className="text-[9px] font-black text-white/20 uppercase text-center">Status Geral</span>
                  </div>
                 <div className="divide-y divide-white/[0.02] bg-white/[0.01] rounded-b-2xl border-x border-b border-white/5">
                    {filtered.map(emp => {
                        const dpV = emp.bkoDP ? (emp.valorDP || 200) : 0;
                        const fisV = emp.bkoFiscal ? (emp.valorFiscal || 200) : 0;
                        const conV = emp.bkoContabil ? (emp.valorContabil || 200) : 0;
                        const totalEmp = emp.valorMensalidade || (dpV + fisV + conV);
                        
                        return (
                           <div key={emp.id} className="grid grid-cols-[40px_1.5fr_1fr_100px_100px_120px] gap-4 items-center py-5 px-6 hover:bg-white/[0.03] transition-all group border-b border-white/[0.02]">
                              <div className="flex justify-center"><button onClick={() => { setEditingEmpresa(emp); setIsEditModalOpen(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95"><Pencil size={12}/></button></div>
                              <div>
                                 <p className="text-[10px] font-black text-white uppercase italic truncate max-w-[200px]">{emp.franquia || emp.nome}</p>
                                 <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{emp.responsavel || 'FINANCEIRO MATRIZ'}</p>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 justify-center max-w-[150px] mx-auto py-1">
                                 {emp.bkoDP && (
                                    <div className="flex flex-col items-center gap-0.5">
                                       <button onClick={()=>handleUpdate(emp.id, {pagoDP: !emp.pagoDP})} className={`px-2 py-1 rounded text-[6px] font-black uppercase transition-all shadow-md ${emp.pagoDP ? 'bg-indigo-600 text-white' : 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10'}`}>DP</button>
                                       <p className="text-[6px] font-black text-white/10 italic">R$ {dpV}</p>
                                    </div>
                                 )}
                                 {emp.bkoFiscal && (
                                    <div className="flex flex-col items-center gap-0.5">
                                       <button onClick={()=>handleUpdate(emp.id, {pagoFiscal: !emp.pagoFiscal})} className={`px-2 py-1 rounded text-[6px] font-black uppercase transition-all shadow-md ${emp.pagoFiscal ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-500 border border-amber-500/10'}`}>FISC</button>
                                       <p className="text-[6px] font-black text-white/10 italic">R$ {fisV}</p>
                                    </div>
                                 )}
                                 {emp.bkoContabil && (
                                    <div className="flex flex-col items-center gap-0.5">
                                       <button onClick={()=>handleUpdate(emp.id, {pagoContabil: !emp.pagoContabil})} className={`px-2 py-1 rounded text-[6px] font-black uppercase transition-all shadow-md ${emp.pagoContabil ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'}`}>CONT</button>
                                       <p className="text-[6px] font-black text-white/10 italic">R$ {conV}</p>
                                    </div>
                                 )}
                              </div>

                              <div className="flex justify-center flex-col items-center">
                                 <h4 className="text-sm font-black text-indigo-400 tracking-tighter leading-none">{emp.dataVencimento?.split('/')[0] || '--'}</h4>
                                 <p className="text-[7px] font-black text-white/20 uppercase tracking-widest">{emp.dataVencimento?.split('/')[1] || '---'}</p>
                              </div>

                              <div className="text-right tabular-nums text-[10px] font-black text-white bg-white/[0.04] px-2 py-1.5 rounded-lg border border-white/5 shadow-inner">
                                 R$ {totalEmp.toFixed(2)}
                              </div>

                              <div className="flex justify-center">
                                 <select 
                                    value={emp.statusFinanceiro || 'PENDENTE'} 
                                    onChange={(e) => handleUpdate(emp.id, { statusFinanceiro: e.target.value as any })}
                                    className={`px-3 py-1.5 rounded-lg text-[7px] font-black uppercase border-0 outline-none shadow-xl cursor-pointer transition-all ${
                                       emp.statusFinanceiro === 'CONCLUÍDO' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 
                                       emp.statusFinanceiro === 'EM ANDAMENTO' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/20' : 
                                       'bg-slate-800 text-slate-400 border border-white/5'
                                    }`}
                                 >
                                    <option value="PENDENTE">A COBRAR</option>
                                    <option value="EM ANDAMENTO">AGENDADO</option>
                                    <option value="CONCLUÍDO">PAGO OK</option>
                                 </select>
                              </div>
                           </div>
                        );
                     })}
                 </div>
              </div>
           ) : (
              <div className="w-full min-w-[1400px]">
                 <div className="grid grid-cols-[40px_40px_130px_1.5fr_130px_90px_100px_60px_50px_100px_90px_80px_40px] gap-4 px-6 py-4 bg-[#0A101D] border-b border-white/5 rounded-t-2xl items-center sticky top-0 z-20 shadow-xl">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={e => setSelectedIds(e.target.checked ? filtered.map(x=>x.id) : [])}/>
                    <span className="text-[9px] font-black text-white/20 uppercase text-center">Edit</span>
                    <span className="text-[9px] font-black text-white/20 uppercase">Status</span>
                    <span className="text-[9px] font-black text-white/20 uppercase">Unidade</span>
                    <span className="text-[9px] font-black text-white/20 uppercase">CNPJ</span>
                    <span className="text-[9px] font-black text-white/20 uppercase text-center">Franq</span>
                    <span className="text-[9px] font-black text-white/20 uppercase">Analista</span>
                    <span className="text-[9px] font-black text-white/20 uppercase text-right">P-L</span>
                    <span className="text-[9px] font-black text-white/20 uppercase text-right">Func</span>
                    <span className="text-[9px] font-black text-white/20 uppercase text-center">Trib</span>
                    <span className="text-[9px] font-black text-white/20 uppercase">Sistema</span>
                    <span className="text-[9px] font-black text-white/20 uppercase text-center">Início</span>
                    <span className="text-[9px] font-black text-white/20 uppercase text-center">Link</span>
                 </div>

                 <div className="divide-y divide-white/[0.02] bg-white/[0.01] rounded-b-2xl border-x border-b border-white/5">
                    {filtered.map(emp => (
                       <div key={emp.id} className="grid grid-cols-[40px_40px_130px_1.5fr_130px_90px_100px_60px_50px_100px_90px_80px_40px] gap-4 items-center py-4 px-6 hover:bg-white/[0.03] transition-all group">
                          <div className="flex justify-center"><input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5" checked={selectedIds.includes(emp.id)} onChange={() => setSelectedIds(prev => prev.includes(emp.id) ? prev.filter(i=>i!==emp.id) : [...prev, emp.id])}/></div>
                          <div className="flex justify-center gap-1">
                             <button onClick={() => { setEditingEmpresa(emp); setIsEditModalOpen(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95"><Pencil size={12}/></button>
                             {emp.isArchived ? (
                                <button onClick={() => restoreEmpresa(emp.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all opacity-0 group-hover:opacity-100" title="RESTAURAR"><RefreshCcw size={12}/></button>
                             ) : (
                                <button onClick={() => archiveEmpresa(emp.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100" title="ARQUIVAR"><Trash2 size={12}/></button>
                             )}
                          </div>
                          <div className="flex justify-center">
                             <div onClick={() => cycleStatus(emp.id, emp.statusCompetencia)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all cursor-pointer shadow-sm hover:brightness-110 active:scale-95 whitespace-nowrap ${emp.statusCompetencia.startsWith('100% CONCLUIDO') ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : emp.statusCompetencia.startsWith('EM ANDAMENTO') ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {emp.statusCompetencia.split('|')[0]}
                             </div>
                          </div>
                          <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-black text-white/90 uppercase truncate">{emp.nome}</span>
                             <div className="flex items-center gap-1 mt-1">
                                {emp.bkoDP && <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[6px] font-black uppercase">DP</span>}
                                {emp.bkoFiscal && <span className="px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 text-[6px] font-black uppercase">FISCAL</span>}
                                {emp.bkoContabil && <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[6px] font-black uppercase">CONTABIL</span>}
                                {checkOverdue(emp) && <AlertTriangle size={12} className="text-red-500 animate-pulse ml-1"/>}
                             </div>
                          </div>
                          <span className="text-[10px] font-mono text-white/30 tabular-nums">{emp.cnpj ? formatCNPJ(emp.cnpj) : '---'}</span>
                          <span className="text-[8px] font-black text-white/20 uppercase text-center truncate">{(emp.franquia || '---').toUpperCase()}</span>
                          <span className="text-[9px] font-black text-indigo-400/60 uppercase italic truncate">{(emp.responsavel || '---').toUpperCase()}</span>
                          <span className="text-[10px] font-mono text-white/60 text-right">{emp.pro_l || '0'}</span>
                          <span className="text-[10px] font-mono text-white/60 text-right">{emp.qtd_func || '0'}</span>
                          <span className="text-[9px] font-black text-indigo-500/40 uppercase text-center block">{emp.tributacao || '---'}</span>
                          <span className="text-[8px] font-bold text-white/20 uppercase text-center truncate">{emp.sistema || '---'}</span>
                          <span className="text-[8px] font-mono text-indigo-400/50 uppercase text-center">{emp.inicio_onboarding || '---'}</span>
                          <div className="flex justify-center">
                             <button onClick={() => { setSelectedEmpresa(emp); setIsPRDrawerOpen(true); }} className={`transition-all ${emp.link_onetty ? 'text-indigo-400 hover:text-white' : 'text-white/10 hover:text-white/20'}`}><ExternalLink size={14}/></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}
        </section>
      </main>

      {/* MODAL EDIÇÃO */}
      {isEditModalOpen && editingEmpresa && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0A101D] border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
               <div className="p-6 border-b border-white/5 flex justify-between items-center"><div><p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Painel de Edição</p><h2 className="text-sm font-black text-white uppercase italic">{editingEmpresa?.nome}</h2></div><button onClick={()=>setIsEditModalOpen(false)} className="text-white/20 hover:text-white"><X size={20}/></button></div>
               <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-white/20 uppercase ml-2 tracking-widest">Razão Social</label><input className="w-full bg-[#0F172A] border border-white/10 p-4 rounded-xl text-xs text-white uppercase outline-none font-bold" value={editingEmpresa?.nome || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, nome: e.target.value.toUpperCase()}:null)}/></div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5"><label className="text-[9px] font-black text-white/20 uppercase ml-2 tracking-widest">CNPJ</label><input className="w-full bg-[#0F172A] border border-white/10 p-4 rounded-xl text-xs text-white outline-none font-mono" value={editingEmpresa?.cnpj || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, cnpj: e.target.value}:null)}/></div>
                     <div className="space-y-1.5"><label className="text-[9px] font-black text-white/20 uppercase ml-2 tracking-widest">Analista</label>
                                 <select className="w-full bg-[#0F172A] border border-white/10 p-4 rounded-xl text-xs text-white font-bold outline-none" value={editingEmpresa?.responsavel || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, responsavel: e.target.value}:null)}>
                                    <option value="">{visaoAtiva === 'COBRANCA' ? 'SELECIONE O ANALISTA FINANCEIRO...' : 'SELECIONE O ANALISTA...'}</option>
                                    {(visaoAtiva === 'COBRANCA' ? analistasFinanceiro : 
                                      visaoAtiva === 'DP' ? analistasDP : 
                                      visaoAtiva === 'Fiscal' ? analistasFiscal : 
                                      analistasContabil).map(a => <option key={a} value={a}>{a}</option>)}
                                 </select>
                     </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-white/5">
                     <label className="text-[9px] font-black text-white/20 uppercase ml-2">Detalhamento Setorial</label>
                     <div className="grid grid-cols-3 gap-4">
                        {/* DP */}
                        <div className={`p-4 rounded-2xl border transition-all ${editingEmpresa?.bkoDP ? 'bg-indigo-600/5 border-indigo-500/20' : 'bg-white/[0.02] border-white/5 opacity-40'}`}>
                           <label className="flex items-center gap-2 mb-3 cursor-pointer"><input type="checkbox" checked={editingEmpresa?.bkoDP} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, bkoDP: e.target.checked}:null)} className="w-3 h-3 rounded bg-white/5"/><span className="text-[10px] font-black text-white uppercase">DP</span></label>
                           <input placeholder="Valor" type="number" className="w-full bg-black/20 border border-white/5 p-3 rounded-xl text-[11px] font-black text-white" value={editingEmpresa?.valorDP || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, valorDP: parseFloat(e.target.value)}:null)}/>
                        </div>
                        {/* FISCAL */}
                        <div className={`p-4 rounded-2xl border transition-all ${editingEmpresa?.bkoFiscal ? 'bg-orange-600/5 border-orange-500/20' : 'bg-white/[0.02] border-white/5 opacity-40'}`}>
                           <label className="flex items-center gap-2 mb-3 cursor-pointer"><input type="checkbox" checked={editingEmpresa?.bkoFiscal} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, bkoFiscal: e.target.checked}:null)} className="w-3 h-3 rounded bg-white/5"/><span className="text-[10px] font-black text-white uppercase">FISCAL</span></label>
                           <input placeholder="Valor" type="number" className="w-full bg-black/20 border border-white/5 p-3 rounded-xl text-[11px] font-black text-white" value={editingEmpresa?.valorFiscal || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, valorFiscal: parseFloat(e.target.value)}:null)}/>
                        </div>
                        {/* CONTÁBIL */}
                        <div className={`p-4 rounded-2xl border transition-all ${editingEmpresa?.bkoContabil ? 'bg-emerald-600/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/5 opacity-40'}`}>
                           <label className="flex items-center gap-2 mb-3 cursor-pointer"><input type="checkbox" checked={editingEmpresa?.bkoContabil} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, bkoContabil: e.target.checked}:null)} className="w-3 h-3 rounded bg-white/5"/><span className="text-[10px] font-black text-white uppercase">CONTÁBIL</span></label>
                           <input placeholder="Valor" type="number" className="w-full bg-black/20 border border-white/5 p-3 rounded-xl text-[11px] font-black text-white" value={editingEmpresa?.valorContabil || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, valorContabil: parseFloat(e.target.value)}:null)}/>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
                        <div className="space-y-1.5"><label className="text-[9px] font-black text-white/20 uppercase ml-2 tracking-widest">Vencimento Padrão</label><input className="w-full bg-[#0F172A] border border-white/10 p-4 rounded-xl text-xs text-indigo-400 font-black outline-none" value={editingEmpresa?.dataVencimento || ''} onChange={e=>setEditingEmpresa(prev=>prev?{...prev, dataVencimento: e.target.value}:null)} placeholder="Ex: Todo dia 10"/></div>
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-black text-white/20 uppercase ml-2 tracking-widest">Valor Mensalidade (Automático)</label>
                           <div className="w-full bg-[#0F172A] border border-indigo-500/30 p-4 rounded-xl text-sm font-black text-emerald-400">
                              R$ {((editingEmpresa?.bkoDP ? (editingEmpresa.valorDP||200) : 0) + (editingEmpresa?.bkoFiscal ? (editingEmpresa.valorFiscal||200) : 0) + (editingEmpresa?.bkoContabil ? (editingEmpresa.valorContabil||200) : 0)).toFixed(2)}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="p-6 bg-white/[0.04] border-t border-white/5 flex gap-4">
                  {visaoAtiva !== 'COBRANCA' && <button onClick={()=>{if(editingEmpresa) archiveEmpresa(editingEmpresa.id); setIsEditModalOpen(false);}} className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Arquivar</button>}
                  <button onClick={() => {
                     // Injetar o valor da calculadora antes de salvar
                     const totalCalculado = ((editingEmpresa?.bkoDP ? (editingEmpresa.valorDP||200) : 0) + (editingEmpresa?.bkoFiscal ? (editingEmpresa.valorFiscal||200) : 0) + (editingEmpresa?.bkoContabil ? (editingEmpresa.valorContabil||200) : 0));
                     if(editingEmpresa) {
                        const payload = {...editingEmpresa, valorMensalidade: totalCalculado};
                        setEditingEmpresa(payload);
                        syncEdit(payload);
                     }
                  }} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl">Salvar Alterações</button>
               </div>
            </div>
         </div>
      )}

      {/* Drawer PR Link */}
      {isPRDrawerOpen && selectedEmpresa && (
         <div className="fixed inset-y-0 right-0 z-[600] w-[400px] bg-[#0A101D] border-l border-white/10 p-10 shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
            <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
               <h3 className="text-xs font-black text-white uppercase italic tracking-[0.2em] flex items-center gap-2"><Globe size={20} className="text-indigo-500"/> PR ONETY</h3>
               <button onClick={()=>setIsPRDrawerOpen(false)} className="text-white/20 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-8">
               <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-indigo-400 uppercase mb-1 tracking-widest">Unidade</p>
                  <p className="text-sm font-black text-white uppercase leading-tight">{selectedEmpresa?.nome}</p>
               </div>
               <div className="space-y-4">
                  <label className="text-[9px] font-black text-white/20 uppercase ml-2 tracking-widest">Link do Projeto</label>
                  <div className="flex gap-2">
                     <input className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl text-xs text-indigo-400 outline-none" value={selectedEmpresa?.link_onetty || ''} onChange={e=>{
                        if(selectedEmpresa) {
                           const val = e.target.value;
                           setSelectedEmpresa({...selectedEmpresa, link_onetty: val});
                           handleUpdate(selectedEmpresa.id, {link_onetty: val});
                        }
                     }}/>
                     {selectedEmpresa?.link_onetty && <a href={selectedEmpresa.link_onetty} target="_blank" rel="noreferrer" className="bg-indigo-600 w-12 h-12 rounded-xl text-white flex items-center justify-center hover:bg-indigo-500 transition-all shadow-xl"><ExternalLink size={20}/></a>}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Modal Novo Processo */}
      {isNewModalOpen && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
            <div className="bg-[#0A101D] border border-white/10 w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
               <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Novo <span className="text-indigo-500">Processo</span></h2>
                  <button onClick={()=>setIsNewModalOpen(false)} className="p-3 text-slate-500 hover:text-white"><X size={24}/></button>
               </div>

               <form onSubmit={handleManualCreate} className="p-10 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                   <div className="grid grid-cols-2 gap-4">
                      <input name="nome" placeholder="RAZÃO SOCIAL..." className="w-full bg-[#0F172A] border border-white/5 p-4 rounded-2xl text-xs text-white uppercase outline-none focus:border-indigo-500/50" required/>
                      <input name="franquia" placeholder="FRANQUIA..." className="w-full bg-[#0F172A] border border-white/5 p-4 rounded-2xl text-xs text-white uppercase outline-none focus:border-indigo-500/50" required/>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <input name="cnpj" placeholder="CNPJ..." className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none"/>
                      <select name="responsavel" className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl text-[10px] text-white font-black uppercase outline-none cursor-pointer" required>
                         <option value="">ANALISTA...</option>
                         {[...analistasDP, ...analistasFiscal, ...analistasContabil].sort().map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                   </div>
                   <div className="grid grid-cols-3 gap-4">
                      <select name="tributacao" className="bg-[#0F172A] p-4 rounded-2xl text-[10px] text-white font-black uppercase"><option value="">TRIBUTAÇÃO...</option>{['SIMPLES NACIONAL', 'LUCRO PRESUMIDO', 'LUCRO REAL', 'MEI'].map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <input name="pro_l" placeholder="PRÓ-LABORE" className="bg-[#0F172A] p-4 rounded-2xl text-xs text-white outline-none"/>
                      <input name="qtd_func" placeholder="FUNCIONÁRIOS" className="bg-[#0F172A] p-4 rounded-2xl text-xs text-white outline-none"/>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <select name="sistema" className="bg-[#0F172A] p-4 rounded-2xl text-[10px] text-white font-black uppercase"><option value="">SISTEMA...</option>{['ALTERDATA', 'ALTERDATA SERVIDOR', 'DOMÍNIO BASE 1', 'DOMÍNIO BASE 2', 'DOMÍNIO BASE 3'].map(s => <option key={s} value={s}>{s}</option>)}</select>
                      <input name="competencia" placeholder={`COMP: ${getCurrentCompetence()}`} className="bg-[#0F172A] p-4 rounded-2xl text-xs text-indigo-400 font-bold outline-none uppercase text-center"/>
                   </div>
                   <div className="pt-8 flex gap-4">
                      <button type="button" onClick={()=>setIsNewModalOpen(false)} className="flex-1 py-5 rounded-3xl text-[10px] font-black text-slate-500 uppercase">Cancelar</button>
                      <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-3xl text-[10px] uppercase shadow-2xl">+ Confirmar Cadastro</button>
                   </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}
