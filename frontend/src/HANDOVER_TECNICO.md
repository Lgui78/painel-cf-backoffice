# 📑 Manual de Integração BKO Mestre (Onboarding & Carteira) - [JS PURO & CSS MODULES]

Este manual contém a lógica traduzida para **Javascript Puro** e a estilização em **CSS Modules** para integração no sistema Onety.

---

## 1. ⚙️ Inteligência do BKO (Javascript Puro)

### A. Lógica de Aging (Fora do Prazo de 3 Meses)
```javascript
const checkOverdue = (empresa) => {
  if (!empresa.inicio_onboarding) return false;
  
  // Apenas unidades sem responsável entram no radar de Aging
  const resp = (empresa.responsavel || '').toUpperCase();
  if (resp && !resp.includes('NÃO ATRIBUÍDO')) return false;

  const [startMonth, startYear] = empresa.inicio_onboarding.split('/').map(Number);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const diffMonths = (currentYear * 12 + currentMonth) - (startYear * 12 + startMonth);
  return diffMonths >= 3; // Retorna true para o card vermelho
};
```

### B. Ciclo de Status (Click to Change)
```javascript
const cycleStatus = (id, currentStatus) => {
  const sequence = ['PENDENTE', 'EM ANDAMENTO', '100% CONCLUIDO'];
  const mainStatus = currentStatus.split('|')[0].trim();
  const index = sequence.indexOf(mainStatus);
  const nextStatus = sequence[(index + 1) % sequence.length];
  
  return nextStatus; // Retorna o próximo status para ser salvo no banco
};
```

---

## 2. 🎨 Estilização - CSS Module (`BkoDashboard.module.css`)

```css
/* Container e Fundo Principal */
.container {
  background-color: #05080F;
  color: rgba(255, 255, 255, 0.9);
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
}

/* Cards de Estatísticas */
.card {
  background-color: #0A101D;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.cardOverdue {
  background-color: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

/* Tabela e Linhas */
.tableRow {
  display: grid;
  grid-template-columns: 40px 1.2fr 130px 90px 100px auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.02);
  transition: background 0.2s;
}

.tableRow:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

/* Status Pills (Bandeirolas) */
.pill {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 8px;
  font-weight: 900;
  text-transform: uppercase;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: center;
}

.pillConcluido {
  background-color: rgba(16, 185, 129, 0.1);
  color: #10B981;
  border-color: rgba(16, 185, 129, 0.2);
}

.pillAndamento {
  background-color: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
  border-color: rgba(245, 158, 11, 0.2);
}

.pillPendente {
  background-color: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  border-color: rgba(239, 68, 68, 0.2);
}
```

---

## 3. 📂 Banco de Dados (Supabase)
Tabela: `backoffice_empresas`.

**Destaques para o Onboarding:**
- Campo `responsavel`: Quando alterado de "NÃO ATRIBUÍDO" para um Analista, o sistema deve setar `isOnboarding = false` automaticamente.
- Campo `inicio_onboarding`: Formato ideal "MM/YYYY" para garantir o funcionamento da lógica de Aging.

---

**Manual Atualizado - Pronto para o Gabriel! 🦅🛡️🚀🏁**
