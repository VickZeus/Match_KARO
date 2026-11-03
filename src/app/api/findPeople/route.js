import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/getUser";

export async function GET() {
    try {
        const user = await getUser();

        if (!user) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get current user's cluster
        const { data: myCluster, error: clusterError } = await supabase
            .from("user_clusters")
            .select("cluster_id")
            .eq("username", user.username)
            .single();

        if (clusterError) {
            console.error("Cluster lookup failed:", clusterError);
            return NextResponse.json({ message: "Cluster lookup failed" }, { status: 500 });
        }
        if (!myCluster) {
            return NextResponse.json({ message: "Cluster not found" }, { status:200});
        }

        // Fetch people from the same cluster
        const { data: people, error: peopleError } = await supabase
            .from("user_clusters")
            .select("username")
            .eq("cluster_id", myCluster.cluster_id)
            .neq("username", user.username)
            .order("username")
            .limit(50);

        if (peopleError) {
            throw peopleError;
        }

        return NextResponse.json({
            cluster_id: myCluster.cluster_id,
            people: people || []
        });

    } catch (error) {
        console.error("FindPeople API:", error);

        return NextResponse.json(
            { message: "Internal Server Error" },
            { status: 500 }
        );
    }
}

