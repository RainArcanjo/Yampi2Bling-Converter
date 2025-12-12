import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { recipientCEP, items, invoiceValue } = await request.json();
    const token = process.env.FRENET_TOKEN;

    if (!token) {
      return NextResponse.json({ error: 'Token não configurado' }, { status: 500 });
    }

    // URL de Cotação da Frenet
    const url = 'https://api.frenet.com.br/shipping/quote';

    const payload = {
      SellerCEP: "07251000", // Seu CEP fixo
      RecipientCEP: recipientCEP,
      ShipmentInvoiceValue: invoiceValue,
      ShippingItemArray: items, // Array com peso e medidas
      RecipientCountry: "BR"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        return NextResponse.json({ error: 'Erro Frenet', details: data }, { status: response.status });
    }

    // Retorna as cotações encontradas
    return NextResponse.json(data);

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}