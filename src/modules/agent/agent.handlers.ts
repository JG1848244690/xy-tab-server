/**
 * Agent handlers
 *
 * streamEvents() 输出三类事件,转发成 SSE:
 *   on_chat_model_stream   → event: token
 *   on_tool_start          → event: tool
 *   on_chain_end (顶层)    → event: done
 *
 * 失败统一发 event: error,然后关闭流。
 */

import { HumanMessage } from '@langchain/core/messages'
import { HttpStatusCodes } from '../../lib/openapi.js'
import { streamSSE } from 'hono/streaming'
import type { AppRouteHandler } from '../../lib/types.js'
import { getAgent } from './agent.model.js'
import type { ChatRoute } from './agent.routes.js'

export const chat: AppRouteHandler<ChatRoute> = async (c) => {
  const { message } = c.req.valid('json')
  const userId = c.get('userId') // bearerAuth 注入

  let bundle
  try {
    bundle = getAgent()
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'agent not configured' },
      HttpStatusCodes.SERVICE_UNAVAILABLE,
    )
  }

  return streamSSE(c, async (stream) => {
    const send = (event: string, data: unknown) =>
      stream.writeSSE({ event, data: JSON.stringify(data) })

    try {
      await send('start', { userId })

      const streamIter = await bundle.agent.streamEvents(
        { messages: [new HumanMessage(message)] },
        { version: 'v2' },
      )

      for await (const ev of streamIter) {
        if (ev.event === 'on_chat_model_stream') {
          const chunk = ev.data?.chunk
          // Anthropic 的增量通常是 AIMessageChunk,content 是字符串或数组
          const text =
            typeof chunk?.content === 'string'
              ? chunk.content
              : Array.isArray(chunk?.content)
                ? chunk.content
                  .filter((b: { type?: string }) => b.type === 'text' || b.type === 'text_delta')
                  .map((b: { text?: string }) => b.text ?? '')
                  .join('')
                : ''
          if (text) await send('token', { text })
        } else if (ev.event === 'on_tool_start') {
          await send('tool', {
            name: ev.name ?? 'tool',
            input: ev.data?.input,
          })
        }
      }

      await send('done', {})
    } catch (err) {
      await send('error', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })
}