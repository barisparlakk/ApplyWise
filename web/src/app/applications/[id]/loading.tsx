export default function ApplicationDetailLoading() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <div className="rounded-md border border-border bg-white p-5">
              <div className="h-5 w-28 rounded-md bg-muted" />
              <div className="mt-4 h-9 w-72 rounded-md bg-muted" />
              <div className="mt-3 h-4 w-44 rounded-md bg-muted" />
            </div>
            <div className="rounded-md border border-border bg-white p-5">
              <div className="h-5 w-36 rounded-md bg-muted" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div className="h-16 rounded-md bg-muted" key={item} />
                ))}
              </div>
              <div className="mt-4 h-40 rounded-md bg-muted" />
            </div>
          </section>
          <aside className="space-y-6">
            <div className="rounded-md border border-border bg-white p-5">
              <div className="h-5 w-36 rounded-md bg-muted" />
              <div className="mt-5 h-36 rounded-md bg-muted" />
            </div>
            <div className="rounded-md border border-border bg-white p-5">
              <div className="h-5 w-32 rounded-md bg-muted" />
              <div className="mt-5 h-24 rounded-md bg-muted" />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
