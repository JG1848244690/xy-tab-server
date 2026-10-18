import { createRouter } from '../../lib/create-app.js';
import * as handlers from './todos.handlers.js';
import * as routes from './todos.routes.js';
// cookieAuth 中间件在 src/app.ts 按路径应用(/todos 与 /todos/*)
const router = createRouter()
    .openapi(routes.getMonthStatus, handlers.getMonthStatus)
    .openapi(routes.getByDate, handlers.getByDate)
    .openapi(routes.getByMonth, handlers.getByMonth)
    .openapi(routes.create, handlers.create)
    .openapi(routes.update, handlers.update)
    .openapi(routes.remove, handlers.remove)
    .openapi(routes.toggle, handlers.toggle);
export default router;
