# Conversor Yampi ➜ Bling  
Ferramenta web desenvolvida em **Next.js + React** para converter o relatório CSV da plataforma **Yampi** em uma **planilha Excel pronta para importação no Bling ERP**.

Além do conversor, o sistema fornece:

- Resumo financeiro dos pedidos  
- Picking List (lista de separação) para impressão  
- Visualização do JSON processado  
- Backup dos dados  
- Geração automática do Excel (.xls) seguindo o padrão do Bling  

---

## 🚀 Tecnologias Utilizadas

- **Next.js 14 (App Router)**
- **React + Hooks**
- **TailwindCSS**
- **XLSX.js** (conversão para Excel)
- **TypeScript / JavaScript**
- **Vercel hosting** (opcional)
- **Git & GitHub**

---

## 📌 Funcionalidades Principais

### ✔️ Upload do CSV da Yampi  
Aceita arquivos `.csv` exportados do painel Yampi.

### ✔️ Conversão automática dos dados  
O sistema:

- Normaliza o CSV  
- Converte para JSON  
- Identifica SKU e preço de acordo com o produto (kits 5, 10, 15, 20 unidades)  
- Gera contadores e resumo financeiro  
- Calcula frete, desconto e total do pedido  
- Mapeia automaticamente Estados → UF  
- Prepara tudo no formato exigido pelo Bling

### ✔️ Geração da planilha Excel (.xls)  
Inclui colunas específicas do Bling como:

- Dados do cliente  
- Endereço  
- Produto  
- SKU  
- Valor unitário  
- Valor total  
- Transporte  
- Data prevista  
- Forma de pagamento  
- Etc.

### ✔️ Picking List (Lista de Separação)
Gerada automaticamente e pronta para impressão (modo printer-friendly).

### ✔️ Visualização Técnica (JSON)
Permite auditar todo o processamento.

---

# 🛠️ Como rodar o projeto localmente

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/seu-repo.git
cd seu-repo
