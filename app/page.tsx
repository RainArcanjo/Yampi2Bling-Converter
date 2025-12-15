"use client";
import { useState, ChangeEvent, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';

// --- CONFIGURAÇÕES ---
const MEDIDAS_KITS: Record<string, { weight: number, height: number, width: number, length: number }> = {
  "Kit 5 Panos":  { weight: 0.125, height: 22, width: 19, length: 5 },
  "Kit 10 Panos": { weight: 0.190, height: 22, width: 19, length: 5 },
  "Kit 15 Panos": { weight: 0.250, height: 19, width: 22, length: 7 },
  "Kit 20 Panos": { weight: 0.300, height: 19, width: 22, length: 7 },
  "Outros":       { weight: 0.125, height: 20, width: 20, length: 5 }
};

export default function YampiConverter() {
  const [jsonOutput, setJsonOutput] = useState<string | null>(null);
  const [jsonObject, setJsonObject] = useState<any[]>([]);
  const [fileName, setFileName] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteProgress, setQuoteProgress] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [freteCalculado, setFreteCalculado] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setDarkMode(true);
    else setDarkMode(false);
  }, []);

  // --- LÓGICA DE LEITURA (XLSX INPUT) ---
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace(/\.[^/.]+$/, ""));
    setLoading(true);
    setError('');
    setJsonOutput(null);
    setJsonObject([]);
    setQuoteProgress(0);
    setFreteCalculado(false);

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Converte para JSON bruto (defval: "" garante que células vazias não quebrem)
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rawData.length === 0) {
            setError("A planilha parece estar vazia.");
            setLoading(false);
            return;
        }

        const normalizedData = processarDadosXLSX(rawData);
        setJsonObject(normalizedData);
        setJsonOutput(JSON.stringify(normalizedData, null, 4));
      } catch (err) {
        console.error(err);
        setError("Erro ao processar o arquivo Excel. Verifique o formato.");
      } finally {
        setLoading(false);
      }
    };
  };

  // Função auxiliar para encontrar coluna por vários nomes possíveis
  const encontrarValor = (row: any, possiveisNomes: string[]) => {
      // Normaliza as chaves da linha para minúsculo para comparar
      const chavesLinha = Object.keys(row).reduce((acc, k) => {
          acc[k.toLowerCase().trim()] = row[k];
          return acc;
      }, {} as any);

      for (const nome of possiveisNomes) {
          const valor = chavesLinha[nome.toLowerCase().trim()];
          if (valor !== undefined && valor !== "") {
              return String(valor).trim();
          }
      }
      return "";
  };

  const processarDadosXLSX = (data: any[]) => {
    return data.map((row: any) => {
      return {
        // Tenta achar pelos nomes do BLING ou da YAMPI ou nomes comuns
        id: encontrarValor(row, ['Nr Pedido', 'id', 'numero_pedido', 'Pedido']),
        
        data: encontrarValor(row, ['Data da Venda', 'data', 'Data']),
        
        cliente: encontrarValor(row, ['Nome Comprador', 'cliente', 'Nome', 'Nome do Cliente']),
        cliente_document: encontrarValor(row, ['CPF/CNPJ Comprador', 'cliente_document', 'CPF', 'CNPJ']),
        cliente_email: encontrarValor(row, ['E-mail Comprador', 'cliente_email', 'Email']),
        cliente_telefone: encontrarValor(row, ['Celular Comprador', 'Telefone Comprador', 'cliente_telefone', 'Celular']),
        
        // Endereço
        entrega_rua: encontrarValor(row, ['Endereço Entrega', 'Endereço Comprador', 'entrega_rua', 'Rua']),
        entrega_numero: encontrarValor(row, ['Número Entrega', 'Número Comprador', 'entrega_numero', 'Numero']),
        entrega_complemento: encontrarValor(row, ['Complemento Entrega', 'entrega_complemento', 'Complemento']),
        entrega_bairro: encontrarValor(row, ['Bairro Entrega', 'Bairro Comprador', 'entrega_bairro', 'Bairro']),
        entrega_cidade: encontrarValor(row, ['Cidade Entrega', 'Cidade Comprador', 'entrega_cidade', 'Cidade']),
        entrega_estado: encontrarValor(row, ['UF Entrega', 'UF Comprador', 'entrega_estado', 'UF', 'Estado']),
        entrega_cep: encontrarValor(row, ['CEP Entrega', 'CEP Comprador', 'entrega_cep', 'CEP']),

        // Produto
        produto: encontrarValor(row, ['Produto', 'produto', 'Nome do Produto']),
        sku: encontrarValor(row, ['SKU', 'sku', 'Código']),
        quantidade: encontrarValor(row, ['Quantidade', 'quantidade', 'Qtd']) || "1",

        // Financeiro
        total_frete: encontrarValor(row, ['Valor Frete Pedido', 'total_frete', 'Frete']) || "0",
        total_pago: encontrarValor(row, ['Total Pedido', 'total_pago', 'Total']) || "0",
        total_desconto: encontrarValor(row, ['Valor Desconto Pedido', 'total_desconto', 'Desconto']) || "0",

        // Logística
        entrega: encontrarValor(row, ['Trasportadora', 'Transportadora', 'entrega']) || "Padrao",
        
        // Extras
        pagamento: encontrarValor(row, ['Método Pagamento', 'pagamento', 'Forma Pagamento']) || "Não Informado",
        parcelamento: encontrarValor(row, ['Qtd Parcela', 'parcelamento']) || "1"
      };
    });
  };

  // --- LÓGICA DE PRODUTO ---
  const getProdutoBling = (skuOriginal: string) => {
    const sku = skuOriginal ? skuOriginal.trim().toUpperCase() : "";
    if (sku === "566-PVLC") return { sku: "566-PVLC", preco: 14.10, nome: "Kit 5 Panos" };
    if (sku === "567-PVLC") return { sku: "567-PVLC", preco: 25.90, nome: "Kit 10 Panos" };
    if (sku === "568-PVLC") return { sku: "568-PVLC", preco: 37.70, nome: "Kit 15 Panos" };
    if (sku === "569-PVLC") return { sku: "569-PVLC", preco: 49.50, nome: "Kit 20 Panos" };
    return { sku: skuOriginal, preco: 0.00, nome: "Outros" };
  };

  // --- MAPEAMENTO DE ESTADOS ---
  const getUF = (estado: string) => {
    if (!estado) return "";
    const cleanState = estado.trim();
    const map: Record<string, string> = {
      "Acre": "AC", "Amapa": "AP", "Amapá": "AP", "Amazonas": "AM", "Para": "PA", "Pará": "PA",
      "Rondonia": "RO", "Rondônia": "RO", "Roraima": "RR", "Tocantins": "TO",
      "Alagoas": "AL", "Bahia": "BA", "Ceara": "CE", "Ceará": "CE", "Maranhao": "MA", "Maranhão": "MA",
      "Paraiba": "PB", "Paraíba": "PB", "Pernambuco": "PE", "Piaui": "PI", "Piauí": "PI",
      "Rio Grande do Norte": "RN", "Sergipe": "SE",
      "Distrito Federal": "DF", "Goias": "GO", "Goiás": "GO", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
      "Espirito Santo": "ES", "Espírito Santo": "ES", "Minas Gerais": "MG", "Rio de Janeiro": "RJ",
      "Sao Paulo": "SP", "São Paulo": "SP",
      "Parana": "PR", "Paraná": "PR", "Rio Grande do Sul": "RS", "Santa Catarina": "SC"
    };
    return map[cleanState] || cleanState.substring(0, 2).toUpperCase();
  };

  // --- INTEGRAÇÃO FRENET ---
  const cotarFretes = async () => {
    if (jsonObject.length === 0) return;
    setQuoting(true);
    setError('');
    const novosDados = [...jsonObject];
    let processados = 0;

    for (let i = 0; i < novosDados.length; i++) {
        const item = novosDados[i];
        const { nome, preco } = getProdutoBling(item.sku);
        const medidas = MEDIDAS_KITS[nome] || MEDIDAS_KITS["Outros"];
        
        // Correção para ler números do Excel corretamente
        let qtd = 1;
        if(typeof item.quantidade === 'string') qtd = parseFloat(item.quantidade.replace(',', '.'));
        else if(typeof item.quantidade === 'number') qtd = item.quantidade;

        const valorNota = preco * qtd;
        const cepDestino = item.entrega_cep.replace(/\D/g, '');

        if (cepDestino.length !== 8) {
            processados++;
            setQuoteProgress(Math.round((processados / novosDados.length) * 100));
            continue;
        }

        const itemsFrenet = [{
            Weight: medidas.weight,
            Length: medidas.length,
            Height: medidas.height,
            Width: medidas.width,
            Quantity: qtd,
            SKU: item.sku
        }];

        try {
            const res = await fetch('/api/frenet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientCEP: cepDestino,
                    items: itemsFrenet,
                    invoiceValue: valorNota
                })
            });

            const data = await res.json();
            if (data.ShippingSevicesArray && data.ShippingSevicesArray.length > 0) {
                const opcoesValidas = data.ShippingSevicesArray.filter((s: any) => !s.Error);
                opcoesValidas.sort((a: any, b: any) => parseFloat(a.ShippingPrice) - parseFloat(b.ShippingPrice));
                novosDados[i].opcoes_frete = opcoesValidas;
                if (opcoesValidas.length > 0) {
                    novosDados[i].frete_selecionado = opcoesValidas[0];
                }
            }
        } catch (err) {
            console.error("Erro cotação", err);
        }
        processados++;
        setQuoteProgress(Math.round((processados / novosDados.length) * 100));
        await new Promise(r => setTimeout(r, 100)); 
    }
    setJsonObject(novosDados);
    setQuoting(false);
    setFreteCalculado(true);
  };

  // --- MUDANÇA MANUAL DE FRETE ---
  const handleTrocaFrete = (indexPedido: number, indexOpcao: number) => {
    const novosDados = [...jsonObject];
    const novaOpcao = novosDados[indexPedido].opcoes_frete[indexOpcao];
    novosDados[indexPedido].frete_selecionado = novaOpcao;
    setJsonObject(novosDados);
  };

  // --- ESTATÍSTICAS ---
  const stats = useMemo(() => {
    if (!jsonObject.length) return { totalPedidos: 0, valorProdutos: 0, valorFrete: 0, valorTotal: 0, kits: {} as Record<string, number> };

    let somaProdutos = 0;
    let somaFrete = 0;
    let somaTotal = 0;
    const kitsCount: Record<string, number> = { "Kit 5 Panos": 0, "Kit 10 Panos": 0, "Kit 15 Panos": 0, "Kit 20 Panos": 0, "Outros": 0 };

    jsonObject.forEach(item => {
      const { preco, nome } = getProdutoBling(item.sku);
      
      let qtd = 1;
      if(typeof item.quantidade === 'string') qtd = parseFloat(item.quantidade.replace(',', '.'));
      else if(typeof item.quantidade === 'number') qtd = item.quantidade;
      
      let frete = 0;
      if (item.frete_selecionado) {
          frete = parseFloat(item.frete_selecionado.ShippingPrice);
      } else {
          // Trata frete vindo do Excel (pode ser numero ou string com virgula)
          if(typeof item.total_frete === 'number') frete = item.total_frete;
          else frete = parseFloat(item.total_frete.toString().replace(',', '.') || "0");
      }
      
      let desconto = 0;
      if(typeof item.total_desconto === 'number') desconto = item.total_desconto;
      else desconto = parseFloat(item.total_desconto.toString().replace(',', '.') || "0");
      
      const totalProdutosItem = (preco * qtd);
      somaProdutos += totalProdutosItem;
      somaFrete += frete;
      const totalItem = totalProdutosItem + frete - desconto;
      somaTotal += totalItem;

      if (kitsCount[nome] !== undefined) kitsCount[nome] += qtd;
      else kitsCount["Outros"] += qtd;
    });

    return { totalPedidos: jsonObject.length, valorProdutos: somaProdutos, valorFrete: somaFrete, valorTotal: somaTotal, kits: kitsCount };
  }, [jsonObject]);

  // --- GERAÇÃO XLS ---
  const gerarXlsBling = () => {
    if (!jsonObject.length) return;
    const hoje = new Date();
    const dataPrevistaObj = new Date(hoje);
    dataPrevistaObj.setDate(hoje.getDate() + 5);
    const dataPrevistaStr = dataPrevistaObj.toLocaleDateString('pt-BR');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const dataArquivo = `${dia}-${mes}-${ano}`;
    const nomeFinal = `Importacao_Bling_${dataArquivo}_${jsonObject.length}_pedidos.xls`;

    const dadosBling = jsonObject.map(item => {
      const { sku, preco } = getProdutoBling(item.sku);
      
      let qtd = 1;
      if(typeof item.quantidade === 'string') qtd = parseFloat(item.quantidade.replace(',', '.'));
      else if(typeof item.quantidade === 'number') qtd = item.quantidade;

      let desconto = 0;
      if(typeof item.total_desconto === 'number') desconto = item.total_desconto;
      else desconto = parseFloat(item.total_desconto.toString().replace(',', '.') || "0");
      
      let freteFinal = 0;
      let transportadoraFinal = item.entrega; 

      if (item.frete_selecionado) {
          freteFinal = parseFloat(item.frete_selecionado.ShippingPrice);
          transportadoraFinal = `${item.frete_selecionado.Carrier} (${item.frete_selecionado.ServiceDescription})`;
      } else {
          if(typeof item.total_frete === 'number') freteFinal = item.total_frete;
          else freteFinal = parseFloat(item.total_frete.toString().replace(',', '.') || "0");
      }
      
      const valorTotalLinha = preco * qtd; 
      const totalPedido = valorTotalLinha + freteFinal - desconto; 
      const uf = getUF(item.entrega_estado);
      const dataVenda = item.data ? item.data.split(' ')[0] : "";

      return {
        "Nr Pedido": item.id,
        "Nome Comprador": item.cliente,
        "Data da Venda": dataVenda,
        "CPF/CNPJ Comprador": item.cliente_document,
        "Endereço Comprador": item.entrega_rua,
        "Bairro Comprador": item.entrega_bairro,
        "Número Comprador": item.entrega_numero,
        "Complemento Comprador": item.entrega_complemento,
        "CEP Comprador": item.entrega_cep,
        "Cidade Comprador": item.entrega_cidade,
        "UF Comprador": uf,
        "Telefone Comprador": item.cliente_telefone,
        "Celular Comprador": item.cliente_telefone,
        "E-mail Comprador": item.cliente_email,
        "Produto": item.produto,
        "SKU": sku,
        "Un": "KIT",
        "Quantidade": qtd,
        "Valor Unitário": preco,      
        "Valor Total": valorTotalLinha, 
        "Total Pedido": totalPedido,    
        "Valor Frete Pedido": freteFinal,
        "Valor Desconto Pedido": desconto,
        "Nome Entrega": item.cliente,
        "Endereço Entrega": item.entrega_rua,
        "Número Entrega": item.entrega_numero,
        "Complemento Entrega": item.entrega_complemento,
        "Cidade Entrega": item.entrega_cidade,
        "UF Entrega": uf,
        "CEP Entrega": item.entrega_cep,
        "Bairro Entrega": item.entrega_bairro,
        "Trasportadora": transportadoraFinal,
        "Serviço": "",
        "Tipo Frete": "R",
        "Observações": item.frete_selecionado ? "Frete Recalculado via Frenet" : "",
        "Método Pagamento": item.pagamento,
        "Qtd Parcela": item.parcelamento,
        "Data Prevista": dataPrevistaStr,
        "Vendedor": "",
        "Forma Pagamento": item.pagamento
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosBling);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Importacao Bling");
    XLSX.writeFile(workbook, nomeFinal, { bookType: 'xls' });
  };

  const downloadJson = () => {
    if (!jsonOutput) return;
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_dados.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyToClipboard = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleTheme = () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // --- VARIAVEIS DE ESTILO ---
  const bgMain = darkMode ? "bg-gray-950" : "bg-gray-100";
  const textMain = darkMode ? "text-white" : "text-gray-900";
  const textMuted = darkMode ? "text-gray-400" : "text-gray-600";
  const cardBg = darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200 shadow-xl";
  const headerBg = darkMode ? "bg-gray-700/50 border-gray-700" : "bg-gray-50 border-gray-200";
  const dropZoneBg = darkMode 
    ? "bg-gray-800/50 hover:bg-gray-800 border-gray-600" 
    : "bg-gray-50 hover:bg-gray-100 border-gray-300";
  const tableHeaderBg = darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-700";
  const tableRowHover = darkMode ? "hover:bg-gray-700/30" : "hover:bg-gray-50";
  const inputBg = darkMode 
    ? "bg-gray-900 border-gray-600 text-white" 
    : "bg-white border-gray-300 text-gray-900";

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 10px; background: white; color: black; }
          .no-print { display: none !important; }
        }
        .print-only { display: none; }
        @media print { .print-only { display: block; } }
      `}</style>

      {/* ÁREA DE IMPRESSÃO */}
      <div id="print-section" className="print-only">
        <h2 style={{textAlign: 'center', fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid black', paddingBottom: '5px'}}>
          RELATÓRIO DE SEPARAÇÃO
        </h2>
        <div style={{marginTop: '10px', fontSize: '12px', marginBottom: '15px'}}>
          <p><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
          <p><strong>Total de Pedidos:</strong> {stats.totalPedidos}</p>
        </div>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
          <thead>
            <tr style={{borderBottom: '1px solid black'}}>
              <th style={{textAlign: 'left', padding: '5px'}}>KIT / PRODUTO</th>
              <th style={{textAlign: 'right', padding: '5px'}}>QTD</th>
            </tr>
          </thead>
          <tbody>
             {Object.entries(stats.kits).map(([kit, qtd]) => (
                qtd > 0 && (
                  <tr key={kit} style={{borderBottom: '1px solid #ddd'}}>
                    <td style={{padding: '8px 5px'}}>{kit}</td>
                    <td style={{textAlign: 'right', padding: '8px 5px', fontWeight: 'bold', fontSize: '16px'}}>{qtd}</td>
                  </tr>
                )
             ))}
          </tbody>
        </table>
        <div style={{marginTop: '20px', textAlign: 'center', borderTop: '2px solid black', paddingTop: '10px', fontSize: '16px', fontWeight: 'bold'}}>
           TOTAL DE ITENS: {Object.values(stats.kits).reduce((a, b) => a + b, 0)}
        </div>
      </div>

      {/* INTERFACE DO USUÁRIO */}
      <div className={`min-h-screen flex flex-col items-center justify-start p-6 font-sans no-print transition-colors duration-300 ${bgMain} ${textMain}`}>
        
        {/* THEME TOGGLE */}
        <div className="absolute top-6 right-6 z-50">
           <button onClick={toggleTheme} className={`p-3 rounded-full transition-all shadow-lg ${darkMode ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' : 'bg-gray-800 text-yellow-400 hover:bg-gray-700'}`}>
             {darkMode ? (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
             ) : (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
             )}
           </button>
        </div>

        <div className={`max-w-7xl w-full p-8 rounded-2xl border transition-colors duration-300 ${cardBg}`}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Yampi2Bling</h1>
            <p className={`${textMuted}`}>Importação XLSX ➔ Cotação Frenet ➔ Exportação Bling</p>
          </div>

          <div className="mb-6">
            <label className={`group relative flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${dropZoneBg}`}>
              <div className="flex flex-col items-center justify-center pt-2 pb-2">
                <span className="text-2xl mb-1">📂</span>
                <p className={`text-sm ${textMuted}`}>{fileName ? `Arquivo: ${fileName}` : "Carregar Planilha Excel (.xlsx)"}</p>
              </div>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {error && <div className="p-4 mb-6 bg-red-900/30 text-red-300 rounded-lg text-center">🚨 {error}</div>}
          {loading && <p className="text-center text-blue-400 animate-pulse">Lendo planilha...</p>}

          {jsonOutput && !loading && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* DASHBOARD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className={`rounded-xl border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <h3 className={`${textMuted} text-xs uppercase font-bold mb-3 border-b border-gray-600/30 pb-2`}>Resumo Financeiro</h3>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className={`text-xs ${textMuted}`}>Produtos</p>
                          <p className={`text-lg font-bold ${textMain}`}>{stats.valorProdutos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                       </div>
                       <div className="text-right">
                          <p className={`text-xs ${textMuted}`}>Frete Total</p>
                          <p className={`text-lg font-bold ${textMain}`}>{stats.valorFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                       </div>
                       <div className="col-span-2 border-t pt-2 mt-1 border-gray-600/30">
                          <div className="flex justify-between items-end">
                             <div>
                                <p className={`text-xs ${textMuted}`}>Pedidos</p>
                                <p className={`text-sm font-bold ${textMain}`}>{stats.totalPedidos}</p>
                             </div>
                             <div className="text-right">
                                <p className={`text-xs ${textMuted}`}>Total Geral</p>
                                <p className="text-2xl font-bold text-green-500">{stats.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className={`rounded-xl border p-4 md:col-span-2 flex flex-col justify-between ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="flex justify-between items-center mb-2">
                       <h3 className={`${textMuted} text-xs uppercase font-bold`}>Separação (Picking)</h3>
                       <button onClick={handlePrint} className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">🖨️ Imprimir</button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                       {Object.entries(stats.kits).map(([kit, qtd]) => (
                          <div key={kit} className={`px-3 py-2 rounded-lg border flex-shrink-0 ${qtd > 0 ? (darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-blue-50 border-blue-200') : (darkMode ? 'bg-gray-800/30 border-gray-800 opacity-30' : 'bg-gray-50 border-gray-100 opacity-50')}`}>
                             <span className={`block text-xs ${textMuted}`}>{kit}</span>
                             <span className={`block text-lg font-bold ${textMain}`}>{qtd}</span>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* COTAÇÃO */}
              {!freteCalculado ? (
                <div className={`border p-8 rounded-xl text-center ${darkMode ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-100'}`}>
                   <h3 className="text-2xl font-bold text-indigo-500 mb-2">Cotação de Frete</h3>
                   <p className={`${textMuted} mb-6`}>Buscar melhores preços na Frenet.</p>
                   {!quoting ? (
                       <button onClick={cotarFretes} className="bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold py-3 px-8 rounded-lg shadow-lg hover:scale-105 transition-transform">🚀 Iniciar Cotação</button>
                   ) : (
                       <div className="max-w-md mx-auto">
                          <div className={`w-full rounded-full h-4 mb-2 overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                             <div className="bg-indigo-500 h-4 rounded-full transition-all" style={{ width: `${quoteProgress}%` }}></div>
                          </div>
                          <p className="text-indigo-400 animate-pulse">Cotando... {quoteProgress}%</p>
                       </div>
                   )}
                </div>
              ) : (
                <div className={`border rounded-xl overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-md'}`}>
                   <div className={`p-4 border-b flex justify-between items-center ${headerBg}`}>
                      <h3 className={`font-bold ${textMain} flex items-center gap-2`}>🚚 Gestão de Entregas</h3>
                      <span className="text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded border border-green-500/30">Cotação Finalizada</span>
                   </div>
                   <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                         <thead className={`text-xs uppercase sticky top-0 z-10 ${tableHeaderBg}`}>
                            <tr>
                               <th className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Pedido / Cliente</th>
                               <th className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Destino</th>
                               <th className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Frete Original</th>
                               <th className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} w-1/3`}>Seleção Frenet</th>
                            </tr>
                         </thead>
                         <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                            {jsonObject.map((item, idx) => (
                               <tr key={idx} className={`transition-colors ${tableRowHover}`}>
                                  <td className="p-4">
                                     <p className={`font-bold text-sm ${textMain}`}>{item.id}</p>
                                     <p className={`text-xs ${textMuted}`}>{item.cliente}</p>
                                     <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800">{getProdutoBling(item.sku).nome}</span>
                                  </td>
                                  <td className={`p-4 text-sm ${textMuted}`}>
                                     <p>{item.entrega_cidade} - {getUF(item.entrega_estado)}</p>
                                     <p className="text-xs opacity-75">{item.entrega_cep}</p>
                                  </td>
                                  <td className={`p-4 text-sm ${textMuted}`}>R$ {item.total_frete}<br/><span className="text-[10px] opacity-75">{item.entrega}</span></td>
                                  <td className="p-4">
                                     {item.opcoes_frete ? (
                                        <select 
                                           className={`w-full text-sm rounded-lg p-2.5 focus:ring-blue-500 ${inputBg}`}
                                           onChange={(e) => handleTrocaFrete(idx, parseInt(e.target.value))}
                                           value={item.opcoes_frete.findIndex((o: any) => o.ServiceDescription === item.frete_selecionado?.ServiceDescription)}
                                        >
                                           {item.opcoes_frete.map((op: any, i: number) => (
                                              <option key={i} value={i}>{op.Carrier} ({op.ServiceDescription}) - R$ {op.ShippingPrice} {i === 0 ? '⭐' : ''}</option>
                                           ))}
                                        </select>
                                     ) : <span className="text-red-500 text-xs font-bold">Erro na cotação</span>}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
              )}

              <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <button onClick={gerarXlsBling} disabled={!freteCalculado} className={`w-full mb-4 flex items-center justify-center gap-3 font-bold py-4 px-6 rounded-xl transition-all shadow-xl ${freteCalculado ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/30 border border-green-500' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    {freteCalculado ? 'Aprovar e Baixar Planilha Bling' : 'Cote os Fretes para Baixar'}
                </button>
                <div className="flex gap-4">
                  <button onClick={downloadJson} className={`flex-1 py-3 rounded-lg text-sm border transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'}`}>Baixar Backup JSON</button>
                  <button onClick={copyToClipboard} className={`flex-1 py-3 rounded-lg text-sm border transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'}`}>{copied ? "✅ Copiado!" : "📋 Copiar JSON"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}