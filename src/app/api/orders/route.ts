import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderSchema } from "@/lib/schemas/order";
import {
  calculateOrderTotal,
  type DetailForCalc,
} from "@/lib/calc/order-total";
import type { PaymentMethod } from "@/lib/calc/payment-fee";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // レート制限チェック
  const rateLimit = await checkRateLimit(request, "orders:get", 30, "minute");
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。" },
      { status: 429 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_datetime, customer_name, payment_method, total_amount, operator_name",
      { count: "exact" }
    )
    .order("order_datetime", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "データの取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ orders: data, total: count });
}

export async function POST(request: NextRequest) {
  // レート制限チェック（注文作成は厳しめに制限）
  const rateLimit = await checkRateLimit(request, "orders:create", 10, "minute");
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。" },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 2. リクエストボディをパース＆バリデーション
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

  // 3. 商品マスタから最新情報を取得
  const productCodes = data.details.map((d) => d.product_code);
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("*")
    .in("code", productCodes)
    .eq("is_active", true);

  if (prodError || !products) {
    console.error("Product fetch error:", prodError);
    return NextResponse.json(
      { error: "商品情報の取得に失敗しました" },
      { status: 500 }
    );
  }

  const productMap = new Map(products.map((p) => [p.code, p]));

  // 4. アプリ設定を取得
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

  // 5. サーバーサイドで単価を再決定＆在庫チェック
  const detailsForCalc: DetailForCalc[] = [];
  const enrichedDetails: Array<{
    line_number: number;
    product_code: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    is_free_shipping: boolean;
    delivery_name: string;
    delivery_name_kana: string | null;
    delivery_phone: string | null;
    delivery_postal_code: string;
    delivery_prefecture: string;
    delivery_address1: string;
    delivery_address2: string | null;
    delivery_company: string | null;
    delivery_department: string | null;
    delivery_date: string | null;
    delivery_time: string | null;
    delivery_method: string | null;
    delivery_memo: string | null;
    noshi_flag: boolean;
    noshi_type: string | null;
    noshi_position: string | null;
    noshi_inscription: string | null;
    noshi_inscription_custom: string | null;
    noshi_name: string | null;
    wrapping_flag: boolean;
    wrapping_type: string | null;
    wrapping_fee: number;
    shipping_fee: number;
    message_card: string | null;
    line_memo: string | null;
  }> = [];

  for (let i = 0; i < data.details.length; i++) {
    const detail = data.details[i];
    const product = productMap.get(detail.product_code);

    if (!product) {
      return NextResponse.json(
        { error: `商品コード ${detail.product_code} が見つかりません` },
        { status: 400 }
      );
    }

    // 在庫チェック
    if (
      product.stock_quantity !== null &&
      detail.quantity > product.stock_quantity
    ) {
      return NextResponse.json(
        {
          error: `商品 ${product.name} の在庫が不足しています（在庫: ${product.stock_quantity}、注文: ${detail.quantity}）`,
        },
        { status: 400 }
      );
    }

    // 単価はサーバーが決定（改ざん防止）
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
      is_free_shipping: product.is_free_shipping,
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
      wrapping_fee: 0, // 後で設定
      shipping_fee: 0, // 後で設定
      message_card: detail.message_card || null,
      line_memo: detail.line_memo || null,
    });
  }

  // 6. サーバーサイドで金額再計算
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

  // 送料・ラッピング料を各明細に反映
  for (let i = 0; i < enrichedDetails.length; i++) {
    enrichedDetails[i].shipping_fee = calc.shippingFees[i] ?? 0;
    enrichedDetails[i].wrapping_fee = calc.wrappingFees[i] ?? 0;
  }

  // 7. 受注番号採番
  const { data: orderNumber, error: numberError } = await adminClient.rpc(
    "generate_order_number"
  );
  if (numberError || !orderNumber) {
    return NextResponse.json(
      { error: "受注番号の採番に失敗しました" },
      { status: 500 }
    );
  }

  // 8. トランザクション INSERT (orders + order_details)
  // Supabase JS では明示的トランザクションがないため、
  // orders を先にINSERT → 成功したら order_details をINSERT
  const { data: orderRow, error: orderError } = await adminClient
    .from("orders")
    .insert({
      order_number: orderNumber,
      operator_name: body.operator_name,
      operator_email: body.operator_email,
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
      created_by: user.id,
    })
    .select("id, order_number")
    .single();

  if (orderError || !orderRow) {
    console.error("Order creation error:", orderError);
    return NextResponse.json(
      { error: "受注の登録に失敗しました" },
      { status: 500 }
    );
  }

  // order_details INSERT
  const detailInserts = enrichedDetails.map((d) => ({
    order_id: orderRow.id,
    ...d,
  }));

  // is_free_shipping はorder_detailsテーブルに存在しないので除外
  const cleanedInserts = detailInserts.map(
    ({ is_free_shipping, ...rest }) => rest
  );

  const { error: detailsError } = await adminClient
    .from("order_details")
    .insert(cleanedInserts);

  if (detailsError) {
    console.error("Order details error:", detailsError);
    // 明細INSERT失敗時はorderも削除（簡易ロールバック）
    await adminClient.from("orders").delete().eq("id", orderRow.id);
    return NextResponse.json(
      { error: "明細の登録に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { id: orderRow.id, order_number: orderRow.order_number },
    { status: 201 }
  );
}
