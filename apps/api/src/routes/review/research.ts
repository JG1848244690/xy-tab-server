/**
 * 联网检索工具(占位,2026-10-27)
 *
 * 出题 agent 在"事实核查"阶段会判断 needsResearch;如果这里注册了工具,
 * 就把 researchQueries 交给它检索,并把结果作为【检索资料】传给终稿。
 *
 * 目前不接入任何搜索(用户:搜索 tool 后续再补)。等接入时,只需在应用启动时:
 *
 *   setResearchTool(async (queries) => {
 *       // 调 Tavily / Brave / Serper / 自建搜索...
 *       return { notes: [...], sources: [{ title, url }] }
 *   })
 *
 * 约定:工具失败返回 null(agent 会退化为"提示人工核实"),不要抛错。
 */

export interface ResearchSource {
    title: string
    url: string
}

export interface ResearchNotes {
    /** 可直接引用的事实要点(每条一句话) */
    notes: string[]
    sources: ResearchSource[]
}

export type ResearchTool = (queries: string[]) => Promise<ResearchNotes | null>

let tool: ResearchTool | null = null

/** 注册/卸载搜索工具(应用启动时调用;测试可置 null) */
export function setResearchTool(next: ResearchTool | null): void {
    tool = next
}

export function hasResearchTool(): boolean {
    return tool !== null
}

/** agent 用:没工具/没查询/工具失败都返回 null,不阻断出题 */
export async function runResearch(queries: string[]): Promise<ResearchNotes | null> {
    if (!tool || queries.length === 0) return null
    try {
        return await tool(queries)
    } catch {
        return null
    }
}
