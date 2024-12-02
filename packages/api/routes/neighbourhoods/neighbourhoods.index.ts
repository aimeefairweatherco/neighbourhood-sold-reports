import { createRouter } from "@/lib/create-app.ts";

import * as handlers from "./neighbourhoods.handlers.ts";
import * as routes from "./neighbourhoods.routes.ts";

const router = createRouter()
   .openapi(routes.list, handlers.list)
   .openapi(routes.getOne, handlers.getOne);

export default router;
