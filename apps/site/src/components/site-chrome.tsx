import Link from 'next/link'
import { SITE_NAME } from '@/lib/site-api'

/** 页脚:备案号优先取 env,未配置时用主域备案号兜底 */
export function SiteFooter() {
    const icp = process.env.NEXT_PUBLIC_ICP || '晋ICP备2026005328号'
    return (
        <footer className="mt-24 border-t border-border py-8 text-[12px] text-muted-foreground">
            <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-3 px-5 sm:flex-row sm:items-baseline sm:px-6">
                <span className="font-serif text-[13px] text-foreground">
                    {SITE_NAME} · 由社区共同维护
                </span>
                <span className="flex items-baseline gap-4">
                    <span>© {new Date().getFullYear()}</span>
                    <a
                        href="https://beian.miit.gov.cn/"
                        target="_blank"
                        rel="nofollow noopener"
                        className="hover:text-accent"
                    >
                        {icp}
                    </a>
                    <a href="/rss.xml" className="hover:text-accent">RSS</a>
                    <a href="/llms.txt" className="hover:text-accent">llms.txt</a>
                </span>
            </div>
        </footer>
    )
}
