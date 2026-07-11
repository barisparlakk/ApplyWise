import { BrandMark } from "@/components/brand";

export default function OnboardingLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#101318] text-white">
      <div className="flex flex-col items-center">
        <BrandMark animated className="h-14 w-14" />
        <p className="mt-4 text-sm font-semibold text-white/64">Preparing your workspace</p>
      </div>
    </main>
  );
}
