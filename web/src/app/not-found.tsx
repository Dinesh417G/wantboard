import { Aurora } from "@/components/chrome";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="relative overflow-hidden">
      <Aurora />
      <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="num text-7xl font-semibold text-gradient">404</div>
        <h1 className="mt-4 text-2xl font-semibold">This deal room doesn&apos;t exist</h1>
        <p className="mt-2 text-muted">The link may be old, or the request was removed.</p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/board">Open the live board</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
