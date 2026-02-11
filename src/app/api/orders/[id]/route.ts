import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderSchema } from "@/lib/schemas/order";
import {
  calculateOrderTotal,
  type DetailForCalc,
} from "@/lib/calc/order-total";
import type { PaymentMethod } from "@/lib/calc/payment-fee";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json(
      { error: "受注が見つかりません" },
      { status: 404 }
    );
  }

  const { data: details } = await supabase
    .from("order_details")
    .select("*")
    .eq("order_id", id)
    .order("line_number");

  return NextResponse.json({ order, details: details || [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 2. 既存受注の存在確認
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("id", id)
    .single();

  if (!existingOrder) {
    return NextResponse.json(
      { error: "受注が見つかりません" },
      { status: 404 }
    );
  }

  // CSV出力済みの場合は編集不可
  if (existingOrder.status === "CSV出力済み") {
    return NextResponse.json(
      { error: "CSV出力済みの受注は編集できません" },
      { status: 400 }
    );
  }

  // 3. リクエストボディをパース＆バリデーション
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です" },
      { status: 400 }
    );
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "バリデーションエラー",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // 4. 商品マスタから最新情報を取得
  const productCodes = data.details.map((d) => d.product_code);
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("*")
    .in("code", productCodes)
    .eq("is_active", true);

  if (prodError || !products) {
    return NextResponse.json(
      { error: "商品情報の取得に失敗しました" },
      { status: 500 }
    );
  }

  const productMap = new Map(products.map((p) => [p.code, p]));

  // 5. アプリ設定を取得
  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("key, value");

  const settingsMap = new Map(
    (settingsData || []).map((s) => [s.key, s.value])
  );
  const defaultShippingFee = parseInt(
    settingsMap.get("default_shipping_fee") || "880"
  );
  const freeShippingThreshold = parseInt(
    settingsMap.get("free_shipping_threshold") || "5000"
  );
  const earlyPriceDeadline = new Date(
    settingsMap.get("early_price_deadline") || "2025-11-28T23:59:59+09:00"
  );
  const isEarlyPrice = new Date() <= earlyPriceDeadline;

  // 6. サーバーサイドで単価を再決定
  const detailsForCalc: DetailForCalc[] = [];
  const enrichedDetails: Array<any> = [];

  for (let i = 0; i < data.details.length; i++) {
    const detail = data.details[i];
    const product = productMap.get(detail.product_code);

    if (!product) {
      return NextResponse.json(
        { error: `商品コード ${detail.product_code} が見つかりません` },
        { status: 400 }
      );
    }

    const unitPrice =
      isEarlyPrice && product.early_price
        ? product.early_price
        : product.regular_price;
    const lineTotal = unitPrice * detail.quantity;

    detailsForCalc.push({
      lineIndex: i,
      unitPrice,
      quantity: detail.quantity,
      deliveryPostalCode: detail.delivery_postal_code,
      deliveryAddress1: detail.delivery_address1,
      deliveryName: detail.delivery_name,
      isFreeShipping: product.is_free_shipping,
      noshiType: detail.noshi_type || null,
      wrappingType: detail.wrapping_type || null,
    });

    enrichedDetails.push({
      line_number: detail.line_number,
      product_code: detail.product_code,
      product_name: product.name,
      unit_price: unitPrice,
      quantity: detail.quantity,
      line_total: lineTotal,
      delivery_name: detail.delivery_name,
      delivery_name_kana: detail.delivery_name_kana || null,
      delivery_phone: detail.delivery_phone || null,
      delivery_postal_code: detail.delivery_postal_code,
      delivery_prefecture: detail.delivery_prefecture,
      delivery_address1: detail.delivery_address1,
      delivery_address2: detail.delivery_address2 || null,
      delivery_company: detail.delivery_company || null,
      delivery_department: detail.delivery_department || null,
      delivery_date: detail.delivery_date || null,
      delivery_time: detail.delivery_time || null,
      delivery_method: detail.delivery_method || null,
      delivery_memo: detail.delivery_memo || null,
      noshi_flag: !!detail.noshi_type,
      noshi_type: detail.noshi_type || null,
      noshi_position: detail.noshi_position || null,
      noshi_inscription: detail.noshi_inscription || null,
      noshi_inscription_custom: detail.noshi_inscription_custom || null,
      noshi_name: detail.noshi_name || null,
      wrapping_flag: !!detail.wrapping_type,
      wrapping_type: detail.wrapping_type || null,
      wrapping_fee: 0,
      shipping_fee: 0,
      message_card: detail.message_card || null,
      line_memo: detail.line_memo || null,
    });
  }

  // 7. サーバーサイドで金額再計算
  const calc = calculateOrderTotal(
    detailsForCalc,
    data.payment_method as PaymentMethod,
    data.discount,
    defaultShippingFee,
    freeShippingThreshold
  );

  if (calc.paymentFeeError) {
    return NextResponse.json(
      { error: calc.paymentFeeError },
      { status: 400 }
    );
  }

  for (let i = 0; i < enrichedDetails.length; i++) {
    enrichedDetails[i].shipping_fee = calc.shippingFees[i] ?? 0;
    enrichedDetails[i].wrapping_fee = calc.wrappingFees[i] ?? 0;
  }

  // 8. orders UPDATE
  const { error: orderError } = await adminClient
    .from("orders")
    .update({
      customer_code: data.customer_code || null,
      customer_name: data.customer_name,
      customer_name_kana: data.customer_name_kana || null,
      postal_code: data.postal_code,
      prefecture: data.prefecture,
      customer_address1: data.customer_address1,
      customer_address2: data.customer_address2 || null,
      customer_company: data.customer_company || null,
      customer_department: data.customer_department || null,
      customer_phone: data.customer_phone || null,
      customer_email: data.customer_email || null,
      payment_method: data.payment_method,
      subtotal: calc.subtotal,
      total_shipping_fee: calc.totalShippingFee,
      total_wrapping_fee: calc.totalWrappingFee,
      total_fee: calc.totalFee,
      discount: data.discount,
      total_amount: calc.totalAmount,
      order_memo: data.order_memo || null,
    })
    .eq("id", id);

  if (orderError) {
    return NextResponse.json(
      { error: `受注の更新に失敗しました: ${orderError.message}` },
      { status: 500 }
    );
  }

  // 9. order_details を全削除→再INSERT（明細差分管理は複雑すぎるため）
  const { error: deleteError } = await adminClient
    .from("order_details")
    .delete()
    .eq("order_id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: `明細の更新に失敗しました: ${deleteError.message}` },
      { status: 500 }
    );
  }

  const detailInserts = enrichedDetails.map((d: any) => ({
    order_id: id,
    ...d,
  }));

  const { error: insertError } = await adminClient
    .from("order_details")
    .insert(detailInserts);

  if (insertError) {
    return NextResponse.json(
      { error: `明細の登録に失敗しました: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: id,
    order_number: existingOrder.order_number,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .single();

  if (!order) {
    return NextResponse.json(
      { error: "受注が見つかりません" },
      { status: 404 }
    );
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("orders").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `削除に失敗しました: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
