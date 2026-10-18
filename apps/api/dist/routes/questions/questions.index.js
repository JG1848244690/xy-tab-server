import { createRouter } from '../../lib/create-app.js';
import * as handlers from './questions.handlers.js';
import * as routes from './questions.routes.js';
// cookieAuth 中间件在 src/app.ts 按路径应用(/questions 与 /questions/*)
// 注意注册顺序:/questions/stats 必须排在 /questions/{id} 前面,
// 否则 {id} 会把 "stats" 当 uuid 校验掉。
const router = createRouter()
    .openapi(routes.list, handlers.list)
    .openapi(routes.getStats, handlers.getStats)
    .openapi(routes.create, handlers.create)
    .openapi(routes.getOne, handlers.getOne)
    .openapi(routes.update, handlers.update)
    .openapi(routes.remove, handlers.remove)
    .openapi(routes.submit, handlers.submit)
    .openapi(routes.markCorrect, handlers.markCorrect)
    .openapi(routes.getAttempts, handlers.getAttempts);
export default router;
