import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const allowedOrigins = [
  "https://www.seersapp.com",
  "https://seersapp.com",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin && allowedOrigins.includes(origin)
      ? origin
      : "https://www.seersapp.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();
    const { email, product, source } = body;

    if (!email || !product) {
      return NextResponse.json(
        { error: "Missing email or product" },
        {
          status: 400,
          headers: getCorsHeaders(origin),
        }
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const result = await pool.query(
      `
      INSERT INTO checkout_intents (email, product_slug, source, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [email, product, source || null, expiresAt]
    );

    return NextResponse.json(
      {
        success: true,
        intentId: result.rows[0].id,
      },
      {
        headers: getCorsHeaders(origin),
      }
    );
  } catch (error) {
    console.error("Checkout Intent Error:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      {
        status: 500,
        headers: getCorsHeaders(origin),
      }
    );
  }
}