import Link from "next/link";

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="w-full bg-black border-t border-t-white text-gray-400 px-2 py-2">
            <div className="flex flex-row gap-1 justify-between items-center">
                {/* Brand */}
                <div className="pix flex flex-col justify-center items-center w-25">
                    <div className="text-[30px] text-white">MK</div>
                    <div className="text-[4px]">Match It Up!</div>
                </div>

            <div className="flex flex-row flex-wrap gap-2 justify-center pix">
                {/* Resources */}
                <div className="flex flex-col gap-2 text-[8px]">
                    <h3 className="text-white pix">Resources</h3>
                    <Link href="/docs" className="hover:text-white text-[5px]">Documentation</Link>
                    <Link href="/report-issue" className="hover:text-white text-[5px]">
                        Report an Issue
                    </Link>
                </div>

                 <div className="flex flex-col gap-2 text-[8px]">
                    <h3 className="text-white pix">Connect</h3>
                    <a href="mailto:matchkaro.official@gmail.com" className="hover:text-white text-[5px]">Email Us</a>
                 </div>

                {/* Legal */}
                <div className="flex flex-col gap-2 text-[8px]">
                    <h3 className="text-white pix">Legal</h3>
                    <Link href="/terms" className="hover:text-white text-[5px]">Terms and Conditions</Link>
                    <Link href="/privacy" className="hover:text-white text-[5px]">Privacy Policy</Link>
                </div>
            </div>



            </div>

            <div className=" pix max-w-6xl mx-auto mt-6 pt-4 border-t border-gray-800 text-center text-[8px]">
                © {year} MatchKaro.
            </div>
        </footer>
    );
}