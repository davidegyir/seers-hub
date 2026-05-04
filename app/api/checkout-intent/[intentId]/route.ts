import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const allowedOrigins = [
  "https://www.seersapp.com",
  "https://seersapp.com",
  "https://portal.seersapp.com",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : "https://portal.seersapp.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ intentId: string }> }
) {
  const origin = req.headers.get("origin");

  try {
    const { intentId } = await context.params;

    if (!intentId) {
      return NextResponse.json(
        { error: "Missing intent ID" },
        {
          status: 400,
          headers: getCorsHeaders(origin),
        }
      );
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        mobile,
        email,
        product_slug,
        source,
        status,
        expires_at
      FROM checkout_intents
      WHERE id = $1
      LIMIT 1
      `,
      [intentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Checkout intent not found" },
        {
          status: 404,
          headers: getCorsHeaders(origin),
        }
      );
    }

    const intent = result.rows[0];

    const now = new Date();
    const expiresAt = new Date(intent.expires_at);

    if (expiresAt < now) {
      return NextResponse.json(
        { error: "Checkout intent expired" },
        {
          status: 410,
          headers: getCorsHeaders(origin),
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        intent: {
          id: intent.id,
          name: intent.full_name,
          mobile: intent.mobile,
          email: intent.email,
          product: intent.product_slug,
          source: intent.source,
          status: intent.status,
        },
      },
      {
        headers: getCorsHeaders(origin),
      }
    );
  } catch (error) {
    console.error("Read Checkout Intent Error:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      {
        status: 500,
        headers: getCorsHeaders(origin),
      }
    );
  }
}