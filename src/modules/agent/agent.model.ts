/**
 * deepagents + Minimax (Anthropic-兼容网关) 模型工厂
 *
 * 见 docs/a社接入tokenplan.md:
 *   baseURL  = https://api.minimaxi.com/anthropic
 *   model    = MiniMax-M3
 *   env      = ANTHROPIC_API_KEY (我们命名为 MINIMAX_API_KEY 更直白)
 *
 * 懒加载:第一次请求时才建模型,避免 MINIMAX_API_KEY 缺失时 import 阶段就崩。
 */

import { ChatAnthropic } from '@langchain/anthropic'
import { createDeepAgent } from 'deepagents'
import env from '../../env.js'

const MiniMax_BASE_URL = 'https://api.minimaxi.com/anthropic'
const MiniMax_MODEL = 'MiniMax-M3'

export interface AgentBundle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any
  model: ChatAnthropic
}

let _bundle: AgentBundle | null = null

export function getAgent(): AgentBundle {
  if (_bundle) return _bundle

  if (!env.MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY not configured — /sync/agent/* disabled')
  }

  const model = new ChatAnthropic({
    model: MiniMax_MODEL,
    apiKey: env.MINIMAX_API_KEY,
    anthropicApiUrl: MiniMax_BASE_URL,
    // stream 时控制单次增量,避免一次性把整段返回
    streaming: true,
    temperature: 0.7,
  })

  const agent = createDeepAgent({
    model,
    systemPrompt:
      '你是 xy-tab 的助理。用户用浏览器扩展连上来,主要帮整理任务、查询同步状态。' +
      '回答简洁,中文优先,涉及代码时给示例。',
  })

  _bundle = { agent, model }
  return _bundle
}