/**
 * Agent 路由定义 —— 流式对话
 *
 *   POST /sync/agent/chat   Bearer 鉴权;body { message }
 *                          返回 text/event-stream(SSE):
 *                            event: token   data: {"text":"..."}
 *                            event: tool    data: {"name":"...","input":{...}}
 *                            event: done    data: {}
 *                            event: error   data: {"message":"..."}
 *
 * 鉴权:app.ts 里 app.use('/sync/agent/chat', bearerAuth())
 */

import { createRoute, z } from '@hono/zod-openapi'
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '../../lib/openapi.js'

const tags = ['Sync Agent']

export const chat = createRoute({
  path: '/sync/agent/chat',
  method: 'post',
  tags,
  // TODO(feat/deepagent): 测完记得加回来 security: [{ Bearer: [] }]
  security: [],
  request: {
    body: jsonContentRequired(
      z.object({
        message: z.string().min(1).max(8000),
      }),
      '单轮对话输入',
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: 'SSE 流式响应',
      content: {
        'text/event-stream': {
          schema: z.string(),
        },
      },
    },
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
      z.object({ error: z.string() }),
      'MINIMAX_API_KEY 未配置',
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'invalid token',
    ),
  },
})

export type ChatRoute = typeof chat