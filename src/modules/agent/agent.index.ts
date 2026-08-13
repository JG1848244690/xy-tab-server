/**
 * Agent 路由出口
 *
 * 鉴权在 src/app.ts 配:
 *   app.use('/sync/agent/chat', bearerAuth())
 */

import { createRouter } from '../../lib/create-app.js'
import * as handlers from './agent.handlers.js'
import * as routes from './agent.routes.js'

const router = createRouter()
  .openapi(routes.chat, handlers.chat)

export default router