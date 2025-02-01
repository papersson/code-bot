import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-2xl font-bold">Welcome</h1>
        
        <div className="flex flex-col gap-2 items-start">
          <Link href="/chat" className="underline text-blue-600 hover:text-blue-800">
            Go to Chat
          </Link>
          <Link href="/projects" className="underline text-blue-600 hover:text-blue-800">
            Go to Projects
          </Link>
          <Link href="/project-descriptions" className="underline text-blue-600 hover:text-blue-800">
            Go to Project Descriptions
          </Link>
        </div>
      </main>
    </div>
  );
}
