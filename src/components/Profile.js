"use client";
import { DropdownMenu } from "radix-ui";
import { useRouter } from "next/navigation";

export default function Profile({ onEdit, onLogout }) {
  const router = useRouter();
  const item =
    "px-2 py-1 rounded-sm cursor-pointer outline-none text-white data-[highlighted]:bg-purple-500";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="rounded-full bg-white w-[30px] h-[30px] text-white text-[12px] outline-none">
          <img src="/default_pfp.png" alt="Profile" className="w-full h-full rounded-full object-cover border border-1" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[100] min-w-32 rounded bg-black text-[7px] p-1 border border-white/60 pix"
        >
          <DropdownMenu.Item className={item} onSelect={() => router.push("/profile/view")}>
            View Profile
          </DropdownMenu.Item>

          <DropdownMenu.Item className={item} onSelect={()=>router.push("/profile/edit")}>
            Edit Profile
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-purple-500/40 my-1" />

          <DropdownMenu.Item
            className="px-2 py-1 rounded-sm cursor-pointer outline-none bg-red-500 text-white data-[highlighted]:bg-red-600"
            onSelect={onLogout}
          >
            Log Out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}