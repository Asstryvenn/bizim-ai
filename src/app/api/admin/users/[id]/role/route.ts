import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminServiceClient, ForbiddenError, NotAuthenticatedError } from "@/lib/admin";

// [id] здесь — user_id (auth.users.id), не business_id.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdmin();
    const { id: targetUserId } = await params;
    const { role } = (await request.json()) as { role: "admin" | "user" };

    if (role !== "admin" && role !== "user") {
      return NextResponse.json({ error: "role должен быть 'admin' или 'user'" }, { status: 400 });
    }

    if (targetUserId === user.id && role === "user") {
      return NextResponse.json(
        { error: "Нельзя снять роль admin с самого себя через панель — попросите другого админа." },
        { status: 400 }
      );
    }

    const supabase = adminServiceClient();
    const { data, error } = await supabase
      .from("businesses")
      .update({ role })
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ business: data });
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
