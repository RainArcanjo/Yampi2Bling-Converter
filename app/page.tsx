"use client";
import { useState, ChangeEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

export default function YampiConverter() {
  const [jsonOutput, setJsonOutput] = useState<string | null>(null);
  const [jsonObject, setJsonObject] = useState<any[]>([]);
  // AQUI ESTÁ A VARIÁVEL (Note o N maiúsculo)
  const [fileName, setFileName] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // --- Lógica de Leitura do CSV ---
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Salva o nome do arquivo original (fileName)
    setFileName(file.name.replace('.csv', ''));
    setLoading(true);
    setError('');
    setJsonOutput(null);
    setJsonObject([]);
    setCopied(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target?.result as string;
        const jsonData = converterCsvParaJson(csvContent);
        setJsonObject(jsonData);
        setJsonOutput(JSON.stringify(jsonData, null, 4));
      } catch (err) {
        console.error(err);
        setError("Erro ao processar o arquivo. Verifique se é o CSV correto.");
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

  // --- Lógica de Negócio BLING ---

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

  const getProdutoBling = (nomeProduto: string) => {
    const nome = nomeProduto.toUpperCase();
    if (nome.includes("5PCS") || nome.includes("5 PCS")) return { sku: "566-PVLC", preco: 14.10, nome: "Kit 5 Panos" };
    if (nome.includes("10PCS") || nome.includes("10 PCS")) return { sku: "567-PVLC", preco: 25.90, nome: "Kit 10 Panos" };
    if (nome.includes("15PCS") || nome.includes("15 PCS")) return { sku: "568-PVLC", preco: 37.70, nome: "Kit 15 Panos" };
    if (nome.includes("20PCS") || nome.includes("20 PCS")) return { sku: "569-PVLC", preco: 49.50, nome: "Kit 20 Panos" };
    return { sku: "ERRO-SKU", preco: 0.00, nome: "Outros" };
  };

  const stats = useMemo(() => {
    if (!jsonObject.length) return { totalPedidos: 0, valorTotal: 0, kits: {} as Record<string, number> };

    let soma = 0;
    const kitsCount: Record<string, number> = {
      "Kit 5 Panos": 0,
      "Kit 10 Panos": 0,
      "Kit 15 Panos": 0,
      "Kit 20 Panos": 0,
      "Outros": 0
    };

    jsonObject.forEach(item => {
      const { preco, nome } = getProdutoBling(item.produto);
      const qtd = parseFloat(item.quantidade.replace(',', '.')) || 1;
      const frete = parseFloat(item.total_frete?.replace(',', '.') || "0");
      const desconto = parseFloat(item.total_desconto?.replace(',', '.') || "0");
      
      const totalItem = (preco * qtd) + frete - desconto;
      soma += totalItem;

      if (kitsCount[nome] !== undefined) {
        kitsCount[nome] += qtd;
      } else {
        kitsCount["Outros"] += qtd;
      }
    });

    return {
      totalPedidos: jsonObject.length,
      valorTotal: soma,
      kits: kitsCount
    };
  }, [jsonObject]);

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
    
    // Nome do arquivo usando Data + Quantidade Pedidos
    const nomeFinal = `Importacao_Bling_${dataArquivo}_${jsonObject.length}_pedidos.xls`;

    const dadosBling = jsonObject.map(item => {
      const { sku, preco } = getProdutoBling(item.produto);
      const qtd = parseFloat(item.quantidade.replace(',', '.')) || 1;
      const frete = parseFloat(item.total_frete?.replace(',', '.') || "0");
      const desconto = parseFloat(item.total_desconto?.replace(',', '.') || "0");
      const valorTotalLinha = preco * qtd; 
      const totalPedido = valorTotalLinha + frete - desconto; 
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
        "Valor Frete Pedido": frete,
        "Valor Desconto Pedido": desconto,
        "Nome Entrega": item.cliente,
        "Endereço Entrega": item.entrega_rua,
        "Número Entrega": item.entrega_numero,
        "Complemento Entrega": item.entrega_complemento,
        "Cidade Entrega": item.entrega_cidade,
        "UF Entrega": uf,
        "CEP Entrega": item.entrega_cep,
        "Bairro Entrega": item.entrega_bairro,
        "Trasportadora": item.entrega,
        "Serviço": "",
        "Tipo Frete": "R",
        "Observações": "",
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
    // Aqui usamos uma string fixa para o backup, para evitar erros
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

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
            background: white;
            color: black;
          }
          .no-print {
            display: none !important;
          }
        }
        .print-only {
          display: none;
        }
        @media print {
          .print-only {
            display: block;
          }
        }
      `}</style>

      {/* --- ÁREA DE IMPRESSÃO --- */}
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

      {/* --- INTERFACE DO USUÁRIO --- */}
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 font-sans no-print">
        <div className="max-w-5xl w-full bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-800">
          
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Conversor Yampi ➔ Bling
            </h1>
            <p className="text-gray-400">
              Gestão de Importação e Picking List
            </p>
          </div>

          <div className="mb-8">
            <label className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-800/50 hover:bg-gray-800 hover:border-blue-500 transition-all duration-300">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <span className="text-3xl mb-2">📂</span>
                {/* Aqui está o uso correto da variável fileName */}
                <p className="text-sm text-gray-400">
                  {fileName ? `Arquivo selecionado: ${fileName}` : "Arraste o CSV da Yampi aqui"}
                </p>
              </div>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {error && (
            <div className="p-4 mb-6 bg-red-900/30 text-red-300 rounded-lg border border-red-800/50 text-center text-sm font-medium">
              🚨 {error}
            </div>
          )}

          {loading && <p className="text-center text-blue-400 animate-pulse">Processando dados...</p>}

          {jsonOutput && !loading && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* BLOC 1: Resumo Financeiro */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-gray-700/50 p-4 border-b border-gray-700">
                    <h3 className="font-bold text-gray-200 flex items-center gap-2">
                      <span>💰</span> Resumo Financeiro
                    </h3>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-1">Total Pedidos</p>
                      <p className="text-3xl font-bold text-white">{stats.totalPedidos}</p>
                    </div>
                    <div className="text-center border-l border-gray-600">
                      <p className="text-gray-400 text-sm mb-1">Valor Total</p>
                      <p className="text-2xl font-bold text-green-400">
                        {stats.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* BLOCO 2: Picking List */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                  <div className="bg-gray-700/50 p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-gray-200 flex items-center gap-2">
                      <span>📦</span> Lista de Separação
                    </h3>
                    <button 
                      onClick={handlePrint}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                    >
                      🖨️ Imprimir
                    </button>
                  </div>
                  <div className="p-4 flex-1">
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(stats.kits).map(([kit, qtd]) => (
                            <div key={kit} className={`p-3 rounded-lg flex justify-between items-center border ${qtd > 0 ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-800/30 border-gray-800 opacity-40'}`}>
                                <span className="text-xs text-gray-300">{kit}</span>
                                <span className="text-lg font-bold text-white">{qtd}</span>
                            </div>
                        ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* BLOCO 3: Ações */}
              <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <button
                    onClick={gerarXlsBling}
                    className="w-full mb-4 flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.01] shadow-xl shadow-green-900/30 border border-green-500"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Baixar Planilha Excel (.xls)
                </button>

                <div className="flex gap-4">
                  <button onClick={downloadJson} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-lg text-sm border border-gray-600 transition-colors">
                    Baixar Backup JSON
                  </button>
                  <button onClick={copyToClipboard} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-lg text-sm border border-gray-600 transition-colors">
                    {copied ? "✅ Copiado!" : "📋 Copiar JSON"}
                  </button>
                </div>
              </div>

              {/* BLOCO 4: Preview JSON */}
              <div className="mt-8">
                 <details className="group">
                    <summary className="list-none flex items-center justify-between cursor-pointer bg-gray-800 p-4 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors">
                        <span className="text-sm font-medium text-gray-400 group-open:text-blue-400">
                           🔍 Ver Código JSON (Técnico)
                        </span>
                        <span className="transition group-open:rotate-180">
                            <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                        </span>
                    </summary>
                    <div className="text-gray-400 mt-2 group-open:animate-fadeIn">
                        <pre className="bg-black/80 p-4 rounded-lg text-xs text-green-400 overflow-auto max-h-60 border border-gray-800 font-mono scrollbar-thin scrollbar-thumb-gray-700">
                            {jsonOutput}
                        </pre>
                    </div>
                 </details>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}