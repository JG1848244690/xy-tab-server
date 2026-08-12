import { createRouter } from '../../lib/create-app.js';
import * as handlers from './sync.handlers.js';
import * as routes from './sync.routes.js';

// 中间件 bearerAuth 在 src/app.ts 按路径应用:
//   app.use('/sync/bookmarks', bearerAuth())
//   app.use('/sync/sessions', bearerAuth())

const router = createRouter()
    .openapi(routes.getBookmarks, handlers.getBookmarks)
    .openapi(routes.putBookmarks, handlers.putBookmarks)
    .openapi(routes.getSessions, handlers.getSessions)
    .openapi(routes.putSessions, handlers.putSessions);

export default router;
