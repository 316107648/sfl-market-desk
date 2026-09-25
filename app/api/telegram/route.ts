import { NextResponse } from "next/server";

type TelegramPayload =
  | { type: "test" }
  | {
      type: "price-alert";
      asset: string;
      price: number;
      target: number;
      direction: "above" | "below";
    };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildMessage(payload: TelegramPayload) {
  if (payload.type === "test") {
    return [
      "🌻 <b>Sunflower Market Pro</b>",
      "",
      "✅ Telegram conectado com sucesso.",
      "Os alertas de mercado estão prontos para uso.",
    ].join("\n");
  }

  const asset = escapeHtml(payload.asset.slice(0, 80));
  const directionLabel = payload.direction === "above" ? "acima" : "abaixo";
  const icon = payload.direction === "above" ? "📈" : "📉";

  return [
    `${icon} <b>Alerta de preço</b>`,
    "",
    `<b>${asset}</b> atingiu o preço configurado.`,
    `Preço atual: <b>${payload.price.toFixed(8)} FLOWER</b>`,
    `Alvo: ${directionLabel} de <b>${payload.target.toFixed(8)} FLOWER</b>`,
    "",
    "Abra o Sunflower Market Pro para analisar o ativo antes de tomar uma decisão.",
  ].join("\n");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
    ),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json(
          { ok: false, error: "Origem não permitida." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Origem inválida." },
        { status: 403 },
      );
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Telegram ainda não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no ambiente do servidor.",
      },
      { status: 503 },
    );
  }

  let payload: TelegramPayload;

  try {
    payload = (await request.json()) as TelegramPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload inválido." },
      { status: 400 },
    );
  }

  if (payload.type === "price-alert") {
    if (
      !payload.asset ||
      !isFiniteNumber(payload.price) ||
      !isFiniteNumber(payload.target) ||
      !["above", "below"].includes(payload.direction)
    ) {
      return NextResponse.json(
        { ok: false, error: "Dados do alerta inválidos." },
        { status: 400 },
      );
    }
  } else if (payload.type !== "test") {
    return NextResponse.json(
      { ok: false, error: "Tipo de mensagem não permitido." },
      { status: 400 },
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(payload),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };

  if (!response.ok || !data.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: data.description || "O Telegram recusou a mensagem.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
