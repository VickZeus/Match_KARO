import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getUser } from "@/lib/getUser";
import { supabase } from "@/lib/supabase";
import { redis } from "@/lib/redis";
import { assignCluster } from "@/lib/assignCluster";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const quizName = new URL(req.url).searchParams.get("quizName");
        if (!quizName) {
            return NextResponse.json({ error: "Missing quizName" }, { status: 400 });
        }
        const client = await clientPromise;
        const db = client.db("Match_Me_Quiz");
        const quiz = await db.collection("Questions").findOne({ quizName }, { projection: { "questions.correct": 0 } });

        if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        return NextResponse.json(quiz);
    } catch (err) {
        console.log(err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const user = await getUser();
        if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

        const { quizName, answers } = await req.json();
        if (!quizName || !answers) {
            return NextResponse.json({ error: "Missing quizName or answers" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("Match_Me_Quiz");
        const quiz = await db.collection("Questions").findOne({ quizName });
        if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

        const totalScore = quiz.questions.length;
        let correctCount = 0;
        for (const q of quiz.questions) {
            const userAnswer = answers[q.Question];
            if (userAnswer && userAnswer === q.correct) correctCount++;
        }
        const fraction = correctCount / totalScore;

        const { error } = await supabase
            .from("user_scores")
            .upsert(
                { username: user.username, quizname: quizName, score: fraction },
                { onConflict: "username,quizname" }
            );

        if (error) {
            console.log(error);
            return NextResponse.json({ error: "Failed to save score" }, { status: 500 });
        }

        try {
            await assignCluster(user.username);
        } catch (e) {
            console.log("assignCluster failed", e);
        }


        // Clear cached scores so the scores panel shows the new result
        try {
            await redis.del(`scores:${user.username}`);
        } catch (e) {
            console.log("Redis delete failed", e);
        }

        return NextResponse.json(
            { message: "Submitted", score: correctCount, totalScore, fraction },
            { status: 200 }
        );
    } catch (err) {
        console.log(err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}