import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { 
  Users, Send, ShieldAlert, Check, CalendarClock, PlaneTakeoff, XCircle,
  LogOut, Globe, LayoutDashboard, MessageSquareText, Search, Upload, Download,
  Square, AlertCircle, Pencil, ChevronLeft, Menu, FileText, Briefcase
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

const optionsSistemas = ['Alterdata Nuvem', 'Alterdata Servidor', 'Domínio (Base 1)', 'Domínio (Base 2)', 'Domínio (Base 3)'];
const optionsTributacao = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune / Isenta'];
const optionsAtividade = ['Serviço', 'Comércio', 'Indústria', 'Ambos'];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Tentar restaurar o login do F5
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
  const [filtroMes, setFiltroMes] = useState('Março/2026');
  const mesesDisponiveis = ['Janeiro/2026', 'Fevereiro/2026', 'Março/2026', 'Abril/2026', 'Maio/2026', 'Junho/2026', 'Julho/2026', 'Agosto/2026', 'Setembro/2026', 'Outubro/2026', 'Novembro/2026', 'Dezembro/2026'];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Empresa | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estados do Modal de Nova Empresa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novaEmpresaForm, setNovaEmpresaForm] = useState({
     franquia: '', razaoSocial: '', cnpj: '', tributacao: 'Simples Nacional', 
     sistemaBase: 'Alterdata Nuvem', codigoSistema: '', responsavel: 'Não Definido'
  });

  // ---------- INTEGRAÇÃO SUPABASE ----------
  const fetchEmpresas = async () => {
    const { data } = await supabase.from('backoffice_empresas').select('*').order('created_at', { ascending: false });
    if (data) {
      setEmpresas(data as Empresa[]);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchEmpresas();
    }
  }, [isLoggedIn]);

  const updateEmpresaDirectly = async (id: string, updates: Partial<Empresa>) => {
    // 1. Atualização Otimista Rápida
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    
    // 2. Gravação Oficial
    const { error } = await supabase.from('backoffice_empresas').update(updates).eq('id', id);
    if (error) {
       console.error("Erro ao salvar:", error);
       alert("Erro ao salvar no banco de dados.");
    }
  };

  const criarNovaOperacao = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
       franquia: novaEmpresaForm.franquia,
       nome: novaEmpresaForm.razaoSocial,
       cnpj: novaEmpresaForm.cnpj,
       tributacao: novaEmpresaForm.tributacao,
       sistemaBase: novaEmpresaForm.sistemaBase,
       codigoSistema: novaEmpresaForm.codigoSistema,
       responsavel: novaEmpresaForm.responsavel,
       atividade: 'Serviço',
       dataEntrada: new Date().toLocaleDateString('pt-BR'),
       inadimplente: false,
       statusCompetencia: 'Pendente',
       faseOnbDP: 'Falta Parametrizar',
       faseOnbFiscal: 'Falta Parametrizar', 
       faseOnbContabil: 'Falta Parametrizar',
       temProcuracao: false,
       bkoDP: true, bkoFiscal: true, bkoContabil: true,
       qtdProlabore: '0', qtdFuncionarios: '0',
       temVariavel: false, temAdiantamento: false, temConsignado: false,
       anotacoesFiscal: '',
       encaminhadoPara: null
    };

    const { data, error } = await supabase.from('backoffice_empresas').insert([payload]).select().single();
    
    if (error) {
        alert("Erro ao criar empresa.");
        return;
    }
    
    if (data) {
       setEmpresas([data as Empresa, ...empresas]);
       setIsModalOpen(false);
       setNovaEmpresaForm({ franquia:'', razaoSocial:'', cnpj:'', tributacao:'Simples Nacional', sistemaBase:'Alterdata Nuvem', codigoSistema:'', responsavel:'Não Definido' });
       alert("Empresa criada com sucesso!");
    }
  };

  const startEditing = (emp: Empresa) => {
    setEditingId(emp.id);
    setEditForm({ ...emp });
  };
  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };
  const saveEditing = () => {
    if (editForm) {
      updateEmpresaDirectly(editForm.id, editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const despacharBko = (id: string, nomeEmpresa: string) => {
    const nomeFuncionario = window.prompt(`Finalizar Backoffice da ${nomeEmpresa}?\n\nDigite o nome do atendente:`);
    if (nomeFuncionario && nomeFuncionario.trim() !== '') {
      updateEmpresaDirectly(id, { encaminhadoPara: nomeFuncionario.trim() });
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
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    
    if (error) {
      setLoginError('Credenciais inválidas.');
    } else {
      localStorage.setItem('cf_auth', 'true');
      setIsLoggedIn(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('cf_auth');
    setIsLoggedIn(false);
    setLoginPassword('');
  };

  const colaboradoresSetor = Array.from(new Set(empresas.map(e => e.responsavel))).map(nome => ({
    nome,
    qtdEmpresas: empresas.filter(e => e.responsavel === nome).length
  }));

  const isOnbView = visaoAtiva.endsWith('_Onb');
  const baseSector = visaoAtiva.replace('_Onb', '');
  const hideAtividade = baseSector === 'DP' || isOnbView;

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

  const getHeadersCSV = () => ['id', 'responsavel', 'franquia', 'cnpj', 'tributacao', 'nome', 'sistemaBase', 'codigoSistema', 'dataEntrada', 'atividade', 'inadimplente', 'statusCompetencia', 'faseOnbDP', 'faseOnbFiscal', 'faseOnbContabil', 'temProcuracao', 'bkoDP', 'bkoFiscal', 'bkoContabil', 'qtdProlabore', 'qtdFuncionarios', 'temVariavel', 'temAdiantamento', 'temConsignado', 'anotacoesFiscal'];
  
  const mapEmpresaToRaw = (emp: Empresa) => [
      emp.id, emp.responsavel, emp.franquia, emp.cnpj, emp.tributacao, emp.nome, 
      emp.sistemaBase, emp.codigoSistema, emp.dataEntrada, emp.atividade, 
      emp.inadimplente?'true':'false', emp.statusCompetencia, emp.faseOnbDP, emp.faseOnbFiscal, emp.faseOnbContabil, emp.temProcuracao?'true':'false',
      emp.bkoDP?'true':'false', emp.bkoFiscal?'true':'false', emp.bkoContabil?'true':'false',
      emp.qtdProlabore || '0', emp.qtdFuncionarios || '0', emp.temVariavel ? 'true' : 'false',
      emp.temAdiantamento ? 'true' : 'false', emp.temConsignado ? 'true' : 'false', emp.anotacoesFiscal || ''
  ];

  const exportToCSV = () => {
    const csvContent = [
       getHeadersCSV().join(','),
       ...empresasFiltradas.map(e => mapEmpresaToRaw(e).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `carteira_cf_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalizeText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

    const headerMap: Record<string, string> = {
      'CODIGO': 'codigoSistema', 'COD': 'codigoSistema',
      'EMPRESA': 'nome', 'EMPRESAS': 'nome', 'RAZAO SOCIAL': 'nome',
      'FRANQUIA': 'franquia', 'CNPJ': 'cnpj',
      'TRIBUTA': 'tributacao', 'ATIVIDADE': 'atividade',
      'PRO-LABORE': 'qtdProlabore', 'PRO LABORE': 'qtdProlabore',
      'FUNCIONARIOS': 'qtdFuncionarios', 'SISTEMA': 'sistemaBase',
      'SIST. BASE': 'sistemaBase', 'BASE': 'sistemaBase',
      'DATA': 'dataEntrada', 'VARIAVEL': 'temVariavel',
      'ADIANTAMENTO': 'temAdiantamento', 'CONSIGNADO': 'temConsignado',
      'PROCURACAO': 'temProcuracao',
      'RESPONSAVEL': 'responsavel', 'COLABORADOR': 'responsavel', 'COLAB': 'responsavel', 'ANALISTA': 'responsavel',    
      'BLOQUEADA': 'inadimplente', 'INADIMPLENTE': 'inadimplente',
      'STATUS': 'statusCompetencia', 'SITUACAO': 'statusCompetencia', 'FASE': 'statusCompetencia', '_*': 'statusCompetencia'
    };

    const exactDPOptions = [
      'Falta Parametrizar', '100% concluído', 'Folha enviada/variável',
      'Folha enviada aguardando conferência do franqueado', 'Aguardando/variáveis',
      'Certificado com 2 etapas', 'Liberado pra envio', 'Sem certificado',
      'Certificado vencido', 'Sem procuração', 'Aguardando T.I'
    ];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'ISO-8859-1',
      complete: async (results) => {
         const rawData = results.data as any[];
         if(rawData.length === 0) return;

         const rawHeaders = Object.keys(rawData[0]);
         const mappedHeaders: Record<string, string> = {};
         
         rawHeaders.forEach(rh => {
            if(!rh) return;
            const normalizedInfo = normalizeText(rh);
            for (const [key, dbCol] of Object.entries(headerMap)) {
               if(normalizedInfo === key || normalizedInfo.includes(key)) {
                  mappedHeaders[rh] = dbCol;
                  break;
               }
            }
         });

         const toInsert = rawData.map(row => {
            const empresa: any = {
               franquia: 'Sem Franq', nome: '', cnpj: '', tributacao: 'Não Definida', 
               sistemaBase: 'Alterdata', codigoSistema: '', responsavel: 'Não Def',
               atividade: '', dataEntrada: new Date().toLocaleDateString('pt-BR'),
               inadimplente: false, statusCompetencia: 'Pendente',
               faseOnbDP: 'Falta Parametrizar', faseOnbFiscal: 'Falta Parametrizar', faseOnbContabil: 'Falta Parametrizar',
               temProcuracao: false, bkoDP: true, bkoFiscal: true, bkoContabil: true,
               qtdProlabore: '0', qtdFuncionarios: '0', temVariavel: false, temAdiantamento: false, temConsignado: false,
               anotacoesFiscal: '', encaminhadoPara: null
            };

            for (const [rawKey, rawVal] of Object.entries(row)) {
               const dbCol = mappedHeaders[rawKey];
               if(dbCol) {
                  const valStr = String(rawVal).trim();
                  const valUpper = valStr.toUpperCase();
                  if (['temVariavel', 'temAdiantamento', 'temConsignado', 'temProcuracao', 'inadimplente'].includes(dbCol)) {
                     empresa[dbCol] = valUpper === 'SIM' || valUpper === 'TRUE' || valUpper === 'S';
                  } else {
                     empresa[dbCol] = valStr || empresa[dbCol]; 
                  }
               }
            }
            if(!empresa.nome) empresa.nome = 'Empresa Desconhecida (Ver Excel)';

            if (empresa.statusCompetencia && empresa.statusCompetencia !== 'Pendente') {
               const normIncoming = normalizeText(empresa.statusCompetencia);
               const matchedOpt = exactDPOptions.find(opt => normalizeText(opt) === normIncoming);
               if (matchedOpt) {
                   empresa.statusCompetencia = matchedOpt;
                   empresa.faseOnbDP = matchedOpt; 
                   empresa.faseOnbFiscal = matchedOpt; 
                   empresa.faseOnbContabil = matchedOpt; 
               } else {
                   empresa.faseOnbDP = empresa.statusCompetencia; 
                   empresa.faseOnbFiscal = empresa.statusCompetencia;
                   empresa.faseOnbContabil = empresa.statusCompetencia;
               }
            }
            return empresa;
         });

         const { data, error } = await supabase.from('backoffice_empresas').insert(toInsert).select();
         if(error) {
            alert(`Erro: ${error.message}`);
         } else if(data) {
            setEmpresas([...data, ...empresas]);
            alert(`🔥 SUCESSO! ${data.length} empresas importadas.`);
         }
      }
    });
    e.target.value = '';
  };

  const NuvemParticularidade = ({ emp }: { emp: Empresa }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState(emp.anotacoesFiscal || '');

    const handleBlur = () => {
      setIsFocused(false);
      if (localValue !== emp.anotacoesFiscal) updateEmpresaDirectly(emp.id, { anotacoesFiscal: localValue });
    };

    if (isFocused) {
      return (
        <textarea 
          autoFocus
          className="w-full min-h-[120px] text-[12px] p-3 rounded-xl border border-white/10 bg-[#131B2F] shadow-xl font-medium text-slate-200 outline-none resize-none absolute z-50 left-0 right-0 top-0 transition-all ring-2 ring-indigo-500/40"
          value={localValue} onChange={(e) => setLocalValue(e.target.value)} onBlur={handleBlur}
          placeholder="Digite a particularidade..."
        />
      );
    }
    return (
      <div onClick={() => setIsFocused(true)} className="text-[11px] text-slate-300 bg-[#131B2F] hover:bg-[#1e293b] border border-white/5 hover:border-indigo-500/40 cursor-pointer p-3 rounded-xl truncate min-h-[42px] transition-all flex items-center gap-2 group shadow-sm">
        <MessageSquareText size={16} className="text-slate-500 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
        {emp.anotacoesFiscal ? <span className="font-medium text-slate-200">{emp.anotacoesFiscal}</span> : <span className="text-slate-500 italic">Clique aqui...</span>}
      </div>
    );
  };

  const BkoBadge = ({ ativo, label, isEdit, onChange }: {ativo: boolean, label: string, isEdit: boolean, onChange?: (val:boolean)=>void}) => {    
    if (isEdit) {
      return (
        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition w-full border border-transparent hover:border-slate-200">
          <input type="checkbox" checked={ativo} onChange={(e)=>onChange?.(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
          <span className={`text-[11px] font-bold ${ativo ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
        </label>
      );
    }
    const activeColorMap: Record<string, string> = {
       'DP': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
       'FIS': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
       'CTB': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    return (
      <div className={`inline-flex items-center justify-center px-2 py-1 min-w-[38px] border text-[9px] font-bold rounded-md uppercase tracking-wider shadow-sm transition-all ${ativo ? activeColorMap[label] : 'bg-[#131B2F] border-white/5 text-slate-500 shadow-none'}`}>
        {ativo ? `${label} ✓` : `${label}`}
      </div>
    );
  };

  const optionsFaseDP = [
    'Falta Parametrizar', '100% concluído', 'Folha enviada/variável', 'Folha enviada aguardando conferência do franqueado',
    'Aguardando/variáveis', 'Certificado com 2 etapas', 'Liberado pra envio', 'Sem certificado',
    'Certificado vencido', 'Sem procuração', 'Aguardando T.I'
  ];

  const optionsMesGeral = ['Pendente', 'Entregue'];

  const getStatusColor = (fase: string) => {
    switch (fase) {
      case '100% concluído': case 'Entregue': case 'Concluído': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Folha enviada/variável': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Folha enviada aguardando conferência do franqueado': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Aguardando/variáveis': case 'Em Andamento': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Certificado com 2 etapas': return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
      case 'Liberado pra envio': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Sem certificado': case 'Pendente': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Certificado vencido': return 'bg-rose-600/10 text-rose-500 border-rose-600/20';
      case 'Sem procuração': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'Aguardando T.I': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    }
  };

  const InlineBadgeSelect = ({ val, options, onChange, disabled }: { val: string, options: string[], onChange: (v: string) => void, disabled?: boolean }) => (
     <select 
       value={val} onChange={(e) => onChange(e.target.value)} disabled={disabled}
       className={`appearance-none cursor-pointer outline-none text-center px-2 py-1.5 rounded-md text-[9.5px] font-black uppercase shadow-sm border transition-all truncate max-w-[170px] ${getStatusColor(val)} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
       style={{ textAlignLast: 'center' }}
     >
        {options.map((o, idx) => <option key={idx} value={o} className="bg-[#0A101D] text-slate-300 uppercase">{o}</option>)}
     </select>
  );

  if (!isLoggedIn) {
    return (
       <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4 relative overflow-hidden">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
         <div className="bg-[#131B2F]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 w-full max-w-sm relative z-10 shadow-2xl">
           <div className="flex justify-center mb-8"><div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5"><div className="w-full h-full bg-[#131B2F] rounded-[14px] flex items-center justify-center"><Briefcase size={28} className="text-indigo-400" /></div></div></div>
           <h1 className="text-2xl font-black text-center mb-2 text-white">BACKOFFICE</h1>
           <p className="text-center text-slate-400 text-[10px] uppercase font-bold mb-8">Gestão CF</p>
           <form onSubmit={handleLogin} className="space-y-4">
             <input type="text" autoFocus required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Login" />
             <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none" placeholder="Senha" />
             <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-xl font-bold transition-all border border-indigo-400/20">Acessar</button>
             {loginError && <p className="text-rose-400 text-[11px] text-center font-bold mt-3">* {loginError}</p>}
           </form>
         </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#040812] flex font-inter text-slate-200">
      <style>{`.custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; border: 2px solid #0A101D; }`}</style>
      <aside className={`flex h-screen fixed shadow-2xl z-40 transition-all duration-300 ${isSidebarOpen ? 'w-[300px]' : 'w-[70px]'}`}>
        <div className="w-[70px] bg-[#0A101D] border-r border-[#192435] flex flex-col items-center py-6 gap-6 h-full relative z-50">
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] cursor-pointer flex items-center justify-center">
              <div className="w-full h-full bg-[#0A101D] rounded-full flex items-center justify-center">{isSidebarOpen ? <ChevronLeft size={18} className="text-white" /> : <Menu size={18} className="text-white" />}</div>
           </div>
           <div className="flex flex-col gap-3 w-full px-2 mt-4 space-y-2">
              <button onClick={() => { setVisaoAtiva('Geral'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${visaoAtiva === 'Geral' ? 'bg-[#0bc5ea] text-white shadow-[0_0_15px_rgba(11,197,234,0.3)]' : 'text-slate-400 hover:bg-white/5'}`}><Globe size={22}/></button>
              <button onClick={() => { setVisaoAtiva('DP'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${baseSector === 'DP' ? 'bg-[#0bc5ea] text-white' : 'text-slate-400 hover:bg-white/5'}`}><Users size={22}/></button>
              <button onClick={() => { setVisaoAtiva('Fiscal'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${baseSector === 'Fiscal' ? 'bg-[#0bc5ea] text-white' : 'text-slate-400 hover:bg-white/5'}`}><FileText size={22}/></button>
              <button onClick={() => { setVisaoAtiva('Contábil'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${baseSector === 'Contábil' ? 'bg-[#0bc5ea] text-white' : 'text-slate-400 hover:bg-white/5'}`}><LayoutDashboard size={22}/></button>
           </div>
        </div>
        <div className={`flex-1 border-r border-[#192435] flex flex-col h-full bg-[#040812] transition-all overflow-hidden ${isSidebarOpen ? 'w-[230px] opacity-100' : 'w-0 opacity-0'}`}>
           <div className="p-5 border-b border-white/5 flex justify-between items-center h-[88px]">
             <span className="text-white font-black text-[15px] tracking-widest">BACK<span className="text-[#0bc5ea]">OFFICE</span></span>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
              {['Geral', 'DP', 'Fiscal', 'Contábil'].map(setor => (
                <div key={setor}>
                  <button onClick={() => {setVisaoAtiva(setor as Visao); cancelEditing();}} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-[13px] font-semibold ${visaoAtiva === setor ? 'text-white bg-[#101b30]' : 'text-slate-400 hover:bg-white/5'}`}>
                    {setor === 'Geral' ? <Globe size={16}/> : setor==='DP'?<Users size={16}/>:setor==='Fiscal'?<FileText size={16}/>:<LayoutDashboard size={16}/>}
                    {setor === 'Geral' ? 'Visão Geral' : `Módulo ${setor}`}
                  </button>
                  {setor !== 'Geral' && baseSector === setor && (
                    <div className="pl-9 mt-1 space-y-1 pb-2">
                       <button onClick={() => setVisaoAtiva(setor as Visao)} className={`w-full text-left px-3 py-2 rounded-lg text-[12px] ${visaoAtiva === setor ? 'text-white' : 'text-slate-400'}`}>Entregas Mensais</button>
                       <button onClick={() => setVisaoAtiva(`${setor}_Onb` as Visao)} className={`w-full text-left px-3 py-2 rounded-lg text-[12px] ${visaoAtiva === `${setor}_Onb` ? 'text-white' : 'text-slate-400'}`}>Onboarding</button>
                    </div>
                  )}
                </div>
              ))}
           </div>
           <div className="p-4 border-t border-white/5"><button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 text-slate-500 hover:text-rose-400 p-2 text-[11px] uppercase font-bold"><LogOut size={14} /> Sair</button></div>
        </div>
      </aside>

      <main className={`flex-1 transition-all ${isSidebarOpen ? 'ml-[300px]' : 'ml-[70px]'} p-8 h-screen overflow-hidden flex flex-col`}>
        <header className="flex justify-between items-end mb-8">
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">{isOnbView ? <PlaneTakeoff size={24}/> : <Globe size={24}/>}</div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Painel {visaoAtiva.replace('_Onb', ' Onboarding')}</h2>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">+ Nova Operação</button>
            <label className="bg-[#131B2F] border border-white/10 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-2"><Upload size={14} /> Importar CSV<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} /></label>
            <button onClick={exportToCSV} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"><Download size={14} /> Exportar</button>
          </div>
        </header>

        <div className="bg-[#0A101D] rounded-xl shadow-2xl ring-1 ring-white/10 overflow-hidden flex flex-col flex-1 relative">
          <div className="p-4 border-b border-white/5 flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} /><input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 bg-[#131B2F] border border-white/10 rounded-lg text-sm text-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <select className="bg-[#131B2F] border border-white/10 text-indigo-400 rounded-lg text-xs py-2 px-3" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                 <option value="Todos">Analista: Todos</option>
                 {colaboradoresSetor.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
              </select>
          </div>

          <div className="overflow-auto flex-1 custom-scrollbar whitespace-nowrap">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-30 bg-[#0A101D]">
                <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
                  <th className="px-5 py-4 w-12 text-center">Ação</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4">Franquia</th>
                  <th className="px-5 py-4">Razão Social</th>
                  <th className="px-5 py-4">CNPJ</th>
                  <th className="px-5 py-4">Trib.</th>
                  <th className="px-5 py-4">Analista</th>
                  <th className="px-5 py-4">Cod.</th>
                  <th className="px-5 py-4 text-center">BKO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[13px] bg-[#0A101D]">
                {empresasFiltradas.map((emp) => {
                  const isEditing = editingId === emp.id;
                  return (
                  <tr key={emp.id} className="hover:bg-white/5">
                    <td className="px-5 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        {isEditing ? (
                          <>
                            <button onClick={saveEditing} className="p-1.5 bg-emerald-500 text-white rounded-md"><Check size={14} /></button>
                            <button onClick={cancelEditing} className="p-1.5 bg-rose-500 text-white rounded-md"><XCircle size={14} /></button>
                          </>
                        ) : (
                          <button onClick={() => startEditing(emp)} className="p-1.5 text-slate-400 hover:text-indigo-400"><Pencil size={15} /></button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                       <InlineBadgeSelect 
                         val={isOnbView ? (baseSector==='DP'?emp.faseOnbDP:baseSector==='Fiscal'?emp.faseOnbFiscal:emp.faseOnbContabil) : emp.statusCompetencia}
                         options={baseSector === 'DP' || isOnbView ? optionsFaseDP : optionsMesGeral}
                         onChange={(v) => {
                           if(!isOnbView) updateEmpresaDirectly(emp.id, {statusCompetencia: v});
                           else {
                             if(baseSector==='DP') updateEmpresaDirectly(emp.id, {faseOnbDP: v});
                             if(baseSector==='Fiscal') updateEmpresaDirectly(emp.id, {faseOnbFiscal: v});
                             if(baseSector==='Contábil') updateEmpresaDirectly(emp.id, {faseOnbContabil: v});
                           }
                         }}
                       />
                    </td>
                    <td className="px-5 py-3">{isEditing ? <input className="bg-[#131B2F] border border-white/10 rounded p-1" value={editForm?.franquia} onChange={e=>setEditForm({...editForm!, franquia:e.target.value})}/> : emp.franquia}</td>
                    <td className="px-5 py-3 font-bold text-slate-200">{isEditing ? <input className="bg-[#131B2F] border border-white/10 rounded p-1 w-full" value={editForm?.nome} onChange={e=>setEditForm({...editForm!, nome:e.target.value})}/> : emp.nome}</td>
                    <td className="px-5 py-3 font-mono text-slate-400">{emp.cnpj}</td>
                    <td className="px-5 py-3">{emp.tributacao}</td>
                    <td className="px-5 py-3"><span className="bg-[#131B2F] px-2 py-0.5 rounded border border-white/10">{emp.responsavel}</span></td>
                    <td className="px-5 py-3 text-[11px]">{emp.codigoSistema}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <BkoBadge label="DP" ativo={emp.bkoDP} isEdit={false} />
                        <BkoBadge label="FIS" ativo={emp.bkoFiscal} isEdit={false} />
                        <BkoBadge label="CTB" ativo={emp.bkoContabil} isEdit={false} />
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
           <div className="bg-[#0A101D] border border-white/10 rounded-2xl w-full max-w-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2"><PlaneTakeoff className="text-emerald-500" /> Cadastrar Nova Empresa</h3>
              <form onSubmit={criarNovaOperacao} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <input required className="bg-[#131B2F] border border-white/10 rounded-lg p-3 text-white" placeholder="Franquia" value={novaEmpresaForm.franquia} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, franquia:e.target.value})} />
                   <input required className="bg-[#131B2F] border border-white/10 rounded-lg p-3 text-white" placeholder="CNPJ" value={novaEmpresaForm.cnpj} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, cnpj:e.target.value})} />
                 </div>
                 <input required className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-white" placeholder="Razão Social" value={novaEmpresaForm.razaoSocial} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, razaoSocial:e.target.value})} />
                 <div className="grid grid-cols-2 gap-4">
                    <select className="bg-[#131B2F] border border-white/10 rounded-lg p-3 text-white" value={novaEmpresaForm.tributacao} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, tributacao:e.target.value})}>{optionsTributacao.map(t=><option key={t}>{t}</option>)}</select>
                    <input className="bg-[#131B2F] border border-white/10 rounded-lg p-3 text-white" placeholder="Analista" value={novaEmpresaForm.responsavel} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, responsavel:e.target.value})} />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-3 rounded-xl border border-white/10 text-slate-300">Cancelar</button>
                    <button type="submit" className="flex-1 p-3 rounded-xl bg-emerald-600 text-white font-bold">Cadastrar</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
