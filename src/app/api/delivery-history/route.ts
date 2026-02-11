import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const customerCode = searchParams.get("customer_code") || "";

  if (!customerCode) {
    return NextResponse.json({ deliveries: [] });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("delivery_history")
    .select("*")
    .eq("customer_code", customerCode)
    .order("id", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deliveries: data || [] });
}
