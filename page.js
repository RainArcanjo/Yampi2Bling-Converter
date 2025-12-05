"use client";
import { useState } from 'react';

export default function YampiConverter() {
  const [jsonOutput, setJsonOutput] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name.replace('.csv', ''));
    setLoading(true);
    setError('');
    setJsonOutput(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target.result;
        const jsonData = converterCsvParaJson(csvContent);
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

  // A Lógica de Conversão (A mesma que validamos)
  const converterCsvParaJson = (csv) => {
    const linhas = csv.trim().split('\n');

    // 1. Tratar Cabeçalho
    let cabecalhoRaw = linhas[0].trim();
    if (cabecalhoRaw.endsWith(';')) cabecalhoRaw = cabecalhoRaw.slice(0, -1);
    
    const headers = cabecalhoRaw.split(',');
    // INSERIR A COLUNA FALTANTE (A correção mágica)
    // Insere 'id_variante' na posição 14 (o 15º elemento)
    headers.splice(14, 0, "id_variante");

    const resultado = [];

    // 2. Processar Linhas
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      // O arquivo original separa blocos por ponto e vírgula
      const partes = linha.split(';');
      const partesLimpas = [];

      partes.forEach(p => {
        // Remove aspas externas se existirem e corrige aspas duplas ("" -> ")
        let limpo = p;
        if (limpo.startsWith('"') && limpo.endsWith('"')) {
          limpo = limpo.slice(1, -1);
        }
        limpo = limpo.replace(/""/g, '"');
        partesLimpas.push(limpo);
      });

      // Junta tudo como um CSV padrão (separado por vírgula)
      const linhaNormalizada = partesLimpas.join(',');

      // Regex para separar por vírgula APENAS se não estiver dentro de aspas
      // Ex: trata corretamente valores como "69,9"
      const regexCSV = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      
      const valores = linhaNormalizada.split(regexCSV).map(val => {
        // Remove aspas sobrando dos valores individuais
        return val.replace(/^"|"$/g, '').trim(); 
      });

      // Montar o Objeto JSON
      const obj = {};
      headers.forEach((header, index) => {
        // Se faltar dado no final, preenche com vazio
        obj[header] = valores[index] || "";
      });

      resultado.push(obj);
    }

    return resultado;
  };

  const downloadJson = () => {
    if (!jsonOutput) return;
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_corrigido.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
        <h1 className="text-3xl font-bold mb-2 text-center text-blue-400">
          Conversor Yampi ➔ JSON
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Corrija a planilha quebrada e baixe o JSON formatado automaticamente.
        </p>

        {/* Área de Upload */}
        <div className="mb-6">
          <label className="block w-full cursor-pointer bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-500 hover:border-blue-400 rounded-lg p-8 text-center transition-all">
            <span className="text-lg font-medium text-gray-300">
              📂 Clique para selecionar o arquivo CSV
            </span>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>

        {error && (
          <div className="p-4 mb-4 bg-red-900/50 text-red-200 rounded border border-red-700 text-center">
            {error}
          </div>
        )}

        {/* Exibição e Download */}
        {loading && <p className="text-center text-blue-300 animate-pulse">Processando arquivo...</p>}

        {jsonOutput && !loading && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between bg-gray-900 p-4 rounded border border-green-800">
              <span className="text-green-400 font-bold">✅ Sucesso!</span>
              <button
                onClick={downloadJson}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded transition-colors shadow-lg shadow-green-900/50"
              >
                Baixar JSON
              </button>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-1">Pré-visualização (primeiros registros):</p>
              <pre className="bg-black p-4 rounded text-xs text-green-300 overflow-auto max-h-60 border border-gray-800 font-mono">
                {jsonOutput}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}