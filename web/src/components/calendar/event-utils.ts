// 生成唯一 ID
export function generateEventId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
