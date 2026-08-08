import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, adminServiceClient, ForbiddenError, NotAuthenticatedError } from "@/lib/admin";

// [id] здесь — user_id (auth.users.id).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdmin();
    const { id: targetUserId } = await params;

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "Нельзя удалить самого себя из панели администратора." },
        { status: 400 }
      );
    }

    const supabase = adminServiceClient();
    // Каскадно удаляет businesses/imported_files/ai_analyses/chat_messages/growth_tools
    // через "on delete cascade" на user_id в схеме.
    const { error } = await supabase.auth.admin.deleteUser(targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
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
