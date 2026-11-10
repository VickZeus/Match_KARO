"use client";

import { useState } from "react";
import Footer from "@/components/Footer";

export default function ReportIssuePage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("idle"); // idle | sending | success | error | unauthorized

    async function handleSubmit(e) {
        e.preventDefault();
        setStatus("sending");

        try {
            const res = await fetch("/api/auth/issues", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description }),
            });

            if (res.status === 401) {
                setStatus("unauthorized");
                return;
            }
            if (!res.ok) throw new Error("Request failed");

            setTitle("");
            setDescription("");
            setStatus("success");
        } catch {
            setStatus("error");
        }
    }

    return (
        <div className="pix text-[6px] flex min-h-screen flex-col items-center bg-black text-white">
            <div className="pix text-[15px] flex h-20 w-full items-center justify-center border-b border-gray-700 bg-black">
                Report An Issue
            </div>

            <div className="w-full flex-1 bg-black px-4 py-8">
                <form
                    onSubmit={handleSubmit}
                    className="mx-auto flex w-full max-w-2xl flex-col gap-4 justify-center"
                >
                    <p className="pix text-[6px] leading-relaxed text-gray-300">
                        Every issue you report helps us grow, and we're glad you chose
                        to tell us about it. Thank you for helping make MatchKaro better!
                    </p>

                    <input
                        type="text"
                        required
                        maxLength={120}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Issue heading"
                        className="pix text-[6px] rounded-md border border-gray-600 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-white"
                    />

                    <textarea
                        required
                        minLength={20}
                        maxLength={5000}
                        rows={10}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the issue in detail. Do include any relevant information, steps to reproduce the issue, and any other details that may help us understand and resolve the problem."
                        className="pix text-[6px] resize-y rounded-md border border-gray-600 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-white"
                    />

                    <button
                        type="submit"
                        disabled={status === "sending"}
                        className="pix text-[6px] self-center rounded-md bg-white px-6 py-2 text-black hover:bg-gray-300 disabled:opacity-50"
                    >
                        {status === "sending" ? "Sending..." : "Submit"}
                    </button>

                    {status === "success" && (
                        <p className="pix text-[6px] border border-white px-3 py-2 text-white">
                            Thanks! Your report has been submitted.
                        </p>
                    )}
                    {status === "unauthorized" && (
                        <p className="pix text-[6px] border border-dashed border-gray-400 px-3 py-2 text-gray-300">
                            Please log in to report an issue.
                        </p>
                    )}
                    {status === "error" && (
                        <p className="pix text-[6px] border border-dashed border-gray-400 px-3 py-2 text-gray-300">
                            Something went wrong. Please try again.
                        </p>
                    )}
                </form>
            </div>

            <Footer />
        </div>
    );
}