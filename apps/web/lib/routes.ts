// Route builders for every product page, so links are consistent across agents.
// Pages that don't exist yet are built by the product-page agents.
export const routes = {
  home: () => "/",
  state: () => "/state",
  district: (lgd: string) => `/districts/${encodeURIComponent(lgd)}`,
  skill: (id: string) => `/skills/${encodeURIComponent(id)}`,
  course: (id: string) => `/courses/${encodeURIComponent(id)}`,
  plan: (lgd: string, fy: string) => `/plans/${encodeURIComponent(lgd)}/${encodeURIComponent(fy)}`,
  radar: () => "/radar",
  employer: () => "/employer",
  me: () => "/me",
  review: () => "/review",
  sources: () => "/sources",
  outcomes: () => "/outcomes",
  accessibility: () => "/accessibility",
  feedback: () => "/feedback",
  lastUpdated: () => "/last-updated",
  gallery: () => "/dev/cards",
} as const;

/** Templates for client components that take "{param}" patterns (DataTable rowHref, Choropleth). */
export const routeTemplates = {
  district: "/districts/{lgd}",
  skill: "/skills/{id}",
  course: "/courses/{id}",
} as const;
