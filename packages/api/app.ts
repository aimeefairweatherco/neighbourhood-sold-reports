import configureOpenAPI from "@/lib/openapi-config.ts";
import createApp from "@/lib/create-app.ts";
import index from "@/routes/index.route.ts";
import neighbourhoods from "@/routes/neighbourhoods/neighbourhoods.index.ts";

const app = createApp();

configureOpenAPI(app);

const routes = [
   index,
   neighbourhoods,
] as const;

routes.forEach((route) => {
   app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
