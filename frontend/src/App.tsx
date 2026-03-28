import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Papa from 'papaparse';
import { LayoutDashboard, Users, FileText, Briefcase, LogOut, Search, Download, Upload, Square, AlertCircle, Pencil, Check, XCircle, Globe, ShieldAlert, CalendarClock, MessageSquareText, PlaneTakeoff, ChevronLeft, Menu, Send } from 'lucide-react';


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
  encaminhadoPara?: string; // Novo campo para rastrear a saída do BKO
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
    // 1. Atualização Otimista Rápida (Pra não dar delay no clique)
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    
    // 2. Gravação Oficial Pique Banco Central
    const { error } = await supabase.from('backoffice_empresas').update(updates).eq('id', id);
    if (error) {
       console.error("Erro ao salvar no cofre:", error);
       alert("Ocorreu um erro ao salvar no Banco. Verifique se as Permissões (RLS) estão liberadas no Supabase.");
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
       bkoDP: true, bkoFiscal: true, bkoContabil: true, // Começa em todos os BKOs
       qtdProlabore: '0', qtdFuncionarios: '0',
       temVariavel: false, temAdiantamento: false, temConsignado: false,
       anotacoesFiscal: '',
       encaminhadoPara: null
    };

    const { data, error } = await supabase.from('backoffice_empresas').insert([payload]).select().single();
    
    if (error) {
        console.error("Erro na Criação:", error);
        alert("Erro ao criar empresa. Certifique-se que o Supabase aceita INSERT.");
        return;
    }
    
    if (data) {
       setEmpresas([data as Empresa, ...empresas]); // Coloca no topo
       setIsModalOpen(false);
       setNovaEmpresaForm({ franquia:'', razaoSocial:'', cnpj:'', tributacao:'Simples Nacional', sistemaBase:'Alterdata Nuvem', codigoSistema:'', responsavel:'Não Definido' });
       alert("Sucesso! Empresa criada e enviada direto para a Trilha de Onboarding.");
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
    const nomeFuncionario = window.prompt(`Finalizar Backoffice da ${nomeEmpresa}?\n\nDigite o nome do funcionário de atendimento que assumirá esta operação:`);
    if (nomeFuncionario && nomeFuncionario.trim() !== '') {
      updateEmpresaDirectly(id, { encaminhadoPara: nomeFuncionario.trim() });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    // Conexão direta com Autenticação Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    
    if (error) {
      setLoginError('Acesso Negado. Credenciais inválidas no servidor central.');
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

    // Normalizador IA pra bater textos loucos de CSV (Tira acento, tira espaço, upcase)
    const normalizeText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

    const headerMap: Record<string, string> = {
      'COD': 'codigoSistema',
      'CODIGO': 'codigoSistema',
      'EMPRESA': 'nome',
      'EMPRESAS': 'nome',
      'RAZAO SOCIAL': 'nome',
      'FRANQUIA': 'franquia',
      'CNPJ': 'cnpj',
      'TRIBUTA': 'tributacao',
      'ATIVIDADE': 'atividade',
      'PRO-LABORE': 'qtdProlabore',
      'PRO LABORE': 'qtdProlabore',
      'FUNCIONARIOS': 'qtdFuncionarios',
      'SISTEMA': 'sistemaBase',
      'SIST. BASE': 'sistemaBase',
      'BASE': 'sistemaBase',
      'DATA': 'dataEntrada',
      'VARIAVEL': 'temVariavel',
      'ADIANTAMENTO': 'temAdiantamento',
      'CONSIGNADO': 'temConsignado',
      'PROCURACAO': 'temProcuracao',
      'RESPONSAVEL': 'responsavel',    
      'COLABORADOR': 'responsavel',    
      'ANALISTA': 'responsavel',    
      'BLOQUEADA': 'inadimplente',
      'INADIMPLENTE': 'inadimplente',
      'STATUS': 'statusCompetencia',
      'SITUACAO': 'statusCompetencia',
      'FASE': 'statusCompetencia',
      '_*': 'statusCompetencia', 
      '': 'statusCompetencia' 
    };

    // Opções corretas para bater o texto vindo do Excel:
    const exactDPOptions = [
      'Falta Parametrizar', '100% concluído', 'Folha enviada/variável',
      'Folha enviada aguardando conferência do franqueado', 'Aguardando/variáveis',
      'Certificado com 2 etapas', 'Liberado pra envio', 'Sem certificado',
      'Certificado vencido', 'Sem procuração', 'Aguardando T.I'
    ];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
         const rawData = results.data as any[];
         if(rawData.length === 0) return;

         const rawHeaders = Object.keys(rawData[0]);
         const mappedHeaders: Record<string, string> = {};
         
         rawHeaders.forEach(rh => {
            const normalizedInfo = normalizeText(rh);
            for (const [key, dbCol] of Object.entries(headerMap)) {
               if(normalizedInfo.includes(key)) {
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
                     empresa[dbCol] = valUpper === 'SIM' || valUpper === 'TRUE';
                  } else {
                     empresa[dbCol] = valStr || empresa[dbCol]; // Usa STR ou deixa o defaultValue
                  }
               }
            }
            if(!empresa.nome) empresa.nome = 'Empresa Desconhecida (Ver Excel)';

            // Tenta forçar o match perfeito da string de STATUS que veio limpa (ex: '100% CONCLUIDO') com a lista bonita
            if (empresa.statusCompetencia && empresa.statusCompetencia !== 'Pendente') {
               const normIncoming = normalizeText(empresa.statusCompetencia);
               const matchedOpt = exactDPOptions.find(opt => normalizeText(opt) === normIncoming);
               if (matchedOpt) {
                   empresa.statusCompetencia = matchedOpt;
                   empresa.faseOnbDP = matchedOpt; // Espelha automático!
                   empresa.faseOnbFiscal = matchedOpt; 
                   empresa.faseOnbContabil = matchedOpt; 
               } else {
                   empresa.faseOnbDP = empresa.statusCompetencia; // Espelha o texto torto mesmo se não achar
                   empresa.faseOnbFiscal = empresa.statusCompetencia;
                   empresa.faseOnbContabil = empresa.statusCompetencia;
               }
            }

            return empresa;
         });

         const { data, error } = await supabase.from('backoffice_empresas').insert(toInsert).select();
         
         if(error) {
            alert(`Erro na importação: ${error.message}`);
         } else if(data) {
            setEmpresas([...data, ...empresas]);
            alert(`🔥 MAGIA FEITA: Cruzamento Realizado! ${data.length} novas empresas foram injetadas e disparadas para o Onboarding!`);
         }
      }
    });
    e.target.value = ''; 
  };

  if (!isLoggedIn) {
     return (
        <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4 relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="bg-[#131B2F]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-10 w-full max-w-sm relative z-10 shadow-2xl">
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/30">
                 <div className="w-full h-full bg-[#131B2F] rounded-[14px] flex items-center justify-center">
                    <Briefcase size={28} className="text-indigo-400" />
                 </div>
              </div>
            </div>
            <h1 className="text-2xl font-black text-center mb-2 text-white tracking-tight">BACKOFFICE</h1>
            <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Gestão Operacional CF</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" autoFocus required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} 
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                placeholder="seu.email@corp.com" />
              <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} 
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                placeholder="************" />
              <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-xl font-bold tracking-wide hover:shadow-lg hover:shadow-indigo-500/25 transition-all mt-4 border border-indigo-400/20">
                Acessar Painel Central
              </button>
              {loginError && <p className="text-rose-400 text-[11px] text-center font-bold mt-3">* {loginError}</p>}
            </form>
          </div>
        </div>
      );
  }

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
          placeholder="Digite a particularidade. Ex: Retenção ISS SP..."
        />
      );
    }
    return (
      <div onClick={() => setIsFocused(true)} className="text-[11px] text-slate-300 bg-[#131B2F] hover:bg-[#1e293b] border border-white/5 hover:border-indigo-500/40 cursor-pointer p-3 rounded-xl truncate min-h-[42px] transition-all flex items-center gap-2 group shadow-sm">
        <MessageSquareText size={16} className="text-slate-500 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
        {emp.anotacoesFiscal ? <span className="font-medium text-slate-200">{emp.anotacoesFiscal}</span> : <span className="text-slate-500 italic">Clique aqui para adicionar uma anotação fiscal...</span>}
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
      <div title={`BKO ${label}: ${ativo ? 'Ativo' : 'Inativo'}`} className={`inline-flex items-center justify-center px-2 py-1 min-w-[38px] border text-[9px] font-bold rounded-md uppercase tracking-wider shadow-sm transition-all ${ativo ? activeColorMap[label] : 'bg-[#131B2F] border-white/5 text-slate-500 shadow-none'}`}>
        {ativo ? `${label} ✓` : `${label}`}
      </div>
    );
  };

  const optionsFaseDP = [
    'Falta Parametrizar',
    '100% concluído',
    'Folha enviada/variável',
    'Folha enviada aguardando conferência do franqueado',
    'Aguardando/variáveis',
    'Certificado com 2 etapas',
    'Liberado pra envio',
    'Sem certificado',
    'Certificado vencido',
    'Sem procuração',
    'Aguardando T.I'
  ];

  const optionsOnbGeral = ['Falta Parametrizar', 'Em Andamento', 'Concluído'];
  const optionsMesGeral = ['Pendente', 'Entregue'];

  const getStatusColor = (fase: string) => {
    switch (fase) {
      case '100% concluído': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Entregue': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Concluído': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Folha enviada/variável': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Folha enviada aguardando conferência do franqueado': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'Aguardando/variáveis': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Em Andamento': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Certificado com 2 etapas': return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20';
      case 'Liberado pra envio': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Sem certificado': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Certificado vencido': return 'bg-rose-600/10 text-rose-500 border-rose-600/20';
      case 'Sem procuração': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'Pendente': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Aguardando T.I': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'Falta Parametrizar': 
      default:
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    }
  };

  const InlineBadgeSelect = ({ val, options, onChange, disabled }: { val: string, options: string[], onChange: (v: string) => void, disabled?: boolean }) => (
     <select 
       value={val} 
       onChange={(e) => onChange(e.target.value)}
       disabled={disabled}
       className={`appearance-none cursor-pointer outline-none text-center px-2 py-1.5 rounded-md text-[9.5px] font-black uppercase tracking-wider shadow-sm border transition-all truncate max-w-[170px] ${getStatusColor(val)} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
       style={{ textAlignLast: 'center' }}
       title={val}
     >
        {options.map((o, idx) => <option key={idx} value={o} className="bg-[#0A101D] text-slate-300 font-bold uppercase">{o}</option>)}
     </select>
  );

  return (
    <div className="min-h-screen bg-[#040812] flex font-inter text-slate-200">
      
      {/* GLOBAL CSS FOR SCROLLBAR */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; border: 2px solid #0A101D; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>

      {/* Modern Premium Sidebar (Dual/Rail Accordion format - COLLAPSIBLE) */}
      <aside className={`flex h-screen fixed shadow-2xl z-40 transition-all duration-300 ${isSidebarOpen ? 'w-[300px]' : 'w-[70px]'}`}>
        
        {/* LEFT RAIL (Slim Icon Sidebar) */}
        <div className="w-[70px] bg-[#0A101D] border-r border-[#192435] flex flex-col items-center py-6 gap-6 shrink-0 h-full relative z-50">
           {/* Logo Sphere */}
           <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] shadow-lg shadow-cyan-500/20 mb-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center">
              <div className="w-full h-full bg-[#0A101D] rounded-full flex items-center justify-center">
                 {isSidebarOpen ? <ChevronLeft size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
              </div>
           </div>

           {/* Icon Buttons matching the screenshot */}
           <div className="flex flex-col gap-3 w-full px-2 mt-4 space-y-2">
              <button title="Universo 360" onClick={() => { setVisaoAtiva('Geral'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${visaoAtiva === 'Geral' ? 'bg-[#0bc5ea] text-white shadow-[0_0_15px_rgba(11,197,234,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                 <Globe size={22} strokeWidth={1.5}/>
              </button>
              
              <button title="Módulo DP" onClick={() => { setVisaoAtiva('DP'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${baseSector === 'DP' ? 'bg-[#0bc5ea] text-white shadow-[0_0_15px_rgba(11,197,234,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                 <Users size={22} strokeWidth={1.5}/>
              </button>

              <button title="Módulo Fiscal" onClick={() => { setVisaoAtiva('Fiscal'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${baseSector === 'Fiscal' ? 'bg-[#0bc5ea] text-white shadow-[0_0_15px_rgba(11,197,234,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                 <FileText size={22} strokeWidth={1.5}/>
              </button>

              <button title="Módulo Contábil" onClick={() => { setVisaoAtiva('Contábil'); setIsSidebarOpen(true); }} className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all ${baseSector === 'Contábil' ? 'bg-[#0bc5ea] text-white shadow-[0_0_15px_rgba(11,197,234,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                 <LayoutDashboard size={22} strokeWidth={1.5}/>
              </button>
           </div>
           
           <div className="mt-auto pb-4">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs border border-slate-700 shadow-md">
                {loginEmail.substring(0,2)}
              </div>
           </div>
        </div>

        {/* RIGHT PANEL (Sub-Menu Accordions) -> Collapses when isSidebarOpen is false */}
        <div className={`flex-1 border-r border-[#192435] flex flex-col h-full bg-[#040812] transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-[230px] opacity-100' : 'w-0 opacity-0 pointer-events-none border-none'}`}>
           {/* Header */}
           <div className="p-5 border-b border-white/5 flex justify-between items-center h-[88px] shrink-0 min-w-[230px]">
             <span className="text-white font-black text-[15px] tracking-widest">BACK<span className="text-[#0bc5ea]">OFFICE</span></span>
             <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest shrink-0">Dashboard</span>
           </div>

           {/* Accordion Lists */}
           <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 min-w-[200px]">
              <div className="mb-3">
                 <button 
                    onClick={() => { setVisaoAtiva('Geral'); cancelEditing(); }} 
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-[13px] font-semibold transition-all ${visaoAtiva === 'Geral' ? 'text-white bg-[#101b30]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                 >
                    <div className="flex items-center gap-3">
                       <Globe size={16} className={visaoAtiva === 'Geral' ? 'text-[#0bc5ea]' : ''}/>
                       Visão Geral 360
                    </div>
                 </button>
              </div>

              {['DP', 'Fiscal', 'Contábil'].map(setor => {
                const isExpanded = baseSector === setor || visaoAtiva === 'Geral'; // Expand if active
                const iconMap: Record<string, any> = { 'DP': Users, 'Fiscal': FileText, 'Contábil': LayoutDashboard };
                const Icon = iconMap[setor];

                return (
                  <div key={setor} className="mb-1">
                     {/* Accordion Header (Click to expand via setting active view to trigger showing its children) */}
                     <button 
                        onClick={() => {
                          setVisaoAtiva(setor as Visao); 
                          cancelEditing();
                        }} 
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-[13px] font-semibold transition-all ${(baseSector === setor && visaoAtiva !== 'Geral') ? 'text-white bg-[#101b30]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                     >
                        <div className="flex items-center gap-3">
                           <Icon size={16} className={(baseSector === setor && visaoAtiva !== 'Geral') ? 'text-[#0bc5ea]' : ''}/>
                           Módulo {setor}
                        </div>
                        <span className="text-[10px] text-slate-500">{isExpanded ? 'v' : '^'}</span>
                     </button>

                     {/* Accordion Children (Só aparece quando clicar / estiver ativo) */}
                     {isExpanded && (
                       <div className="pl-9 mt-1 space-y-1 pb-2">
                          <button onClick={() => {setVisaoAtiva(setor as Visao); cancelEditing();}} className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all ${visaoAtiva === setor ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${visaoAtiva === setor ? 'border-[#0bc5ea] bg-[#0bc5ea]/10 text-[#0bc5ea]' : 'border-slate-700 bg-transparent'}`}><Check size={10} className={visaoAtiva === setor ? 'opacity-100' : 'opacity-0'}/></div>
                            Entregas Mensais
                          </button>

                          <button onClick={() => {setVisaoAtiva(`${setor}_Onb` as Visao); cancelEditing();}} className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all ${visaoAtiva === `${setor}_Onb` ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${visaoAtiva === `${setor}_Onb` ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-slate-700 bg-transparent'}`}><PlaneTakeoff size={10} className={visaoAtiva === `${setor}_Onb` ? 'opacity-100' : 'opacity-0'}/></div>
                            Onboarding
                          </button>
                       </div>
                     )}
                  </div>
                )
              })}
           </div>

           <div className="p-4 border-t border-white/5 bg-[#0A101D] min-w-[230px]">
              <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 text-slate-500 hover:text-rose-400 px-3 py-2 text-[11px] font-bold uppercase transition-all">
                <LogOut size={14} /> Sair do Sistema
              </button>
           </div>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-[300px]' : 'ml-[70px]'} p-8 max-w-full relative flex flex-col h-screen overflow-hidden bg-[#040812]`}>
        <header className="flex justify-between items-end mb-8 shrink-0">
          <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border ${isOnbView ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : visaoAtiva === 'Geral' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-white/5 text-slate-300 border-white/10'}`}>
                 {isOnbView ? <PlaneTakeoff size={24}/> : visaoAtiva === 'Geral' ? <Globe size={24}/> : baseSector === 'DP' ? <Users size={24}/> : baseSector === 'Fiscal' ? <FileText size={24}/> : <LayoutDashboard size={24}/>}
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white tracking-tight">
                  Painel <span className={`${isOnbView ? 'text-amber-500' : visaoAtiva === 'Geral' ? 'text-cyan-400' : 'text-indigo-400'} font-black`}>{visaoAtiva.replace('_Onb', ' Onboarding')}</span>
                </h2>
                <p className="text-slate-400 font-medium text-[13px] mt-1">Monitoramento operacional em tempo real.</p>
              </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 border border-emerald-500">
               + Nova Operação
            </button>
            <label className="bg-[#0A101D] hover:bg-[#131B2F] border border-white/10 text-slate-300 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all cursor-pointer flex items-center gap-2">
              <Upload size={14} className="text-slate-400" /> Importar CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
             <button onClick={exportToCSV} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 border border-indigo-500/50">
               <Download size={14} /> Exportar
             </button>
          </div>
        </header>

        {/* The Glass Table Container */}
        <div className="bg-[#0A101D] rounded-xl shadow-2xl ring-1 ring-white/10 overflow-hidden flex flex-col flex-1 relative">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-white/5 bg-[#0A101D] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 w-full max-w-3xl">
                <div className="relative flex-[2]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input 
                    type="text" placeholder="Buscar por Nome, CNPJ ou Analista..."
                    className="w-full pl-10 pr-4 py-2 bg-[#131B2F] border border-white/10 rounded-lg text-[13px] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-px h-6 bg-white/10"></div>

                <select className="bg-[#131B2F] border text-indigo-400 font-bold border-white/10 shadow-inner rounded-lg text-[12px] py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer flex-1 transition-colors hover:bg-white/5" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
                   {mesesDisponiveis.map(m => <option key={m} value={m}>Mês: {m}</option>)}
                </select>

                <select className="bg-[#131B2F] border text-slate-300 font-semibold border-white/10 shadow-inner rounded-lg text-[12px] py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer flex-1 transition-colors hover:bg-white/5" value={filterResponsavel} onChange={e=>setFilterResponsavel(e.target.value)}>
                   <option value="Todos">Todos Analistas</option>
                   {colaboradoresSetor.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                 <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 shadow-sm">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                   {empresasFiltradas.length} Operações Ativas
                 </div>
              </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto flex-1 h-full custom-scrollbar relative">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
              <thead className="sticky top-0 z-30 bg-[#0A101D]">
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
                  <th className="px-5 py-3.5 w-12 text-center text-slate-600"><Square size={14}/></th>
                  <th className="px-5 py-3.5 w-12 text-center">Ação</th>
                  
                  {!isOnbView ? (
                    <th className="px-5 py-3.5 border-r border-white/5 bg-[#131B2F]/50 text-center text-slate-300">Obrigação Mensal</th>
                  ) : (
                    <th className="px-5 py-3.5 border-r border-amber-500/10 bg-amber-500/5 text-center text-amber-500">Trilha Onboarding</th>
                  )}

                  <th className="px-5 py-3.5 text-slate-400">Franquia</th>
                  <th className="px-5 py-3.5">Razão Social</th>
                  <th className="px-5 py-3.5">CNPJ</th>
                  <th className="px-5 py-3.5 text-center">Tributação</th>
                  {!hideAtividade && <th className="px-5 py-3.5">Atividade</th>}
                  <th className="px-5 py-3.5">Entrada</th>
                  
                  {baseSector === 'DP' && !isOnbView && (
                    <th className="px-6 py-3.5 border-l border-white/5 bg-[#131B2F]/50 text-slate-400 text-center relative z-20">Engrenagem DP</th>
                  )}

                  {baseSector === 'Fiscal' && !isOnbView && (
                    <th className="px-6 py-3.5 border-l border-white/5 bg-[#131B2F]/50 text-slate-400 relative z-20 min-w-[280px]">Particularidades</th>
                  )}

                  <th className="px-5 py-3.5">Analista</th>
                  <th className="px-5 py-3.5">Sist Base</th>
                  <th className="px-5 py-3.5">Cód.</th>
                  <th className="px-5 py-3.5 text-center">Mix Módulos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[13px] font-medium text-slate-300 bg-[#0A101D]">
                {empresasFiltradas.length > 0 ? empresasFiltradas.map((emp) => {
                  const isEditing = editingId === emp.id;
                  
                  return (
                  <tr key={emp.id} className={`group hover:bg-white/5 transition-all duration-200 ${isEditing ? 'bg-indigo-500/10 shadow-sm relative z-10' : ''}`}>
                    <td className="px-5 py-3.5 text-center"><input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-[#131B2F] text-indigo-500 focus:ring-indigo-500 cursor-pointer"/></td>
                    <td className="px-5 py-3.5 text-center">
                      {isEditing ? (
                        <div className="flex gap-2 justify-center">
                          <button onClick={saveEditing} className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-sm hover:bg-emerald-600 transition-colors"><Check size={14} /></button>
                          <button onClick={cancelEditing} className="p-1.5 bg-rose-500 text-white rounded-lg shadow-sm hover:bg-rose-600 transition-colors"><XCircle size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => startEditing(emp)} disabled={!!editingId} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent">
                            <Pencil size={15} />
                          </button>
                          {!emp.encaminhadoPara && (
                            <button onClick={() => despacharBko(emp.id, emp.nome)} disabled={!!editingId} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent" title="Finalizar e Despachar ao Atendimento">
                              <Send size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* STATUS DE ENTREGA MENSAL */}
                    {!isOnbView ? (
                       <td className="px-5 py-3.5 border-r border-white/5 text-center bg-[#131B2F]/30 transition-colors">
                          <InlineBadgeSelect 
                            val={emp.statusCompetencia || 'Pendente'}
                            options={baseSector === 'DP' ? optionsFaseDP : optionsMesGeral}
                            onChange={(v) => updateEmpresaDirectly(emp.id, {statusCompetencia: v})}
                            disabled={!!editingId && !isEditing}
                          />
                       </td>
                    ) : (
                       <td className="px-5 py-4 border-r border-amber-500/10 bg-amber-500/5 text-center">
                          <InlineBadgeSelect 
                            val={baseSector === 'DP' ? emp.faseOnbDP : baseSector === 'Fiscal' ? emp.faseOnbFiscal : emp.faseOnbContabil}
                            options={optionsFaseDP} // USA A MESMA LISTA COLORIDA PARA TODOS OS ONBOARDINGS!
                            onChange={(v) => {
                               if(baseSector === 'DP') updateEmpresaDirectly(emp.id, {faseOnbDP: v});
                               if(baseSector === 'Fiscal') updateEmpresaDirectly(emp.id, {faseOnbFiscal: v});
                               if(baseSector === 'Contábil') updateEmpresaDirectly(emp.id, {faseOnbContabil: v});
                            }}
                            disabled={!!editingId && !isEditing}
                          />
                       </td>
                    )}

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                         <input type="text" className="border border-white/10 bg-[#131B2F] text-white rounded-md p-2 w-[140px] text-[11px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/50" value={editForm?.franquia} onChange={e => setEditForm({...editForm!, franquia: e.target.value})} />
                      ) : (
                         <div className="flex flex-col items-start gap-1">
                            <span className="font-bold text-[13px] text-slate-200">{emp.franquia}</span>
                            {emp.inadimplente && <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest flex items-center gap-1"><ShieldAlert size={10}/> BLOQUEADO</span>}
                         </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                          <input type="text" className="border border-white/10 bg-[#131B2F] text-white rounded-md p-2 w-[220px] text-[11px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/50" value={editForm?.nome} onChange={e => setEditForm({...editForm!, nome: e.target.value})} />
                      ) : (
                          <div className="flex flex-col gap-1 items-start">
                             <div className="text-[12.5px] font-semibold text-slate-300 whitespace-nowrap">{emp.nome}</div>
                             {emp.encaminhadoPara && (
                               <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide flex items-center gap-1 w-max">
                                 <Send size={9}/> {emp.encaminhadoPara}
                               </div>
                             )}
                          </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                          <input type="text" className="border border-white/10 bg-[#131B2F] text-white rounded-md p-2 w-[110px] text-[11px] font-mono shadow-sm focus:ring-2 focus:ring-indigo-500/50" value={editForm?.cnpj} onChange={e => setEditForm({...editForm!, cnpj: e.target.value})} />
                      ) : (
                          <div className="text-[11.5px] font-mono text-slate-400">{emp.cnpj}</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      {isEditing ? (
                        <select className="border border-white/10 bg-[#131B2F] text-indigo-300 rounded-md p-2 w-[120px] text-[10px] font-bold shadow-sm" value={editForm?.tributacao} onChange={e => setEditForm({...editForm!, tributacao: e.target.value})}>
                          {optionsTributacao.map(t => <option key={t}>{t}</option>)}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${emp.tributacao === 'Imune / Isenta' ? 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20' : 'bg-white/5 text-slate-300 ring-1 ring-white/10'}`}>{emp.tributacao}</span>
                      )}
                    </td>

                    {!hideAtividade && (
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <select className="border border-white/10 rounded-md p-2 text-[10px] font-bold w-[90px] shadow-sm bg-[#131B2F] text-white" value={editForm?.atividade} onChange={e => setEditForm({...editForm!, atividade: e.target.value})}>
                            {optionsAtividade.map(t => <option key={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className="text-[11.5px] font-semibold text-slate-300 px-2 py-0.5 bg-[#131B2F] rounded-md border border-white/5">{emp.atividade}</span>
                        )}
                      </td>
                    )}

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                         <input type="text" className="border border-white/10 bg-[#131B2F] text-white rounded-md p-2 w-[80px] text-[10px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/50" value={editForm?.dataEntrada} onChange={e => setEditForm({...editForm!, dataEntrada: e.target.value})} />
                      ) : (
                         <div className="text-[11.5px] font-medium text-slate-400">{emp.dataEntrada}</div>
                      )}
                    </td>

                    {/* =========== BISTURI DP =========== */}
                    {baseSector === 'DP' && !isOnbView && (
                      <td className="px-5 py-4 border-l border-white/5 bg-[#131B2F]/30 group-hover:bg-transparent transition-colors">
                        {isEditing ? (
                           <div className="text-[10px] text-indigo-400 font-bold bg-[#131B2F] border border-white/10 rounded-lg p-3 shadow-inner">
                              <span className="uppercase tracking-wider">Ajuste de Folha:</span> <br/>
                              <div className="flex gap-2 mt-2">
                                <label>Pról: <input type="number" className="w-[50px] bg-[#0A101D] border border-white/10 rounded p-1 text-white" value={editForm?.qtdProlabore} onChange={e=>setEditForm({...editForm!, qtdProlabore: e.target.value})}/></label>
                                <label>Func: <input type="number" className="w-[50px] bg-[#0A101D] border border-white/10 rounded p-1 text-white" value={editForm?.qtdFuncionarios} onChange={e=>setEditForm({...editForm!, qtdFuncionarios: e.target.value})}/></label>
                              </div>
                           </div>
                        ) : (
                          <div className="flex gap-3 items-center">
                               <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center shadow-sm min-w-[40px]">
                                 <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Pró-L</div>
                                 <div className="text-[12px] font-black text-slate-200">{emp.qtdProlabore || '0'}</div>
                               </div>
                               <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center shadow-sm min-w-[40px]">
                                 <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Func</div>
                                 <div className="text-[12px] font-black text-slate-200">{emp.qtdFuncionarios || '0'}</div>
                               </div>

                               <div className="flex flex-col gap-1 ml-1">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${emp.temAdiantamento ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-transparent text-slate-600 border-transparent opacity-60'}`}>Adiantamento</span>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${emp.temConsignado ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-transparent text-slate-600 border-transparent opacity-60'}`}>Consignado</span>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${emp.temVariavel ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-transparent text-slate-600 border-transparent opacity-60'}`}>Variável</span>
                               </div>
                          </div>
                        )}
                      </td>
                    )}

                    {/* =========== BISTURI FISCAL =========== */}
                    {baseSector === 'Fiscal' && !isOnbView && (
                      <td className="px-5 py-4 border-l border-white/5 bg-[#131B2F]/30 align-top group-hover:bg-transparent transition-colors">
                        {isEditing ? (
                          <div className="text-[10px] text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 shadow-inner rounded-xl px-3 py-2 italic flex items-center gap-2 max-w-[280px]">
                             <AlertCircle size={14}/> Salve a linha para editar anotações livrement na tabela!
                          </div>
                        ) : (
                          <div className="relative min-w-[280px]">
                            <NuvemParticularidade emp={emp} />
                          </div>
                        )}
                      </td>
                    )}

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input type="text" className="border border-white/10 bg-[#131B2F] text-white rounded-md p-2 w-[100px] text-[10px] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500/50" value={editForm?.responsavel} onChange={e => setEditForm({...editForm!, responsavel: e.target.value})} />
                      ) : (
                        <span className="font-semibold text-slate-200 bg-[#131B2F] border border-white/5 px-2 py-0.5 rounded-md text-[11px] shadow-sm truncate block max-w-max">{emp.responsavel}</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <select className="border border-white/10 bg-[#131B2F] text-indigo-300 rounded-md p-2 w-[110px] text-[10px] font-bold shadow-sm" value={editForm?.sistemaBase} onChange={e => setEditForm({...editForm!, sistemaBase: e.target.value})}>
                          {optionsSistemas.map(opt => <option key={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <span className="text-[11.5px] font-medium text-slate-400 block">{emp.sistemaBase}</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                         <input type="text" className="border border-white/10 bg-[#131B2F] text-white rounded-md p-2 w-[60px] text-[10px] font-mono shadow-sm focus:ring-2 focus:ring-indigo-500/50" value={editForm?.codigoSistema} onChange={e => setEditForm({...editForm!, codigoSistema: e.target.value})} />
                      ) : (
                         <div className="text-[11.5px] font-mono text-slate-500">{emp.codigoSistema}</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <div className="text-[10px] text-indigo-400 font-bold bg-[#131B2F] p-2 rounded-lg border border-white/10 flex items-center justify-center">Protegido (Edite In-Line)</div>
                      ) : (
                        <div className="flex gap-1.5 justify-center">
                          <BkoBadge isEdit={false} ativo={emp.bkoDP} label="DP" />
                          <BkoBadge isEdit={false} ativo={emp.bkoFiscal} label="FIS" />
                          <BkoBadge isEdit={false} ativo={emp.bkoContabil} label="CTB" />
                        </div>
                      )}
                    </td>

                  </tr>
                )}) : (
                  <tr>
                    <td colSpan={100} className="px-6 py-32 text-center">
                      <div className="flex flex-col items-center justify-center opacity-40">
                         <div className="w-16 h-16 bg-[#131B2F] border border-white/5 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                            <Search className="h-8 w-8 text-slate-500" />
                         </div>
                         <p className="text-lg font-bold text-slate-400">Nenhuma matriz listada.</p>
                         <p className="text-sm mt-1 text-slate-500 font-medium">Os radares não detectaram informações correspondentes aos filtros.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL CADASTRAR NOVA OPERAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#040812]/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
           <div className="bg-[#0A101D] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#131B2F]/50">
                 <h3 className="text-white font-black text-lg flex items-center gap-2">
                    <PlaneTakeoff className="text-emerald-500" />
                    Cadastrar Nova Empresa
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><XCircle size={20}/></button>
              </div>

              <form onSubmit={criarNovaOperacao} className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Franquia</label>
                      <input required type="text" className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="Ex: RJ - Centro" value={novaEmpresaForm.franquia} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, franquia:e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">CNPJ</label>
                      <input required type="text" className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="00.000.000/0000-00" value={novaEmpresaForm.cnpj} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, cnpj:e.target.value})} />
                    </div>
                 </div>

                 <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Razão Social</label>
                    <input required type="text" className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="Nome da Empresa LTDA" value={novaEmpresaForm.razaoSocial} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, razaoSocial:e.target.value})} />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tributação</label>
                      <select className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" value={novaEmpresaForm.tributacao} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, tributacao:e.target.value})}>
                          {optionsTributacao.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sistema Contábil</label>
                      <select className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" value={novaEmpresaForm.sistemaBase} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, sistemaBase:e.target.value})}>
                          {optionsSistemas.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Código no Sistema</label>
                      <input type="text" className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="Ex: 1545" value={novaEmpresaForm.codigoSistema} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, codigoSistema:e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Auditor / Analista</label>
                      <input type="text" className="w-full bg-[#131B2F] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none" placeholder="Nome do Responsável" value={novaEmpresaForm.responsavel} onChange={e=>setNovaEmpresaForm({...novaEmpresaForm, responsavel:e.target.value})} />
                    </div>
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-3 rounded-xl border border-white/10 text-slate-300 font-bold hover:bg-white/5 transition-colors flex-1">Cancelar</button>
                    <button type="submit" className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors flex-1 shadow-lg shadow-emerald-500/20">Finalizar e Iniciar Onboarding</button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}
