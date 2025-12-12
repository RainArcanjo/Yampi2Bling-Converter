"use client";
import { useState, ChangeEvent, useMemo } from 'react';
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
  
  // NOVO: Estado do Tema (Começa como true = Escuro)
  const [darkMode, setDarkMode] = useState(true);

  // --- LEITURA DO ARQUIVO ---
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace('.csv', ''));
    setLoading(true);
    setError('');
    setJsonOutput(null);
    setJsonObject([]);
    setQuoteProgress(0);
    setFreteCalculado(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target?.result as string;
        const jsonData = converterCsvParaJson(csvContent);
        setJsonObject(jsonData);
        setJsonOutput(JSON.stringify(jsonData, null, 4));
      } catch (err) {
        console.error(err);
        setError("Erro ao processar o arquivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const converterCsvParaJson = (csv: string) => {
    const linhas = csv.trim().split('\n');
    let cabecalhoRaw = linhas[0].trim();
    if (cabecalhoRaw.endsWith(';')) cabecalhoRaw = cabecalhoRaw.slice(0, -1);
    const headers = cabecalhoRaw.split(',');
    headers.splice(14, 0, "id_variante");

    const resultado: any[] = [];
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;
      const partes = linha.split(';');
      const partesLimpas: string[] = [];
      partes.forEach(p => {
        let limpo = p;
        if (limpo.startsWith('"') && limpo.endsWith('"')) limpo = limpo.slice(1, -1);
        limpo = limpo.replace(/""/g, '"');
        partesLimpas.push(limpo);
      });
      const linhaNormalizada = partesLimpas.join(',');
      const regexCSV = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const valores = linhaNormalizada.split(regexCSV).map(val => val.replace(/^"|"$/g, '').trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = valores[index] || "";
      });
      resultado.push(obj);
    }
    return resultado;
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

  const getUF = (estado: string) => {
    const map: Record<string, string> = {
      "Sao Paulo": "SP", "São Paulo": "SP", "Rio de Janeiro": "RJ", "Minas Gerais": "MG",
      "Espirito Santo": "ES", "Espírito Santo": "ES", "Rio Grande do Sul": "RS",
      "Parana": "PR", "Paraná": "PR", "Santa Catarina": "SC", "Bahia": "BA",
      "Distrito Federal": "DF", "Goias": "GO", "Goiás": "GO", "Ceara": "CE", "Ceará": "CE",
      "Pernambuco": "PE", "Amazonas": "AM"
    };
    return map[estado] || estado.substring(0, 2).toUpperCase();
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
        const qtd = parseFloat(item.quantidade.replace(',', '.')) || 1;
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
                
                // Ordenar por preço
                opcoesValidas.sort((a: any, b: any) => parseFloat(a.ShippingPrice) - parseFloat(b.ShippingPrice));
                
                // Salvar TODAS as opções no objeto
                novosDados[i].opcoes_frete = opcoesValidas;
                
                // Pré-selecionar o mais barato
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
    if (!jsonObject.length) return { totalPedidos: 0, valorTotal: 0, kits: {} as Record<string, number> };

    let soma = 0;
    const kitsCount: Record<string, number> = {
      "Kit 5 Panos": 0, "Kit 10 Panos": 0, "Kit 15 Panos": 0, "Kit 20 Panos": 0, "Outros": 0
    };

    jsonObject.forEach(item => {
      const { preco, nome } = getProdutoBling(item.sku);
      const qtd = parseFloat(item.quantidade.replace(',', '.')) || 1;
      
      let frete = 0;
      if (item.frete_selecionado) {
          frete = parseFloat(item.frete_selecionado.ShippingPrice);
      } else {
          frete = parseFloat(item.total_frete?.replace(',', '.') || "0");
      }
      
      const desconto = parseFloat(item.total_desconto?.replace(',', '.') || "0");
      const totalItem = (preco * qtd) + frete - desconto;
      soma += totalItem;

      if (kitsCount[nome] !== undefined) kitsCount[nome] += qtd;
      else kitsCount["Outros"] += qtd;
    });

    return {
      totalPedidos: jsonObject.length,
      valorTotal: soma,
      kits: kitsCount
    };
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
      const qtd = parseFloat(item.quantidade.replace(',', '.')) || 1;
      const desconto = parseFloat(item.total_desconto?.replace(',', '.') || "0");
      
      let freteFinal = 0;
      let transportadoraFinal = item.entrega; 

      if (item.frete_selecionado) {
          freteFinal = parseFloat(item.frete_selecionado.ShippingPrice);
          transportadoraFinal = `${item.frete_selecionado.Carrier} (${item.frete_selecionado.ServiceDescription})`;
      } else {
          freteFinal = parseFloat(item.total_frete?.replace(',', '.') || "0");
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

  const toggleTheme = () => setDarkMode(!darkMode);

  // --- VARIAVEIS DE ESTILO (THEME) ---
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

      {/* ÁREA DE IMPRESSÃO (Picking List) */}
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
        
        {/* BOTÃO THEME TOGGLE */}
        <div className="absolute top-6 right-6 z-50">
           <button 
             onClick={toggleTheme} 
             className={`p-3 rounded-full transition-all shadow-lg ${darkMode ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' : 'bg-gray-800 text-yellow-400 hover:bg-gray-700'}`}
             title="Mudar Tema"
           >
             {darkMode ? (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
             ) : (
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
             )}
           </button>
        </div>

        <div className={`max-w-7xl w-full p-8 rounded-2xl border transition-colors duration-300 ${cardBg}`}>
          
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              Yampi2Bling
            </h1>
            <p className={`${textMuted}`}>Importação Yampi ➔ Cotação Frenet ➔ Exportação Bling</p>
          </div>

          <div className="mb-6">
            <label className={`group relative flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${dropZoneBg}`}>
              <div className="flex flex-col items-center justify-center pt-2 pb-2">
                <span className="text-2xl mb-1">📂</span>
                <p className={`text-sm ${textMuted}`}>{fileName ? `Arquivo: ${fileName}` : "Carregar CSV da Yampi"}</p>
              </div>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {error && <div className="p-4 mb-6 bg-red-900/30 text-red-300 rounded-lg text-center">🚨 {error}</div>}
          {loading && <p className="text-center text-blue-400 animate-pulse">Lendo arquivo...</p>}

          {jsonOutput && !loading && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* ESTATÍSTICAS NO TOPO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Card Financeiro */}
                 <div className={`rounded-xl border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <h3 className={`${textMuted} text-xs uppercase font-bold mb-2`}>Resumo do Pedido</h3>
                    <div className="flex justify-between items-end">
                       <div>
                          <p className={`text-3xl font-bold ${textMain}`}>{stats.totalPedidos}</p>
                          <p className={`text-xs ${textMuted}`}>Pedidos</p>
                       </div>
                       <div className="text-right">
                          <p className="text-2xl font-bold text-green-500">
                             {stats.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className={`text-xs ${textMuted}`}>Total (c/ Frete)</p>
                       </div>
                    </div>
                 </div>

                 {/* Card Picking List */}
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

              {/* ÁREA DE COTAÇÃO FRENET */}
              {!freteCalculado ? (
                <div className={`border p-8 rounded-xl text-center ${darkMode ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-100'}`}>
                   <h3 className="text-2xl font-bold text-indigo-500 mb-2">Cotação de Frete</h3>
                   <p className={`${textMuted} mb-6`}>O sistema irá conectar com a Frenet para buscar os melhores preços para cada cliente.</p>
                   
                   {!quoting ? (
                       <button onClick={cotarFretes} className="bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/30 transition-transform transform hover:scale-105">
                           🚀 Iniciar Cotação Automática
                       </button>
                   ) : (
                       <div className="max-w-md mx-auto">
                          <div className={`w-full rounded-full h-4 mb-2 overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                             <div className="bg-indigo-500 h-4 rounded-full transition-all duration-300" style={{ width: `${quoteProgress}%` }}></div>
                          </div>
                          <p className="text-indigo-400 animate-pulse">Consultando transportadoras... {quoteProgress}%</p>
                       </div>
                   )}
                </div>
              ) : (
                /* TABELA DE GESTÃO DE FRETES */
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
                               <th className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Frete Yampi (Orig.)</th>
                               <th className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} w-1/3`}>Selecione o Frete (Frenet)</th>
                            </tr>
                         </thead>
                         <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                            {jsonObject.map((item, idx) => (
                               <tr key={idx} className={`transition-colors ${tableRowHover}`}>
                                  <td className="p-4">
                                     <p className={`font-bold text-sm ${textMain}`}>{item.id}</p>
                                     <p className={`text-xs ${textMuted}`}>{item.cliente}</p>
                                     <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800">
                                        {getProdutoBling(item.sku).nome}
                                     </span>
                                  </td>
                                  <td className={`p-4 text-sm ${textMuted}`}>
                                     <p>{item.entrega_cidade} - {getUF(item.entrega_estado)}</p>
                                     <p className="text-xs opacity-75">{item.entrega_cep}</p>
                                  </td>
                                  <td className={`p-4 text-sm ${textMuted}`}>
                                     R$ {item.total_frete}
                                     <br/><span className="text-[10px] opacity-75">{item.entrega}</span>
                                  </td>
                                  <td className="p-4">
                                     {item.opcoes_frete ? (
                                        <select 
                                           className={`w-full text-sm rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
                                           onChange={(e) => handleTrocaFrete(idx, parseInt(e.target.value))}
                                           value={item.opcoes_frete.findIndex((o: any) => o.ServiceDescription === item.frete_selecionado?.ServiceDescription)}
                                        >
                                           {item.opcoes_frete.map((op: any, i: number) => (
                                              <option key={i} value={i}>
                                                 {op.Carrier} ({op.ServiceDescription}) - R$ {op.ShippingPrice} {i === 0 ? '⭐ (Melhor)' : ''}
                                              </option>
                                           ))}
                                        </select>
                                     ) : (
                                        <span className="text-red-500 text-xs font-bold">Erro na cotação</span>
                                     )}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
              )}

              {/* BOTÕES DE AÇÃO FINAL */}
              <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <button
                    onClick={gerarXlsBling}
                    disabled={!freteCalculado}
                    className={`w-full mb-4 flex items-center justify-center gap-3 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.01] shadow-xl ${freteCalculado ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/30 border border-green-500' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    {freteCalculado ? 'Aprovar e Baixar Planilha Bling' : 'Cote os Fretes para Baixar'}
                </button>

                <div className="flex gap-4">
                  <button onClick={downloadJson} className={`flex-1 py-3 rounded-lg text-sm border transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'}`}>
                    Baixar Backup JSON
                  </button>
                  <button onClick={copyToClipboard} className={`flex-1 py-3 rounded-lg text-sm border transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'}`}>
                    {copied ? "✅ Copiado!" : "📋 Copiar JSON"}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}