import { NextResponse } from "next/server";
import { getUser } from "@/lib/getUser"
import { redis } from "@/lib/redis"

const ALLOWED = ["username", "email", "autho", "model_run_id","cluster_id","updated_at","created_at"];

export async function GET(req) {
    const user = await getUser();
    if(!user) return NextResponse.json({message:"Not Logged In"},{status:401})

    const field = new URL(req.url).searchParams.get("field");
    if(!ALLOWED.includes(field)){
        return NextResponse.json({message:"Unknown field"},{status:400})
    }

    try{
        const profile = await redis.get(`user:${user.username}`);
        if(!profile){
            return NextResponse.json({message:"Not cached"},{status:404})
        }
        return NextResponse.json({[field]: profile[field] ??null},{status:200});
    }
    catch(err){
        console.log("Redis read failed", err);
        return NextResponse.json({message:"Server error"},{status:500})
    }
}