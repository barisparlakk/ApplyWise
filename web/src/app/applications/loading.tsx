export default function ApplicationsLoading() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="h-5 w-32 rounded-md bg-muted" />
        <div className="mt-3 h-9 w-72 rounded-md bg-muted" />
        <div className="mt-8 rounded-md border border-border bg-white p-5">
          <div className="h-5 w-24 rounded-md bg-muted" />
          <div className="mt-5 space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div className="grid gap-3 sm:grid-cols-4" key={item}>
                <div className="h-10 rounded-md bg-muted" />
                <div className="h-10 rounded-md bg-muted" />
                <div className="h-10 rounded-md bg-muted" />
                <div className="h-10 rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 grid gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div className="rounded-md border border-border bg-white p-4" key={item}>
              <div className="h-5 w-28 rounded-md bg-muted" />
              <div className="mt-5 h-28 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
