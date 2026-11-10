// lib/getUser.js
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function getUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        return { username: payload.username, autho: payload.autho };
    } catch {
        return null;
    }
}