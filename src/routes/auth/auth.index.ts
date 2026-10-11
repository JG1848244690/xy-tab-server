import { createRouter } from '../../lib/create-app.js';
import * as handlers from './auth.handlers.js';
import * as routes from './auth.routes.js';

// 中间件 bearerAuth 在 src/app.ts 按路径应用:
//   app.use('/sync/auth/logout', bearerAuth())
//   app.use('/sync/auth/me', bearerAuth())
// 这里 router 只负责 openapi 定义

const router = createRouter()
    .openapi(routes.googleLogin, handlers.googleLogin)
    .openapi(routes.logout, handlers.logout)
    .openapi(routes.me, handlers.me);

export default router;
