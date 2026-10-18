import { createRouter } from '../../lib/create-app.js';
import * as handlers from './auth.handlers.js';
import * as routes from './auth.routes.js';
// cookieAuth 中间件在 src/app.ts 按路径应用(只保护 /auth/me)
const router = createRouter()
    .openapi(routes.login, handlers.login)
    .openapi(routes.register, handlers.register)
    .openapi(routes.logout, handlers.logout)
    .openapi(routes.me, handlers.me);
export default router;
