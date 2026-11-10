// app/api/auth/issues/route.js
import { NextResponse } from "next/server";
import { getUser } from "@/lib/getUser";
import { supabase } from "@/lib/supabase.js";

export async function POST(req) {
    const user = await getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const heading = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (heading.length < 1 || heading.length > 120) {
        return NextResponse.json({ error: "Invalid heading" }, { status: 400 });
    }
    if (description.length < 20 || description.length > 5000) {
        return NextResponse.json({ error: "Invalid description" }, { status: 400 });
    }

    const { error } = await supabase.from("issue_table").insert({
        username: user.username,
        heading,
        description,
    });

    if (error) {
        console.error("Issue insert failed:", error.message);
        return NextResponse.json({ error: "Could not save issue" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}