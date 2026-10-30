/**
 * 每次路由切换时重新挂载 → 给整页一次轻微上浮。
 *
 * 只动 opacity/transform,不动布局;动画本身由 globals.css 里的
 * `.page-enter` 提供,prefers-reduced-motion 下自动关闭。
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="page-enter">{children}</div>
}
