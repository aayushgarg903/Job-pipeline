// Static page-level fallback. Every page wraps its locale/data-bound body in
// <Suspense fallback={<PageSkeleton />}> so client navigations stay instant under
// Cache Components (the layout's boundary sits above the navigation scope).
import { SkeletonCard, type CardVariant } from "@ks/ui";

export function PageSkeleton({ cards = 3, variant = "district" }: { cards?: number; variant?: CardVariant }) {
  return (
    <div className="ks-card-grid" aria-busy="true">
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} variant={variant} label={i === 0 ? "Loading · उघडत आहे" : undefined} />
      ))}
    </div>
  );
}
